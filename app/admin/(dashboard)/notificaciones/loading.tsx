import { Skeleton } from '@/components/ui/skeleton';
import { TabsSkeleton } from '@/components/admin/skeletons';

/**
 * Notificaciones: título + 3 pestañas + el editor de plantillas (la activa
 * por defecto), que es una tarjeta de ajustes arriba y, debajo, el par
 * "formulario | vista previa" en dos columnas a partir de `lg`.
 */
export default function Loading() {
  return (
    <div>
      <Skeleton className='h-7 w-56 mb-6' />
      <TabsSkeleton count={3} />

      {/* Tarjeta de ajustes generales */}
      <div className='rounded-lg border bg-white p-6 mb-6 space-y-4'>
        <Skeleton className='h-5 w-48' />
        <div className='grid gap-4 sm:grid-cols-2'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-10 w-full rounded-md' />
            </div>
          ))}
        </div>
        <Skeleton className='h-10 w-36 rounded-md' />
      </div>

      {/* Editor de plantilla + vista previa */}
      <div className='grid gap-6 lg:grid-cols-2'>
        <div className='rounded-lg border bg-white p-6 space-y-4'>
          <Skeleton className='h-5 w-56' />
          <div className='flex flex-wrap gap-2'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-7 w-24 rounded-full' />
            ))}
          </div>
          <Skeleton className='h-10 w-full rounded-md' />
          <Skeleton className='h-48 w-full rounded-md' />
          <Skeleton className='h-10 w-32 rounded-md' />
        </div>
        <div className='rounded-lg border bg-white p-6 space-y-3'>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-[320px] w-full rounded-md' />
        </div>
      </div>
    </div>
  );
}
