import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Confirmation({
  summary,
}: {
  summary: { serviceName: string; date: string; time: string };
}) {
  return (
    <div className='text-center py-10'>
      <CheckCircle2 className='h-14 w-14 text-brand-teal mx-auto mb-6' />
      <h2 className='text-2xl font-bold text-brand-ink mb-3'>
        ¡Solicitud enviada!
      </h2>
      <p className='text-gray-600 max-w-md mx-auto mb-2'>
        Tu solicitud para <span className='font-medium'>{summary.serviceName}</span>{' '}
        el <span className='font-medium'>{summary.date}</span> a las{' '}
        <span className='font-medium'>{summary.time}</span> fue recibida.
      </p>
      <p className='text-gray-600 max-w-md mx-auto mb-8'>
        Manu te contactará por WhatsApp para confirmarla. Esta cita todavía
        no está confirmada.
      </p>
      <Link href='/'>
        <Button variant='outline'>Volver al inicio</Button>
      </Link>
    </div>
  );
}
