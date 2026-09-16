import { Skeleton } from '@/components/ui/skeleton';
import { PageTitleSkeleton } from '@/components/admin/skeletons';

/** Nueva cita: título + explicación + formulario de una columna. */
export default function Loading() {
  return (
    <div>
      <PageTitleSkeleton />
      <Skeleton className='h-4 w-full max-w-lg mb-6' />
      <div className='max-w-xl space-y-6'>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-10 w-full rounded-md' />
          </div>
        ))}
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-10 w-full rounded-md' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-10 w-full rounded-md' />
          </div>
        </div>
        <Skeleton className='h-10 w-full rounded-md' />
      </div>
    </div>
  );
}
