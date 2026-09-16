// Tipos compartidos del módulo de notificaciones.
//
// Este archivo NO importa nada de Supabase ni de Node: lo consumen tanto los
// Server Components/Actions como los componentes 'use client' del panel
// (la vista previa de plantillas renderiza en el navegador).

export type NotificationEvent =
  | 'booking_requested'
  | 'appointment_reminder'
  | 'birthday';

export type NotificationChannel = 'email' | 'whatsapp';

export type NotificationRecipientKind = 'client' | 'admin';

/**
 * `ENVIANDO` es un estado transitorio: lo pone el worker al reclamar una fila
 * (claim atómico) y dura lo que tarda el canal en responder. Existe para que
 * dos corridas simultáneas del despachador no manden el mismo mensaje dos
 * veces; si una corrida muere a mitad, la siguiente lo devuelve a PENDIENTE.
 */
export type NotificationStatus =
  | 'PENDIENTE'
  | 'ENVIANDO'
  | 'ENVIADO'
  | 'FALLIDO'
  | 'OMITIDO';

/** Fila de la tabla `notifications` (el outbox). */
export interface Notification {
  id: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient_kind: NotificationRecipientKind;
  to_email: string | null;
  to_phone: string | null;
  client_id: string | null;
  appointment_id: string | null;
  subject: string | null;
  /** Ya renderizado, con las variables resueltas. */
  body: string;
  status: NotificationStatus;
  attempts: number;
  scheduled_for: string;
  sent_at: string | null;
  error: string | null;
  dedupe_key: string;
  created_at: string;
  updated_at: string;
}

/** Fila de `notification_templates`. */
export interface NotificationTemplate {
  id: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient_kind: NotificationRecipientKind;
  /** Solo aplica a `channel === 'email'`. */
  subject: string | null;
  body: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Fila singleton de `notification_settings`. */
export interface NotificationSettings {
  id: true;
  admin_email: string | null;
  admin_whatsapp: string | null;
  business_name: string;
  reminder_hours_before: number;
  birthday_send_day: number;
  updated_at: string;
}

/** Valores que reemplazan a las variables `{{...}}` de una plantilla. */
export type TemplateVars = Record<string, string>;

/** Resultado de renderizar una plantilla para un canal concreto. */
export interface RenderedMessage {
  /** `null` en WhatsApp (no tiene asunto). */
  subject: string | null;
  /** Listo para enviar: HTML en correo, texto plano en WhatsApp. */
  body: string;
  /** Versión en texto plano del cuerpo (fallback del correo, y lo que se ve en la vista previa). */
  text: string;
}

/**
 * Resultado de intentar enviar por un canal.
 * - `ok`: el canal confirmó el envío → ENVIADO.
 * - `error`: el canal falló → FALLIDO (se puede reintentar desde el panel).
 * - `deferred`: el canal no envía solo (WhatsApp asistido) → queda PENDIENTE
 *   en la bandeja para que Manu lo mande con un click.
 * - `skipped`: no se intentó por configuración faltante o falta de
 *   destinatario → OMITIDO, con el motivo visible en el historial.
 */
export type ChannelSendResult =
  | { ok: true; info?: string }
  | { ok: false; error: string }
  | { deferred: true; reason: string }
  | { skipped: true; reason: string };

/**
 * Interfaz común de los canales. El adaptador de WhatsApp de hoy (asistido)
 * y el futuro de WhatsApp Cloud API implementan exactamente esto, así que
 * cambiar de uno a otro no toca `enqueue.ts` ni `dispatch.ts`.
 */
export interface NotificationChannelAdapter {
  /**
   * `false` = el canal no envía por su cuenta; el worker ni siquiera lo
   * consulta y sus notificaciones se quedan PENDIENTE a la espera de una
   * acción humana. Poner esto en `true` es todo lo que hace falta para que
   * el worker empiece a despachar el canal automáticamente.
   */
  readonly sendsAutomatically: boolean;
  send(notification: Notification): Promise<ChannelSendResult>;
}
