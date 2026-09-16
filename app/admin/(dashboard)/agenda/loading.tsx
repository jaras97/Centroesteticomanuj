import { Skeleton } from '@/components/ui/skeleton';
import { PageTitleSkeleton } from '@/components/admin/skeletons';

/** Agenda: título + barra de herramientas del calendario + grilla. */
export default function Loading() {
  return (
    <div>
      <PageTitleSkeleton />
      <div className='rounded-lg border bg-white p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-9 w-9 rounded-md' />
            <Skeleton className='h-9 w-9 rounded-md' />
            <Skeleton className='h-5 w-40' />
          </div>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-9 w-20 rounded-md' />
            <Skeleton className='h-9 w-20 rounded-md' />
            <Skeleton className='h-9 w-20 rounded-md' />
          </div>
        </div>
        {/* Grilla semanal: fila de días + cuerpo alto, para no saltar cuando
            FullCalendar toma su lugar. */}
        <div className='grid grid-cols-7 gap-px mb-px'>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className='h-8 rounded-none' />
          ))}
        </div>
        <Skeleton className='h-[520px] w-full rounded-none' />
      </div>
    </div>
  );
}
