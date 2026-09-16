import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emailChannel } from './channels/email';
import { whatsappChannel } from './channels/whatsapp';
import type {
  Notification,
  NotificationChannel,
  NotificationChannelAdapter,
} from './types';

// Worker del outbox: toma las notificaciones PENDIENTE cuyo `scheduled_for`
// ya venció, se las pasa al adaptador de su canal y escribe el resultado.
//
// Se invoca desde dos lados: el cron diario (app/api/cron/notificaciones) y,
// sin bloquear, la Server Action pública de reserva — para que el aviso a
// Manu salga en segundos y no al día siguiente.

type NotificationsClient = SupabaseClient;

/**
 * Registro de canales. Enchufar WhatsApp Cloud API es cambiar la
 * implementación de `whatsappChannel` (su `sendsAutomatically` pasa a `true`)
 * — este archivo no se toca.
 */
const CHANNELS: Record<NotificationChannel, NotificationChannelAdapter> = {
  email: emailChannel,
  whatsapp: whatsappChannel,
};

/** Canales que el worker sí intenta enviar solo. */
const AUTOMATIC_CHANNELS = (Object.keys(CHANNELS) as NotificationChannel[]).filter(
  (channel) => CHANNELS[channel].sendsAutomatically,
);

/** Tope por corrida: evita que una acumulación vieja agote el tiempo de la función. */
const DEFAULT_BATCH_SIZE = 40;

/**
 * Cuánto puede quedarse una fila en ENVIANDO antes de que se dé por muerta y
 * vuelva a la cola. Tiene que ser holgadamente mayor que lo que tarda una
 * corrida (`maxDuration = 60` en la ruta de cron): si se acorta de más, se
 * reintenta un envío que en realidad sigue en curso y llega duplicado.
 */
const STALE_CLAIM_MS = 10 * 60_000;

export interface DispatchSummary {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Filas que otra corrida simultánea ya se había llevado. */
  claimedByOther: number;
}

/**
 * Devuelve al estado PENDIENTE las filas que quedaron colgadas en ENVIANDO.
 *
 * Pasa cuando el proceso muere entre el claim y la escritura del resultado
 * (timeout de la función serverless, deploy a mitad de corrida). Sin este
 * rescate, esas notificaciones no se enviarían nunca: nadie las volvería a
 * mirar porque el worker solo consulta PENDIENTE.
 */
async function rescueStaleClaims(supabase: NotificationsClient): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();

  const { error } = await supabase
    .from('notifications')
    .update({ status: 'PENDIENTE' })
    .eq('status', 'ENVIANDO')
    .lt('updated_at', cutoff);

  if (error) {
    console.error('[notificaciones] no se pudieron rescatar envíos colgados', error.message);
  }
}

export async function dispatchPending(
  supabase: NotificationsClient,
  options?: { limit?: number },
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    claimedByOther: 0,
  };

  // Los canales asistidos (WhatsApp hoy) quedan fuera de la consulta a
  // propósito: si entraran, sus filas PENDIENTE se quedarían al frente de la
  // cola para siempre y el worker las releería en cada corrida.
  if (AUTOMATIC_CHANNELS.length === 0) return summary;

  await rescueStaleClaims(supabase);

  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('status', 'PENDIENTE')
    .in('channel', AUTOMATIC_CHANNELS)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(options?.limit ?? DEFAULT_BATCH_SIZE);

  if (error) {
    console.error('[notificaciones] no se pudo leer el outbox', error.message);
    return summary;
  }

  const candidates = (data ?? []) as Array<{ id: string }>;

  for (const candidate of candidates) {
    // CLAIM ATÓMICO. El índice único sobre dedupe_key protege el ENCOLADO,
    // no el ENVÍO: sin esto, el cron diario y el `dispatchQuietly()` que
    // dispara una reserva entrante pueden leer la misma fila PENDIENTE y
    // mandarle dos correos a la misma clienta.
    //
    // Este UPDATE ... WHERE status='PENDIENTE' ... RETURNING sí es atómico:
    // en READ COMMITTED la segunda transacción se bloquea en la fila, y al
    // desbloquearse reevalúa el WHERE contra la versión ya actualizada, no
    // encuentra 'PENDIENTE' y devuelve 0 filas. Solo despacha quien reclama.
    const { data: claimedRow, error: claimError } = await supabase
      .from('notifications')
      .update({ status: 'ENVIANDO' })
      .eq('id', candidate.id)
      .eq('status', 'PENDIENTE')
      .select('*')
      .maybeSingle();

    if (claimError) {
      console.error('[notificaciones] no se pudo reclamar la notificación', claimError.message);
      continue;
    }

    // Se la llevó otra corrida simultánea: no es un error, es el mecanismo
    // funcionando.
    if (!claimedRow) {
      summary.claimedByOther += 1;
      continue;
    }

    const notification = claimedRow as Notification;
    const adapter = CHANNELS[notification.channel];
    if (!adapter) {
      // Canal desconocido: se devuelve a la cola para no dejarla colgada.
      await supabase
        .from('notifications')
        .update({ status: 'PENDIENTE' })
        .eq('id', notification.id);
      continue;
    }

    summary.processed += 1;

    let result;
    try {
      result = await adapter.send(notification);
    } catch (err) {
      result = {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Error inesperado del canal.',
      };
    }

    const attempts = notification.attempts + 1;

    // `deferred`: el canal no envía solo. Vuelve a PENDIENTE (sin contar el
    // intento) para que siga a la vista en la bandeja asistida.
    if ('deferred' in result) {
      await supabase
        .from('notifications')
        .update({ status: 'PENDIENTE' })
        .eq('id', notification.id);
      continue;
    }

    if ('ok' in result && result.ok) {
      summary.sent += 1;
      await supabase
        .from('notifications')
        .update({
          status: 'ENVIADO',
          sent_at: new Date().toISOString(),
          attempts,
          error: null,
        })
        .eq('id', notification.id);
      continue;
    }

    if ('skipped' in result) {
      summary.skipped += 1;
      await supabase
        .from('notifications')
        .update({ status: 'OMITIDO', attempts, error: result.reason })
        .eq('id', notification.id);
      continue;
    }

    summary.failed += 1;
    await supabase
      .from('notifications')
      .update({ status: 'FALLIDO', attempts, error: result.error })
      .eq('id', notification.id);
  }

  return summary;
}

/**
 * Igual que `dispatchPending`, pero no lanza jamás.
 *
 * Es lo que se usa desde el flujo público de reserva (dentro de `after()`,
 * para que corra después de responderle a la clienta): si Resend está caído,
 * la clienta igual ve su solicitud confirmada y la notificación queda
 * FALLIDO en el historial, lista para reintentar desde el panel.
 */
export async function dispatchQuietly(
  supabase: NotificationsClient,
): Promise<DispatchSummary | null> {
  try {
    return await dispatchPending(supabase);
  } catch (err) {
    console.error('[notificaciones] fallo al despachar en segundo plano', err);
    return null;
  }
}
