'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/admin/empty-state';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { EVENT_LABELS, RECIPIENT_LABELS } from '@/lib/notifications/templates';
import type { Notification } from '@/lib/notifications/types';
import {
  markWhatsAppNotificationSent,
  skipWhatsAppNotification,
} from '@/app/admin/(dashboard)/actions';

// Bandeja asistida: mientras no exista la integración con WhatsApp Cloud API,
// el sistema redacta el mensaje y Manu lo manda con un click. El botón abre
// wa.me con el texto ya escrito; "Ya lo envié" cierra la notificación.

export default function NotificationWhatsappInbox({
  notifications,
}: {
  notifications: Notification[];
}) {
  if (notifications.length === 0) {
    return (
      <EmptyState icon={MessageCircle} message='No hay mensajes de WhatsApp pendientes.' />
    );
  }

  return (
    <div className='space-y-3'>
      <p className='text-sm text-gray-500'>
        Estos mensajes ya están redactados. Al abrir WhatsApp se carga el texto completo: solo
        tienes que darle enviar y luego marcarlo acá.
      </p>
      {notifications.map((notification) => (
        <WhatsappRow key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function WhatsappRow({ notification }: { notification: Notification }) {
  const [isPending, startTransition] = useTransition();

  const link = notification.to_phone
    ? buildWhatsAppLink(notification.to_phone, notification.body)
    : null;

  function handleSent() {
    startTransition(async () => {
      const result = await markWhatsAppNotificationSent(notification.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Mensaje marcado como enviado.');
    });
  }

  function handleSkip() {
    startTransition(async () => {
      const result = await skipWhatsAppNotification(notification.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Mensaje descartado.');
    });
  }

  return (
    <div className='rounded-lg border bg-white p-4 space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='secondary'>{EVENT_LABELS[notification.event]}</Badge>
        <Badge variant='outline'>{RECIPIENT_LABELS[notification.recipient_kind]}</Badge>
        <span className='text-sm text-gray-600'>{notification.to_phone}</span>
        <span className='ml-auto text-xs text-gray-400'>
          En cola desde {formatBogotaHuman(notification.created_at)}
        </span>
      </div>

      <p className='whitespace-pre-wrap rounded-md bg-[#ECE5DD] px-3 py-2 text-sm text-gray-800'>
        {notification.body}
      </p>

      <div className='flex flex-wrap justify-end gap-2'>
        <Button variant='ghost' size='sm' onClick={handleSkip} disabled={isPending}>
          <X className='h-4 w-4' />
          Descartar
        </Button>
        {link && (
          <Button asChild variant='outline' size='sm'>
            <a href={link} target='_blank' rel='noopener noreferrer'>
              <MessageCircle className='h-4 w-4' />
              Abrir WhatsApp
            </a>
          </Button>
        )}
        <Button size='sm' onClick={handleSent} disabled={isPending}>
          {isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Check className='h-4 w-4' />}
          Ya lo envié
        </Button>
      </div>
    </div>
  );
}
