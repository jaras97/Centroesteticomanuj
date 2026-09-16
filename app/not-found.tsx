import Link from 'next/link';
import { ArrowLeft, CalendarPlus } from 'lucide-react';

export const metadata = {
  title: 'Página no encontrada',
};

/** 404 global: el de Next venía crudo, sin marca ni salida. */
export default function NotFound() {
  return (
    <main className='min-h-screen bg-gradient-to-br from-brand-sand/10 to-white flex items-center justify-center px-4 py-20'>
      <div className='max-w-lg text-center'>
        <p className='font-display italic text-6xl md:text-7xl text-brand-sand-dark mb-4'>404</p>
        <h1 className='font-display italic text-3xl md:text-4xl text-brand-ink mb-4'>
          No encontramos esta página
        </h1>
        <p className='text-gray-600 mb-8'>
          Puede que el enlace esté desactualizado o que la página haya cambiado de lugar.
        </p>
        <div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
          <Link
            href='/'
            className='inline-flex items-center gap-2 rounded-full bg-brand-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2'
          >
            <ArrowLeft className='h-4 w-4' />
            Volver al inicio
          </Link>
          <Link
            href='/reservar'
            className='inline-flex items-center gap-2 rounded-full border border-brand-ink/15 px-6 py-3 text-sm font-medium text-brand-ink transition-colors hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2'
          >
            <CalendarPlus className='h-4 w-4' />
            Reservar una cita
          </Link>
        </div>
      </div>
    </main>
  );
}
