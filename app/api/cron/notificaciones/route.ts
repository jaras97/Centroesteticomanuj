import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  addDaysToDateStr,
  bogotaWallTimeToUtc,
  formatDateStr,
  formatDateStrHuman,
  formatTimeStr,
  toBogotaWallClock,
} from '@/lib/booking/timezone';
import {
  enqueueAppointmentReminder,
  enqueueBirthday,
  loadNotificationContext,
  type NotificationContext,
} from '@/lib/notifications/enqueue';
import { dispatchPending } from '@/lib/notifications/dispatch';
import type { SupabaseClient } from '@supabase/supabase-js';

// Único proceso programado del módulo de notificaciones. Hace TRES cosas en
// una sola corrida porque el plan Hobby de Vercel solo admite 2 cron jobs y
// frecuencia diaria (ver vercel.json y docs/PRD-notificaciones.md):
//   1. encola los recordatorios de las citas CONFIRMADA que vienen,
//   2. encola los saludos de cumpleaños del mes, el día configurado,
//   3. despacha el outbox pendiente.
//
// Es idempotente: se puede llamar diez veces el mismo día sin duplicar un
// solo mensaje (índice único sobre notifications.dedupe_key).
//
// Esta ruta NO pasa por middleware.ts (que solo matchea /admin/:path*), así
// que se autentica sola contra CRON_SECRET.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type CronClient = SupabaseClient;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  // El secreto manda SIEMPRE que esté configurado. Vercel agrega solo la
  // cabecera `Authorization: Bearer ${CRON_SECRET}` a sus invocaciones de cron
  // cuando esa variable existe, así que exigirla no rompe nada y cierra la
  // puerta a que baste con falsificar una cabecera (lo que pasaría el día que
  // el proyecto quede detrás de otro proxy o se despliegue fuera de Vercel).
  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`;
  }

  // Sin CRON_SECRET configurado, la única credencial disponible es la
  // cabecera que pone Vercel (y que elimina de cualquier petición externa).
  return Boolean(request.headers.get('x-vercel-cron'));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    const reason = process.env.CRON_SECRET?.trim()
      ? 'Credencial de cron inválida.'
      : 'CRON_SECRET no está configurado en este entorno.';
    return NextResponse.json({ ok: false, error: reason }, { status: 401 });
  }

  const supabase = createServiceClient();
  const context = await loadNotificationContext(supabase);

  const reminders = await enqueueRemindersForUpcomingDay(supabase, context);
  const birthdays = await enqueueBirthdaysOfTheMonth(supabase, context);
  const dispatched = await dispatchPending(supabase, { limit: 100 });

  return NextResponse.json({
    ok: true,
    reminders,
    birthdays,
    dispatched,
  });
}

/** Vercel Cron invoca con GET; POST existe para poder dispararlo a mano (pg_cron, curl). */
export const POST = GET;

// ---------------------------------------------------------------------------
// 1. Recordatorios
// ---------------------------------------------------------------------------

/**
 * Encola los recordatorios de las citas CONFIRMADA del día objetivo.
 *
 * La ventana se calcula SIEMPRE en hora de pared de Bogotá y se convierte a
 * instantes UTC con `bogotaWallTimeToUtc`. En Vercel el proceso corre en UTC:
 * usar `new Date().getDate()` acá mandaría los recordatorios del día
 * equivocado entre las 19:00 y la medianoche de Bogotá.
 *
 * Con un cron diario, `reminder_hours_before` define CUÁNTOS DÍAS antes se
 * avisa (24h → el día anterior, 48h → dos días antes), no la hora exacta:
 * esa la fija el horario en que corre el job.
 */
async function enqueueRemindersForUpcomingDay(
  supabase: CronClient,
  context: NotificationContext,
) {
  const todayBogota = formatDateStr(toBogotaWallClock(new Date()));
  const daysAhead = Math.max(
    1,
    Math.round(context.settings.reminder_hours_before / 24),
  );
  const targetDate = addDaysToDateStr(todayBogota, daysAhead);

  const windowStart = bogotaWallTimeToUtc(targetDate, '00:00');
  const windowEnd = bogotaWallTimeToUtc(addDaysToDateStr(targetDate, 1), '00:00');

  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, start_time, requested_name, client:clients(id, name, phone, email), service:services(name)',
    )
    .eq('status', 'CONFIRMADA')
    .gte('start_time', windowStart.toISOString())
    .lt('start_time', windowEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[notificaciones] no se pudieron leer las citas de mañana', error.message);
    return { targetDate, appointments: 0, enqueued: 0, error: error.message };
  }

  // `as unknown as` como en el resto del repo: sin tipos generados de la
  // base, supabase-js infiere las relaciones embebidas como arrays aunque
  // PostgREST devuelva un objeto (la FK es muchos-a-uno).
  const appointments = (data ?? []) as unknown as Array<{
    id: string;
    start_time: string;
    requested_name: string | null;
    client: { id: string; name: string; phone: string; email: string | null } | null;
    service: { name: string } | null;
  }>;

  let enqueued = 0;

  for (const appointment of appointments) {
    if (!appointment.client) continue;

    const wallClock = toBogotaWallClock(new Date(appointment.start_time));
    const result = await enqueueAppointmentReminder(supabase, context, {
      appointmentId: appointment.id,
      clientId: appointment.client.id,
      clientName: appointment.client.name || appointment.requested_name || 'Hola',
      clientPhone: appointment.client.phone,
      clientEmail: appointment.client.email,
      serviceName: appointment.service?.name ?? 'tu cita',
      fecha: formatDateStrHuman(formatDateStr(wallClock)),
      hora: formatTimeStr(wallClock),
    });
    enqueued += result.enqueued;
  }

  return { targetDate, appointments: appointments.length, enqueued };
}

// ---------------------------------------------------------------------------
// 2. Cumpleaños
// ---------------------------------------------------------------------------

/**
 * El día configurado de cada mes, felicita a todas las clientas que cumplen
 * años ese mes (no el mismo día: Manu prefiere mandarlo al arranque del mes,
 * y así un solo job diario alcanza).
 *
 * Es MARKETING, no transaccional: respeta `clients.marketing_opt_out`
 * (Ley 1581 de 2012). El dedupe_key lleva el año, así que una clienta recibe
 * el saludo una sola vez por año aunque el cron corra de más.
 */
async function enqueueBirthdaysOfTheMonth(
  supabase: CronClient,
  context: NotificationContext,
) {
  const nowBogota = toBogotaWallClock(new Date());
  const dayOfMonth = nowBogota.getUTCDate();
  const month = nowBogota.getUTCMonth() + 1;
  const year = nowBogota.getUTCFullYear();

  if (dayOfMonth !== context.settings.birthday_send_day) {
    return { skipped: true as const, reason: 'Hoy no es el día configurado.', enqueued: 0 };
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone, email, birthday')
    .eq('marketing_opt_out', false)
    .not('birthday', 'is', null);

  if (error) {
    console.error('[notificaciones] no se pudieron leer los cumpleaños', error.message);
    return { skipped: false as const, enqueued: 0, error: error.message };
  }

  const clients = (data ?? []) as Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    birthday: string | null;
  }>;

  // `birthday` es un `date` de Postgres ('YYYY-MM-DD'): el mes se lee del
  // string, sin construir un Date (que lo interpretaría en la zona del proceso).
  const birthdayClients = clients.filter((client) => {
    const parts = client.birthday?.split('-');
    return parts?.length === 3 && Number(parts[1]) === month;
  });

  let enqueued = 0;

  for (const client of birthdayClients) {
    const result = await enqueueBirthday(supabase, context, {
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      year,
    });
    enqueued += result.enqueued;
  }

  return { skipped: false as const, month, clients: birthdayClients.length, enqueued };
}
