'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CalendarIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { bogotaWallTimeToUtc } from '@/lib/booking/timezone';
import { createBlockedSlot } from '@/app/admin/(dashboard)/actions';

export default function BlockSlotDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!date) {
      toast.error('Elige una fecha.');
      return;
    }
    const dateStr = format(date, 'yyyy-MM-dd');
    const startAt = bogotaWallTimeToUtc(dateStr, allDay ? '00:00' : startTime);
    const endAt = allDay
      ? bogotaWallTimeToUtc(dateStr, '23:59')
      : bogotaWallTimeToUtc(dateStr, endTime);

    if (endAt <= startAt) {
      toast.error('La hora final debe ser después de la hora inicial.');
      return;
    }

    startTransition(async () => {
      const result = await createBlockedSlot({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        reason,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Horario bloqueado.');
      setOpen(false);
      setDate(undefined);
      setReason('');
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          Bloquear horario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear horario</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-full justify-start font-normal'>
                  <CalendarIcon className='h-4 w-4' />
                  {date ? format(date, 'yyyy-MM-dd') : 'Elige una fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0'>
                <Calendar mode='single' selected={date} onSelect={setDate} />
              </PopoverContent>
            </Popover>
          </div>

          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            Todo el día
          </label>

          {!allDay && (
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <Label htmlFor='start-time'>Desde</Label>
                <Input
                  id='start-time'
                  type='time'
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='end-time'>Hasta</Label>
                <Input
                  id='end-time'
                  type='time'
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='reason'>Motivo (opcional)</Label>
            <Textarea id='reason' value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
