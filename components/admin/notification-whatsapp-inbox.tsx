'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Megaphone,
  MessageCircle,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/admin/empty-state';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { EVENT_LABELS, RECIPIENT_LABELS } from '@/lib/notifications/templates';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/notifications/types';
import {
  markWhatsAppNotificationSent,
  skipWhatsAppNotification,
} from '@/app/admin/(dashboard)/actions';

// Bandeja asistida: mientras no exista la integración con WhatsApp Cloud API,
// el sistema redacta el mensaje y Manu lo manda con un click. El botón abre
// wa.me con el texto ya escrito; "Ya lo envié" cierra la notificación.
//
// Desde que existen las campañas, una sola promoción encola UNA FILA POR
// DESTINATARIA: 50 clientas son 50 filas de golpe, el mismo día en que también
// hay recordatorios y cumpleaños. Por eso la bandeja separa lo suelto (lo del
// día, que es lo urgente) de las campañas, que se pliegan en un grupo con su
// progreso. Lo suelto va PRIMERO y siempre visible: nunca puede quedar
// enterrado debajo de una campaña.

/** Forma mínima que necesita la bandeja de una campaña: solo para el título. */
export interface WhatsappInboxCampaignRef {
  id: string;
  title: string;
}

/**
 * Nombre de la clienta. El outbox solo guarda teléfono y correo, así que el
 * nombre llega desde la página. Sin él, la bandeja muestra un `+57300…` que no
 * le dice nada a nadie justo cuando hay que decidir a quién escribirle.
 */
export interface WhatsappInboxClientRef {
  id: string;
  name: string;
}

/**
 * Límite práctico de un deep link `wa.me`: por encima de esto algunos
 * navegadores (y el propio WhatsApp Web) cortan el texto. El cuerpo de una
 * campaña con flyer + la línea de baja es justo el caso que puede pasarse.
 */
const SAFE_LINK_LENGTH = 2000;

const URL_PATTERN = /https?:\/\/[^\s]+/;

/** Primer enlace del mensaje: en una campaña es el flyer (un wa.me no adjunta imágenes). */
function findFirstUrl(body: string): string | null {
  return body.match(URL_PATTERN)?.[0] ?? null;
}

interface CampaignGroup {
  id: string;
  title: string | null;
  items: Notification[];
  /** Pendientes que tenía el grupo al abrir la página (ver `baselineRef`). */
  baseline: number;
}

export default function NotificationWhatsappInbox({
  notifications,
  campaigns = [],
  clients = [],
}: {
  notifications: Notification[];
  /** Opcional a propósito: sin ella los grupos se muestran igual, sin título. */
  campaigns?: WhatsappInboxCampaignRef[];
  /** Opcional a propósito: sin ella las filas muestran el teléfono, como antes. */
  clients?: WhatsappInboxClientRef[];
}) {
  const campaignTitles = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign.title])),
    [campaigns],
  );

  const clientNames = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients],
  );

  function nameOf(notification: Notification): string | null {
    return notification.client_id ? clientNames.get(notification.client_id) ?? null : null;
  }

  /**
   * Cuántos mensajes tenía cada campaña la primera vez que se vio en esta
   * sesión. Es lo único honesto que se puede mostrar como progreso: la bandeja
   * solo recibe filas PENDIENTE, así que no sabe cuántas ya se enviaron antes
   * (y `campaigns.recipient_count` cuenta destinatarias de TODOS los canales,
   * no mensajes de WhatsApp). Un refresh reinicia la cuenta, por eso el texto
   * dice explícitamente "desde que abriste la bandeja".
   */
  const baselineRef = useRef(new Map<string, number>());

  const { loose, groups } = useMemo(() => {
    const looseItems: Notification[] = [];
    const byCampaign = new Map<string, Notification[]>();

    for (const notification of notifications) {
      if (!notification.campaign_id) {
        looseItems.push(notification);
        continue;
      }
      const bucket = byCampaign.get(notification.campaign_id);
      if (bucket) bucket.push(notification);
      else byCampaign.set(notification.campaign_id, [notification]);
    }

    const campaignGroups: CampaignGroup[] = [];
    for (const [id, items] of byCampaign) {
      if (!baselineRef.current.has(id)) baselineRef.current.set(id, items.length);
      const baseline = Math.max(baselineRef.current.get(id) ?? items.length, items.length);
      campaignGroups.push({ id, title: campaignTitles.get(id) ?? null, items, baseline });
    }

    return { loose: looseItems, groups: campaignGroups };
  }, [notifications, campaignTitles]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(id: string) {
    setOpenGroups((current) => ({ ...current, [id]: !isOpen(id) }));
  }

  // Una sola campaña y nada suelto: no tiene sentido obligar a un click extra.
  // Con mensajes sueltos o varias campañas, arrancan plegadas para que lo del
  // día se vea sin scrollear 50 filas de promoción.
  const defaultOpen = groups.length === 1 && loose.length === 0;

  function isOpen(id: string): boolean {
    return openGroups[id] ?? defaultOpen;
  }

  if (notifications.length === 0) {
    return (
      <EmptyState icon={MessageCircle} message='No hay mensajes de WhatsApp pendientes.' />
    );
  }

  return (
    <div className='space-y-6'>
      <p className='text-sm text-gray-500'>
        Estos mensajes ya están redactados. Al abrir WhatsApp se carga el texto completo: solo
        tienes que darle enviar y luego marcarlo acá.
      </p>

      {loose.length > 0 && (
        <section className='space-y-3'>
          {groups.length > 0 && (
            <h3 className='text-sm font-semibold text-brand-ink'>
              Mensajes del día ({loose.length})
            </h3>
          )}
          {loose.map((notification) => (
            <WhatsappCard
              key={notification.id}
              notification={notification}
              clientName={nameOf(notification)}
            />
          ))}
        </section>
      )}

      {groups.map((group) => (
        <CampaignGroupBlock
          key={group.id}
          group={group}
          clientNameOf={nameOf}
          open={isOpen(group.id)}
          onToggle={() => toggleGroup(group.id)}
        />
      ))}
    </div>
  );
}

