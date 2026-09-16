import Link from 'next/link';
import {
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  HandCoins,
  Percent,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StaggerIn from '@/components/admin/stagger-in';
import Pagination from '@/components/admin/pagination';
import FinanceStatCard from '@/components/admin/finance-stat-card';
import DailyCashFlowChart from '@/components/admin/daily-cash-flow-chart';
import ServiceBreakdownCard from '@/components/admin/service-breakdown-card';
import CategoryBreakdownCard from '@/components/admin/category-breakdown-card';
import IncomeByAccountCard from '@/components/admin/income-by-account-card';
import ExportMovementsButton from '@/components/admin/export-movements-button';
import MovementsFilters from '@/components/admin/movements-filters';
import MovementsTable from '@/components/admin/movements-table';
import MovementFormDialog from '@/components/admin/movement-form-dialog';
import PendingRecurringNotice from '@/components/admin/pending-recurring-notice';
import RecurringExpensesTable from '@/components/admin/recurring-expenses-table';
import RecurringExpenseFormDialog from '@/components/admin/recurring-expense-form-dialog';
import FinancialAccountsTable from '@/components/admin/financial-accounts-table';
import FinancialAccountFormDialog from '@/components/admin/financial-account-form-dialog';
import ExpenseCategoriesTable from '@/components/admin/expense-categories-table';
import ExpenseCategoryFormDialog from '@/components/admin/expense-category-form-dialog';
import {
  MOVEMENTS_PAGE_SIZE,
  getCashPosition,
  getDailyCashFlow,
  getExpensesByCategory,
  getHeldDeposits,
  getIncomeByAccount,
  getMonthlyFinancialSummary,
  getMonthlyMovementsForCsv,
  getPendingRecurringExpenses,
  getRevenueByService,
  listExpenseCategories,
  listFinancialAccounts,
  listMovements,
  listRecurringExpenses,
} from '@/lib/finance/queries';
import { monthLabel, parseMonth, shiftMonth, type MonthStr } from '@/lib/finance/month';
import type { MovementKind } from '@/lib/finance/types';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';

const BASE_PATH = '/admin/finanzas';

const TABS = [
  { value: 'resumen', label: 'Resumen', shortLabel: 'Resumen' },
  { value: 'movimientos', label: 'Movimientos', shortLabel: 'Movs.' },
  { value: 'fijos', label: 'Gastos fijos', shortLabel: 'Fijos' },
  { value: 'cuentas', label: 'Cuentas', shortLabel: 'Cuentas' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

const MOVEMENT_KINDS: MovementKind[] = ['INGRESO_OTRO', 'GASTO', 'RETIRO', 'APORTE'];

function parseTab(value: string | undefined): TabValue {
  return TABS.some((t) => t.value === value) ? (value as TabValue) : 'resumen';
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseKind(value: string | undefined): MovementKind | undefined {
  return MOVEMENT_KINDS.includes(value as MovementKind) ? (value as MovementKind) : undefined;
}

/** Los filtros solo aceptan uuids: cualquier otra cosa se ignora en vez de viajar a PostgREST. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseUuid(value: string | undefined): string | undefined {
  return value && UUID_RE.test(value) ? value : undefined;
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    tab?: string;
    tipo?: string;
    categoria?: string;
    cuenta?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const month = parseMonth(params.month);
  const tab = parseTab(params.tab);
  const kind = parseKind(params.tipo);
  const categoryId = parseUuid(params.categoria);
  const accountId = parseUuid(params.cuenta);
  const page = parsePage(params.page);

  const supabase = await createClient();

  return (
    <div>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink'>
          <Wallet className='h-6 w-6 text-brand-teal' />
          Finanzas
        </h1>
        <MonthNav month={month} tab={tab} />
      </div>

      <TabsNav current={tab} month={month} />

      <div className='mt-4'>
        {tab === 'resumen' && <ResumenTab supabase={supabase} month={month} />}
        {tab === 'movimientos' && (
          <MovimientosTab
            supabase={supabase}
            month={month}
            kind={kind}
            categoryId={categoryId}
            accountId={accountId}
            page={page}
          />
        )}
        {tab === 'fijos' && <FijosTab supabase={supabase} />}
        {tab === 'cuentas' && <CuentasTab supabase={supabase} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navegación
// ---------------------------------------------------------------------------

function MonthNav({ month, tab }: { month: MonthStr; tab: TabValue }) {
  function href(target: MonthStr) {
    return `${BASE_PATH}?month=${target}&tab=${tab}`;
  }

  // `asChild`: el enlace ES el botón. Un <button> dentro de un <a> es HTML
  // inválido y deja dos paradas de teclado, la segunda sin nombre accesible.
  return (
    <div className='flex items-center gap-2'>
      <Button asChild variant='outline' size='icon'>
        <Link href={href(shiftMonth(month, -1))} aria-label='Mes anterior'>
          <ChevronLeft className='h-4 w-4' />
        </Link>
      </Button>
      <span className='w-36 text-center text-sm font-medium capitalize text-brand-ink'>
        {monthLabel(month)}
      </span>
      <Button asChild variant='outline' size='icon'>
        <Link href={href(shiftMonth(month, 1))} aria-label='Mes siguiente'>
          <ChevronRight className='h-4 w-4' />
        </Link>
      </Button>
    </div>
  );
}

/**
 * Las pestañas son enlaces y no estado de cliente: la de Movimientos pagina y
 * filtra por URL, y con pestañas en memoria un `<Link>` de paginación
 * devolvería a "Resumen" en cada página.
 *
 * A 360px cuatro pestañas en una fila no caben (se desbordan del contenedor y,
 * con el `overflow-x-hidden` de la columna, quedan recortadas sin aviso): en
 * móvil se muestran en 2×2, y de `sm` en adelante en una sola fila.
 */
function TabsNav({ current, month }: { current: TabValue; month: MonthStr }) {
  return (
    <nav
      aria-label='Secciones de Finanzas'
      className='grid w-full grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:inline-flex sm:w-auto sm:gap-0'
    >
      {TABS.map((t) => {
        const isActive = t.value === current;
        return (
          <Link
            key={t.value}
            href={`${BASE_PATH}?month=${month}&tab=${t.value}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              // h-11 en móvil: son la navegación principal de la pantalla y
              // 32px se queda corto para el dedo (mínimo recomendado 44px).
              'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 sm:h-8',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-brand-ink',
            )}
          >
            <span className='sm:hidden'>{t.shortLabel}</span>
            <span className='hidden sm:inline'>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className='mb-3'>
      <h2 className='text-xs font-semibold uppercase tracking-wide text-gray-500'>{title}</h2>
      {hint && <p className='mt-0.5 text-xs text-gray-500'>{hint}</p>}
    </div>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Pestaña: Resumen
// ---------------------------------------------------------------------------

async function ResumenTab({
  supabase,
  month,
}: {
  supabase: SupabaseClient;
  month: MonthStr;
}) {
  const [
    summary,
    cash,
    deposits,
    servicesMonth,
    servicesAllTime,
    expensesByCategory,
    incomeByAccount,
    dailyFlow,
    csvRows,
  ] = await Promise.all([
    getMonthlyFinancialSummary(supabase, month),
    getCashPosition(supabase),
    getHeldDeposits(supabase),
    getRevenueByService(supabase, month),
    getRevenueByService(supabase, null),
    getExpensesByCategory(supabase, month),
    getIncomeByAccount(supabase, month),
    getDailyCashFlow(supabase, month),
    getMonthlyMovementsForCsv(supabase, month),
  ]);

  return (
    <div className='space-y-8'>
      <section>
        <div className='mb-3 flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-xs font-semibold uppercase tracking-wide text-gray-500'>
              Resultado del mes
            </h2>
            <p className='mt-0.5 text-xs text-gray-500'>
              Lo que el negocio ganó en {monthLabel(month)}. No es la plata que tienes: eso es la
              caja, abajo.
            </p>
          </div>
          <ExportMovementsButton month={month} rows={csvRows} />
        </div>

        <StaggerIn className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <FinanceStatCard
            icon={TrendingUp}
            label='Ingresos del mes'
            value={formatCOP(summary.totalIncome)}
            hint={`Servicios ${formatCOP(summary.serviceRevenue)} · otros ${formatCOP(
              summary.otherIncome,
            )}`}
            delta={summary.deltas.totalIncome}
          />
          <FinanceStatCard
            icon={TrendingDown}
            label='Gastos operativos'
            value={formatCOP(summary.operatingExpenses)}
            tooltip='Solo costos del negocio. Tus retiros NO están acá: un retiro no es un gasto.'
            delta={summary.deltas.operatingExpenses}
            higherIsBetter={false}
          />
          <FinanceStatCard
            icon={PiggyBank}
            label='Utilidad del negocio'
            value={formatCOP(summary.netProfit)}
            tooltip='Ingresos menos gastos operativos. Los retiros y aportes no la tocan: sacar plata no hace que el negocio haya ganado menos.'
            delta={summary.deltas.netProfit}
          />
          <FinanceStatCard
            icon={Percent}
            label='Margen'
            value={`${summary.marginPercent}%`}
            hint={`Mes anterior: ${summary.previous.marginPercent}%`}
          />
        </StaggerIn>
      </section>

      <section>
        <SectionHeading
          title='Caja'
          hint='La plata que existe de verdad, acumulada desde siempre. Acá los retiros y aportes sí cuentan.'
        />
        <StaggerIn className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <FinanceStatCard
            icon={Banknote}
            label='Caja disponible'
            value={formatCOP(cash.totalCash)}
            tooltip='Saldo histórico de todas las cuentas: saldos iniciales + todo lo que entró − todo lo que salió, retiros incluidos.'
            hint={
              cash.unassignedBalance !== 0
                ? `${formatCOP(cash.unassignedBalance)} sin asignar a una cuenta`
                : undefined
            }
          />
          <FinanceStatCard
            icon={ArrowUpRight}
            label='Retirado en el mes'
            value={formatCOP(summary.withdrawals)}
            tooltip='Lo que sacaste del negocio este mes. Baja la caja, no la utilidad.'
          />
          <FinanceStatCard
            icon={HandCoins}
            label='Aportes del mes'
            value={formatCOP(summary.contributions)}
            tooltip='Plata tuya que metiste al negocio. Sube la caja, no la utilidad.'
          />
          <FinanceStatCard
            icon={CalendarCheck}
            label='Anticipos retenidos'
            value={formatCOP(deposits.total)}
            hint={`De ${deposits.count} ${deposits.count === 1 ? 'cita' : 'citas'} por completar`}
            tooltip='Plata que ya entró por citas que aún no se cierran. No se cuenta como ingreso todavía: se contará dentro del cobro final de cada cita.'
          />
        </StaggerIn>
      </section>

      <section>
        <SectionHeading title='Operación' />
        <StaggerIn className='grid grid-cols-2 gap-4 xl:grid-cols-4'>
          <FinanceStatCard
            compact
            icon={DollarSign}
            label='Ingresos de hoy'
            value={formatCOP(summary.todayRevenue)}
          />
          <FinanceStatCard
            compact
            icon={Receipt}
            label='Ticket promedio'
            value={formatCOP(summary.averageTicket)}
            hint={`${summary.completedCount} ${
              summary.completedCount === 1 ? 'cita completada' : 'citas completadas'
            }`}
          />
          <FinanceStatCard
            compact
            icon={TrendingDown}
            label='No-show / cancelación'
            value={`${summary.noShowRate}%`}
          />
          <FinanceStatCard
            compact
            icon={summary.newClients >= summary.recurringClients ? UserPlus : Users}
            label='Nuevos / recurrentes'
            value={`${summary.newClients} / ${summary.recurringClients}`}
          />
        </StaggerIn>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg font-semibold'>Ingresos y gastos por día</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyCashFlowChart data={dailyFlow} />
          <p className='mt-3 text-xs text-gray-500'>
            Este gráfico es el resultado del negocio, no la caja: los retiros y aportes quedan
            fuera a propósito. Si entraran, un retiro se vería como un día de gastos enorme.
          </p>
        </CardContent>
      </Card>

      <div className='grid gap-4 lg:grid-cols-2'>
        <ServiceBreakdownCard monthData={servicesMonth} allTimeData={servicesAllTime} />
        <CategoryBreakdownCard rows={expensesByCategory} />
      </div>

      <IncomeByAccountCard rows={incomeByAccount} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pestaña: Movimientos
// ---------------------------------------------------------------------------

async function MovimientosTab({
  supabase,
  month,
  kind,
  categoryId,
  accountId,
  page,
}: {
  supabase: SupabaseClient;
  month: MonthStr;
  kind?: MovementKind;
  categoryId?: string;
  accountId?: string;
  page: number;
}) {
  const [movements, accounts, categories, pending] = await Promise.all([
    listMovements(supabase, { month, kind, categoryId, accountId, page }),
    listFinancialAccounts(supabase),
    listExpenseCategories(supabase),
    getPendingRecurringExpenses(supabase, month),
  ]);

  const hasFilters = !!(kind || categoryId || accountId);

  return (
    <div className='space-y-4'>
      <PendingRecurringNotice month={month} pending={pending} />

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-gray-500'>
          El libro de {monthLabel(month)}: gastos, ingresos extra, retiros y aportes. Los ingresos
          por cita no se registran acá, entran solos al completar la cita.
        </p>
        <MovementFormDialog month={month} accounts={accounts} categories={categories} />
      </div>

      <MovementsFilters
        month={month}
        kind={kind}
        categoryId={categoryId}
        accountId={accountId}
        accounts={accounts}
        categories={categories}
      />

      <MovementsTable
        movements={movements.rows}
        month={month}
        accounts={accounts}
        categories={categories}
        hasFilters={hasFilters}
      />

      {movements.totalCount > 0 && (
        <Pagination
          page={movements.page}
          pageSize={MOVEMENTS_PAGE_SIZE}
          totalCount={movements.totalCount}
          basePath={BASE_PATH}
          params={{ month, tab: 'movimientos', tipo: kind, categoria: categoryId, cuenta: accountId }}
          itemLabel={{ singular: 'movimiento', plural: 'movimientos' }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pestaña: Gastos fijos
// ---------------------------------------------------------------------------

async function FijosTab({ supabase }: { supabase: SupabaseClient }) {
  const [recurring, accounts, categories] = await Promise.all([
    listRecurringExpenses(supabase),
    listFinancialAccounts(supabase),
    listExpenseCategories(supabase),
  ]);

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <p className='max-w-2xl text-sm text-gray-500'>
          Plantillas de lo que pagas todos los meses. <strong>No se registran solas</strong>: cada
          mes aparecen como pendientes en Movimientos y las confirmas con un clic. Es a propósito
          —un gasto fijo puede cambiar de monto o no pagarse ese mes, y un movimiento inventado
          descuadraría la utilidad y la caja sin que nadie se entere.
        </p>
        <RecurringExpenseFormDialog accounts={accounts} categories={categories} />
      </div>

      <RecurringExpensesTable
        recurring={recurring}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pestaña: Cuentas
// ---------------------------------------------------------------------------

async function CuentasTab({ supabase }: { supabase: SupabaseClient }) {
  const [accounts, categories, cash] = await Promise.all([
    listFinancialAccounts(supabase),
    listExpenseCategories(supabase),
    getCashPosition(supabase),
  ]);

  return (
    <div className='space-y-8'>
      <section>
        <div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-brand-ink'>Cuentas</h2>
            <p className='max-w-2xl text-sm text-gray-500'>
              Dónde vive la plata. El orden es el que verás al cobrar una cita, así que arriba
              conviene dejar las que más usas. Las cuentas no se borran, se desactivan: sus
              movimientos históricos siguen explicando de dónde salió cada peso.
            </p>
          </div>
          <FinancialAccountFormDialog />
        </div>

        <FinancialAccountsTable accounts={accounts} cash={cash} />
      </section>

      <section>
        <div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-brand-ink'>Categorías de gasto</h2>
            <p className='max-w-2xl text-sm text-gray-500'>
              En qué se va la plata. Marcar una como <strong>Fijo</strong> o{' '}
              <strong>Variable</strong> es lo que deja leer de un vistazo cuánto del mes ya estaba
              comprometido. Tampoco se borran: se desactivan.
            </p>
          </div>
          <ExpenseCategoryFormDialog />
        </div>

        <ExpenseCategoriesTable categories={categories} />
      </section>
    </div>
  );
}
