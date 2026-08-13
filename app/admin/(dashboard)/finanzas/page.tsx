import Link from 'next/link';
import { ChevronLeft, ChevronRight, DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SummaryCard from '@/components/admin/summary-card';
import ExpensesTable from '@/components/admin/expenses-table';
import ExpenseFormDialog from '@/components/admin/expense-form-dialog';
import RevenueChart, { type DailyRevenuePoint } from '@/components/admin/revenue-chart';
import ServiceBreakdownCard, {
  type ServiceBreakdownRow,
} from '@/components/admin/service-breakdown-card';
import { formatCOP } from '@/lib/format';
import {
  addDaysToDateStr,
  bogotaWallTimeToUtc,
  formatDateStr,
  toBogotaWallClock,
} from '@/lib/booking/timezone';
import type { Expense } from '@/lib/supabase/types';

const MONTHS_ES_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const todayStr = formatDateStr(toBogotaWallClock(new Date()));
  const month = monthParam || todayStr.slice(0, 7);
  const [year, monthNum] = month.split('-').map(Number);

  const monthStartUtc = bogotaWallTimeToUtc(`${month}-01`, '00:00');
  const monthEndUtc = bogotaWallTimeToUtc(`${shiftMonth(month, 1)}-01`, '00:00');
  const monthEndDateStr = `${shiftMonth(month, 1)}-01`;

  const supabase = await createClient();

  const [
    { data: completedAppointments },
    { data: nonCompletedAppointments },
    { data: expenses },
    { data: todayAppointments },
    { data: allTimeCompletedAppointments },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('client_id, charged_amount, start_time, service_id, services(name)')
      .eq('status', 'COMPLETADA')
      .gte('start_time', monthStartUtc.toISOString())
      .lt('start_time', monthEndUtc.toISOString()),
    supabase
      .from('appointments')
      .select('id, status')
      .in('status', ['NO_ASISTIO', 'CANCELADA'])
      .gte('start_time', monthStartUtc.toISOString())
      .lt('start_time', monthEndUtc.toISOString()),
    supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', `${month}-01`)
      .lt('expense_date', monthEndDateStr)
      .order('expense_date', { ascending: false }),
    supabase
      .from('appointments')
      .select('charged_amount')
      .eq('status', 'COMPLETADA')
      .gte('start_time', bogotaWallTimeToUtc(todayStr, '00:00').toISOString())
      .lt('start_time', bogotaWallTimeToUtc(addDaysToDateStr(todayStr, 1), '00:00').toISOString()),
    supabase
      .from('appointments')
      .select('charged_amount, service_id, services(name)')
      .eq('status', 'COMPLETADA'),
  ]);

  const completed = (completedAppointments ?? []) as unknown as Array<{
    client_id: string;
    charged_amount: number | null;
    start_time: string;
    service_id: string;
    services: { name: string } | null;
  }>;

  const totalRevenue = completed.reduce((sum, a) => sum + (a.charged_amount ?? 0), 0);
  const chargedCount = completed.filter((a) => a.charged_amount != null).length;
  const averageTicket = chargedCount > 0 ? Math.round(totalRevenue / chargedCount) : 0;

  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const todayRevenue = (todayAppointments ?? []).reduce(
    (sum, a) => sum + (a.charged_amount ?? 0),
    0,
  );

  const nonCompletedCount = nonCompletedAppointments?.length ?? 0;
  const totalOutcomes = completed.length + nonCompletedCount;
  const noShowRate = totalOutcomes > 0 ? Math.round((nonCompletedCount / totalOutcomes) * 100) : 0;

  // Ingresos por servicio.
  const byService = new Map<string, { name: string; total: number; count: number }>();
  for (const a of completed) {
    const key = a.service_id;
    const entry = byService.get(key) ?? { name: a.services?.name ?? 'Servicio', total: 0, count: 0 };
    entry.total += a.charged_amount ?? 0;
    entry.count += 1;
    byService.set(key, entry);
  }
  const revenueByService: ServiceBreakdownRow[] = [...byService.values()].sort(
    (a, b) => b.total - a.total,
  );

  // Ingresos por servicio, histórico (todas las citas completadas, sin filtro de mes).
  const byServiceAllTime = new Map<string, ServiceBreakdownRow>();
  for (const a of (allTimeCompletedAppointments ?? []) as unknown as Array<{
    charged_amount: number | null;
    service_id: string;
    services: { name: string } | null;
  }>) {
    const entry = byServiceAllTime.get(a.service_id) ?? {
      name: a.services?.name ?? 'Servicio',
      total: 0,
      count: 0,
    };
    entry.total += a.charged_amount ?? 0;
    entry.count += 1;
    byServiceAllTime.set(a.service_id, entry);
  }
  const revenueByServiceAllTime = [...byServiceAllTime.values()].sort(
    (a, b) => b.total - a.total,
  );

  // Tendencia diaria.
  const dailyMap = new Map<number, number>();
  for (const a of completed) {
    const dayStr = formatDateStr(toBogotaWallClock(new Date(a.start_time)));
    const day = Number(dayStr.split('-')[2]);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + (a.charged_amount ?? 0));
  }
  const dailyRevenue: DailyRevenuePoint[] = Array.from(
    { length: daysInMonth(month) },
    (_, i) => ({ day: i + 1, amount: dailyMap.get(i + 1) ?? 0 }),
  );

  // Clientes nuevos vs recurrentes (según su primera cita COMPLETADA histórica).
  const monthClientIds = [...new Set(completed.map((a) => a.client_id))];
  let newClients = 0;
  if (monthClientIds.length > 0) {
    const { data: history } = await supabase
      .from('appointments')
      .select('client_id, start_time')
      .eq('status', 'COMPLETADA')
      .in('client_id', monthClientIds)
      .order('start_time', { ascending: true });

    const firstCompletedAt = new Map<string, string>();
    for (const row of history ?? []) {
      if (!firstCompletedAt.has(row.client_id)) firstCompletedAt.set(row.client_id, row.start_time);
    }
    for (const clientId of monthClientIds) {
      const first = firstCompletedAt.get(clientId);
      if (first && first >= monthStartUtc.toISOString()) newClients += 1;
    }
  }
  const recurringClients = monthClientIds.length - newClients;

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const monthLabel = `${MONTHS_ES_FULL[monthNum - 1]} ${year}`;

  return (
    <div>
      <div className='flex items-center justify-between mb-6 flex-wrap gap-3'>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink'>
          <Wallet className='h-6 w-6 text-brand-teal' />
          Finanzas
        </h1>
        <div className='flex items-center gap-2'>
          <Link href={`/admin/finanzas?month=${prevMonth}`}>
            <Button variant='outline' size='icon'>
              <ChevronLeft className='h-4 w-4' />
            </Button>
          </Link>
          <span className='text-sm font-medium text-brand-ink capitalize w-36 text-center'>
            {monthLabel}
          </span>
          <Link href={`/admin/finanzas?month=${nextMonth}`}>
            <Button variant='outline' size='icon'>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue='resumen'>
        <TabsList>
          <TabsTrigger value='resumen'>Resumen</TabsTrigger>
          <TabsTrigger value='gastos'>Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value='resumen'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
            <SummaryCard icon={DollarSign} label='Ingresos de hoy' value={formatCOP(todayRevenue)} />
            <SummaryCard icon={TrendingUp} label='Ingresos del mes' value={formatCOP(totalRevenue)} />
            <SummaryCard icon={TrendingDown} label='Gastos del mes' value={formatCOP(totalExpenses)} />
            <SummaryCard icon={Wallet} label='Utilidad neta' value={formatCOP(netProfit)} />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6'>
            <SummaryCard icon={DollarSign} label='Ticket promedio' value={formatCOP(averageTicket)} />
            <SummaryCard icon={TrendingDown} label='No-show / cancelación' value={`${noShowRate}%`} />
            <SummaryCard
              icon={TrendingUp}
              label='Clientes nuevos vs recurrentes'
              value={`${newClients} / ${recurringClients}`}
            />
          </div>

          <Card className='mb-6'>
            <CardHeader>
              <CardTitle className='text-lg font-semibold'>Ingresos por día</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart data={dailyRevenue} />
            </CardContent>
          </Card>

          <ServiceBreakdownCard monthData={revenueByService} allTimeData={revenueByServiceAllTime} />
        </TabsContent>

        <TabsContent value='gastos'>
          <div className='flex justify-end mb-4'>
            <ExpenseFormDialog />
          </div>
          <Card>
            <CardContent className='p-0'>
              <ExpensesTable expenses={(expenses ?? []) as Expense[]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
