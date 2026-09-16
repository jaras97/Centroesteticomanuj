import { Skeleton } from '@/components/ui/skeleton';

/**
 * Galería: barra superior (el Header vive dentro de la página, no del layout,
 * así que el esqueleto también lo representa) + título, filtros y cuadrícula.
 */
export default function Loading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-brand-sand/10 to-white'>
      <div className='bg-white shadow-lg'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between'>
          <Skeleton className='h-10 w-32' />
          <Skeleton className='h-9 w-40 rounded-full' />
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20'>
        <div className='flex flex-col items-center gap-6 mb-16'>
          <Skeleton className='h-10 w-72' />
          <Skeleton className='h-5 w-full max-w-xl' />
          <div className='flex flex-wrap justify-center gap-2'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-9 w-24 rounded-full' />
            ))}
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='aspect-[4/5] w-full rounded-xl' />
          ))}
        </div>
      </div>
    </div>
  );
}
