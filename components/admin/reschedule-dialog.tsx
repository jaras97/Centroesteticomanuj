'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Loader2 } from 'lucide-react';
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
import { bogotaWallTimeToUtc, formatDateStr, formatTimeStr, toBogotaWallClock } from '@/lib/booking/timezone';
import { rescheduleAppointment } from '@/app/admin/(dashboard)/actions';

export default function RescheduleDialog({
  appointmentId,
  currentStartTime,
}: {
  appointmentId: string;
  currentStartTime: string;
}) {
  const [open, setOpen] = useState(false);
  const wall = toBogotaWallClock(new Date(currentStartTime));
  const [date, setDate] = useState(formatDateStr(wall));
  const [time, setTime] = useState(formatTimeStr(wall));
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!date || !time) {
      toast.error('Elige fecha y hora.');
      return;
    }

    const newStartTimeIso = bogotaWallTimeToUtc(date, time).toISOString();

    startTransition(async () => {
      const result = await rescheduleAppointment(appointmentId, newStartTimeIso);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cita reagendada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline'>
          <CalendarClock className='h-3.5 w-3.5' /> Reagendar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar cita</DialogTitle>
        </DialogHeader>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-2'>
            <Label htmlFor='reschedule-date'>Fecha</Label>
            <Input
              id='reschedule-date'
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='reschedule-time'>Hora</Label>
            <Input
              id='reschedule-time'
              type='time'
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Guardar nuevo horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
