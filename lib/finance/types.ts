/**
 * Contrato de tipos del módulo de Finanzas.
 *
 * Las filas de tabla viven en `lib/supabase/types.ts` junto con el resto del
 * esquema (es la convención del proyecto: un solo archivo con el modelo de
 * datos) y se re-exportan acá para que la UI tenga **un solo import**:
 *
 *     import type { FinancialAccount, MonthlyFinancialSummary } from '@/lib/finance/types';
 *
 * Lo que sí nace acá son los tipos **agregados** — lo que devuelven las
 * funciones de `lib/finance/queries.ts`, listo para pintar.
 */
export type {
  ExpenseCategory,
  ExpenseNature,
  FinancialAccount,
  FinancialAccountKind,
  FinancialMovement,
  MovementKind,
  RecurringExpense,
} from '@/lib/supabase/types';

import type {
  ExpenseNature,
  FinancialAccount,
  FinancialMovement,
  MovementKind,
} from '@/lib/supabase/types';
import type { MonthStr } from '@/lib/finance/month';

export type { MonthStr };

/** Etiqueta en español de cada tipo de movimiento, para la UI. */
export const MOVEMENT_KIND_LABEL: Record<MovementKind, string> = {
  INGRESO_OTRO: 'Otro ingreso',
  GASTO: 'Gasto',
  RETIRO: 'Retiro',
  APORTE: 'Aporte',
};

/**
 * true si el movimiento entra al P&L (utilidad). Retiros y aportes no.
 *
 * Junto con `MOVEMENT_KIND_SIGN` es la **única** definición de la regla
 * contable del lado TypeScript: `getMonthlyTotals` (lib/finance/queries.ts)
 * DERIVA de estos dos mapas los ingresos, los gastos operativos y la utilidad,
 * en vez de repetir a mano qué `kind` entra a cada total. Clasificar un `kind`
 * nuevo acá y en el mapa de signos es todo lo que hay que hacer para que el
 * P&L lo tenga en cuenta.
 */
export const MOVEMENT_KIND_IS_OPERATING: Record<MovementKind, boolean> = {
  INGRESO_OTRO: true,
  GASTO: true,
  // Un retiro no es un gasto: es utilidad YA ganada que cambia de bolsillo.
  RETIRO: false,
  // Un aporte no es un ingreso: es plata que Manu mete, no que ganó el negocio.
  APORTE: false,
};

/**
 * +1 si el movimiento entra plata a la caja, -1 si la saca.
 *
 * OJO — ESTA REGLA ESTÁ DUPLICADA EN SQL. `finance_cash_flow_by_account()` en
 * `supabase/migrations/0016_finanzas.sql` (sección 7a) repite los mismos signos
 * en un `case when m.kind in ('INGRESO_OTRO', 'APORTE') then m.amount else
 * -m.amount end`, porque Postgres no puede importar un `Record` de TypeScript.
 * **Son dos copias de la misma regla: si se toca un signo acá, o se agrega un
 * `kind` nuevo, hay que tocar también esa función y correr la migración en los
 * DOS proyectos de Supabase (dev y producción).**
 */
export const MOVEMENT_KIND_SIGN: Record<MovementKind, 1 | -1> = {
  INGRESO_OTRO: 1,
  APORTE: 1,
  GASTO: -1,
  RETIRO: -1,
};

/**
 * Los `kind` existentes, para poder recorrerlos. No es una lista paralela que
 * pueda desincronizarse: sale de las llaves del mapa de signos, y
 * `Record<MovementKind, ...>` obliga a TypeScript a exigir una entrada por cada
 * `kind` del enum — agregar uno nuevo no compila hasta clasificarlo en los dos
 * mapas de arriba, y de ahí la agregación lo toma sola.
 */
export const MOVEMENT_KINDS = Object.keys(MOVEMENT_KIND_SIGN) as MovementKind[];

/**
 * Los tres números que la Fase anterior confundía en uno solo.
 * `netProfit` es utilidad del NEGOCIO: `withdrawals`/`contributions` quedan
 * fuera a propósito (un retiro no es un gasto, es utilidad ya ganada que
 * cambia de bolsillo). Para la plata realmente disponible, `getCashPosition`.
 */
