import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton, TabsSkeleton } from '@/components/admin/skeletons';

/** Contenido: título + 6 pestañas + botón de alta + tabla de la pestaña activa. */
export default function Loading() {
  return (
    <div>
      <Skeleton className='h-7 w-64 mb-6' />
      <TabsSkeleton count={6} />
      <div className='flex justify-end mb-4'>
        <Skeleton className='h-10 w-44 rounded-md' />
      </div>
      <TableSkeleton rows={5} />
    </div>
  );
}
