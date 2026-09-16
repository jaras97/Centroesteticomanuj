'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '@/lib/constants';

/**
 * Barra de progreso superior para las navegaciones del panel.
 *
 * Cada página del admin es un Server Component que consulta Supabase, así que
 * entre el clic y el render pasa un rato en el que no se veía absolutamente
 * nada. Esto da esa señal.
 *
 * Por qué se escucha el clic a nivel de documento en vez de instrumentar los
 * links: `usePathname()` solo cambia cuando la navegación YA se comprometió
 * (demasiado tarde para avisar que está cargando), y `useLinkStatus` de Next
 * llegó en 15.3 — este proyecto está en 15.2. Escuchando el clic en fase de
 * captura, la barra funciona para cualquier <Link> del panel (nav, footer,
 * tablas, paginación) sin tocar ninguno de esos componentes.
 *
 * El fin de la navegación se detecta comparando la URL real del navegador con
 * la URL destino: `pathname` solo no alcanza, porque hay navegaciones que solo
 * cambian el query string (mes en Finanzas, página en Clientes).
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  // `navigating` = hay una navegación en curso; `visible` = la barra ya se
  // pintó. Se separan para no hacer parpadear la barra en las rutas que
  // resuelven al instante (prefetch caliente).
  const [navigating, setNavigating] = useState(false);
  const [visible, setVisible] = useState(false);
  const targetRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    targetRef.current = null;
    setNavigating(false);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const destination = url.pathname + url.search;
      // Mismo destino (o solo cambia el hash): no hay carga que esperar.
      if (destination === window.location.pathname + window.location.search) return;

      targetRef.current = destination;
      setNavigating(true);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Vigilancia del fin de la navegación + red de seguridad por si algo falla
  // (una navegación abortada dejaría la barra colgada para siempre).
  useEffect(() => {
    if (!navigating) {
      setVisible(false);
      return;
    }

    const show = window.setTimeout(() => setVisible(true), 120);
    const interval = window.setInterval(() => {
      if (window.location.pathname + window.location.search === targetRef.current) stop();
    }, 100);
    const timeout = window.setTimeout(stop, 10000);

    return () => {
      window.clearTimeout(show);
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [navigating, stop]);

  // Si la ruta cambió, la navegación terminó pase lo que pase.
  useEffect(() => {
    stop();
  }, [pathname, stop]);

  return (
    // El hijo directo de AnimatePresence tiene que ser el propio motion
    // component, si no la animación de salida nunca se ejecuta.
    <AnimatePresence>
      {visible && (
        <motion.div
          key='route-progress'
          role='progressbar'
          aria-label='Cargando página'
          className='fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-brand-teal'
          initial={{ scaleX: prefersReducedMotion ? 1 : 0, opacity: 1 }}
          animate={{ scaleX: prefersReducedMotion ? 1 : 0.9 }}
          exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.25, ease: EASE_OUT } }}
          transition={{ duration: prefersReducedMotion ? 0 : 1.4, ease: EASE_OUT }}
        />
      )}
    </AnimatePresence>
  );
}
