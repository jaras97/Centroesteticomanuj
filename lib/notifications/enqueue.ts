import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildUnsubscribeNote,
  renderCampaignMessage,
  renderTemplate,
} from './templates';
import type {
  Campaign,
  CampaignRecipient,
  NotificationChannel,
  NotificationEvent,
  NotificationRecipientKind,
  NotificationSettings,
  NotificationStatus,
  NotificationTemplate,
  TemplateVars,
} from './types';

// Encolado en el outbox. Nada se envía desde acá: se resuelve la plantilla,
// se arma el destinatario y se inserta una fila PENDIENTE. El despacho es
// trabajo de dispatch.ts.
//
// La idempotencia NO está en este código: está en el índice único sobre
// notifications.dedupe_key. Todo insert va con `ignoreDuplicates`, que en
// supabase-js se traduce a un `on conflict do nothing`. Por eso el cron
// puede correr dos veces el mismo día sin duplicar un solo mensaje.

type NotificationsClient = SupabaseClient;

export interface NotificationContext {
  settings: NotificationSettings;
  templates: NotificationTemplate[];
  businessName: string;
  /** Correo donde Manu recibe los avisos internos. */
  adminEmail: string | null;
  /** WhatsApp donde Manu recibe los avisos internos. */
  adminPhone: string | null;
  /** Teléfono público del centro, el que se le da a la clienta ({{telefono}}). */
  publicPhone: string;
  /** Correo público del centro (para la nota de baja del correo de cumpleaños). */
  publicEmail: string;
  /** Logo PNG de la cabecera de los correos (el del sitio es SVG, ver buildEmailHtml). */
  emailLogoUrl: string | null;
}

const FALLBACK_BUSINESS_NAME = 'Centro Estético Manuj';

/**
 * Carga plantillas + configuración una sola vez. El cron procesa muchas
 * notificaciones por corrida: no tiene sentido volver a pedirlas por cada una.
 */
export async function loadNotificationContext(
  supabase: NotificationsClient,
): Promise<NotificationContext> {
  const [{ data: settings }, { data: templates }, { data: site }] = await Promise.all([
    supabase.from('notification_settings').select('*').eq('id', true).maybeSingle(),
    supabase.from('notification_templates').select('*'),
    supabase
      .from('site_settings')
      .select('email, whatsapp_number, phone_display')
      .eq('id', true)
      .maybeSingle(),
  ]);

  // Si la migración 0014 todavía no corrió, `settings` viene null: se usan
  // los valores por defecto y no se encola nada (no hay plantillas).
  const resolvedSettings: NotificationSettings = settings ?? {
    id: true,
    admin_email: null,
    admin_whatsapp: null,
    business_name: FALLBACK_BUSINESS_NAME,
    email_logo_url: null,
    reminder_hours_before: 24,
    birthday_send_day: 1,
    updated_at: new Date().toISOString(),
  };

  return {
    settings: resolvedSettings,
    templates: (templates ?? []) as NotificationTemplate[],
    businessName: resolvedSettings.business_name || FALLBACK_BUSINESS_NAME,
    adminEmail: resolvedSettings.admin_email || site?.email || null,
    adminPhone: resolvedSettings.admin_whatsapp || site?.whatsapp_number || null,
    publicPhone: site?.phone_display || site?.whatsapp_number || '',
    publicEmail: site?.email || '',
    emailLogoUrl: resolvedSettings.email_logo_url || null,
  };
}

function findTemplate(
  context: NotificationContext,
  event: NotificationEvent,
  channel: NotificationChannel,
  recipientKind: NotificationRecipientKind,
): NotificationTemplate | null {
  return (
    context.templates.find(
      (t) => t.event === event && t.channel === channel && t.recipient_kind === recipientKind,
    ) ?? null
  );
}

export interface EnqueueInput {
  event: NotificationEvent;
  channel: NotificationChannel;
  recipientKind: NotificationRecipientKind;
  toEmail?: string | null;
  toPhone?: string | null;
  clientId?: string | null;
  appointmentId?: string | null;
  vars: TemplateVars;
  dedupeKey: string;
  scheduledFor?: Date;
  /** Línea extra al pie del correo (la nota de baja del saludo de cumpleaños). */
  footerNote?: string;
}

