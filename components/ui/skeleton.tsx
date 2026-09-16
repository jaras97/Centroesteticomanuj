import { cn } from '@/lib/utils';

/**
 * Bloque gris pulsante para los esqueletos de carga (loading.tsx).
 * La idea es que cada esqueleto imite la FORMA real de su página, para que
 * al llegar el contenido no haya salto de layout.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden='true'
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      {...props}
    />
  );
}

export default Skeleton;
