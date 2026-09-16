import { Skeleton } from '@/components/ui/skeleton';

/** Reservar: encabezado + indicador de pasos + lista de servicios. */
export default function Loading() {
  return (
    <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
      <div className='flex flex-col items-center gap-3 mb-10'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='h-5 w-full max-w-md' />
      </div>

      <div className='flex items-center justify-center gap-4 mb-10'>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className='flex items-center gap-2'>
            <Skeleton className='h-7 w-7 rounded-full' />
            <Skeleton className='h-4 w-20' />
          </div>
        ))}
      </div>

      <div className='space-y-3'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='rounded-lg border bg-white p-4 space-y-2'>
            <div className='flex items-center justify-between gap-3'>
              <Skeleton className='h-5 w-44' />
              <Skeleton className='h-5 w-20' />
            </div>
            <Skeleton className='h-4 w-3/4' />
          </div>
        ))}
      </div>
    </div>
  );
}
