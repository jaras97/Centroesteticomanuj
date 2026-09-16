import Link from 'next/link';
import { Cake, CalendarCheck, CalendarPlus, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import SolicitudCard, { type SolicitudRow } from '@/components/admin/solicitud-card';
import UpcomingBirthdays from '@/components/admin/upcoming-birthdays';
import EmptyState from '@/components/admin/empty-state';
import SummaryCard from '@/components/admin/summary-card';
import StaggerIn from '@/components/admin/stagger-in';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { bogotaWallTimeToUtc, formatDateStr, toBogotaWallClock } from '@/lib/booking/timezone';
import { daysUntilNextBirthday, isBirthdaySoon } from '@/lib/booking/birthdays';

export default async function BandejaPage() {
  const supabase = await createClient();

  const todayStr = formatDateStr(toBogotaWallClock(new Date()));
  const todayStartUtc = bogotaWallTimeToUtc(todayStr, '00:00');
  const todayEndUtc = bogotaWallTimeToUtc(todayStr, '23:59');

  const [{ data: requests }, { count: todayCount }, { data: clientsWithBirthday }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('*, clients(*), services(*)')
        .in('status', ['SOLICITADA', 'ESPERANDO_ANTICIPO'])
        .order('created_at', { ascending: true }),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', todayStartUtc.toISOString())
        .lte('start_time', todayEndUtc.toISOString())
        .in('status', ['CONFIRMADA', 'COMPLETADA']),
      supabase.from('clients').select('id, name, birthday').not('birthday', 'is', null),
    ]);

  const rows = (requests ?? []) as unknown as SolicitudRow[];
  const clientIds = [...new Set(rows.map((r) => r.client_id))];

  let completedClientIds = new Set<string>();
  if (clientIds.length > 0) {
    const { data: completed } = await supabase
      .from('appointments')
      .select('client_id')
      .eq('status', 'COMPLETADA')
      .in('client_id', clientIds);
    completedClientIds = new Set((completed ?? []).map((c) => c.client_id));
  }

  const birthdaysThisWeek = (clientsWithBirthday ?? []).filter((c) =>
    isBirthdaySoon(c.birthday, 7),
  ).length;

  const upcomingBirthdays = (clientsWithBirthday ?? [])
    .map((c) => ({ id: c.id, name: c.name, birthday: c.birthday as string, daysUntil: daysUntilNextBirthday(c.birthday as string) }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 6);

  return (
    <div>
      <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink mb-6'>
        <Inbox className='h-6 w-6 text-brand-teal' />
        Bandeja de solicitudes
      </h1>

      <StaggerIn className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
        <SummaryCard icon={Inbox} label='Solicitudes pendientes' value={rows.length} />
        <SummaryCard icon={CalendarCheck} label='Citas de hoy' value={todayCount ?? 0} />
        <SummaryCard icon={Cake} label='Cumpleaños esta semana' value={birthdaysThisWeek} />
      </StaggerIn>

      <div className='grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start'>
        {rows.length === 0 ? (
          <Card>
            <CardContent className='p-5'>
              <EmptyState
                icon={Inbox}
                message='No hay solicitudes pendientes.'
                hint='Todo al día. Las solicitudes que lleguen desde el sitio aparecerán aquí.'
                action={
                  <Button variant='outline' size='sm' asChild>
                    <Link href='/admin/reservar'>
                      <CalendarPlus className='h-4 w-4' />
                      Agendar una cita manual
                    </Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <StaggerIn className='space-y-4'>
            {rows.map((request) => (
              <SolicitudCard
                key={request.id}
                request={request}
                isNewClient={!completedClientIds.has(request.client_id)}
              />
            ))}
          </StaggerIn>
        )}

        <UpcomingBirthdays rows={upcomingBirthdays} />
      </div>
    </div>
  );
}
