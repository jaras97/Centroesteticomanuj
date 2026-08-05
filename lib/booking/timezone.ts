import { BOGOTA_UTC_OFFSET_MINUTES } from './config';

/** 'YYYY-MM-DD' */
export type DateStr = string;
/** 'HH:mm' */
export type TimeStr = string;

/** Convierte una fecha/hora en horario de Bogotá a un instante UTC real. */
export function bogotaWallTimeToUtc(date: DateStr, time: TimeStr): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const utcMillis =
    Date.UTC(year, month - 1, day, hours, minutes) +
    BOGOTA_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMillis);
}

/**
 * Devuelve un Date cuyos getters UTC (getUTCFullYear, getUTCHours, getUTCDay, ...)
 * reflejan la hora de pared en Bogotá para el instante dado — evita depender de
 * la zona horaria del proceso donde corre el servidor.
 */
export function toBogotaWallClock(instant: Date): Date {
  return new Date(instant.getTime() - BOGOTA_UTC_OFFSET_MINUTES * 60_000);
}

export function formatDateStr(wallClock: Date): DateStr {
  const y = wallClock.getUTCFullYear();
  const m = String(wallClock.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wallClock.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTimeStr(wallClock: Date): TimeStr {
  const h = String(wallClock.getUTCHours()).padStart(2, '0');
  const m = String(wallClock.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function addDaysToDateStr(date: DateStr, days: number): DateStr {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return formatDateStr(shifted);
}

/** Lunes (YYYY-MM-DD, hora de Bogotá) de la semana que contiene `date`. */
export function mondayOfWeek(date: DateStr): DateStr {
  const dow = bogotaDayOfWeek(bogotaWallTimeToUtc(date, '00:00'));
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysToDateStr(date, diff);
}

/** 0 = domingo .. 6 = sábado, igual que Date.getDay(), pero en hora de Bogotá. */
export function bogotaDayOfWeek(instant: Date): number {
  return toBogotaWallClock(instant).getUTCDay();
}

const MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Formatea un instante UTC como fecha/hora legible en Bogotá, sin depender
 * de la zona horaria del proceso donde corre (a diferencia de Intl/date-fns
 * con getters locales).
 */
export function formatBogotaHuman(iso: string): string {
  const wall = toBogotaWallClock(new Date(iso));
  const day = wall.getUTCDate();
  const month = MONTHS_ES[wall.getUTCMonth()];
  const year = wall.getUTCFullYear();
  const hours = wall.getUTCHours();
  const minutes = String(wall.getUTCMinutes()).padStart(2, '0');
  const period = hours < 12 ? 'a.m.' : 'p.m.';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${day} ${month} ${year}, ${hour12}:${minutes} ${period}`;
}
