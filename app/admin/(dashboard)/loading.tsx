import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTitleSkeleton, SummaryCardsSkeleton } from '@/components/admin/skeletons';

/** Bandeja: título + 3 tarjetas de resumen + solicitudes / cumpleaños. */
export default function Loading() {
  return (
    <div>
      <PageTitleSkeleton />
      <SummaryCardsSkeleton count={3} />

      <div className='grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start'>
        <div className='space-y-4'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className='p-5 space-y-3'>
                <div className='flex items-center justify-between gap-3'>
                  <Skeleton className='h-5 w-40' />
                  <Skeleton className='h-5 w-24 rounded-full' />
                </div>
                <Skeleton className='h-4 w-2/3' />
                <Skeleton className='h-4 w-1/2' />
                <div className='flex flex-wrap gap-2 pt-2'>
                  <Skeleton className='h-9 w-28 rounded-md' />
                  <Skeleton className='h-9 w-28 rounded-md' />
                  <Skeleton className='h-9 w-24 rounded-md' />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className='p-5 space-y-4'>
            <Skeleton className='h-5 w-44' />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='flex items-center justify-between gap-3'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-4 w-16' />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
