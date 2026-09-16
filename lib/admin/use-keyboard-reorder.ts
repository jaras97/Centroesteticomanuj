'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { toast } from 'sonner';

/**
 * Lógica compartida por las 6 listas ordenables del panel (diapositivas,
 * categorías de servicio, imágenes de galería, secciones del inicio, cuentas
 * y categorías de gasto).
 *
 * Qué resuelve, además de lo que ya hacía cada tabla por su cuenta:
 *
 * 1. **Teclado.** El handle de `Reorder.Item` solo escucha el puntero, así que
 *    sin mouse no había forma de reordenar nada. Acá el handle es un `button`
 *    enfocable que mueve la fila con ↑/↓ (e Inicio/Fin a los extremos).
 * 2. **Foco pegado a la fila.** Al reordenar, React mueve el nodo en el DOM y
 *    el navegador suelta el foco; sin devolverlo sería imposible mover algo
 *    dos posiciones seguidas. Se reenfoca el mismo handle después del commit.
 * 3. **Anuncio a lectores de pantalla.** Una sola región `aria-live="polite"`
 *    por lista (ver `ReorderAnnouncer` en `components/admin/reorder-handle.tsx`).
 * 4. **Una sola escritura.** Mantener la flecha apretada dispara una pulsación
 *    por repetición del teclado; si cada una persistiera, mover algo 5 lugares
 *    serían 5 `update` de toda la lista. Se guarda con debounce y se fuerza el
 *    envío al perder el foco, al soltar el arrastre y al desmontar.
 *
 * El estado del orden vive acá (antes era un `useState` + `useEffect` repetido
 * en cada tabla): el padre es un Server Component que reenvía props frescas
 * después de cada `revalidatePath`, y el arrastre ya actualizó este estado de
 * forma optimista, así que sincronizar no produce parpadeo.
 */

/** Cuánto se espera después de la última flecha antes de escribir en el servidor. */
const PERSIST_DELAY_MS = 700;

export const REORDER_INSTRUCTIONS =
  'Con el botón de reordenar enfocado: flecha arriba y flecha abajo mueven la fila un lugar, Inicio la lleva al principio y Fin al final. El nuevo orden se guarda solo.';

/** Props de accesibilidad que la lista le pasa al handle de cada fila. */
export interface ReorderHandleProps {
  'aria-label': string;
  'aria-describedby': string;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onBlur: () => void;
  registerRef: (node: HTMLButtonElement | null) => void;
}

/** Props de la región `aria-live` + el texto de instrucciones (uno por lista). */
export interface ReorderAnnouncerProps {
  instructionsId: string;
  instructions: string;
  announcement: string;
}

type ReorderActionResult = { ok: boolean; error?: string };

interface Options<T> {
  /** Filas que llegan del servidor, ya ordenadas por `display_order`. */
  items: T[];
  /** Cómo nombrar la fila en el anuncio y en el `aria-label` ("Limpieza facial"). */
  getLabel: (item: T) => string;
  /** Sustantivo con artículo para el `aria-label` ("la diapositiva"). */
  itemNoun: string;
  /** El Server Action `reorder*`, que recibe el orden completo (no swaps). */
  persist: (orderedIds: string[]) => Promise<ReorderActionResult>;
}

