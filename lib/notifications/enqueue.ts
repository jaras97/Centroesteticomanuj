import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildUnsubscribeNote,
  renderTemplate,
} from './templates';
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationRecipientKind,
  NotificationSettings,
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
 * Encola un lote. Descarta en silencio lo que no se puede mandar (plantilla
 * apagada o inexistente, destinatario sin correo/teléfono) — son situaciones
 * normales, no errores: una clienta puede no haber dado su correo.
 */
export async function enqueueNotifications(
  supabase: NotificationsClient,
  context: NotificationContext,
  inputs: EnqueueInput[],
): Promise<{ enqueued: number }> {
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
    if (input.channel === 'email' && !toEmail) return [];
    if (input.channel === 'whatsapp' && !toPhone) return [];

    const rendered = renderTemplate(template, input.vars, {
      businessName: context.businessName,
      footerNote: input.footerNote,
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
        status: 'PENDIENTE',
        scheduled_for: (input.scheduledFor ?? new Date()).toISOString(),
        dedupe_key: input.dedupeKey,
      },
    ];
  });

  if (rows.length === 0) return { enqueued: 0 };

  const { error } = await supabase
    .from('notifications')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });

  if (error) {
    // No se propaga: encolar es un efecto secundario, nunca puede tumbar
    // la operación de negocio que lo disparó (una reserva, por ejemplo).
    console.error('[notificaciones] no se pudo encolar', error.message);
    return { enqueued: 0 };
  }

  return { enqueued: rows.length };
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
