'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markDepositReceived } from '@/app/admin/(dashboard)/actions';

export default function DepositReceivedButton({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size='sm'
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await markDepositReceived(appointmentId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success('Cita confirmada.');
        })
      }
    >
      {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
      Anticipo recibido
    </Button>
  );
}
