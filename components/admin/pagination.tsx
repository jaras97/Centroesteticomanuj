import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Paginación reusable para listados del admin. Es un Server Component: la
 * página vive en la URL (`?page=`), así que navegar es un simple `<Link>`
 * — funciona sin JS, se puede abrir en pestaña nueva y sobrevive un refresh.
 *
 * `params` son el resto de parámetros de la URL que hay que conservar al
 * cambiar de página (búsqueda, orden, filtros…). Los valores vacíos o
 * `undefined` se omiten para no ensuciar el link.
 */
export default function Pagination({
  page,
  pageSize,
  totalCount,
  basePath,
  params = {},
  itemLabel = { singular: 'resultado', plural: 'resultados' },
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
  params?: Record<string, string | number | undefined>;
  itemLabel?: { singular: string; plural: string };
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function hrefForPage(target: number): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue;
      search.set(key, String(value));
    }
    if (target > 1) search.set('page', String(target));
    else search.delete('page');
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const countLabel = `${totalCount} ${
    totalCount === 1 ? itemLabel.singular : itemLabel.plural
  }`;

  return (
    <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
      <p className='text-sm text-gray-500'>
        {countLabel}
        {totalPages > 1 && (
          <span className='hidden sm:inline'>
            {' '}
            · página {page} de {totalPages}
          </span>
        )}
      </p>

      {totalPages > 1 && (
        <div className='flex items-center gap-2'>
          <PageLink
            href={hrefForPage(page - 1)}
            disabled={!hasPrev}
            label='Anterior'
            icon='left'
          />
          <span className='text-sm text-gray-500 sm:hidden'>
            {page} / {totalPages}
          </span>
          <PageLink
            href={hrefForPage(page + 1)}
            disabled={!hasNext}
            label='Siguiente'
            icon='right'
          />
        </div>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: 'left' | 'right';
}) {
  const className = cn(
    'inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm transition-colors',
    disabled
      ? 'pointer-events-none border-gray-200 text-gray-300'
      : 'border-input text-brand-ink hover:bg-brand-teal/10',
  );

  const content = (
    <>
      {icon === 'left' && <ChevronLeft className='h-4 w-4' />}
      {label}
      {icon === 'right' && <ChevronRight className='h-4 w-4' />}
    </>
  );

  // Deshabilitado se renderiza como <span> y no como <Link>: un enlace que no
  // lleva a ningún lado confunde a lectores de pantalla y al teclado.
  if (disabled) {
    return (
      <span className={className} aria-disabled='true'>
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={className} aria-label={label}>
      {content}
    </Link>
  );
}
