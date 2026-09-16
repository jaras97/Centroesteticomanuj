'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, EventInput, MoreLinkArg } from '@fullcalendar/core';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BlockSlotDialog from '@/components/admin/block-slot-dialog';
import AgendaEventDialog, { type SelectedAgendaEvent } from '@/components/admin/agenda-event-dialog';
import {
  addDaysToDateStr,
  formatDateStr,
  formatDateStrHuman,
  nowInBogota,
  toBogotaWallClock,
  type DateStr,
} from '@/lib/booking/timezone';
import './agenda-calendar.css';

export interface AgendaAppointment {
  id: string;
  client_id: string;
  service_id: string;
  status: 'SOLICITADA' | 'ESPERANDO_ANTICIPO' | 'CONFIRMADA' | 'COMPLETADA';
  start_time: string;
  end_time: string;
  duration_min: number;
  deposit_received_amount: number | null;
  charged_amount: number | null;
  payment_method: string | null;
  clients: { name: string; phone: string };
  services: { name: string; price: number | null };
}

export interface AgendaBlockedSlot {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
}

const STATUS_COLOR: Record<AgendaAppointment['status'], string> = {
  SOLICITADA: '#d97706', // amber-600
  ESPERANDO_ANTICIPO: '#B79A80', // brand.sand-dark
  CONFIRMADA: '#739DAA', // brand.teal
  COMPLETADA: '#059669', // emerald-600
};

const DENSITIES = ['compacta', 'media', 'amplia'] as const;
type Density = (typeof DENSITIES)[number];
const DENSITY_LABEL: Record<Density, string> = {
  compacta: 'Compacta',
  media: 'Media',
  amplia: 'Amplia',
};

/** Convierte un instante UTC real a un ISO string "disfrazado" de UTC que
 * representa la hora de pared en Bogotá — para usar con timeZone='UTC' en FullCalendar. */
function toFakeUtcIso(iso: string): string {
  return toBogotaWallClock(new Date(iso)).toISOString();
}

/**
 * "Ahora" para FullCalendar, en la misma escala "falso-UTC" que los eventos.
 *
 * Como el calendario corre con `timeZone='UTC'` y todos los eventos se pintan
 * con la hora de pared de Bogotá disfrazada de UTC (`toFakeUtcIso`), el "ahora"
 * que calcula FullCalendar por defecto (el UTC real) queda 5 horas adelantado:
 * la línea roja de `nowIndicator` se dibujaba 5h más abajo y el resaltado de
 * "hoy" saltaba de día a las 19:00 de Bogotá. Pasándole esta función, el
 * CalendarNowManager la vuelve a invocar en cada lectura (no fija un ancla),
 * así que el indicador sigue avanzando en tiempo real.
 */
function fullCalendarNow(): Date {
  return nowInBogota();
}

// Ventana por defecto del calendario — nunca se achica, solo se expande si hay
// una cita o bloqueo fuera de este rango (ver `slotMinTime`/`slotMaxTime` más abajo).
const DEFAULT_MIN_MINUTES = 7 * 60; // 07:00
const DEFAULT_MAX_MINUTES = 21 * 60; // 21:00

