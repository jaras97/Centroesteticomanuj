import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PageTitleSkeleton,
  SummaryCardsSkeleton,
  TabsSkeleton,
} from '@/components/admin/skeletons';

/** Finanzas: título + navegador de mes, pestañas, 4+3 tarjetas, gráfico y desglose. */
export default function Loading() {
  return (
    <div>
      <div className='flex items-center justify-between mb-6 flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-6 w-6 rounded' />
          <Skeleton className='h-7 w-40' />
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-10 w-10 rounded-md' />
          <Skeleton className='h-5 w-36' />
          <Skeleton className='h-10 w-10 rounded-md' />
        </div>
      </div>

      <TabsSkeleton count={2} />

      <SummaryCardsSkeleton
        count={4}
        className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'
      />
      <SummaryCardsSkeleton
        count={3}
        className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6'
      />

      <Card className='mb-6'>
        <CardHeader>
          <Skeleton className='h-5 w-40' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-64 w-full' />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className='h-5 w-52' />
        </CardHeader>
        <CardContent className='space-y-3'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center justify-between gap-4'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-4 w-24' />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
