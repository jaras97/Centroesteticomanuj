'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Buscador con debounce para el listado de clientes.
 *
 * El texto vive en la URL (`?q=`) para que la búsqueda sea compartible y
 * sobreviva un refresh, pero se escribe sobre un estado local: así el input
 * responde al instante y no pierde el foco cuando el Server Component se
 * vuelve a renderizar (`router.replace` no remonta este componente).
 */
export default function ClientsSearch({
  placeholder = 'Buscar por nombre o teléfono…',
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q') ?? '';

  const [value, setValue] = useState(currentQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const trimmed = value.trim();
    // Ya sincronizado: corta la reacción en cadena (replace → nuevos
    // searchParams → efecto → replace → …) sin necesidad de refs de montaje.
    if (trimmed === currentQuery) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      // Cualquier búsqueda nueva vuelve a la primera página: quedarse en la
      // 4 con un resultado distinto deja al usuario mirando una lista vacía.
      params.delete('page');

      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, currentQuery, pathname, router, searchParams]);

  return (
    <div className='relative w-full sm:max-w-sm'>
      <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
      <Input
        type='text'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label='Buscar clientes'
        className='pl-9 pr-9'
      />
      <div className='absolute right-3 top-1/2 -translate-y-1/2'>
        {isPending ? (
          <Loader2 className='h-4 w-4 animate-spin text-brand-teal' />
        ) : value ? (
          <button
            type='button'
            onClick={() => setValue('')}
            aria-label='Limpiar búsqueda'
            className='text-gray-400 transition-colors hover:text-brand-ink'
          >
            <X className='h-4 w-4' />
          </button>
        ) : null}
      </div>
    </div>
  );
}
