import { createClient } from '@/lib/supabase/server';
import SolicitudCard, { type SolicitudRow } from '@/components/admin/solicitud-card';
import { Card, CardContent } from '@/components/ui/card';
import { bogotaWallTimeToUtc, formatDateStr, toBogotaWallClock } from '@/lib/booking/timezone';
import { isBirthdaySoon } from '@/lib/booking/birthdays';

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
      supabase.from('clients').select('birthday').not('birthday', 'is', null),
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

  return (
    <div>
      <h1 className='text-2xl font-bold text-brand-ink mb-6'>
        Bandeja de solicitudes
      </h1>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
        <SummaryCard label='Solicitudes pendientes' value={rows.length} />
        <SummaryCard label='Citas de hoy' value={todayCount ?? 0} />
        <SummaryCard label='Cumpleaños esta semana' value={birthdaysThisWeek} />
      </div>

      {rows.length === 0 ? (
        <p className='text-gray-500'>No hay solicitudes pendientes.</p>
      ) : (
        <div className='space-y-4'>
          {rows.map((request) => (
            <SolicitudCard
              key={request.id}
              request={request}
              isNewClient={!completedClientIds.has(request.client_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className='p-5'>
        <p className='text-sm text-gray-500'>{label}</p>
        <p className='text-3xl font-bold bg-gradient-to-r from-brand-teal to-brand-teal-dark bg-clip-text text-transparent'>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
