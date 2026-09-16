import { Skeleton } from '@/components/ui/skeleton';

/** Ficha de cliente: volver + nombre/teléfono + historial (2/3) y datos (1/3). */
export default function Loading() {
  return (
    <div>
      <Skeleton className='h-4 w-24 mb-4' />
      <Skeleton className='h-7 w-56 mb-2' />
      <Skeleton className='h-4 w-32 mb-6' />

      <div className='grid gap-8 md:grid-cols-3'>
        <div className='md:col-span-2'>
          <Skeleton className='h-5 w-40 mb-3' />
          <div className='space-y-3'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='border rounded-lg p-4 bg-white space-y-2'>
                <div className='flex items-center justify-between gap-2'>
                  <Skeleton className='h-4 w-40' />
                  <Skeleton className='h-5 w-24 rounded-full' />
                </div>
                <Skeleton className='h-4 w-3/4' />
              </div>
            ))}
          </div>
        </div>

        <div className='space-y-6'>
          <div>
            <Skeleton className='h-5 w-44 mb-3' />
            <div className='space-y-3'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className='space-y-2'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-10 w-full rounded-md' />
                </div>
              ))}
              <Skeleton className='h-10 w-full rounded-md' />
            </div>
          </div>
          <div className='border rounded-lg bg-white p-5 space-y-3'>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-2 w-full rounded-full' />
          </div>
        </div>
      </div>
    </div>
  );
}
