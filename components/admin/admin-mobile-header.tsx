'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminSectionTitle } from '@/components/admin/admin-nav-links';

/**
 * Barra compacta de móvil: marca + sección actual. Va `fixed` (no `sticky`)
 * porque la columna de contenido lleva `overflow-x-hidden`, que la vuelve
 * contenedor de scroll y rompería el sticky. El `env(safe-area-inset-top)`
 * es para el notch cuando el panel se usa como PWA o en horizontal.
 */
export default function AdminMobileHeader() {
  const pathname = usePathname();

  return (
    <header className='fixed inset-x-0 top-0 z-40 border-b bg-white pt-[env(safe-area-inset-top)] lg:hidden'>
      <div className='flex h-14 items-center gap-3 px-4'>
        <Link
          href='/admin'
          className='flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2'
        >
          <span
            aria-hidden='true'
            className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-ink font-display text-base italic leading-none text-white'
          >
            M
          </span>
          <span className='sr-only'>Centro Estético Manuj — ir a la Bandeja</span>
        </Link>
        <span aria-hidden='true' className='h-5 w-px shrink-0 bg-gray-200' />
        <p className='min-w-0 truncate text-sm font-semibold text-brand-ink'>
          {adminSectionTitle(pathname)}
        </p>
      </div>
    </header>
  );
}
