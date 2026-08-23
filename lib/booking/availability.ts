import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import {
  BOOKING_HORIZON_WEEKS,
  LEAD_TIME_HOURS,
} from '@/lib/booking/config';
import {
  bogotaDayOfWeek,
  bogotaWallTimeToUtc,
  formatDateStr,
  toBogotaWallClock,
} from '@/lib/booking/timezone';

export interface DayAvailability {
  date: string; // 'YYYY-MM-DD'
  slots: string[]; // 'HH:mm'
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Fusiona franjas contiguas o solapadas (ej. 09:00-10:00 + 10:00-11:00) en
 * una sola ventana continua. Sin esto, un servicio cuya duración+buffer
 * excede el ancho de una franja individual nunca encuentra horario, aunque
 * el día tenga tiempo abierto de sobra repartido en varias franjas seguidas.
 */
function mergeWindows<T extends { start_time: string; end_time: string }>(
  windows: T[],
): { start_time: string; end_time: string }[] {
  const sorted = [...windows].sort(
    (a, b) => timeStrToMinutes(a.start_time) - timeStrToMinutes(b.start_time),
  );

  const merged: { start_time: string; end_time: string }[] = [];
  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && timeStrToMinutes(w.start_time) <= timeStrToMinutes(last.end_time)) {
      if (timeStrToMinutes(w.end_time) > timeStrToMinutes(last.end_time)) {
        last.end_time = w.end_time;
      }
    } else {
      merged.push({ start_time: w.start_time, end_time: w.end_time });
    }
  }
  return merged;
}

/**
 * Calcula los horarios disponibles para un servicio: plantilla semanal
 * menos bloqueos puntuales menos citas activas, en bloques de
 * duration_min + buffer_min, dentro de la ventana [ahora+lead, ahora+horizonte].
 */
export async function getAvailableSlots(
  serviceId: string,
): Promise<DayAvailability[]> {
  const supabase = createServiceClient();

  const { data: service } = await supabase
    .from('services')
    .select('duration_min, buffer_min, active')
    .eq('id', serviceId)
    .maybeSingle();

  if (!service || !service.active) return [];

  const slotMinutes = service.duration_min + service.buffer_min;

  const now = new Date();
  const rangeStart = new Date(now.getTime() + LEAD_TIME_HOURS * 60 * 60_000);
  const rangeEnd = new Date(
    now.getTime() + BOOKING_HORIZON_WEEKS * 7 * 24 * 60 * 60_000,
  );

  const [{ data: availabilityRows }, { data: blockedRows }, { data: appointmentRows }] =
    await Promise.all([
      supabase
        .from('availability')
        .select('day_of_week, start_time, end_time')
        .eq('active', true),
      supabase
        .from('blocked_slots')
        .select('start_at, end_at')
        .lt('start_at', rangeEnd.toISOString())
        .gt('end_at', rangeStart.toISOString()),
      supabase
        .from('appointments')
        .select('start_time, end_time, status, expires_at')
        .lt('start_time', rangeEnd.toISOString())
        .gt('end_time', rangeStart.toISOString())
        .in('status', ['SOLICITADA', 'ESPERANDO_ANTICIPO', 'CONFIRMADA', 'COMPLETADA']),
    ]);

  const availability = availabilityRows ?? [];
  const blocked = (blockedRows ?? []).map((b) => ({
    start: new Date(b.start_at),
    end: new Date(b.end_at),
  }));
  const busy = (appointmentRows ?? [])
    .filter(
      (a) =>
        a.status === 'CONFIRMADA' ||
        a.status === 'COMPLETADA' ||
        (a.expires_at && new Date(a.expires_at) > now),
    )
    .map((a) => ({
      start: new Date(a.start_time),
      end: new Date(a.end_time),
    }));

  const result: DayAvailability[] = [];
  const horizonDays = BOOKING_HORIZON_WEEKS * 7;
  const todayBogota = toBogotaWallClock(now);

  for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
    const dateWallClock = new Date(
      todayBogota.getTime() + dayOffset * 24 * 60 * 60_000,
    );
    const dateStr = formatDateStr(dateWallClock);
    const dayOfWeek = bogotaDayOfWeek(bogotaWallTimeToUtc(dateStr, '00:00'));

    const windows = mergeWindows(
      availability.filter((w) => w.day_of_week === dayOfWeek),
    );
    if (windows.length === 0) continue;

    const daySlots: string[] = [];

    for (const window of windows) {
      const windowStartMin = timeStrToMinutes(window.start_time);
      const windowEndMin = timeStrToMinutes(window.end_time);

      for (
        let candidateMin = windowStartMin;
        candidateMin + slotMinutes <= windowEndMin;
        candidateMin += slotMinutes
      ) {
        const timeStr = minutesToTimeStr(candidateMin);
        const slotStart = bogotaWallTimeToUtc(dateStr, timeStr);
        const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60_000);

        if (slotStart < rangeStart || slotStart > rangeEnd) continue;

        const overlapsBlocked = blocked.some((b) =>
          rangesOverlap(slotStart, slotEnd, b.start, b.end),
        );
        if (overlapsBlocked) continue;

        const overlapsBusy = busy.some((b) =>
          rangesOverlap(slotStart, slotEnd, b.start, b.end),
        );
        if (overlapsBusy) continue;

        daySlots.push(timeStr);
      }
    }

    if (daySlots.length > 0) {
      result.push({ date: dateStr, slots: daySlots.sort() });
    }
  }

  return result;
}
