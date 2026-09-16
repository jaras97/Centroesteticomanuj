import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Piezas compartidas por los `loading.tsx` del panel. Cada esqueleto debe
 * imitar la forma real de su página (mismos altos, mismas columnas) para que
 * al llegar el contenido no se note un salto de layout.
 */

/** Título de página: icono + texto, mismas medidas que `h1 text-2xl`. */
export function PageTitleSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className='flex items-center justify-between gap-3 mb-6'>
      <div className='flex items-center gap-2'>
        <Skeleton className='h-6 w-6 rounded' />
        <Skeleton className='h-7 w-48' />
      </div>
      {action && <Skeleton className='h-10 w-36 rounded-md' />}
    </div>
  );
}

/** Fila de tarjetas de resumen (SummaryCard). */
export function SummaryCardsSkeleton({
  count = 3,
  className = 'grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className='p-5 flex items-start justify-between gap-3'>
            <div className='space-y-2'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-8 w-20' />
            </div>
            <Skeleton className='h-5 w-5 rounded' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Tabla dentro de una tarjeta: encabezado + n filas. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className='rounded-lg border bg-white'>
      <div className='border-b px-4 py-3'>
        <Skeleton className='h-4 w-1/3' />
      </div>
      <div className='divide-y'>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className='flex items-center gap-4 px-4 py-4'>
            <Skeleton className='h-4 w-1/3' />
            <Skeleton className='h-4 w-1/5' />
            <Skeleton className='hidden sm:block h-4 w-1/5' />
            <Skeleton className='ml-auto h-8 w-16 rounded-md' />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista de pestañas (TabsList) con n disparadores. */
export function TabsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className='inline-flex h-10 items-center gap-1 rounded-md bg-muted p-1 mb-4'>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className='h-8 w-24 rounded-sm' />
      ))}
    </div>
  );
}
