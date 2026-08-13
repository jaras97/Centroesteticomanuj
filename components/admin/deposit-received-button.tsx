'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { markDepositReceived } from '@/app/admin/(dashboard)/actions';

export default function DepositReceivedButton({
  appointmentId,
  defaultAmount,
}: {
  appointmentId: string;
  defaultAmount?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount || ''));
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await markDepositReceived(
        appointmentId,
        amount ? Number(amount) : undefined,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cita confirmada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm'>Anticipo recibido</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar anticipo recibido</DialogTitle>
        </DialogHeader>

        <div className='space-y-2'>
          <Label htmlFor='deposit-received-amount'>Monto recibido</Label>
          <Input
            id='deposit-received-amount'
            type='number'
            min={0}
            placeholder='$0'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