/**
 * ¿Falta el dato del destinatario para este canal? Devuelve el motivo en
 * español, o `null` si se puede mandar.
 *
 * ESTE ES EL CORAZÓN DE LA TRAZABILIDAD. Antes, cuando faltaba el correo, el
 * encolado devolvía `[]` y no quedaba NINGÚN rastro: en producción el outbox
 * tenía 2 filas, las dos de WhatsApp, y parecía que el correo estaba roto.
 * No lo estaba — 40 de las 59 clientas no tienen correo (es opcional en
 * /reservar) y esos mensajes nunca existieron. Ahora la fila se encola igual
 * con `status = 'OMITIDO'` y este texto en `error`.
 *
 * El mismo motivo lo reusa `retryNotification` para no dejar colgada en
 * PENDIENTE una fila que se reintenta y sigue sin destinatario.
 */
export function missingRecipientReason(
  channel: NotificationChannel,
  recipientKind: NotificationRecipientKind,
  toEmail: string | null,
  toPhone: string | null,
): string | null {
  if (channel === 'email' && !toEmail) {
    return recipientKind === 'admin'
      ? 'No hay correo de avisos configurado (Notificaciones → Ajustes generales).'
      : 'La clienta no tiene correo registrado.';
  }
  if (channel === 'whatsapp' && !toPhone) {
    return recipientKind === 'admin'
      ? 'No hay WhatsApp de avisos configurado (Notificaciones → Ajustes generales).'
      : 'La clienta no tiene teléfono registrado.';
  }
  return null;
}

/** Tope de filas por `upsert`. Una campaña puede encolar decenas de destinatarias. */
const INSERT_CHUNK_SIZE = 200;

/**
 * Inserta en lote, de a `INSERT_CHUNK_SIZE`. Nunca lanza: encolar es un
 * efecto secundario y no puede tumbar la operación que lo disparó (una
 * reserva, por ejemplo). Devuelve `false` si algún lote falló.
 */
async function insertNotificationRows(
  supabase: NotificationsClient,
  rows: Record<string, unknown>[],
): Promise<boolean> {
  let ok = true;

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    // `ignoreDuplicates` = `on conflict (dedupe_key) do nothing`: ESA es la
    // idempotencia, no este código.
    const { error } = await supabase
      .from('notifications')
      .upsert(chunk, { onConflict: 'dedupe_key', ignoreDuplicates: true });

    if (error) {
      console.error('[notificaciones] no se pudo encolar', error.message);
      ok = false;
    }
  }

  return ok;
}

/**
 * Encola un lote.
 *
 * Lo que NO se puede mandar por falta de datos del destinatario se encola
 * igual como OMITIDO, con el motivo escrito (ver `missingRecipientReason`):
 * una fila OMITIDO no la despacha el worker (solo consulta PENDIENTE) ni
 * aparece en la bandeja de WhatsApp (filtra PENDIENTE), pero sí queda en el
 * historial, que es todo el punto.
 *
 * Lo que sí se descarta en silencio es la plantilla apagada o inexistente:
 * apagar una plantilla es una decisión deliberada de Manu, y dejar rastro de
 * cada mensaje que ella eligió no mandar solo ensuciaría el historial.
 */
export async function enqueueNotifications(
  supabase: NotificationsClient,
  context: NotificationContext,
  inputs: EnqueueInput[],
): Promise<{ enqueued: number; skipped: number }> {
  const rows = inputs.flatMap((input) => {
    const template = findTemplate(
      context,
      input.event,
      input.channel,
      input.recipientKind,
    );
    if (!template || !template.enabled) return [];

    const toEmail = input.toEmail?.trim() || null;
    const toPhone = input.toPhone?.trim() || null;
    const missing = missingRecipientReason(
      input.channel,
      input.recipientKind,
      toEmail,
      toPhone,
    );

    // El cuerpo se renderiza igual aunque falte el destinatario: así, si Manu
    // agrega el correo de la clienta y le da "Reintentar", el mensaje ya está
    // escrito tal como se habría mandado ese día.
    const rendered = renderTemplate(template, input.vars, {
      businessName: context.businessName,
      footerNote: input.footerNote,
      logoUrl: context.emailLogoUrl,
    });

    return [
      {
        event: input.event,
        channel: input.channel,
        recipient_kind: input.recipientKind,
        to_email: toEmail,
        to_phone: toPhone,
        client_id: input.clientId ?? null,
        appointment_id: input.appointmentId ?? null,
        subject: rendered.subject,
        body: rendered.body,
        status: (missing ? 'OMITIDO' : 'PENDIENTE') satisfies NotificationStatus,
        error: missing,
        scheduled_for: (input.scheduledFor ?? new Date()).toISOString(),
        dedupe_key: input.dedupeKey,
      },
    ];
  });

  if (rows.length === 0) return { enqueued: 0, skipped: 0 };

  const ok = await insertNotificationRows(supabase, rows);
  if (!ok) return { enqueued: 0, skipped: 0 };

  const skipped = rows.filter((row) => row.status === 'OMITIDO').length;
  return { enqueued: rows.length - skipped, skipped };
}

