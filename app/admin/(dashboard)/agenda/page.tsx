import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  addDaysToDateStr,
  bogotaWallTimeToUtc,
  formatDateStr,
  mondayOfWeek,
  toBogotaWallClock,
  type DateStr,
} from '@/lib/booking/timezone';
import AgendaCalendar, {
  type AgendaAppointment,
  type AgendaBlockedSlot,
} from '@/components/admin/agenda-calendar';

function firstDayOfMonth(date: DateStr): DateStr {
  return `${date.slice(0, 7)}-01`;
}

function lastDayOfMonth(date: DateStr): DateStr {
  const [y, m] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const todayStr = formatDateStr(toBogotaWallClock(new Date()));
  const focusedDate = date || todayStr;
  const monday = mondayOfWeek(focusedDate);

  // Se trae siempre el rango completo de la grilla del mes que contiene
  // focusedDate (superset de cualquier semana/día dentro de ese mes), así
  // el toggle Semana/Día/Mes es instantáneo en el cliente sin ida y vuelta
  // al servidor — solo cambiar de mes (flechas) dispara un nuevo fetch.
  const gridStart = mondayOfWeek(firstDayOfMonth(focusedDate));
  const gridEndExclusive = addDaysToDateStr(mondayOfWeek(lastDayOfMonth(focusedDate)), 7);

  const gridStartUtc = bogotaWallTimeToUtc(gridStart, '00:00');
  const gridEndUtc = bogotaWallTimeToUtc(gridEndExclusive, '00:00');

  const supabase = await createClient();

  const [{ data: appointments }, { data: blockedSlots }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, clients(*), services(*)')
      .gte('start_time', gridStartUtc.toISOString())
      .lt('start_time', gridEndUtc.toISOString())
      .in('status', ['SOLICITADA', 'ESPERANDO_ANTICIPO', 'CONFIRMADA', 'COMPLETADA'])
      .order('start_time', { ascending: true }),
    supabase
      .from('blocked_slots')
      .select('*')
      .lt('start_at', gridEndUtc.toISOString())
      .gt('end_at', gridStartUtc.toISOString())
      .order('start_at', { ascending: true }),
  ]);

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink'>
          <CalendarDays className='h-6 w-6 text-brand-teal' />
          Agenda
        </h1>
      </div>
      <AgendaCalendar
        monday={monday}
        focusedDate={focusedDate}
        appointments={(appointments ?? []) as unknown as AgendaAppointment[]}
        blockedSlots={(blockedSlots ?? []) as AgendaBlockedSlot[]}
      />
    </div>
  );
}
