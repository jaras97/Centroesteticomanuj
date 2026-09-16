'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Frontera de error del panel. Sin esto, cualquier fallo de una consulta a
 * Supabase tumbaba la pantalla completa sin explicación ni forma de reintentar.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Queda en la consola del navegador y en los logs de Vercel.
    console.error('[admin] error de ruta:', error);
  }, [error]);

  return (
    <div className='mx-auto max-w-lg py-12 text-center'>
      <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50'>
        <AlertTriangle className='h-6 w-6 text-amber-500' />
      </div>
      <h1 className='text-xl font-bold text-brand-ink mb-2'>Algo salió mal</h1>
      <p className='text-sm text-gray-500 mb-6'>
        No se pudo cargar esta sección del panel. Puede ser una caída momentánea de la conexión
        con la base de datos. Intenta de nuevo; si sigue fallando, vuelve a entrar más tarde.
      </p>
      {error.digest && (
        <p className='text-xs text-gray-400 mb-6'>
          Código del error: <code>{error.digest}</code>
        </p>
      )}
      <div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
        <Button onClick={reset}>
          <RotateCw className='h-4 w-4' />
          Reintentar
        </Button>
        <Button asChild variant='outline'>
          <Link href='/admin'>
            <Inbox className='h-4 w-4' />
            Ir a la bandeja
          </Link>
        </Button>
      </div>
    </div>
  );
}
