import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SummaryCardsSkeleton } from '@/components/admin/skeletons';

/**
 * Finanzas: título + navegador de mes, las 4 pestañas y la pestaña Resumen
 * (tres filas de tarjetas, gráfico y desgloses), que es la que se abre por
 * defecto.
 *
 * Las pestañas se dibujan a mano en vez de con `TabsSkeleton`: acá son 2×2 en
 * móvil, igual que en la página, para que el esqueleto no salte de forma al
 * cargar.
 */
export default function Loading() {
  return (
    <div>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
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

      <div className='mb-6 grid w-full grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:inline-flex sm:w-auto sm:gap-0'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-11 w-full rounded-sm sm:h-8 sm:w-24' />
        ))}
      </div>

      <SummaryCardsSkeleton
        count={4}
        className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
      />
      <SummaryCardsSkeleton
        count={4}
        className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
      />
      <SummaryCardsSkeleton
        count={4}
        className='mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4'
      />

      <Card className='mb-6'>
        <CardHeader>
          <Skeleton className='h-5 w-52' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-64 w-full' />
        </CardContent>
      </Card>

      <div className='grid gap-4 lg:grid-cols-2'>
        {Array.from({ length: 2 }).map((_, card) => (
          <Card key={card}>
            <CardHeader>
              <Skeleton className='h-5 w-44' />
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
        ))}
      </div>
    </div>
  );
}
