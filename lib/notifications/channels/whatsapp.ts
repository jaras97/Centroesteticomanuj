import { buildWhatsAppLink } from '@/lib/whatsapp';
import type { ChannelSendResult, Notification, NotificationChannelAdapter } from '../types';

// Adaptador de WhatsApp — modo ASISTIDO.
//
// Hoy no existe integración con la API de WhatsApp: el sistema redacta el
// mensaje, lo deja PENDIENTE en el outbox y el panel
// (/admin/notificaciones → "Pendientes de WhatsApp") lo muestra con un botón
// que abre el deep link wa.me ya escrito. Manu lo manda y marca "Enviado".
//
// Por eso `sendsAutomatically = false`: el worker ni siquiera consulta estas
// filas, así no se quedan girando en la cola en cada corrida.
//
// PARA MIGRAR A WHATSAPP CLOUD API: este archivo es el único que cambia.
// Ver docs/PRD-notificaciones.md → "Cómo se escala a WhatsApp Cloud API".

export const whatsappChannel: NotificationChannelAdapter = {
  sendsAutomatically: false,

  async send(notification: Notification): Promise<ChannelSendResult> {
    if (!notification.to_phone) {
      return { skipped: true, reason: 'No hay número de teléfono para este destinatario.' };
    }

    return {
      deferred: true,
      reason: 'WhatsApp se envía a mano desde la bandeja del panel.',
    };
  },
};

/** Deep link wa.me ya redactado para una notificación de la bandeja asistida. */
export function buildNotificationWhatsAppLink(
  notification: Pick<Notification, 'to_phone' | 'body'>,
): string | null {
  if (!notification.to_phone) return null;
  return buildWhatsAppLink(notification.to_phone, notification.body);
}