function minutesOfDay(fakeUtcIso: string): number {
  const d = new Date(fakeUtcIso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function floorToHour(minutes: number): number {
  return Math.floor(minutes / 60) * 60;
}

function ceilToHour(minutes: number): number {
  return Math.ceil(minutes / 60) * 60;
}

function formatMinutesAsTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  const hh = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const mm = (clamped % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:00`;
}

const MONTHS_ES_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Primero del mes siguiente/anterior al que contiene `date` (navegación por mes). */
function shiftMonthDateStr(date: DateStr, delta: number): DateStr {
  const [y, m] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

type CalendarView = 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth';

const VIEW_LABEL: Record<CalendarView, string> = {
  timeGridWeek: 'Semana',
  timeGridDay: 'Día',
  dayGridMonth: 'Mes',
};

export default function AgendaCalendar({
  monday,
  focusedDate,
  appointments,
  blockedSlots,
}: {
  monday: string;
  focusedDate: string;
  appointments: AgendaAppointment[];
  blockedSlots: AgendaBlockedSlot[];
}) {
  const prevWeek = addDaysToDateStr(monday, -7);
  const nextWeek = addDaysToDateStr(monday, 7);
  const prevDay = addDaysToDateStr(focusedDate, -1);
  const nextDay = addDaysToDateStr(focusedDate, 1);
  const prevMonth = shiftMonthDateStr(focusedDate, -1);
  const nextMonth = shiftMonthDateStr(focusedDate, 1);
  const calendarRef = useRef<FullCalendar>(null);
  const router = useRouter();
  const [view, setView] = useState<CalendarView>('timeGridWeek');
  const [density, setDensity] = useState<Density>('media');
  const [selectedEvent, setSelectedEvent] = useState<SelectedAgendaEvent | null>(null);
  // Instante real (no "falso-UTC") con el que se decide si una cita ya pasó.
  // Comparar dos instantes reales entre sí no depende de la zona horaria.
  const mountedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    calendarRef.current?.getApi().gotoDate(focusedDate);
  }, [focusedDate]);

  const events = useMemo<EventInput[]>(() => {
    const appointmentEvents = appointments.map((appointment) => ({
      id: `appt-${appointment.id}`,
      start: toFakeUtcIso(appointment.start_time),
      end: toFakeUtcIso(appointment.end_time),
      title: `${appointment.deposit_received_amount ? '💰 ' : ''}${appointment.clients.name} · ${appointment.services.name}`,
      backgroundColor: STATUS_COLOR[appointment.status],
      borderColor: STATUS_COLOR[appointment.status],
      extendedProps: { kind: 'appointment', appointment },
    }));

    const blockedEvents = blockedSlots.map((block) => ({
      id: `block-${block.id}`,
      start: toFakeUtcIso(block.start_at),
      end: toFakeUtcIso(block.end_at),
      title: block.reason ? `Bloqueado: ${block.reason}` : 'Bloqueado',
      backgroundColor: '#9ca3af',
      borderColor: '#9ca3af',
      editable: false,
      extendedProps: { kind: 'blocked', block },
    }));

    return [...appointmentEvents, ...blockedEvents];
  }, [appointments, blockedSlots]);

  // Rango de horas visible: por defecto 07:00-21:00, pero se expande automáticamente
  // si hay una cita o bloqueo fuera de esa ventana (ej. agendado manualmente por el
  // admin fuera del horario publicado), para que nunca quede invisible en el calendario.
  const { slotMinTime, slotMaxTime } = useMemo(() => {
    let minMinutes = DEFAULT_MIN_MINUTES;
    let maxMinutes = DEFAULT_MAX_MINUTES;

    for (const appointment of appointments) {
      minMinutes = Math.min(minMinutes, floorToHour(minutesOfDay(toFakeUtcIso(appointment.start_time))));
      maxMinutes = Math.max(maxMinutes, ceilToHour(minutesOfDay(toFakeUtcIso(appointment.end_time))));
    }
    for (const block of blockedSlots) {
      minMinutes = Math.min(minMinutes, floorToHour(minutesOfDay(toFakeUtcIso(block.start_at))));
      maxMinutes = Math.max(maxMinutes, ceilToHour(minutesOfDay(toFakeUtcIso(block.end_at))));
    }

    return {
      slotMinTime: formatMinutesAsTime(minMinutes),
      slotMaxTime: formatMinutesAsTime(maxMinutes),
    };
  }, [appointments, blockedSlots]);

  function handleEventClick(arg: EventClickArg) {
    const { kind, appointment, block } = arg.event.extendedProps as {
      kind: 'appointment' | 'blocked';
      appointment?: AgendaAppointment;
      block?: AgendaBlockedSlot;
    };

    if (kind === 'appointment' && appointment) {
      setSelectedEvent({
        kind: 'appointment',
        data: appointment,
        isPast: new Date(appointment.end_time) < mountedAt,
      });
    } else if (kind === 'blocked' && block) {
      setSelectedEvent({ kind: 'blocked', data: block });
    }
  }

  function changeView(next: CalendarView) {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  }

  // Al hacer clic en un día (o en "+N más") en vista Mes, se navega a la
  // vista Día de ese día en vez de mostrar el popover nativo de FullCalendar
  // (con muchas citas el mismo día, ese popover se sobreponía al resto de la
  // UI y era difícil de leer).
  function goToDay(date: Date) {
    const dateStr = formatDateStr(date);
    setView('timeGridDay');
    calendarRef.current?.getApi().changeView('timeGridDay', dateStr);
    router.push(`/admin/agenda?date=${dateStr}`);
  }

  function handleDateClick(arg: DateClickArg) {
    if (view !== 'dayGridMonth') return;
    goToDay(arg.date);
  }

  function handleMoreLinkClick(arg: MoreLinkArg) {
    goToDay(arg.date);
    return 'timeGridDay' as const;
  }

  const [prevHref, nextHref] =
    view === 'timeGridDay'
      ? [prevDay, nextDay]
      : view === 'dayGridMonth'
        ? [prevMonth, nextMonth]
        : [prevWeek, nextWeek];

  const [focusedYear, focusedMonth] = focusedDate.split('-').map(Number);
  const headerLabel =
    view === 'dayGridMonth'
      ? `${MONTHS_ES_FULL[focusedMonth - 1]} ${focusedYear}`
      : view === 'timeGridDay'
        ? formatDateStrHuman(focusedDate)
        : `Semana del ${monday}`;

  return (
    <div>
      <div className='flex items-center justify-between mb-6 gap-3 flex-wrap'>
        <div className='flex items-center gap-2'>
          <Link href={`/admin/agenda?date=${prevHref}`}>
            <Button variant='outline' size='icon'>
              <ChevronLeft className='h-4 w-4' />
            </Button>
          </Link>
          <span className='text-sm font-medium text-brand-ink capitalize'>{headerLabel}</span>
          <Link href={`/admin/agenda?date=${nextHref}`}>
            <Button variant='outline' size='icon'>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </Link>
        </div>

        <div className='flex items-center gap-3 flex-wrap'>
          <div className='flex items-center rounded-md border p-0.5 text-sm'>
            {(['timeGridWeek', 'timeGridDay', 'dayGridMonth'] as const).map((v) => (
              <button
                key={v}
                type='button'
                onClick={() => changeView(v)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  view === v ? 'bg-brand-teal text-white' : 'text-gray-500 hover:text-brand-ink'
                }`}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>

          {view !== 'dayGridMonth' && (
            <div className='flex items-center gap-1 text-sm'>
              <Button
                variant='outline'
                size='icon'
                disabled={density === 'compacta'}
                onClick={() => setDensity(DENSITIES[DENSITIES.indexOf(density) - 1])}
              >
                <Minus className='h-3.5 w-3.5' />
              </Button>
              <span className='w-16 text-center text-gray-500'>{DENSITY_LABEL[density]}</span>
              <Button
                variant='outline'
                size='icon'
                disabled={density === 'amplia'}
                onClick={() => setDensity(DENSITIES[DENSITIES.indexOf(density) + 1])}
              >
                <Plus className='h-3.5 w-3.5' />
              </Button>
            </div>
          )}

          <BlockSlotDialog />
        </div>
      </div>

      <div className='bg-white border rounded-lg p-3 overflow-x-auto'>
        <div className='agenda-fc' data-density={density}>
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView='timeGridWeek'
            initialDate={focusedDate}
            timeZone='UTC'
            now={fullCalendarNow}
            headerToolbar={false}
            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
            firstDay={1}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            allDaySlot={false}
            nowIndicator
            height='auto'
            dayMaxEvents={3}
            events={events}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            moreLinkClick={handleMoreLinkClick}
          />
        </div>
      </div>

      <AgendaEventDialog
        event={selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
      />
    </div>
  );
}
