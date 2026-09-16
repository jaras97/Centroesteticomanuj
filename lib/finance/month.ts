/**
 * Helpers de mes ('YYYY-MM') para Finanzas. Puros y sin dependencias de
 * Supabase a propósito: los usan tanto los Server Components como los
 * componentes cliente (navegación de mes, etiquetas, exportar CSV).
 *
 * Todo se calcula con getters **UTC** sobre `Date.UTC(...)`: el proceso de
 * Vercel corre en UTC y los getters locales (`getMonth`, `getDate`) darían un
 * mes distinto según dónde corra. Para "el mes actual" se usa
 * `todayInBogota()`, que ya resuelve la zona horaria del negocio.
 */
import { todayInBogota } from '@/lib/booking/timezone';

/** 'YYYY-MM' */
export type MonthStr = string;

const MONTHS_ES_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** El mes en curso en Bogotá. */
export function currentMonth(): MonthStr {
  return todayInBogota().slice(0, 7);
}

/** Valida y normaliza un `?month=` de la URL; cae al mes actual si no sirve. */
export function parseMonth(value: string | undefined | null): MonthStr {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return currentMonth();
  return value;
}

/** Corre un mes hacia adelante (delta > 0) o hacia atrás (delta < 0). */
export function shiftMonth(month: MonthStr, delta: number): MonthStr {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Cuántos días tiene el mes (28-31), sin depender de la zona del proceso. */
export function daysInMonth(month: MonthStr): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "septiembre 2026", para encabezados. */
export function monthLabel(month: MonthStr): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_ES_FULL[m - 1]} ${y}`;
}

/**
 * Rango del mes en las DOS escalas que conviven en Finanzas:
 *
 * · `startDate` / `endDateExclusive` ('YYYY-MM-DD') para `financial_movements`,
 *   cuyo `movement_date` es un `date` simple y se compara como string.
 * · `startUtcIso` / `endUtcIso` para `appointments`, cuyo `start_time` es
 *   `timestamptz` y hay que convertir desde hora de pared de Bogotá.
 *
 * Confundirlas es el error sutil de este módulo: comparar un `timestamptz`
 * contra 'YYYY-MM-01' mete las 5 primeras horas del día 1 en el mes anterior.
 */
export function monthRange(month: MonthStr): {
  startDate: string;
  endDateExclusive: string;
} {
  return { startDate: `${month}-01`, endDateExclusive: `${shiftMonth(month, 1)}-01` };
}
