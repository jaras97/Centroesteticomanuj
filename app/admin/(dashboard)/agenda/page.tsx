import { createClient } from '@/lib/supabase/server';
import {
  addDaysToDateStr,
  bogotaWallTimeToUtc,
  formatDateStr,
  mondayOfWeek,
  toBogotaWallClock,
} from '@/lib/booking/timezone';
import AgendaWeekView, {
  type AgendaAppointment,
  type AgendaBlockedSlot,
} from '@/components/admin/agenda-week-view';

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const todayStr = formatDateStr(toBogotaWallClock(new Date()));
  const monday = mondayOfWeek(week || todayStr);
  const nextMonday = addDaysToDateStr(monday, 7);

  const weekStartUtc = bogotaWallTimeToUtc(monday, '00:00');
  const weekEndUtc = bogotaWallTimeToUtc(nextMonday, '00:00');

  const supabase = await createClient();

  const [{ data: appointments }, { data: blockedSlots }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, clients(*), services(*)')
      .gte('start_time', weekStartUtc.toISOString())
      .lt('start_time', weekEndUtc.toISOString())
      .in('status', ['SOLICITADA', 'ESPERANDO_ANTICIPO', 'CONFIRMADA', 'COMPLETADA'])
      .order('start_time', { ascending: true }),
    supabase
      .from('blocked_slots')
      .select('*')
      .lt('start_at', weekEndUtc.toISOString())
      .gt('end_at', weekStartUtc.toISOString())
      .order('start_at', { ascending: true }),
  ]);

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold text-brand-ink'>Agenda</h1>
      </div>
      <AgendaWeekView
        monday={monday}
        appointments={(appointments ?? []) as unknown as AgendaAppointment[]}
        blockedSlots={(blockedSlots ?? []) as AgendaBlockedSlot[]}
      />
    </div>
  );
}
