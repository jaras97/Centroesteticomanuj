'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  bogotaWallTimeToUtc,
  formatDateStr,
  formatTimeStr,
  toBogotaWallClock,
} from '@/lib/booking/timezone';
import { formatCOP } from '@/lib/format';
import { getBookableServices, updateAppointmentBooking } from '@/app/admin/(dashboard)/actions';

interface BookableService {
  id: string;
  name: string;
  duration_min: number;
  buffer_min: number;
  price: number | null;
  deposit_amount: number | null;
}

/**
 * Editar una cita todavía no cerrada: servicio + fecha/hora + duración.
 * Los tres campos viven en el mismo diálogo porque un cambio de servicio
 * suele arrastrar un cambio de horario (un servicio más largo puede no
 * caber donde estaba el anterior), y así se resuelve en una sola operación.
 */
export default function EditAppointmentDialog({
  appointmentId,
  currentServiceId,
  currentStartTime,
  currentDurationMin,
}: {
  appointmentId: string;
  currentServiceId: string;
  currentStartTime: string;
  currentDurationMin: number;
}) {
  const [open, setOpen] = useState(false);
  const wall = toBogotaWallClock(new Date(currentStartTime));
  const [serviceId, setServiceId] = useState(currentServiceId);
  const [date, setDate] = useState(formatDateStr(wall));
  const [time, setTime] = useState(formatTimeStr(wall));
  const [duration, setDuration] = useState(String(currentDurationMin));
  const [services, setServices] = useState<BookableService[]>([]);
  const [isPending, startTransition] = useTransition();

  // Se cargan al abrir (mismo patrón perezoso que getAvailableRewards en el
  // diálogo de completar) para no engordar el payload de la agenda, que ya
  // trae un mes entero de citas.
  useEffect(() => {
    if (!open) return;
    getBookableServices().then(setServices);
  }, [open]);

  // Al reabrir, se vuelve a partir de los valores reales de la cita.
  useEffect(() => {
    if (open) return;
    const w = toBogotaWallClock(new Date(currentStartTime));
    setServiceId(currentServiceId);
    setDate(formatDateStr(w));
    setTime(formatTimeStr(w));
    setDuration(String(currentDurationMin));
  }, [open, currentServiceId, currentStartTime, currentDurationMin]);

  const selected = services.find((s) => s.id === serviceId);
  const serviceChanged = serviceId !== currentServiceId;

  function handleServiceChange(nextId: string) {
    setServiceId(nextId);
    // La duración vuelve al valor de catálogo del servicio elegido; si Manu
    // necesita otra, la ajusta abajo (mismo override que al confirmar).
    const next = services.find((s) => s.id === nextId);
    if (next) setDuration(String(next.duration_min));
  }

  function handleSubmit() {
    if (!date || !time) {
      toast.error('Elige fecha y hora.');
      return;
    }
    if (!serviceId) {
      toast.error('Elige un servicio.');
      return;
    }

    const startTimeIso = bogotaWallTimeToUtc(date, time).toISOString();

    startTransition(async () => {
      const result = await updateAppointmentBooking(appointmentId, {
        serviceId,
        startTimeIso,
        durationMin: Number(duration) || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(serviceChanged ? 'Cita actualizada.' : 'Cita reagendada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline'>
          <CalendarClock className='h-3.5 w-3.5' /> Editar cita
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cita</DialogTitle>
          <DialogDescription>
            Cambia el servicio, la fecha/hora o la duración. Si la clienta pidió otro servicio,
            cámbialo aquí en vez de rechazar la cita y crearla de nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>Servicio</Label>
            <Select value={serviceId} onValueChange={handleServiceChange}>
              <SelectTrigger>
                <SelectValue placeholder='Selecciona el servicio' />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration_min} min
                    {s.price != null ? ` · ${formatCOP(s.price)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {serviceChanged && selected && (
              <p className='text-sm text-amber-600'>
                Cambia a {selected.name}
                {selected.price != null && ` · valor ${formatCOP(selected.price)}`}
                {!!selected.deposit_amount &&
                  ` · anticipo sugerido ${formatCOP(selected.deposit_amount)}`}
                . El estado de la cita no cambia: confírmala tú como siempre.
              </p>
            )}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='edit-appointment-date'>Fecha</Label>
              <Input
                id='edit-appointment-date'
                type='date'
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-appointment-time'>Hora</Label>
              <Input
                id='edit-appointment-time'
                type='time'
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='edit-appointment-duration'>Duración (minutos)</Label>
            <Input
              id='edit-appointment-duration'
              type='number'
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            {selected && (
              <p className='text-sm text-gray-500'>
                Ocupa {(Number(duration) || selected.duration_min) + selected.buffer_min} min en la
                agenda ({selected.buffer_min} min de buffer).
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
