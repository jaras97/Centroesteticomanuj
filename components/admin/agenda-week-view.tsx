'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BlockSlotDialog from '@/components/admin/block-slot-dialog';
import RescheduleDialog from '@/components/admin/reschedule-dialog';
import {
  addDaysToDateStr,
  formatBogotaHuman,
  formatDateStr,
  toBogotaWallClock,
} from '@/lib/booking/timezone';
import {
  deleteBlockedSlot,
  markCompleted,
  markNoShow,
} from '@/app/admin/(dashboard)/actions';

export interface AgendaAppointment {
  id: string;
  status: 'SOLICITADA' | 'ESPERANDO_ANTICIPO' | 'CONFIRMADA' | 'COMPLETADA';
  start_time: string;
  end_time: string;
  duration_min: number;
  clients: { name: string; phone: string };
  services: { name: string };
}

export interface AgendaBlockedSlot {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const STATUS_VARIANT: Record<AgendaAppointment['status'], 'warning' | 'outline' | 'default' | 'success'> = {
  SOLICITADA: 'warning',
  ESPERANDO_ANTICIPO: 'outline',
  CONFIRMADA: 'default',
  COMPLETADA: 'success',
};

function timeOnly(iso: string): string {
  return formatBogotaHuman(iso).split(', ')[1];
}

export default function AgendaWeekView({
  monday,
  appointments,
  blockedSlots,
}: {
  monday: string;
  appointments: AgendaAppointment[];
  blockedSlots: AgendaBlockedSlot[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(monday, i));
  const prevWeek = addDaysToDateStr(monday, -7);
  const nextWeek = addDaysToDateStr(monday, 7);
  const now = new Date();

  return (
    <div>
      <div className='flex items-center justify-between mb-6 gap-3 flex-wrap'>
        <div className='flex items-center gap-2'>
          <Link href={`/admin/agenda?week=${prevWeek}`}>
            <Button variant='outline' size='icon'>
              <ChevronLeft className='h-4 w-4' />
            </Button>
          </Link>
          <span className='text-sm font-medium text-brand-ink'>
            Semana del {monday}
          </span>
          <Link href={`/admin/agenda?week=${nextWeek}`}>
            <Button variant='outline' size='icon'>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </Link>
        </div>
        <BlockSlotDialog />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-7 gap-3'>
        {days.map((day, idx) => {
          const dayAppointments = appointments.filter(
            (a) => formatDateStr(toBogotaWallClock(new Date(a.start_time))) === day,
          );
          const dayBlocked = blockedSlots.filter(
            (b) => formatDateStr(toBogotaWallClock(new Date(b.start_at))) === day,
          );

          return (
            <div key={day} className='bg-white border rounded-lg p-3 min-h-[140px]'>
              <p className='text-xs font-semibold text-gray-500 mb-2'>
                {DAY_LABELS[idx]} {day.slice(-2)}
              </p>

              <div className='space-y-2'>
                {dayBlocked.map((b) => (
                  <BlockedChip key={b.id} block={b} />
                ))}
                {dayAppointments.map((a) => (
                  <AppointmentChip key={a.id} appointment={a} isPast={new Date(a.end_time) < now} />
                ))}
                {dayAppointments.length === 0 && dayBlocked.length === 0 && (
                  <p className='text-xs text-gray-300'>—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentChip({
  appointment,
  isPast,
}: {
  appointment: AgendaAppointment;
  isPast: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className='rounded-md border p-2 text-xs'>
      <div className='flex items-center justify-between gap-1 mb-1'>
        <span className='font-medium text-brand-ink'>{timeOnly(appointment.start_time)}</span>
        <Badge variant={STATUS_VARIANT[appointment.status]} className='text-[10px]'>
          {appointment.status}
        </Badge>
      </div>
      <p className='text-gray-700'>{appointment.clients.name}</p>
      <p className='text-gray-500'>{appointment.services.name}</p>

      {!isPast && (
        <div className='mt-2 [&_button]:h-6 [&_button]:px-2 [&_button]:text-[10px] [&_svg]:h-3 [&_svg]:w-3'>
          <RescheduleDialog
            appointmentId={appointment.id}
            currentStartTime={appointment.start_time}
          />
        </div>
      )}

      {isPast && appointment.status === 'CONFIRMADA' && (
        <div className='flex gap-1 mt-2'>
          <Button
            size='sm'
            variant='outline'
            className='h-6 px-2 text-[10px]'
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await markCompleted(appointment.id);
                if (!result.ok) toast.error(result.error);
              })
            }
          >
            {isPending ? <Loader2 className='h-3 w-3 animate-spin' /> : 'Completada'}
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='h-6 px-2 text-[10px]'
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await markNoShow(appointment.id);
                if (!result.ok) toast.error(result.error);
              })
            }
          >
            No asistió
          </Button>
        </div>
      )}
    </div>
  );
}

function BlockedChip({ block }: { block: AgendaBlockedSlot }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className='rounded-md bg-gray-100 p-2 text-xs flex items-start justify-between gap-1'>
      <div>
        <p className='font-medium text-gray-600'>
          {timeOnly(block.start_at)} – {timeOnly(block.end_at)}
        </p>
        {block.reason && <p className='text-gray-500'>{block.reason}</p>}
      </div>
      <button
        type='button'
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteBlockedSlot(block.id);
            if (!result.ok) toast.error(result.error);
          })
        }
        className='text-gray-400 hover:text-destructive'
      >
        {isPending ? <Loader2 className='h-3 w-3 animate-spin' /> : <X className='h-3 w-3' />}
      </button>
    </div>
  );
}