export interface MonthlyFinancialTotals {
  month: MonthStr;
  /** Σ `charged_amount` de citas COMPLETADA del mes (fecha de la cita, hora Bogotá). */
  serviceRevenue: number;
  /**
   * Σ movimientos operativos que ENTRAN plata (los `kind` con
   * `MOVEMENT_KIND_IS_OPERATING` y signo +1). Hoy eso es exactamente
   * INGRESO_OTRO; los aportes no cuentan porque no son operativos.
   */
  otherIncome: number;
  totalIncome: number;
  /**
   * Σ movimientos operativos que SACAN plata (los `kind` con
   * `MOVEMENT_KIND_IS_OPERATING` y signo -1), en positivo. Hoy eso es
   * exactamente GASTO; los retiros no cuentan porque no son operativos.
   */
  operatingExpenses: number;
  /** totalIncome − operatingExpenses. NO descuenta retiros. */
  netProfit: number;
  /** netProfit / totalIncome, en % entero. 0 si no hubo ingresos. */
  marginPercent: number;
  /** Σ RETIRO del mes: cuánto sacó Manu. No afecta netProfit. */
  withdrawals: number;
  /** Σ APORTE del mes. No afecta netProfit. */
  contributions: number;
}

/** Variación % contra el mes anterior. `null` = el mes anterior fue 0 (no hay % que calcular). */
export interface MonthlyDeltas {
  serviceRevenue: number | null;
  totalIncome: number | null;
  operatingExpenses: number | null;
  netProfit: number | null;
}

export interface MonthlyFinancialSummary extends MonthlyFinancialTotals {
  /** Ingresos por servicio de HOY (Bogotá), sin importar el mes consultado. */
  todayRevenue: number;
  /** serviceRevenue / citas completadas CON monto registrado. */
  averageTicket: number;
  /** % de citas del mes que terminaron en NO_ASISTIO o CANCELADA. */
  noShowRate: number;
  /** Clientes atendidos en el mes cuya primera cita COMPLETADA histórica cae en este mes. */
  newClients: number;
  recurringClients: number;
  completedCount: number;
  /** Mismos totales del mes anterior, para pintar deltas ▲/▼. */
  previous: MonthlyFinancialTotals;
  deltas: MonthlyDeltas;
}

export interface AccountBalance {
  account: FinancialAccount;
  /** opening_balance + todo lo que entró y salió por esa cuenta, histórico. */
  balance: number;
}

/**
 * Caja disponible: acumulado histórico real. A diferencia de `netProfit`, acá
 * los retiros y aportes SÍ cuentan — es la plata que existe, no la ganada.
 */
export interface CashPosition {
  /** Siempre igual a Σ byAccount.balance + unassignedBalance. */
  totalCash: number;
  byAccount: AccountBalance[];
  /**
   * Plata que no se puede atribuir a ninguna cuenta activa: movimientos o
   * citas sin `account_id`, más lo que quedó pegado a una cuenta desactivada
   * (desactivar una cuenta no hace desaparecer su plata). La UI debería
   * mostrarlo como aviso: si es grande, falta asignar cuentas.
   */
  unassignedBalance: number;
}

/** Anticipos ya cobrados de citas que todavía no se cerraron. */
export interface HeldDeposits {
  total: number;
  /** Cuántas citas abiertas tienen anticipo. */
  count: number;
}

export interface ServiceRevenueRow {
  serviceId: string;
  name: string;
  total: number;
  count: number;
}

export interface CategoryExpenseRow {
  categoryId: string | null;
  name: string;
  nature: ExpenseNature | null;
  total: number;
  count: number;
}

export interface IncomeByAccountRow {
  accountId: string | null;
  /** Nombre de la cuenta, o el `payment_method` histórico si no hay cuenta. */
  name: string;
  total: number;
  /** false = balde de respaldo (cita sin `account_id`). La UI puede advertirlo. */
  assigned: boolean;
}

export interface DailyCashFlowPoint {
  /** Día del mes, 1-31. La serie viene completa (incluye días en cero). */
  day: number;
  /** Ingresos operativos: servicios + INGRESO_OTRO. */
  income: number;
  /** Gastos operativos (GASTO). Retiros y aportes NO entran: no son P&L. */
  expense: number;
}

/** Movimiento con su categoría y cuenta ya resueltas, para el listado. */
export interface MovementListRow extends FinancialMovement {
  category: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
}

export interface MovementListResult {
  rows: MovementListRow[];
  totalCount: number;
  /** Página efectiva (puede diferir de la pedida si se pasó del final). */
  page: number;
  pageSize: number;
}

export interface MovementFilters {
  month: MonthStr;
  kind?: MovementKind;
  categoryId?: string;
  accountId?: string;
  page?: number;
}

/** Fila plana del CSV. Las llaves son los encabezados en español. */
export interface MovementCsvRow {
  fecha: string;
  tipo: string;
  categoria: string;
  cuenta: string;
  descripcion: string;
  monto: number;
}

/** Plantilla de gasto fijo que todavía no se registró en el mes consultado. */
export interface PendingRecurringExpense {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  accountName: string | null;
  /** 'YYYY-MM-DD' sugerido para el movimiento (mes consultado + day_of_month). */
  suggestedDate: string;
}
