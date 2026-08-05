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
import { Textarea } from '@/components/ui/textarea';
import { rejectAppointment } from '@/app/admin/(dashboard)/actions';

export default function RejectDialog({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleReject() {
    startTransition(async () => {
      const result = await rejectAppointment(appointmentId, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Solicitud rechazada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline'>
          Rechazar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar solicitud</DialogTitle>
          <DialogDescription>
            El horario quedará libre nuevamente. Puedes anotar un motivo interno (opcional).
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-2'>
          <Label htmlFor='reason'>Motivo (opcional)</Label>
          <Textarea
            id='reason'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant='destructive' onClick={handleReject} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
