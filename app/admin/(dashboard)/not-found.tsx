import Link from 'next/link';
import { Inbox, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 404 dentro del panel (ej. `notFound()` de una ficha de cliente que ya no
 * existe). Se renderiza con el nav y el footer del admin alrededor, para no
 * expulsar a Manu del panel por un id inválido.
 */
export default function AdminNotFound() {
  return (
    <div className='mx-auto max-w-lg py-12 text-center'>
      <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100'>
        <SearchX className='h-6 w-6 text-gray-400' />
      </div>
      <h1 className='text-xl font-bold text-brand-ink mb-2'>No encontramos esto</h1>
      <p className='text-sm text-gray-500 mb-6'>
        El registro que buscas no existe o fue eliminado.
      </p>
      <Button asChild variant='outline'>
        <Link href='/admin'>
          <Inbox className='h-4 w-4' />
          Ir a la bandeja
        </Link>
      </Button>
    </div>
  );
}
