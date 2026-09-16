/**
 * Agregación de Finanzas. **Este archivo es el contrato con la UI**: la página
 * no debe volver a hacer cuentas a mano (antes toda la agregación vivía suelta
 * dentro de `app/admin/(dashboard)/finanzas/page.tsx`, y así no se podía reusar
 * ni testear).
 *
 * ---------------------------------------------------------------------------
 * POSTURA CONTABLE (decidida — ver también el encabezado de 0016_finanzas.sql)
 * ---------------------------------------------------------------------------
 * 1. El **ingreso por servicio** se reconoce en la fecha de la cita
 *    (`appointments.start_time`, hora Bogotá) por `charged_amount`, sobre citas
 *    COMPLETADA. No se reescribe el histórico.
 *
 * 2. Los **anticipos** (`appointments.deposit_received_amount`) NO se suman
 *    como ingreso ni se prorratean. El anticipo es un adelanto del mismo
 *    `charged_amount` que se registrará al cerrar la cita: sumarlo aparte
 *    contaría el mismo peso dos veces, primero al recibirlo y otra vez dentro
 *    del cobro final. Pero tampoco puede quedar invisible — es plata que ya
 *    entró. Por eso se expone como un KPI propio (`getHeldDeposits`):
 *    "Anticipos retenidos", sobre las citas que todavía no están
 *    COMPLETADA/CANCELADA/NO_ASISTIO/EXPIRADA.
 *
 * 3. **Utilidad ≠ caja.** `netProfit` es utilidad del negocio (P&L) y NO
 *    descuenta retiros: un retiro no es un gasto, es utilidad ya ganada que
 *    cambia de bolsillo. La plata realmente disponible es `getCashPosition`,
 *    donde retiros y aportes sí cuentan.
 *
 *    Qué `kind` entra al P&L y con qué signo NO se decide en este archivo: sale
 *    de `MOVEMENT_KIND_IS_OPERATING` + `MOVEMENT_KIND_SIGN` (`lib/finance/types.ts`),
 *    de donde `getMonthlyTotals` lo deriva. Ojo que esos signos están duplicados
 *    en SQL dentro de `finance_cash_flow_by_account()` (0016_finanzas.sql, §7a):
 *    tocar uno obliga a tocar el otro.
 *
 * ---------------------------------------------------------------------------
 * ZONA HORARIA
 * ---------------------------------------------------------------------------
 * Todo es America/Bogota (UTC-5 fijo) vía `lib/booking/timezone.ts`. El proceso
 * de Vercel corre en UTC: prohibido `getHours`/`getDate`/`Intl`/`date-fns` con
 * hora local para lógica de negocio.
 *
 * Ojo con el detalle sutil: `appointments.start_time` es `timestamptz` (hay que
 * convertir con `bogotaWallTimeToUtc` / `toBogotaWallClock`), mientras que
 * `financial_movements.movement_date` es un `date` simple que se compara como
 * string 'YYYY-MM-DD' — igual que hacía `expenses.expense_date`.
 */
import type { createClient } from '@/lib/supabase/server';
import {
  addDaysToDateStr,
  bogotaWallTimeToUtc,
  formatDateStr,
  toBogotaWallClock,
  todayInBogota,
} from '@/lib/booking/timezone';
import {
  currentMonth,
  daysInMonth,
  monthRange,
  shiftMonth,
  type MonthStr,
} from '@/lib/finance/month';
import {
  MOVEMENT_KIND_IS_OPERATING,
  MOVEMENT_KIND_LABEL,
  MOVEMENT_KIND_SIGN,
  MOVEMENT_KINDS,
} from '@/lib/finance/types';
import type {
  AccountBalance,
  CashPosition,
  CategoryExpenseRow,
  DailyCashFlowPoint,
  HeldDeposits,
  IncomeByAccountRow,
  MonthlyDeltas,
  MonthlyFinancialSummary,
  MonthlyFinancialTotals,
  MovementCsvRow,
  MovementFilters,
  MovementListResult,
  MovementListRow,
  PendingRecurringExpense,
  ServiceRevenueRow,
} from '@/lib/finance/types';
import type {
  ExpenseCategory,
  FinancialAccount,
  MovementKind,
  RecurringExpense,
} from '@/lib/supabase/types';

