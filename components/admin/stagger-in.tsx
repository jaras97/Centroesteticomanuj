'use client';

import { Children, isValidElement, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '@/lib/constants';

/**
 * Entrada escalonada para filas de tarjetas del panel.
 *
 * Recibe los hijos ya renderizados en el servidor (no recibe componentes como
 * prop, que no cruzan la frontera server/client) y solo los envuelve. Muy
 * corta a propósito: esto es una herramienta de trabajo diaria, una animación
 * larga en cada carga se vuelve insoportable. Se respeta
 * `prefers-reduced-motion`.
 */
export default function StaggerIn({
  children,
  className,
  delayStep = 0.035,
}: {
  children: ReactNode;
  className?: string;
  delayStep?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <div className={className}>{children}</div>;

  return (
    <div className={className}>
      {Children.toArray(children).map((child, index) => (
        <motion.div
          key={isValidElement(child) && child.key ? child.key : index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT, delay: index * delayStep }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
