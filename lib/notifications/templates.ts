// Renderizado de plantillas: reemplaza las variables {{...}} y arma el
// cuerpo final según el canal. Puro TypeScript, sin dependencias de servidor:
// el editor del panel lo importa desde un componente 'use client' para
// mostrar la vista previa en vivo con los mismos valores que se enviarían.

import type {
  NotificationChannel,
  NotificationEvent,
  NotificationTemplate,
  RenderedMessage,
  TemplateVars,
} from './types';

/**
 * Escapa HTML. NO es opcional: `{{cliente}}` sale del formulario público de
 * /reservar, así que un nombre con `<script>` terminaría dentro del HTML del
 * correo. Se aplica a los VALORES interpolados, no al texto de la plantilla
 * (ese lo escribe Manu desde el panel, es contenido de confianza).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Limpia un valor que va a terminar en una CABECERA de correo (el asunto).
 *
 * El asunto no se escapa como HTML a propósito (saldría "&amp;" visible en la
 * bandeja de entrada), pero sí hay que quitarle los saltos de línea y los
 * caracteres de control: `{{cliente}}` viene del formulario público y un
 * nombre con un CR/LF adentro es el vector clásico de inyección de cabeceras.
 */
export function sanitizeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\r\n\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

/**
 * Reemplaza `{{variable}}` por su valor. Una variable desconocida se
 * reemplaza por cadena vacía (mejor un hueco que un `{{typo}}` visible en el
 * correo de una clienta).
 */
function interpolate(
  text: string,
  vars: TemplateVars,
  transform: (value: string) => string,
): string {
  return text.replace(VARIABLE_PATTERN, (_match, key: string) =>
    transform(vars[key] ?? ''),
  );
}

/** Convierte texto plano (como lo escribe Manu) en párrafos HTML. */
function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px;">${block.replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

// Colores de marca por defecto. En un correo no se pueden usar las variables
// CSS del sitio (ningún cliente de correo las resuelve), por eso acá sí van
// literales — es el único lugar del proyecto donde eso es correcto.
const EMAIL_INK = '#0C0C0C';
const EMAIL_SAND = '#D2B8A1';
const EMAIL_MUTED = '#8A8A8A';

