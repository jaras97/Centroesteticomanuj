'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import RescheduleDialog from '@/components/admin/reschedule-dialog';
import CompleteAppointmentDialog from '@/components/admin/complete-appointment-dialog';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { markNoShow, deleteBlockedSlot } from '@/app/admin/(dashboard)/actions';
import type { AgendaAppointment, AgendaBlockedSlot } from '@/components/admin/agenda-calendar';

export type SelectedAgendaEvent =
  | { kind: 'appointment'; data: AgendaAppointment; isPast: boolean }
  | { kind: 'blocked'; data: AgendaBlockedSlot };

const STATUS_LABEL: Record<AgendaAppointment['status'], string> = {
  SOLICITADA: 'Solicitada',
  ESPERANDO_ANTICIPO: 'Esperando anticipo',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Completada',
};

const STATUS_VARIANT: Record<
  AgendaAppointment['status'],
  'warning' | 'outline' | 'default' | 'success'
> = {
  SOLICITADA: 'warning',
  ESPERANDO_ANTICIPO: 'outline',
  CONFIRMADA: 'default',
  COMPLETADA: 'success',
};

export default function AgendaEventDialog({
  event,
  onOpenChange,
}: {
  event: SelectedAgendaEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [lastEvent, setLastEvent] = useState<SelectedAgendaEvent | null>(null);

  useEffect(() => {
    if (event) setLastEvent(event);
  }, [event]);

  const shown = event ?? lastEvent;

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent>
        {shown?.kind === 'appointment' && (
          <AppointmentDetail
            appointment={shown.data}
            isPast={shown.isPast}
            onDone={() => onOpenChange(false)}
          />
        )}
        {shown?.kind === 'blocked' && (
          <BlockedDetail block={shown.data} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AppointmentDetail({
  appointment,
  isPast,
  onDone,
}: {
  appointment: AgendaAppointment;
  isPast: boolean;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <DialogHeader>
        <DialogTitle className='flex items-center gap-2'>
          {appointment.clients.name}
          <Badge variant={STATUS_VARIANT[appointment.status]}>
            {STATUS_LABEL[appointment.status]}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <div className='space-y-1 text-sm'>
        <p className='text-brand-ink font-medium'>{appointment.services.name}</p>
        <p className='text-gray-500'>
          {formatBogotaHuman(appointment.start_time)} · {appointment.duration_min} min
        </p>
        <p className='text-gray-500'>{appointment.clients.phone}</p>
      </div>

      <div className='flex flex-wrap gap-2 pt-2'>
        {!isPast && (
          <RescheduleDialog
            appointmentId={appointment.id}
            currentStartTime={appointment.start_time}
          />
        )}
        {isPast && appointment.status === 'CONFIRMADA' && (
          <>
            <CompleteAppointmentDialog
              appointmentId={appointment.id}
              clientId={appointment.client_id}
              defaultAmount={appointment.services.price ?? 0}
              onDone={onDone}
            />
            <Button
              size='sm'
              variant='outline'
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await markNoShow(appointment.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  onDone();
                })
              }
            >
              No asistió
            </Button>
          </>
        )}
      </div>
    </>
  );
}

function BlockedDetail({ block, onDone }: { block: AgendaBlockedSlot; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Horario bloqueado</DialogTitle>
      </DialogHeader>

      <div className='space-y-1 text-sm'>
        <p className='text-brand-ink font-medium'>
          {formatBogotaHuman(block.start_at)} – {formatBogotaHuman(block.end_at)}
        </p>
        {block.reason && <p className='text-gray-500'>{block.reason}</p>}
      </div>

      <div className='pt-2'>
        <Button
          size='sm'
          variant='outline'
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteBlockedSlot(block.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              onDone();
            })
          }
        >
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          Eliminar bloqueo
        </Button>
      </div>
    </>
  );
}
