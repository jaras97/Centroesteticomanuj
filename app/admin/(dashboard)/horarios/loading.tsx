import { Skeleton } from '@/components/ui/skeleton';
import { PageTitleSkeleton } from '@/components/admin/skeletons';

/** Horarios: título + textos explicativos + 7 tarjetas de día. */
export default function Loading() {
  return (
    <div>
      <PageTitleSkeleton />
      <div className='space-y-2 mb-6'>
        <Skeleton className='h-4 w-full max-w-3xl' />
        <Skeleton className='h-4 w-full max-w-2xl' />
        <Skeleton className='h-4 w-full max-w-xl' />
      </div>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className='bg-white border rounded-lg p-4 space-y-3'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-8 w-full rounded-md' />
            <Skeleton className='h-8 w-full rounded-md' />
            <Skeleton className='h-8 w-32 rounded-md' />
          </div>
        ))}
      </div>
    </div>
  );
}
