import { formatDateStr, toBogotaWallClock } from '@/lib/booking/timezone';

/** Días hasta el próximo cumpleaños (0 = hoy), en hora de Bogotá. `birthday` es 'YYYY-MM-DD'. */
export function daysUntilNextBirthday(birthday: string, now: Date = new Date()): number {
  const todayStr = formatDateStr(toBogotaWallClock(now));
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
  const [, month, day] = birthday.split('-').map(Number);

  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  let nextUtc = Date.UTC(todayYear, month - 1, day);
  if (nextUtc < todayUtc) {
    nextUtc = Date.UTC(todayYear + 1, month - 1, day);
  }

  return Math.round((nextUtc - todayUtc) / (24 * 60 * 60_000));
}

export function isBirthdaySoon(birthday: string | null, withinDays = 30, now: Date = new Date()) {
  if (!birthday) return false;
  return daysUntilNextBirthday(birthday, now) <= withinDays;
}