/** Envuelve el cuerpo en una plantilla HTML sobria, legible en móvil. */
export function buildEmailHtml(options: {
  bodyHtml: string;
  businessName: string;
  /** Línea extra al pie (p. ej. la nota de baja del correo de cumpleaños). */
  footerNote?: string;
  /**
   * Logo de la cabecera. Tiene que ser PNG o JPG: **ningún cliente de correo
   * mayoritario renderiza SVG** (Gmail y Outlook lo bloquean), así que NO
   * sirve el `site_settings.logo_url` del sitio, que es un SVG. Por eso es un
   * campo aparte (`notification_settings.email_logo_url`) y no el del sitio.
   * Si viene vacío, la cabecera cae al nombre del negocio en texto.
   */
  logoUrl?: string | null;
}): string {
  const { bodyHtml, businessName, footerNote, logoUrl } = options;

  // El `alt` no es decorativo: muchos clientes bloquean las imágenes por
  // defecto y esa línea es lo único que se ve hasta que la clienta las
  // habilita. Va estilada para que se lea como el título que reemplaza.
  const header = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="60" height="60" alt="${escapeHtml(businessName)}"
                   style="display:block;border:0;outline:none;text-decoration:none;width:60px;height:auto;color:${EMAIL_SAND};font-family:Georgia,'Times New Roman',serif;font-size:18px;font-style:italic;" />`
    : `<p style="margin:0;color:${EMAIL_SAND};font-family:Georgia,'Times New Roman',serif;font-size:20px;font-style:italic;letter-spacing:0.5px;">
                ${escapeHtml(businessName)}
              </p>`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(businessName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F4F1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F4F1;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:${EMAIL_INK};padding:24px 28px;">
              ${header}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:${EMAIL_INK};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;">
${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;">
              <hr style="border:none;border-top:1px solid #EDE7E2;margin:0 0 16px;" />
              <p style="margin:0;color:${EMAIL_MUTED};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;">
                ${escapeHtml(businessName)}${footerNote ? `<br />${footerNote}` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Qué se ofrece dejar de recibir. Son literales del código (no entran valores
 * de ningún formulario), por eso no se escapan.
 */
type UnsubscribeSubject = 'estos saludos' | 'estas promociones';

function unsubscribeSentence(
  contact: string,
  what: UnsubscribeSubject,
  replyTarget: 'este correo' | 'este mensaje',
): string {
  return contact
    ? `¿Prefieres no recibir ${what}? Escríbenos a ${contact} y te damos de baja.`
    : `¿Prefieres no recibir ${what}? Respóndenos ${replyTarget} y te damos de baja.`;
}

/**
 * Nota de baja para el PIE DE UN CORREO (va dentro del HTML, por eso escapa
 * el contacto). Es marketing (Ley 1581 de 2012), no transaccional: tiene que
 * ofrecer cómo darse de baja. La usan el saludo de cumpleaños y las campañas.
 * Manu marca el `marketing_opt_out` de la clienta desde su ficha en
 * /admin/clientes.
 */
export function buildUnsubscribeNote(
  contact: string,
  what: UnsubscribeSubject = 'estos saludos',
): string {
  return unsubscribeSentence(escapeHtml(contact || ''), what, 'este correo');
}

/**
 * La misma nota, en TEXTO PLANO, para el mensaje de WhatsApp de una campaña.
 * No se escapa: iría al link `wa.me` con los `&amp;` literales a la vista.
 */
export function buildUnsubscribeText(
  contact: string,
  what: UnsubscribeSubject = 'estas promociones',
): string {
  return unsubscribeSentence(contact || '', what, 'este mensaje');
}

/**
 * Renderiza una plantilla para su canal.
 * - Correo: los valores se escapan y el cuerpo se envuelve en HTML.
 * - WhatsApp: texto plano tal cual, sin escapar (iría al link `wa.me` como
 *   `&amp;` literal si se escapara).
 */
export function renderTemplate(
  template: Pick<NotificationTemplate, 'event' | 'channel' | 'subject' | 'body'>,
  vars: TemplateVars,
  options?: { businessName?: string; footerNote?: string; logoUrl?: string | null },
): RenderedMessage {
  const text = interpolate(template.body, vars, (v) => v);

  if (template.channel === 'whatsapp') {
    return { subject: null, body: text, text };
  }

  // El asunto viaja en una cabecera de correo: es texto plano, escapar
  // HTML ahí produciría "&amp;" visible en la bandeja de entrada. Lo que sí
  // se le quita son los saltos de línea y los caracteres de control
  // (inyección de cabeceras) — ver `sanitizeHeaderValue`.
  const subject = template.subject
    ? sanitizeHeaderValue(interpolate(template.subject, vars, sanitizeHeaderValue))
    : null;

  const escapedBody = interpolate(template.body, vars, escapeHtml);
  const body = buildEmailHtml({
    bodyHtml: textToHtmlParagraphs(escapedBody),
    businessName: options?.businessName ?? vars.negocio ?? 'Centro Estético Manuj',
    footerNote: options?.footerNote,
    logoUrl: options?.logoUrl,
  });

  return { subject, body, text };
}

/**
 * Renderiza el mensaje de una CAMPAÑA. No pasa por `notification_templates`:
 * cada campaña trae su propio asunto y cuerpo (ver `campaigns` en 0017).
 *
 * Las dos diferencias con `renderTemplate`, y por qué:
 *
 * 1. EL FLYER. En correo se **embebe** como `<img>` arriba del texto. En
 *    WhatsApp no se puede adjuntar nada desde un deep link `wa.me`, así que
 *    va el **link público** al final del mensaje y WhatsApp arma la vista
 *    previa solo. El flyer tiene que ser PNG/JPG: ningún cliente de correo
 *    mayoritario renderiza SVG dentro de un `<img>` (lo validan las Server
 *    Actions y `uploadSiteMedia`).
 *
 * 2. LA LÍNEA DE BAJA, siempre, en los dos canales. Una campaña es marketing
 *    (Ley 1581 de 2012), como el saludo de cumpleaños.
 *
 * Se mantiene intacto lo que sí comparte: los valores interpolados se escapan
 * como HTML en el correo, y al asunto se le limpian los CR/LF.
 */
export function renderCampaignMessage(
  campaign: {
    subject: string | null;
    body: string;
    flyer_image_url: string | null;
  },
  channel: NotificationChannel,
  vars: TemplateVars,
  options: {
    businessName: string;
    logoUrl?: string | null;
    /** Contacto al que se escribe para darse de baja (correo público del centro). */
    unsubscribeContact: string;
  },
): RenderedMessage {
  const text = interpolate(campaign.body, vars, (v) => v);

  if (channel === 'whatsapp') {
    const parts = [text];
    if (campaign.flyer_image_url) parts.push(campaign.flyer_image_url);
    parts.push(buildUnsubscribeText(options.unsubscribeContact, 'estas promociones'));
    const whatsappBody = parts.join('\n\n');
    return { subject: null, body: whatsappBody, text: whatsappBody };
  }

  const subject = campaign.subject
    ? sanitizeHeaderValue(interpolate(campaign.subject, vars, sanitizeHeaderValue))
    : null;

  // `max-width` en línea y `width:100%`: es lo único que hace que el flyer no
  // se desborde en el móvil en los clientes que ignoran el CSS de `<head>`.
  const flyerHtml = campaign.flyer_image_url
    ? `<img src="${escapeHtml(campaign.flyer_image_url)}" alt="${escapeHtml(options.businessName)}"
             style="display:block;border:0;outline:none;text-decoration:none;width:100%;max-width:504px;height:auto;border-radius:8px;margin:0 0 20px;" />`
    : '';

  const escapedBody = interpolate(campaign.body, vars, escapeHtml);
  const body = buildEmailHtml({
    bodyHtml: `${flyerHtml}\n${textToHtmlParagraphs(escapedBody)}`,
    businessName: options.businessName,
    footerNote: buildUnsubscribeNote(options.unsubscribeContact, 'estas promociones'),
    logoUrl: options.logoUrl,
  });

  return { subject, body, text };
}

// ---------------------------------------------------------------------------
// Metadatos para la UI del panel
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  key: string;
  label: string;
}

const VAR_CLIENTE: TemplateVariable = { key: 'cliente', label: 'Nombre de la clienta' };
const VAR_SERVICIO: TemplateVariable = { key: 'servicio', label: 'Servicio solicitado' };
const VAR_FECHA: TemplateVariable = { key: 'fecha', label: 'Fecha de la cita' };
const VAR_HORA: TemplateVariable = { key: 'hora', label: 'Hora de la cita' };
const VAR_NEGOCIO: TemplateVariable = { key: 'negocio', label: 'Nombre del centro' };
const VAR_TELEFONO: TemplateVariable = { key: 'telefono', label: 'WhatsApp del centro' };
const VAR_TELEFONO_CLIENTE: TemplateVariable = {
  key: 'telefono_cliente',
  label: 'Teléfono de la clienta',
};

/** Variables disponibles en cada evento (lo que se muestra clickeable en el editor). */
export const EVENT_VARIABLES: Record<NotificationEvent, TemplateVariable[]> = {
  booking_requested: [
    VAR_CLIENTE,
    VAR_SERVICIO,
    VAR_FECHA,
    VAR_HORA,
    VAR_NEGOCIO,
    VAR_TELEFONO,
    VAR_TELEFONO_CLIENTE,
  ],
  appointment_reminder: [
    VAR_CLIENTE,
    VAR_SERVICIO,
    VAR_FECHA,
    VAR_HORA,
    VAR_NEGOCIO,
    VAR_TELEFONO,
    VAR_TELEFONO_CLIENTE,
  ],
  birthday: [VAR_CLIENTE, VAR_NEGOCIO, VAR_TELEFONO, VAR_TELEFONO_CLIENTE],
  // Una campaña no sabe de citas: no tiene servicio, ni fecha, ni hora.
  campaign: [VAR_CLIENTE, VAR_NEGOCIO, VAR_TELEFONO],
};

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  booking_requested: 'Nueva solicitud de cita',
  appointment_reminder: 'Recordatorio de cita',
  birthday: 'Saludo de cumpleaños',
  campaign: 'Campaña / promoción',
};

export const EVENT_DESCRIPTIONS: Record<NotificationEvent, string> = {
  booking_requested:
    'Se dispara apenas alguien envía el formulario de /reservar. Le avisa a Manu y le confirma a la clienta que su solicitud llegó.',
  appointment_reminder:
    'Lo encola el proceso diario para las citas CONFIRMADAS del día siguiente (según la antelación configurada).',
  birthday:
    'Lo encola el proceso diario, el día del mes configurado, para las clientas que cumplen años ese mes. Respeta a quienes pidieron no recibir marketing.',
  campaign:
    'Envío masivo con flyer que se dispara a mano desde la pestaña Campañas. No usa plantilla: cada campaña trae su propio texto. Respeta a quienes pidieron no recibir marketing.',
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Correo',
  whatsapp: 'WhatsApp',
};

export const RECIPIENT_LABELS: Record<'client' | 'admin', string> = {
  client: 'Para la clienta',
  admin: 'Para Manu (interno)',
};

/** Valores de ejemplo para la vista previa del editor de plantillas. */
export const PREVIEW_VARS: TemplateVars = {
  cliente: 'María Fernanda',
  servicio: 'Maquillaje social',
  fecha: '15 ago 2026',
  hora: '10:30',
  negocio: 'Centro Estético Manuj',
  telefono: '+57 321 548 7690',
  telefono_cliente: '+57 300 123 4567',
};

/** Valores de ejemplo para la vista previa de una campaña. */
export const CAMPAIGN_PREVIEW_VARS: TemplateVars = {
  cliente: PREVIEW_VARS.cliente,
  negocio: PREVIEW_VARS.negocio,
  telefono: PREVIEW_VARS.telefono,
};
