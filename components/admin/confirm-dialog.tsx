'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { confirmAppointment } from '@/app/admin/(dashboard)/actions';

export default function ConfirmDialog({
  appointmentId,
  defaultDuration,
  willRequireDeposit,
}: {
  appointmentId: string;
  defaultDuration: number;
  willRequireDeposit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(String(defaultDuration));
  const [depositAmount, setDepositAmount] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmAppointment(
        appointmentId,
        Number(duration),
        depositAmount ? Number(depositAmount) : undefined,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cita actualizada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm'>Confirmar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar cita</DialogTitle>
          <DialogDescription>
            Puedes ajustar la duración real de esta cita antes de confirmarla.
            {willRequireDeposit &&
              ' Este es un cliente nuevo con anticipo requerido: la cita quedará "esperando anticipo" hasta que confirmes que lo recibiste.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-2'>
          <Label htmlFor='duration'>Duración (minutos)</Label>
          <Input
            id='duration'
            type='number'
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        {!willRequireDeposit && (
          <div className='space-y-2'>
            <Label htmlFor='deposit-amount'>Anticipo/abono recibido (opcional)</Label>
            <Input
              id='deposit-amount'
              type='number'
              min={0}
              placeholder='$0'
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>
        )}

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
