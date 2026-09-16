import 'server-only';
import { Resend } from 'resend';
import type { ChannelSendResult, Notification, NotificationChannelAdapter } from '../types';

// Adaptador de correo (Resend).
//
// Degrada con gracia a propósito: si el proyecto se despliega sin
// RESEND_API_KEY o sin RESEND_FROM, la aplicación entera sigue funcionando y
// las notificaciones de correo quedan OMITIDO con el motivo escrito en el
// historial de /admin/notificaciones. Nunca lanza: el que lo llama (el
// worker) no debería tener que saber si el correo está configurado.

function getConfig(): { apiKey: string; from: string } | { missing: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();

  if (!apiKey && !from) {
    return {
      missing:
        'El correo automático no está configurado (faltan RESEND_API_KEY y RESEND_FROM).',
    };
  }
  if (!apiKey) {
    return { missing: 'El correo automático no está configurado (falta RESEND_API_KEY).' };
  }
  if (!from) {
    return { missing: 'El correo automático no está configurado (falta RESEND_FROM).' };
  }
  return { apiKey, from };
}

/** ¿Está el correo configurado? Lo usa el panel para avisarlo en pantalla. */
export function isEmailConfigured(): boolean {
  return !('missing' in getConfig());
}

/** Motivo por el cual el correo no está configurado, o `null` si sí lo está. */
export function emailConfigurationIssue(): string | null {
  const config = getConfig();
  return 'missing' in config ? config.missing : null;
}

/** Envío directo, sin pasar por el outbox. Solo para el correo de prueba del panel. */
export async function sendRawEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<ChannelSendResult> {
  const config = getConfig();
  if ('missing' in config) return { skipped: true, reason: config.missing };

  try {
    const resend = new Resend(config.apiKey);
    const { data, error } = await resend.emails.send({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    });

    if (error) {
      return { ok: false, error: error.message || 'Resend rechazó el envío.' };
    }
    return { ok: true, info: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error desconocido al enviar el correo.',
    };
  }
}

export const emailChannel: NotificationChannelAdapter = {
  sendsAutomatically: true,

  async send(notification: Notification): Promise<ChannelSendResult> {
    if (!notification.to_email) {
      return { skipped: true, reason: 'No hay dirección de correo para este destinatario.' };
    }

    return sendRawEmail({
      to: notification.to_email,
      subject: notification.subject ?? 'Centro Estético Manuj',
      html: notification.body,
    });
  },
};
