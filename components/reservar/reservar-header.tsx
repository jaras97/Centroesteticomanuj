import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';

export default function ReservarHeader({ logoUrl }: { logoUrl: string }) {
  return (
    <header className='border-b bg-white'>
      <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
        <Link href='/' className='flex items-center gap-2'>
          <Image
            src={logoUrl}
            alt='Centro Estético Manuj'
            width={120}
            height={40}
            className='h-8 w-auto'
          />
        </Link>
        <Link
          href='/'
          className='inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:text-brand-teal-dark transition-colors'
        >
          <ChevronLeft className='h-4 w-4' />
          Volver al sitio
        </Link>
      </div>
    </header>
  );
}