// ---------------------------------------------------------------------------
// Constructores por evento
// ---------------------------------------------------------------------------

export interface BookingRequestedInput {
  appointmentId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  serviceName: string;
  /** Fecha ya formateada para humanos ("15 ago 2026"). */
  fecha: string;
  /** Hora de pared de Bogotá ("10:30"). */
  hora: string;
}

/** Nueva solicitud web: aviso interno para Manu + acuse de recibo a la clienta. */
export async function enqueueBookingRequested(
  supabase: NotificationsClient,
  context: NotificationContext,
  input: BookingRequestedInput,
) {
  const vars: TemplateVars = {
    cliente: input.clientName,
    servicio: input.serviceName,
    fecha: input.fecha,
    hora: input.hora,
    negocio: context.businessName,
    telefono: context.publicPhone,
    telefono_cliente: input.clientPhone,
  };

  const base = {
    event: 'booking_requested' as const,
    vars,
    clientId: input.clientId,
    appointmentId: input.appointmentId,
  };

  return enqueueNotifications(supabase, context, [
    {
      ...base,
      channel: 'email',
      recipientKind: 'admin',
      toEmail: context.adminEmail,
      dedupeKey: `booking_requested:${input.appointmentId}:admin:email`,
    },
    {
      ...base,
      channel: 'whatsapp',
      recipientKind: 'admin',
      toPhone: context.adminPhone,
      dedupeKey: `booking_requested:${input.appointmentId}:admin:whatsapp`,
    },
    {
      ...base,
      channel: 'email',
      recipientKind: 'client',
      toEmail: input.clientEmail,
      dedupeKey: `booking_requested:${input.appointmentId}:client:email`,
    },
    {
      ...base,
      channel: 'whatsapp',
      recipientKind: 'client',
      toPhone: input.clientPhone,
      dedupeKey: `booking_requested:${input.appointmentId}:client:whatsapp`,
    },
  ]);
}

export interface ReminderInput {
  appointmentId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  serviceName: string;
  fecha: string;
  hora: string;
}

/** Recordatorio de una cita CONFIRMADA. Transaccional: no mira marketing_opt_out. */
export async function enqueueAppointmentReminder(
  supabase: NotificationsClient,
  context: NotificationContext,
  input: ReminderInput,
) {
  const vars: TemplateVars = {
    cliente: input.clientName,
    servicio: input.serviceName,
    fecha: input.fecha,
    hora: input.hora,
    negocio: context.businessName,
    telefono: context.publicPhone,
    telefono_cliente: input.clientPhone,
  };

  const base = {
    event: 'appointment_reminder' as const,
    vars,
    clientId: input.clientId,
    appointmentId: input.appointmentId,
  };

  return enqueueNotifications(supabase, context, [
    {
      ...base,
      channel: 'email',
      recipientKind: 'client',
      toEmail: input.clientEmail,
      dedupeKey: `reminder:${input.appointmentId}:client:email`,
    },
    {
      ...base,
      channel: 'whatsapp',
      recipientKind: 'client',
      toPhone: input.clientPhone,
      dedupeKey: `reminder:${input.appointmentId}:client:whatsapp`,
    },
  ]);
}

export interface BirthdayInput {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  /** Año del saludo — parte del dedupe_key, para felicitar una vez por año. */
  year: number;
}

/**
 * Saludo de cumpleaños. Es MARKETING: el llamador tiene que haber filtrado
 * `marketing_opt_out`, y el correo lleva la nota de baja al pie.
 */