export function useKeyboardReorder<T extends { id: string }>({
  items: itemsProp,
  getLabel,
  itemNoun,
  persist,
}: Options<T>) {
  const [items, setItems] = useState(itemsProp);
  const [announcement, setAnnouncement] = useState('');
  const instructionsId = useId();

  // El orden vigente, leído/escrito de forma síncrona dentro de los handlers:
  // con la flecha mantenida llegan varias pulsaciones antes de que React
  // re-renderice, y leer `items` daría un orden viejo.
  const orderRef = useRef(itemsProp);
  // Último orden confirmado por el servidor, para revertir si falla el guardado.
  const serverOrderRef = useRef(itemsProp);
  const pendingIdsRef = useRef<string[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlesRef = useRef(new Map<string, HTMLButtonElement>());
  const refocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    orderRef.current = items;
  }, [items]);

  useEffect(() => {
    serverOrderRef.current = itemsProp;
    // Si hay un movimiento por teclado sin guardar, las props todavía traen el
    // orden viejo: pisarlas revertiría lo que el usuario acaba de hacer.
    if (pendingIdsRef.current) return;
    setItems(itemsProp);
    orderRef.current = itemsProp;
  }, [itemsProp]);

  // Devolverle el foco al handle que se movió, después de que React recolocó
  // la fila en el DOM.
  useEffect(() => {
    const id = refocusIdRef.current;
    if (!id) return;
    refocusIdRef.current = null;
    handlesRef.current.get(id)?.focus();
  }, [items]);

  function flush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const orderedIds = pendingIdsRef.current;
    if (!orderedIds) return;
    pendingIdsRef.current = null;

    persist(orderedIds).then((result) => {
      if (result.ok) return;
      toast.error(result.error ?? 'No se pudo reordenar.');
      setItems(serverOrderRef.current);
      orderRef.current = serverOrderRef.current;
    });
  }

  // `flush` se recrea en cada render (captura `persist`); los efectos y los
  // timers usan siempre la última versión a través de esta referencia.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  // Si la lista se desmonta (navegar a otra pantalla) con un movimiento sin
  // guardar, se guarda igual: perder el reordenamiento sería peor.
  useEffect(() => () => flushRef.current(), []);

  function schedulePersist(nextOrder: T[]) {
    pendingIdsRef.current = nextOrder.map((item) => item.id);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushRef.current();
    }, PERSIST_DELAY_MS);
  }

  function move(id: string, to: 'up' | 'down' | 'first' | 'last') {
    const current = orderRef.current;
    const from = current.findIndex((item) => item.id === id);
    if (from === -1) return;

    const lastIndex = current.length - 1;
    const target =
      to === 'up' ? from - 1 : to === 'down' ? from + 1 : to === 'first' ? 0 : lastIndex;
    const item = current[from];
    const label = getLabel(item);

    if (target < 0 || target > lastIndex || target === from) {
      setAnnouncement(
        from === 0
          ? `${label} ya está en la primera posición.`
          : `${label} ya está en la última posición.`,
      );
      return;
    }

    const next = [...current];
    next.splice(from, 1);
    next.splice(target, 0, item);

    orderRef.current = next;
    setItems(next);
    refocusIdRef.current = id;
    setAnnouncement(`${label} movido a la posición ${target + 1} de ${next.length}.`);
    schedulePersist(next);
  }

  function getHandleProps(item: T, index: number): ReorderHandleProps {
    return {
      'aria-label': `Reordenar ${itemNoun} ${getLabel(item)}. Posición ${index + 1} de ${items.length}. Arrástralo, o muévelo con las flechas arriba y abajo.`,
      'aria-describedby': instructionsId,
      onKeyDown: (event) => {
        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault();
            move(item.id, 'up');
            break;
          case 'ArrowDown':
            event.preventDefault();
            move(item.id, 'down');
            break;
          case 'Home':
            event.preventDefault();
            move(item.id, 'first');
            break;
          case 'End':
            event.preventDefault();
            move(item.id, 'last');
            break;
          default:
            break;
        }
      },
      onBlur: () => {
        // Al reordenar, el navegador dispara `blur` porque el nodo se mueve en
        // el DOM; no es una salida real, el foco vuelve al mismo handle.
        if (refocusIdRef.current) return;
        // Segundo resguardo: se comprueba después de que el foco se asentó.
        setTimeout(() => {
          const handle = handlesRef.current.get(item.id);
          if (handle && document.activeElement === handle) return;
          flushRef.current();
        }, 0);
      },
      registerRef: (node) => {
        if (node) handlesRef.current.set(item.id, node);
        else handlesRef.current.delete(item.id);
      },
    };
  }

  /** Al soltar el arrastre se guarda de una, sin esperar el debounce. */
  function onDragEnd() {
    pendingIdsRef.current = orderRef.current.map((item) => item.id);
    flush();
  }

  const announcer: ReorderAnnouncerProps = {
    instructionsId,
    instructions: REORDER_INSTRUCTIONS,
    announcement,
  };

  return { items, setItems, getHandleProps, onDragEnd, announcer };
}