function CampaignGroupBlock({
  group,
  clientNameOf,
  open,
  onToggle,
}: {
  group: CampaignGroup;
  /** Resuelve el nombre de la clienta; el outbox solo guarda el teléfono. */
  clientNameOf: (notification: Notification) => string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `campana-${group.id}`;
  const sent = Math.max(group.baseline - group.items.length, 0);
  const percent = group.baseline > 0 ? Math.round((sent / group.baseline) * 100) : 0;

  // Todas las destinatarias reciben el mismo texto salvo el nombre, así que la
  // vista previa se muestra UNA vez por campaña y no 50 veces.
  const sample = group.items[0];
  const flyerUrl = sample ? findFirstUrl(sample.body) : null;
  const sampleLink = sample?.to_phone
    ? buildWhatsAppLink(sample.to_phone, sample.body)
    : null;

  return (
    <section className='overflow-hidden rounded-lg border bg-white'>
      <h3>
        <button
          type='button'
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className='flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-brand-sand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal'
        >
          <Megaphone aria-hidden className='mt-0.5 h-5 w-5 shrink-0 text-brand-teal' />
          <span className='min-w-0 flex-1'>
            <span className='block text-sm font-semibold text-brand-ink'>
              Campaña{group.title ? ` "${group.title}"` : ''}
            </span>
            <span className='mt-0.5 block text-sm text-gray-500'>
              {sent} de {group.baseline} enviados · quedan {group.items.length}
            </span>
            <span
              aria-hidden
              className='mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-brand-sand/40'
            >
              <span
                className='block h-full rounded-full bg-brand-teal'
                style={{ width: `${percent}%` }}
              />
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0 text-gray-500 motion-safe:transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>

      <div id={panelId} hidden={!open} className='space-y-3 border-t px-4 pb-4 pt-3'>
        <p className='text-xs text-gray-500'>
          El progreso cuenta lo que marcaste desde que abriste la bandeja. Cada mensaje se manda
          igual que siempre: abrir WhatsApp, enviar y marcar acá.
        </p>

        {sample && (
          <div className='space-y-2'>
            <p className='text-xs font-medium text-gray-500'>Texto que se envía</p>
            <MessagePreview body={sample.body} />
            {flyerUrl && (
              <a
                href={flyerUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex min-h-[44px] items-center gap-1.5 text-sm text-brand-teal underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2'
              >
                <ExternalLink aria-hidden className='h-4 w-4' />
                Verificar el enlace del flyer
              </a>
            )}
            {sampleLink && sampleLink.length > SAFE_LINK_LENGTH && <LongMessageWarning />}
          </div>
        )}

        {/* A propósito NO hay "marcar todas como enviadas": ver el comentario
            al pie del archivo. */}
        <ul className='space-y-2'>
          {group.items.map((notification) => (
            <li key={notification.id}>
              <WhatsappCard
                notification={notification}
                clientName={clientNameOf(notification)}
                compact
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MessagePreview({ body }: { body: string }) {
  return (
    // El #ECE5DD no es color de marca: es el fondo del chat de WhatsApp, para
    // que la vista previa se parezca a lo que va a ver la clienta.
    // `break-words` es imprescindible: el link del flyer es una URL larguísima
    // sin espacios y a 360px se desbordaría de la tarjeta.
    <p className='whitespace-pre-wrap break-words rounded-md bg-[#ECE5DD] px-3 py-2 text-sm text-gray-800'>
      {body}
    </p>
  );
}

function LongMessageWarning() {
  return (
    <p className='flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900'>
      <TriangleAlert aria-hidden className='mt-0.5 h-4 w-4 shrink-0' />
      <span>
        El mensaje es muy largo para un enlace de WhatsApp y algunos navegadores pueden cortarlo.
        Revisa que llegue completo, o acorta el texto de la campaña.
      </span>
    </p>
  );
}

function WhatsappCard({
  notification,
  clientName = null,
  compact = false,
}: {
  notification: Notification;
  clientName?: string | null;
  /** Dentro de un grupo de campaña la vista previa ya se mostró una vez arriba. */
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showBody, setShowBody] = useState(false);

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

  const bodyId = `mensaje-${notification.id}`;

  return (
    <div className={cn('space-y-3 rounded-lg border bg-white p-4', compact && 'p-3')}>
      <div className='flex flex-wrap items-center gap-2'>
        {compact ? (
          <>
            <span className='text-sm font-medium text-brand-ink'>
              {clientName ?? notification.to_phone}
            </span>
            {clientName && (
              <span className='text-xs text-gray-500'>{notification.to_phone}</span>
            )}
          </>
        ) : (
          <>
            <Badge variant='secondary'>
              {EVENT_LABELS[notification.event] ?? notification.event}
            </Badge>
            <Badge variant='outline'>{RECIPIENT_LABELS[notification.recipient_kind]}</Badge>
            {clientName && (
              <span className='text-sm font-medium text-brand-ink'>{clientName}</span>
            )}
            <span className='text-sm text-gray-600'>{notification.to_phone}</span>
          </>
        )}
        <span className='text-xs text-gray-500 sm:ml-auto'>
          En cola desde {formatBogotaHuman(notification.created_at)}
        </span>
      </div>

      {compact ? (
        <>
          <button
            type='button'
            onClick={() => setShowBody((value) => !value)}
            aria-expanded={showBody}
            aria-controls={bodyId}
            className='inline-flex min-h-[44px] items-center gap-1 text-sm text-gray-500 underline-offset-4 hover:text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 sm:min-h-0'
          >
            <ChevronDown
              aria-hidden
              className={cn(
                'h-4 w-4 motion-safe:transition-transform',
                showBody && 'rotate-180',
              )}
            />
            {showBody ? 'Ocultar el texto' : 'Ver el texto de este mensaje'}
          </button>
          <div id={bodyId} hidden={!showBody}>
            <MessagePreview body={notification.body} />
          </div>
        </>
      ) : (
        <MessagePreview body={notification.body} />
      )}

      {link && link.length > SAFE_LINK_LENGTH && !compact && <LongMessageWarning />}

      <div className='flex flex-wrap justify-end gap-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleSkip}
          disabled={isPending}
          className='h-11 sm:h-9'
        >
          <X className='h-4 w-4' />
          Descartar
        </Button>
        {link && (
          <Button asChild variant='outline' size='sm' className='h-11 sm:h-9'>
            <a href={link} target='_blank' rel='noopener noreferrer'>
              <MessageCircle className='h-4 w-4' />
              Abrir WhatsApp
            </a>
          </Button>
        )}
        <Button size='sm' onClick={handleSent} disabled={isPending} className='h-11 sm:h-9'>
          {isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <Check className='h-4 w-4' />
          )}
          Ya lo envié
        </Button>
      </div>
    </div>
  );
}

// Por qué NO existe "marcar todas como enviadas":
//
// 1. Mentiría en el historial. El estado ENVIADO de una fila de WhatsApp es la
//    única constancia de que la clienta recibió el mensaje; marcar 50 de un
//    click, con WhatsApp abriéndose de a uno, garantiza que varias queden como
//    enviadas sin haberse enviado. El módulo entero existe para tener
//    trazabilidad: un botón que la ensucia a escala resta más de lo que suma.
// 2. Técnicamente sería una tanda de 50 llamadas sueltas (no hay Server Action
//    masiva) y cada una revalida la página: lento, y a mitad de camino deja la
//    bandeja en un estado ambiguo.
//
// Si algún día hace falta, el lugar correcto es una Server Action masiva que
// escriba un motivo explícito ("marcada en lote sin confirmación de envío"),
// detrás de un ConfirmActionDialog — no un botón suelto al lado de "Ya lo
// envié".
