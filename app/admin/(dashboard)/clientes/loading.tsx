import { Skeleton } from '@/components/ui/skeleton';
import { PageTitleSkeleton, TableSkeleton } from '@/components/admin/skeletons';

/** Clientes: título + "Nuevo cliente", buscador, tabla y paginación. */
export default function Loading() {
  return (
    <div>
      <PageTitleSkeleton action />
      <div className='mb-4'>
        <Skeleton className='h-10 w-full sm:max-w-sm rounded-md' />
      </div>
      <TableSkeleton rows={8} />
      <div className='flex items-center justify-between gap-3 mt-4'>
        <Skeleton className='h-4 w-48' />
        <div className='flex items-center gap-2'>
          <Skeleton className='h-9 w-24 rounded-md' />
          <Skeleton className='h-9 w-24 rounded-md' />
        </div>
      </div>
    </div>
  );
}