export async function enqueueBirthday(
  supabase: NotificationsClient,
  context: NotificationContext,
  input: BirthdayInput,
) {
  const vars: TemplateVars = {
    cliente: input.clientName,
    negocio: context.businessName,
    telefono: context.publicPhone,
    telefono_cliente: input.clientPhone,
  };

  const base = {
    event: 'birthday' as const,
    vars,
    clientId: input.clientId,
  };

  return enqueueNotifications(supabase, context, [
    {
      ...base,
      channel: 'email',
      recipientKind: 'client',
      toEmail: input.clientEmail,
      dedupeKey: `birthday:${input.clientId}:${input.year}:client:email`,
      footerNote: buildUnsubscribeNote(context.publicEmail),
    },
    {
      ...base,
      channel: 'whatsapp',
      recipientKind: 'client',
      toPhone: input.clientPhone,
      dedupeKey: `birthday:${input.clientId}:${input.year}:client:whatsapp`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Campañas (migración 0017)
// ---------------------------------------------------------------------------

export interface EnqueueCampaignResult {
  /** Destinatarias con AL MENOS un mensaje encolable. Es lo que va a `recipient_count`. */
  recipients: number;
  /** Filas PENDIENTE de correo (las manda el despachador solo). */
  queuedEmail: number;
  /** Filas PENDIENTE de WhatsApp (quedan en la bandeja asistida). */
  queuedWhatsapp: number;
  /** Filas OMITIDO por falta de correo/teléfono, con el motivo en el historial. */
  skipped: number;
  /** `false` si algún lote no se pudo insertar (el motivo queda en el log). */
  ok: boolean;
}

/**
 * Encola una campaña: una fila de `notifications` por destinataria y canal.
 *
 * Reusa el outbox en vez de mandar desde acá, igual que todo lo demás del
 * módulo. Así hereda gratis el despachador, el claim atómico, el historial y
 * —lo más importante— el `dedupe_key`: `campaign:<id>:<clienta>:<canal>`
 * garantiza que una campaña no le llegue dos veces a la misma persona aunque
 * el envío se dispare de nuevo.
 *
 * El correo sale solo (el despachador lo toma). El WhatsApp queda PENDIENTE
 * en la bandeja asistida, como todo el WhatsApp del proyecto.
 *
 * TODO en un solo `upsert` por lote de 200: una campaña a 60 clientas por dos
 * canales son 120 filas, y hacer un round-trip por destinataria sería
 * absurdo.
 *
 * OJO — LEY 1581: esta función NO filtra `marketing_opt_out`. Eso ya lo hizo
 * la función SQL `campaign_audience` que produjo `recipients`; duplicar el
 * filtro acá solo escondería el día que alguien llame con otra lista.
 */
export async function enqueueCampaign(
  supabase: NotificationsClient,
  context: NotificationContext,
  campaign: Pick<Campaign, 'id' | 'subject' | 'body' | 'flyer_image_url' | 'channels'>,
  recipients: CampaignRecipient[],
): Promise<EnqueueCampaignResult> {
  const result: EnqueueCampaignResult = {
    recipients: 0,
    queuedEmail: 0,
    queuedWhatsapp: 0,
    skipped: 0,
    ok: true,
  };

  const scheduledFor = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const recipient of recipients) {
    const toEmail = recipient.email?.trim() || null;
    const toPhone = recipient.phone?.trim() || null;
    let reachable = false;

    for (const channel of campaign.channels) {
      const missing = missingRecipientReason(channel, 'client', toEmail, toPhone);

      const rendered = renderCampaignMessage(campaign, channel, {
        cliente: recipient.name,
        negocio: context.businessName,
        telefono: context.publicPhone,
      }, {
        businessName: context.businessName,
        logoUrl: context.emailLogoUrl,
        unsubscribeContact: context.publicEmail,
      });

      if (missing) {
        result.skipped += 1;
      } else {
        reachable = true;
        if (channel === 'email') result.queuedEmail += 1;
        else result.queuedWhatsapp += 1;
      }

      rows.push({
        event: 'campaign' satisfies NotificationEvent,
        channel,
        recipient_kind: 'client' satisfies NotificationRecipientKind,
        to_email: channel === 'email' ? toEmail : null,
        to_phone: channel === 'whatsapp' ? toPhone : null,
        client_id: recipient.id,
        appointment_id: null,
        campaign_id: campaign.id,
        subject: rendered.subject,
        body: rendered.body,
        status: (missing ? 'OMITIDO' : 'PENDIENTE') satisfies NotificationStatus,
        error: missing,
        scheduled_for: scheduledFor,
        dedupe_key: `campaign:${campaign.id}:${recipient.id}:${channel}`,
      });
    }

    if (reachable) result.recipients += 1;
  }

  if (rows.length === 0) return result;

  result.ok = await insertNotificationRows(supabase, rows);
  return result;
}
