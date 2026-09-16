'use client';

import { GripVertical } from 'lucide-react';
import type { DragControls, TargetAndTransition, Transition } from 'framer-motion';
import type { ReorderAnnouncerProps, ReorderHandleProps } from '@/lib/admin/use-keyboard-reorder';

/**
 * Handle único de las 6 listas ordenables del panel. Arrastra con el puntero
 * (por eso no se escucha la fila entera: en móvil hay que poder scrollear y en
 * escritorio no puede pelearse con los botones de la fila) y **además** mueve
 * la fila con el teclado, con las props que arma `useKeyboardReorder`.
 *
 * El `-m-2 p-2` no es decorativo: agranda el área táctil sin correr el layout.
 */
export default function ReorderHandle({
  dragControls,
  registerRef,
  ...a11y
}: ReorderHandleProps & { dragControls: DragControls }) {
  return (
    <button
      type='button'
      tabIndex={0}
      ref={registerRef}
      onPointerDown={(event) => dragControls.start(event)}
      className='-m-2 shrink-0 cursor-grab touch-none p-2 text-gray-400 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 active:cursor-grabbing'
      {...a11y}
    >
      <GripVertical className='h-5 w-5' aria-hidden />
    </button>
  );
}

/**
 * Región `aria-live` + instrucciones de teclado de la lista. Va **una sola vez
 * por lista**, fuera del `Reorder.Group`: el `aria-live` tiene que existir en
 * el DOM antes de que cambie su texto para que el lector lo anuncie, y el
 * párrafo de instrucciones es el destino del `aria-describedby` de cada handle.
 */
export function ReorderAnnouncer({
  instructionsId,
  instructions,
  announcement,
}: ReorderAnnouncerProps) {
  return (
    <>
      <p id={instructionsId} className='sr-only'>
        {instructions}
      </p>
      <p aria-live='polite' className='sr-only'>
        {announcement}
      </p>
    </>
  );
}

/**
 * Movimiento del `Reorder.Item`, compartido por las 6 listas. Con
 * `prefers-reduced-motion` se cae el zoom al arrastrar y la fila cambia de
 * lugar sin animación (mover con el teclado repetidas veces, animado, marea).
 */
export function reorderItemMotion(reduceMotion: boolean | null): {
  whileDrag: TargetAndTransition;
  transition?: Transition;
} {
  const lifted: TargetAndTransition = { boxShadow: '0 8px 20px rgba(0,0,0,0.12)' };
  return reduceMotion
    ? { whileDrag: lifted, transition: { duration: 0 } }
    : { whileDrag: { ...lifted, scale: 1.01 } };
}
