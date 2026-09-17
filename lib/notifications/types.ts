// Tipos compartidos del módulo de notificaciones.
//
// Este archivo NO importa nada de Supabase ni de Node: lo consumen tanto los
// Server Components/Actions como los componentes 'use client' del panel
// (la vista previa de plantillas renderiza en el navegador).

export type NotificationEvent =
  | 'booking_requested'
  | 'appointment_reminder'
  | 'birthday'
  /**
   * Envío masivo con flyer que Manu dispara a mano desde el panel (no lo
   * produce ningún evento del negocio). Es el único evento cuyo texto NO sale
   * de `notification_templates`: cada campaña trae su propio asunto y cuerpo.
   * Ver `campaigns` en 0017_campanas.sql.
   */
  | 'campaign';

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
  /** De qué campaña salió este mensaje (`null` en todo lo transaccional). */
  campaign_id: string | null;
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
  /** Logo PNG/JPG para la cabecera de los correos. Ver `buildEmailHtml`. */
  email_logo_url: string | null;
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

// ---------------------------------------------------------------------------
// Campañas (migración 0017)
// ---------------------------------------------------------------------------

/**
 * Segmento de una campaña. Es el contenido de `campaigns.audience` (jsonb) y
 * lo resuelve `lib/notifications/audience.ts` contra Postgres.
 *
 * Discriminado por `kind` a propósito: cada segmento tiene parámetros
 * distintos, y con columnas sueltas la mitad quedaría siempre en null.
 *
 * NINGÚN segmento incluye jamás a una clienta con `marketing_opt_out = true`:
 * la exclusión vive en la función SQL `campaign_audience`, no en quien la
 * llama, para que no se pueda olvidar (Ley 1581 de 2012).
 */
export type CampaignAudience =
  /** Todas las clientas registradas. */
  | { kind: 'all' }
  /** Las que cumplen años en el mes `month` (1-12). */
  | { kind: 'birthday_month'; month: number }
  /** Sin ninguna cita COMPLETADA en los últimos `months` meses. */
  | { kind: 'inactive'; months: number }
  /** Su PRIMERA cita COMPLETADA cae dentro de los últimos `months` meses. */
  | { kind: 'new'; months: number }
  /** Selección a mano desde el panel. */
  | { kind: 'manual'; clientIds: string[] };

export type CampaignAudienceKind = CampaignAudience['kind'];

/**
 * `BORRADOR` se edita y se borra; `ENVIADA` es histórico y no admite ninguna
 * de las dos cosas (lo impiden las Server Actions).
 */
export type CampaignStatus = 'BORRADOR' | 'ENVIADA';

/** Fila de la tabla `campaigns`. */
export interface Campaign {
  id: string;
  /** Nombre interno, para reconocerla en la lista. No se le manda a nadie. */
  title: string;
  /** Asunto del correo. Obligatorio si `channels` incluye 'email'. */
  subject: string | null;
  /** Texto del mensaje. Admite las mismas variables `{{...}}` que las plantillas. */
  body: string;
  /** PNG/JPG en Storage (`site-media`, carpeta `campaigns/`). Nunca SVG. */
  flyer_image_url: string | null;
  channels: NotificationChannel[];
  audience: CampaignAudience;
  status: CampaignStatus;
  sent_at: string | null;
  /**
   * Alcance REAL, no tamaño del segmento: destinatarias que quedaron con al
   * menos un mensaje encolable (PENDIENTE). Una clienta sin correo, en una
   * campaña que iba solo por correo, no suma acá — su fila queda OMITIDO en
   * el outbox con el motivo.
   */
  recipient_count: number | null;
  created_at: string;
  updated_at: string;
}

/** Lo que devuelve `getCampaignAudienceStats` (y `previewCampaignAudience`). */
export interface CampaignAudienceStats {
  /** Destinatarias del segmento, YA descontadas las que pidieron no recibir marketing. */
  total: number;
  /** De esas, cuántas tienen correo registrado. */
  reachableByEmail: number;
  /** De esas, cuántas tienen teléfono registrado. */
  reachableByWhatsapp: number;
  /** Cuántas quedaron fuera por `marketing_opt_out` (dato para mostrar, no para sumar). */
  excludedByOptOut: number;
}

/** Una destinataria ya resuelta, lista para encolar. */
export interface CampaignRecipient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}
