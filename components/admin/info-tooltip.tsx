'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Icono de ayuda con una explicación corta. Se usa sobre todo en Finanzas,
 * donde la diferencia entre "utilidad", "caja" y "retirado" es justo lo que
 * hay que explicar en una línea.
 *
 * El estado `open` es controlado a propósito: el hover de Radix no existe en
 * un celular, y Finanzas se usa mucho desde el celular. Con `onClick` el
 * mismo icono funciona con dedo y con mouse.
 *
 * El `preventDefault()` del clic no es decorativo: `TooltipTrigger` compone su
 * propio `onClick` (que CIERRA el tooltip) después del nuestro, y solo lo
 * omite si el evento quedó con `defaultPrevented`. Sin él, abrir y cerrar
 * ocurrían en el mismo tick y en un celular —donde no hay hover— el tooltip
 * no se abría nunca.
 */
export default function InfoTooltip({
  text,
  label = 'Más información',
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type='button'
            aria-label={label}
            onClick={(event) => {
              event.preventDefault();
              setOpen((v) => !v);
            }}
            // -m-2 p-2: el icono mide 14px y solo, como blanco táctil, es
            // inalcanzable con el dedo. El padding lo lleva a 30px sin
            // mover nada de sitio (el margen negativo compensa).
            className='-m-2 shrink-0 rounded-full p-2 text-gray-500 transition-colors hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2'
          >
            <Info className='h-3.5 w-3.5' />
          </button>
        </TooltipTrigger>
        <TooltipContent className='max-w-[15rem] text-balance font-normal leading-snug'>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