type FinanceClient = Awaited<ReturnType<typeof createClient>>;

/** Tamaño de página del listado de movimientos (mismo criterio que /admin/clientes). */
export const MOVEMENTS_PAGE_SIZE = 20;

/**
 * Estados en los que una cita todavía "debe" el servicio: su anticipo sigue
 * siendo plata retenida. Al pasar a COMPLETADA el anticipo se absorbe en
 * `charged_amount`; al pasar a CANCELADA/NO_ASISTIO/EXPIRADA deja de ser un
 * pasivo vivo (qué se hace con esa plata es una decisión comercial, no contable).
 */
const OPEN_APPOINTMENT_STATUSES = ['SOLICITADA', 'ESPERANDO_ANTICIPO', 'CONFIRMADA'] as const;

/** Rango de un mes en instantes UTC, para filtrar `appointments.start_time`. */
function monthUtcRange(month: MonthStr): { startIso: string; endIso: string } {
  const { startDate, endDateExclusive } = monthRange(month);
  return {
    startIso: bogotaWallTimeToUtc(startDate, '00:00').toISOString(),
    endIso: bogotaWallTimeToUtc(endDateExclusive, '00:00').toISOString(),
  };
}

/** Día del mes (1-31) en hora de Bogotá de un `timestamptz`. */
function bogotaDayOfMonth(iso: string): number {
  return Number(formatDateStr(toBogotaWallClock(new Date(iso))).split('-')[2]);
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

// ---------------------------------------------------------------------------
// Catálogos (cuentas, categorías, recurrentes)
// ---------------------------------------------------------------------------

/** Cuentas ordenadas por `display_order`. `activeOnly` para selectores. */
/**
 * Una agregación que corre en Postgres falló. Se lanza en vez de devolver
 * ceros a propósito: un cero silencioso en un número de plata es peor que un
 * error visible — nadie audita un total que "se ve bajo". La causa casi
 * siempre es la misma, y el mensaje lo dice.
 */
export class FinanceAggregateError extends Error {
  constructor(what: string) {
    super(
      `No se pudo calcular ${what}. Lo más probable es que falte correr la ` +
        `migración 0016 en ESTE proyecto de Supabase (son dos: dev y producción).`,
    );
    this.name = 'FinanceAggregateError';
  }
}

export async function listFinancialAccounts(
  supabase: FinanceClient,
  activeOnly = false,
): Promise<FinancialAccount[]> {
  let query = supabase
    .from('financial_accounts')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (activeOnly) query = query.eq('active', true);

  const { data } = await query;
  return (data ?? []) as FinancialAccount[];
}

export async function listExpenseCategories(
  supabase: FinanceClient,
  activeOnly = false,
): Promise<ExpenseCategory[]> {
  let query = supabase
    .from('expense_categories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (activeOnly) query = query.eq('active', true);

  const { data } = await query;
  return (data ?? []) as ExpenseCategory[];
}

export async function listRecurringExpenses(
  supabase: FinanceClient,
  activeOnly = false,
): Promise<RecurringExpense[]> {
  let query = supabase
    .from('recurring_expenses')
    .select('*')
    .order('day_of_month', { ascending: true })
    .order('name', { ascending: true });

  if (activeOnly) query = query.eq('active', true);

  const { data } = await query;
  return (data ?? []) as RecurringExpense[];
}

// ---------------------------------------------------------------------------
// Resumen mensual
// ---------------------------------------------------------------------------

/** Totales crudos de un mes (los mismos que se calculan para el mes anterior). */
async function getMonthlyTotals(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<{
  totals: MonthlyFinancialTotals;
  completed: Array<{ client_id: string; charged_amount: number | null; start_time: string }>;
}> {
  const { startDate, endDateExclusive } = monthRange(month);
  const { startIso, endIso } = monthUtcRange(month);

  const [{ data: completedRows }, { data: movementRows }] = await Promise.all([
    supabase
      .from('appointments')
      .select('client_id, charged_amount, start_time')
      .eq('status', 'COMPLETADA')
      .gte('start_time', startIso)
      .lt('start_time', endIso),
    supabase
      .from('financial_movements')
      .select('kind, amount')
      .gte('movement_date', startDate)
      .lt('movement_date', endDateExclusive),
  ]);

  const completed = (completedRows ?? []) as Array<{
    client_id: string;
    charged_amount: number | null;
    start_time: string;
  }>;

  const serviceRevenue = completed.reduce((sum, a) => sum + (a.charged_amount ?? 0), 0);

  // Un acumulador por `kind`, armado desde `MOVEMENT_KINDS`: si mañana aparece
  // un `kind` nuevo en el enum entra acá solo, sin tocar esta inicialización.
  const byKind = Object.fromEntries(MOVEMENT_KINDS.map((kind) => [kind, 0])) as Record<
    MovementKind,
    number
  >;
  for (const m of (movementRows ?? []) as Array<{ kind: MovementKind; amount: number }>) {
    byKind[m.kind] = (byKind[m.kind] ?? 0) + m.amount;
  }

  // La regla contable NO se vuelve a escribir acá: se DERIVA de los dos mapas
  // de `lib/finance/types.ts`. Un `kind` operativo con signo +1 suma a los
  // ingresos; uno operativo con signo -1 suma a los gastos (en positivo, que es
  // como se guardan los montos); los NO operativos —hoy RETIRO y APORTE— no
  // tocan el P&L, solo la caja (`getCashPosition`).
  //
  // Antes esto eran sumas a mano (`byKind.INGRESO_OTRO`, `byKind.GASTO`) y
  // `MOVEMENT_KIND_IS_OPERATING` no lo consumía nadie: dos copias de la misma
  // regla que podían divergir en silencio. Con los 4 `kind` de hoy el resultado es
  // idéntico —ingresos = INGRESO_OTRO, gastos = GASTO—, pero agregar un `kind`
  // nuevo ya no puede dejar la utilidad mal sin que nadie se entere.
  let otherIncome = 0;
  let operatingExpenses = 0;
  for (const kind of MOVEMENT_KINDS) {
    if (!MOVEMENT_KIND_IS_OPERATING[kind]) continue;
    if (MOVEMENT_KIND_SIGN[kind] === 1) otherIncome += byKind[kind];
    else operatingExpenses += byKind[kind];
  }

  const totalIncome = serviceRevenue + otherIncome;
  const netProfit = totalIncome - operatingExpenses;

  return {
    totals: {
      month,
      serviceRevenue,
      otherIncome,
      totalIncome,
      operatingExpenses,
      netProfit,
      marginPercent: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
      withdrawals: byKind.RETIRO,
      contributions: byKind.APORTE,
    },
    completed,
  };
}

/**
 * Todo lo que va arriba de la página de Finanzas, incluidos los totales del
 * mes anterior y las variaciones % — no hace falta una segunda llamada para
 * pintar los deltas ▲/▼.
 */
export async function getMonthlyFinancialSummary(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<MonthlyFinancialSummary> {
  const todayStr = todayInBogota();
  const { startIso, endIso } = monthUtcRange(month);

  const [
    { totals, completed },
    { totals: previous },
    { data: nonCompletedRows },
    { data: todayRows },
  ] = await Promise.all([
    getMonthlyTotals(supabase, month),
    getMonthlyTotals(supabase, shiftMonth(month, -1)),
    supabase
      .from('appointments')
      .select('id')
      .in('status', ['NO_ASISTIO', 'CANCELADA'])
      .gte('start_time', startIso)
      .lt('start_time', endIso),
    supabase
      .from('appointments')
      .select('charged_amount')
      .eq('status', 'COMPLETADA')
      .gte('start_time', bogotaWallTimeToUtc(todayStr, '00:00').toISOString())
      .lt('start_time', bogotaWallTimeToUtc(addDaysToDateStr(todayStr, 1), '00:00').toISOString()),
  ]);

  const chargedCount = completed.filter((a) => a.charged_amount != null).length;
  const averageTicket =
    chargedCount > 0 ? Math.round(totals.serviceRevenue / chargedCount) : 0;

  const nonCompletedCount = nonCompletedRows?.length ?? 0;
  const totalOutcomes = completed.length + nonCompletedCount;
  const noShowRate =
    totalOutcomes > 0 ? Math.round((nonCompletedCount / totalOutcomes) * 100) : 0;

  const todayRevenue = (todayRows ?? []).reduce(
    (sum, a: { charged_amount: number | null }) => sum + (a.charged_amount ?? 0),
    0,
  );

  // Nuevos vs. recurrentes: "nuevo" = su PRIMERA cita COMPLETADA histórica cae
  // dentro del mes consultado, o sea que NO tiene ninguna cita completada
  // anterior al mes.
  //
  // Lo resuelve Postgres (`finance_client_mix`), no JavaScript, por dos razones:
  //
  //  · el corte de fecha lo hace sobre `timestamptz` y no comparando strings.
  //    Antes se comparaba `startIso` (de `toISOString()`, '…T05:00:00.000Z')
  //    contra lo que devuelve PostgREST ('…T05:00:00+00:00'): con la misma
  //    fecha y hora el orden lexicográfico se decidía entre '+' (0x2B) y '.'
  //    (0x2E) y daba al revés, así que una primera cita a las 00:00 del día 1
  //    contaba como recurrente;
  //  · no depende de `max_rows`. La versión anterior traía el historial de
  //    todas las clientas del mes y lo cruzaba acá: 30 clientas con 50 visitas
  //    ya pasaban las 1000 filas y el conteo se degradaba sin avisar.
  const { data: mixRows, error: mixError } = await supabase.rpc('finance_client_mix', {
    p_start: startIso,
    p_end: endIso,
  });

  if (mixError) throw new FinanceAggregateError('los clientes nuevos vs. recurrentes');

  const mix = ((mixRows ?? []) as Array<{ new_clients: number; returning_clients: number }>)[0];
  const newClients = Number(mix?.new_clients) || 0;
  const recurringClients = Number(mix?.returning_clients) || 0;

  const deltas: MonthlyDeltas = {
    serviceRevenue: percentDelta(totals.serviceRevenue, previous.serviceRevenue),
    totalIncome: percentDelta(totals.totalIncome, previous.totalIncome),
    operatingExpenses: percentDelta(totals.operatingExpenses, previous.operatingExpenses),
    netProfit: percentDelta(totals.netProfit, previous.netProfit),
  };

  return {
    ...totals,
    todayRevenue,
    averageTicket,
    noShowRate,
    newClients,
    recurringClients,
    completedCount: completed.length,
    previous,
    deltas,
  };
}

/**
 * Solo los totales del mes anterior, por si la UI los necesita sueltos.
 * `getMonthlyFinancialSummary` ya los trae en `.previous` — usar ese y evitar
 * la consulta extra salvo que haga falta comparar contra otro mes.
 */
export async function getPreviousMonthComparison(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<MonthlyFinancialTotals> {
  const { totals } = await getMonthlyTotals(supabase, shiftMonth(month, -1));
  return totals;
}

// ---------------------------------------------------------------------------
// Caja disponible
// ---------------------------------------------------------------------------

/**
 * Caja disponible = Σ `opening_balance` de TODAS las cuentas (activas o no)
 *                 + Σ ingresos por servicio (histórico, todas las COMPLETADA)
 *                 + Σ INGRESO_OTRO + Σ APORTE − Σ GASTO − Σ RETIRO.
 *
 * Es histórico a propósito: la caja no se "reinicia" cada mes.
 *
 * Los movimientos y citas sin `account_id` **sí** cuentan en `totalCash`, pero
 * no en el saldo de ninguna cuenta: caen en `unassignedBalance`, junto con lo
 * que quedó pegado a una cuenta desactivada. Así siempre se cumple
 * `totalCash === Σ byAccount.balance + unassignedBalance`, y la UI puede
 * advertir cuando hay mucha plata sin asignar.
 */
export async function getCashPosition(supabase: FinanceClient): Promise<CashPosition> {
  const [accounts, { data: flowRows, error }] = await Promise.all([
    listFinancialAccounts(supabase),
    supabase.rpc('finance_cash_flow_by_account'),
  ]);

  if (error) throw new FinanceAggregateError('la caja disponible');

  const activeAccounts = accounts.filter((a) => a.active);
  const activeIds = new Set(activeAccounts.map((a) => a.id));

  // El `opening_balance` de una cuenta desactivada tampoco desaparece: sigue
  // siendo plata que existe. Si no se sumara acá, desactivar una cuenta con
  // $500.000 de saldo inicial bajaría la caja total en $500.000 sin que nada
  // lo explique. Va al balde de "sin asignar", igual que sus movimientos.
  const inactiveOpening = accounts
    .filter((a) => !a.active)
    .reduce((sum, a) => sum + a.opening_balance, 0);

  const flowByAccount = new Map<string, number>();
  let unassignedFlow = inactiveOpening;

  // Postgres ya devolvió una fila por cuenta (más una con account_id null):
  // acá solo se reparte entre cuentas activas y el balde sin asignar.
  for (const row of (flowRows ?? []) as Array<{ account_id: string | null; net_flow: number }>) {
    const delta = Number(row.net_flow) || 0;
    if (row.account_id && activeIds.has(row.account_id)) {
      flowByAccount.set(row.account_id, (flowByAccount.get(row.account_id) ?? 0) + delta);
    } else {
      unassignedFlow += delta;
    }
  }

  const byAccount: AccountBalance[] = activeAccounts.map((account) => ({
    account,
    balance: account.opening_balance + (flowByAccount.get(account.id) ?? 0),
  }));

  return {
    totalCash: byAccount.reduce((sum, r) => sum + r.balance, 0) + unassignedFlow,
    byAccount,
    unassignedBalance: unassignedFlow,
  };
}

/**
 * Anticipos retenidos: plata que ya entró por citas que todavía no se cerraron.
 * NO es un ingreso (se contará dentro del `charged_amount` al completar la
 * cita); es un KPI informativo para que esa plata deje de ser invisible.
 */
export async function getHeldDeposits(supabase: FinanceClient): Promise<HeldDeposits> {
  const { data } = await supabase
    .from('appointments')
    .select('deposit_received_amount')
    .in('status', OPEN_APPOINTMENT_STATUSES as unknown as string[])
    .not('deposit_received_amount', 'is', null)
    .gt('deposit_received_amount', 0);

  const rows = (data ?? []) as Array<{ deposit_received_amount: number | null }>;
  return {
    total: rows.reduce((sum, r) => sum + (r.deposit_received_amount ?? 0), 0),
    count: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Desgloses
// ---------------------------------------------------------------------------

/**
 * Ingresos por servicio. `month = null` devuelve el histórico completo (es lo
 * que alimenta la pestaña "Histórico" del desglose, igual que antes).
 */
export async function getRevenueByService(
  supabase: FinanceClient,
  month: MonthStr | null,
): Promise<ServiceRevenueRow[]> {
  const range = month ? monthUtcRange(month) : null;

  const { data, error } = await supabase.rpc('finance_revenue_by_service', {
    p_start: range?.startIso ?? null,
    p_end: range?.endIso ?? null,
  });

  if (error) throw new FinanceAggregateError('los ingresos por servicio');

  return ((data ?? []) as Array<{
    service_id: string;
    service_name: string | null;
    total: number;
    appointment_count: number;
  }>)
    .map((r) => ({
      serviceId: r.service_id,
      name: r.service_name ?? 'Servicio',
      total: Number(r.total) || 0,
      count: Number(r.appointment_count) || 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Gastos del mes agrupados por categoría gestionada. */
export async function getExpensesByCategory(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<CategoryExpenseRow[]> {
  const { startDate, endDateExclusive } = monthRange(month);

  const { data } = await supabase
    .from('financial_movements')
    .select('amount, category_id, expense_categories(id, name, nature)')
    .eq('kind', 'GASTO')
    .gte('movement_date', startDate)
    .lt('movement_date', endDateExclusive);

  const byCategory = new Map<string, CategoryExpenseRow>();
  for (const m of (data ?? []) as unknown as Array<{
    amount: number;
    category_id: string | null;
    expense_categories: { id: string; name: string; nature: 'FIJO' | 'VARIABLE' } | null;
  }>) {
    // Los gastos migrados desde `expenses` cuya categoría no calzó quedan sin
    // categoría: se agrupan en un balde propio en vez de desaparecer.
    const key = m.category_id ?? '__sin_categoria__';
    const entry = byCategory.get(key) ?? {
      categoryId: m.category_id,
      name: m.expense_categories?.name ?? 'Sin categoría',
      nature: m.expense_categories?.nature ?? null,
      total: 0,
      count: 0,
    };
    entry.total += m.amount;
    entry.count += 1;
    byCategory.set(key, entry);
  }

  return [...byCategory.values()].sort((a, b) => b.total - a.total);
}

/**
 * De dónde entró la plata este mes: ingresos por servicio (`appointments`) más
 * los INGRESO_OTRO, agrupados por cuenta.
 *
 * Las citas anteriores a la migración 0016 no tienen `account_id`. En vez de
 * meterlas todas en un "Sin asignar" opaco, se agrupan por su `payment_method`
 * histórico (el texto libre que sí se capturaba) y se marcan `assigned: false`.
 */
export async function getIncomeByAccount(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<IncomeByAccountRow[]> {
  const { startDate, endDateExclusive } = monthRange(month);
  const { startIso, endIso } = monthUtcRange(month);

  const [{ data: appointmentRows }, { data: movementRows }, accounts] = await Promise.all([
    supabase
      .from('appointments')
      .select('charged_amount, account_id, payment_method')
      .eq('status', 'COMPLETADA')
      .gte('start_time', startIso)
      .lt('start_time', endIso),
    supabase
      .from('financial_movements')
      .select('amount, account_id')
      .eq('kind', 'INGRESO_OTRO')
      .gte('movement_date', startDate)
      .lt('movement_date', endDateExclusive),
    listFinancialAccounts(supabase),
  ]);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = new Map<string, IncomeByAccountRow>();

  function add(accountId: string | null, fallbackLabel: string | null, amount: number) {
    if (amount === 0) return;
    const resolvedName = accountId ? accountName.get(accountId) : undefined;
    const assigned = !!resolvedName;
    // `|| 'Sin asignar'` y no `??`: un `payment_method` de cadena vacía (o
    // solo espacios) no es null, y con `??` se colaba como una fila sin
    // nombre en el desglose.
    const name = resolvedName ?? (fallbackLabel?.trim() || 'Sin asignar');
    const key = assigned ? `a:${accountId}` : `f:${name.toLowerCase()}`;
    const entry = rows.get(key) ?? {
      accountId: assigned ? accountId : null,
      name,
      total: 0,
      assigned,
    };
    entry.total += amount;
    rows.set(key, entry);
  }

  for (const a of (appointmentRows ?? []) as Array<{
    charged_amount: number | null;
    account_id: string | null;
    payment_method: string | null;
  }>) {
    add(a.account_id, a.payment_method, a.charged_amount ?? 0);
  }

  for (const m of (movementRows ?? []) as Array<{ amount: number; account_id: string | null }>) {
    add(m.account_id, null, m.amount);
  }

  return [...rows.values()].sort((a, b) => b.total - a.total);
}

/**
 * Serie diaria del mes para el gráfico. Devuelve TODOS los días del mes
 * (incluidos los de cero) para que el eje X no tenga huecos.
 *
 * Solo P&L: retiros y aportes quedan fuera. Mezclarlos haría que un retiro se
 * viera como un día de gastos enorme, que es justo la confusión que este
 * módulo viene a eliminar.
 */
export async function getDailyCashFlow(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<DailyCashFlowPoint[]> {
  const { startDate, endDateExclusive } = monthRange(month);
  const { startIso, endIso } = monthUtcRange(month);

  const [{ data: appointmentRows }, { data: movementRows }] = await Promise.all([
    supabase
      .from('appointments')
      .select('charged_amount, start_time')
      .eq('status', 'COMPLETADA')
      .gte('start_time', startIso)
      .lt('start_time', endIso),
    supabase
      .from('financial_movements')
      .select('kind, amount, movement_date')
      .in('kind', ['INGRESO_OTRO', 'GASTO'])
      .gte('movement_date', startDate)
      .lt('movement_date', endDateExclusive),
  ]);

  const income = new Map<number, number>();
  const expense = new Map<number, number>();

  for (const a of (appointmentRows ?? []) as Array<{
    charged_amount: number | null;
    start_time: string;
  }>) {
    const day = bogotaDayOfMonth(a.start_time);
    income.set(day, (income.get(day) ?? 0) + (a.charged_amount ?? 0));
  }

  for (const m of (movementRows ?? []) as Array<{
    kind: MovementKind;
    amount: number;
    movement_date: string;
  }>) {
    // `movement_date` ya es 'YYYY-MM-DD' en hora de Bogotá: no hay que convertir.
    const day = Number(m.movement_date.split('-')[2]);
    const target = m.kind === 'GASTO' ? expense : income;
    target.set(day, (target.get(day) ?? 0) + m.amount);
  }

  return Array.from({ length: daysInMonth(month) }, (_, i) => ({
    day: i + 1,
    income: income.get(i + 1) ?? 0,
    expense: expense.get(i + 1) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Listado de movimientos
// ---------------------------------------------------------------------------

const MOVEMENT_SELECT =
  '*, expense_categories(id, name), financial_accounts(id, name)';

function toMovementListRow(raw: Record<string, unknown>): MovementListRow {
  const { expense_categories: category, financial_accounts: account, ...rest } = raw as {
    expense_categories: { id: string; name: string } | null;
    financial_accounts: { id: string; name: string } | null;
  } & Record<string, unknown>;

  return {
    ...(rest as unknown as MovementListRow),
    category: category ?? null,
    account: account ?? null,
  };
}

/**
 * Listado paginado del libro, con filtros opcionales. La página vive en la URL
 * (`?page=`), igual que en /admin/clientes, y se usa `components/admin/pagination.tsx`.
 *
 * Si la página pedida quedó más allá del final (p. ej. se borró un movimiento
 * estando en la última página), se reintenta con la última página real en vez
 * de devolver una tabla vacía.
 */
export async function listMovements(
  supabase: FinanceClient,
  filters: MovementFilters,
): Promise<MovementListResult> {
  const { startDate, endDateExclusive } = monthRange(filters.month);
  const requestedPage = Math.max(1, Math.trunc(filters.page ?? 1));

  async function run(page: number) {
    let query = supabase
      .from('financial_movements')
      .select(MOVEMENT_SELECT, { count: 'exact' })
      .gte('movement_date', startDate)
      .lt('movement_date', endDateExclusive);

    if (filters.kind) query = query.eq('kind', filters.kind);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.accountId) query = query.eq('account_id', filters.accountId);

    const from = (page - 1) * MOVEMENTS_PAGE_SIZE;
    return query
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + MOVEMENTS_PAGE_SIZE - 1);
  }

  let { data, count } = await run(requestedPage);
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / MOVEMENTS_PAGE_SIZE));

  let page = requestedPage;
  if (page > totalPages) {
    page = totalPages;
    ({ data } = await run(page));
  }

  return {
    rows: ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toMovementListRow),
    totalCount,
    page,
    pageSize: MOVEMENTS_PAGE_SIZE,
  };
}

/**
 * Filas planas del mes para exportar a CSV. Incluye TAMBIÉN los ingresos por
 * servicio (una fila por cita completada) además de los movimientos: un
 * export que solo trajera `financial_movements` no cuadraría con ningún KPI
 * de la página, porque el grueso del ingreso vive en `appointments`.
 */
export async function getMonthlyMovementsForCsv(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<MovementCsvRow[]> {
  const { startDate, endDateExclusive } = monthRange(month);
  const { startIso, endIso } = monthUtcRange(month);

  const [{ data: movementRows }, { data: appointmentRows }, accounts] = await Promise.all([
    supabase
      .from('financial_movements')
      .select(MOVEMENT_SELECT)
      .gte('movement_date', startDate)
      .lt('movement_date', endDateExclusive)
      .order('movement_date', { ascending: true }),
    supabase
      .from('appointments')
      .select('charged_amount, start_time, account_id, payment_method, clients(name), services(name)')
      .eq('status', 'COMPLETADA')
      .gte('start_time', startIso)
      .lt('start_time', endIso)
      .order('start_time', { ascending: true }),
    listFinancialAccounts(supabase),
  ]);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const serviceRows: MovementCsvRow[] = (
    (appointmentRows ?? []) as unknown as Array<{
      charged_amount: number | null;
      start_time: string;
      account_id: string | null;
      payment_method: string | null;
      clients: { name: string } | null;
      services: { name: string } | null;
    }>
  ).map((a) => ({
    fecha: formatDateStr(toBogotaWallClock(new Date(a.start_time))),
    tipo: 'Ingreso por servicio',
    categoria: a.services?.name ?? 'Servicio',
    cuenta:
      (a.account_id ? accountName.get(a.account_id) : undefined) ??
      (a.payment_method?.trim() || 'Sin asignar'),
    descripcion: a.clients?.name ?? '',
    monto: a.charged_amount ?? 0,
  }));

  const ledgerRows: MovementCsvRow[] = ((movementRows ?? []) as unknown as Array<
    Record<string, unknown>
  >)
    .map(toMovementListRow)
    .map((m) => ({
      fecha: m.movement_date,
      tipo: MOVEMENT_KIND_LABEL[m.kind],
      categoria: m.category?.name ?? '',
      cuenta: m.account?.name ?? 'Sin asignar',
      descripcion: m.description ?? '',
      monto: m.amount,
    }));

  return [...serviceRows, ...ledgerRows].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---------------------------------------------------------------------------
// Gastos recurrentes
// ---------------------------------------------------------------------------

/**
 * Plantillas activas que todavía NO tienen un movimiento con ese
 * `recurring_template_id` dentro del mes consultado — lo que la UI ofrece
 * registrar con un clic.
 *
 * No hay cron que las genere sola, a propósito: un gasto fijo puede cambiar de
 * monto o no pagarse ese mes, y un movimiento inventado es peor que ninguno.
 *
 * Un mes FUTURO nunca tiene pendientes: navegar a noviembre en septiembre no
 * debe ofrecer "registrar el arriendo de noviembre" ni avisar que faltan N
 * gastos fijos que todavía no vencieron. Dentro del mes en curso sí se ofrecen
 * todos, aunque su `day_of_month` no haya llegado: un gasto fijo se puede
 * pagar antes, y esconderlo obligaría a registrarlo a mano — sin quedar
 * vinculado a la plantilla, volvería a aparecer como pendiente y se pagaría
 * dos veces.
 */
export async function getPendingRecurringExpenses(
  supabase: FinanceClient,
  month: MonthStr,
): Promise<PendingRecurringExpense[]> {
  if (month > currentMonth()) return [];

  const { startDate, endDateExclusive } = monthRange(month);

  const [templates, { data: registered }, accounts, categories] = await Promise.all([
    listRecurringExpenses(supabase, true),
    supabase
      .from('financial_movements')
      .select('recurring_template_id')
      .not('recurring_template_id', 'is', null)
      .gte('movement_date', startDate)
      .lt('movement_date', endDateExclusive),
    listFinancialAccounts(supabase),
    listExpenseCategories(supabase),
  ]);

  const alreadyRegistered = new Set(
    ((registered ?? []) as Array<{ recurring_template_id: string | null }>)
      .map((r) => r.recurring_template_id)
      .filter((id): id is string => !!id),
  );
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return templates
    .filter((t) => !alreadyRegistered.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      amount: t.amount,
      dayOfMonth: t.day_of_month,
      categoryId: t.category_id,
      categoryName: t.category_id ? categoryName.get(t.category_id) ?? null : null,
      accountId: t.account_id,
      accountName: t.account_id ? accountName.get(t.account_id) ?? null : null,
      suggestedDate: `${month}-${String(t.day_of_month).padStart(2, '0')}`,
    }));
}
