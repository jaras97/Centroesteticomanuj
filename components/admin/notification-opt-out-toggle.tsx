'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { setClientMarketingOptOut } from '@/app/admin/(dashboard)/actions';

// Consentimiento de marketing (Ley 1581 de 2012). Solo afecta al saludo de
// cumpleaños: los avisos de solicitud y recordatorio son transaccionales
// (nacen de una acción de la propia clienta) y se mandan igual.
//
// Se monta en la ficha de la clienta: app/admin/(dashboard)/clientes/[id]/page.tsx
//   <NotificationOptOutToggle clientId={client.id} optOut={client.marketing_opt_out} />

export default function NotificationOptOutToggle({
  clientId,
  optOut,
}: {
  clientId: string;
  optOut: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await setClientMarketingOptOut(clientId, !optOut);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        optOut
          ? 'La clienta vuelve a recibir el saludo de cumpleaños.'
          : 'La clienta ya no recibirá correos de cumpleaños.',
      );
    });
  }

  return (
    <Card>
      <CardContent className='flex flex-wrap items-center justify-between gap-3 py-4'>
        <div className='flex items-start gap-2'>
          {optOut ? (
            <BellOff className='h-4 w-4 mt-0.5 text-gray-400' />
          ) : (
            <BellRing className='h-4 w-4 mt-0.5 text-brand-teal' />
          )}
          <div>
            <p className='text-sm font-medium text-brand-ink'>
              {optOut
                ? 'No recibe saludos de cumpleaños'
                : 'Recibe el saludo de cumpleaños'}
            </p>
            <p className='text-xs text-gray-500'>
              Los avisos de su cita (solicitud y recordatorio) se envían siempre.
            </p>
          </div>
        </div>
        <Button variant='outline' size='sm' onClick={handleToggle} disabled={isPending}>
          {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
          {optOut ? 'Volver a enviar' : 'Dar de baja'}
        </Button>
      </CardContent>
    </Card>
  );
}
