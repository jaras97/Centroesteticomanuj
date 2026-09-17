'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  History,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/admin/empty-state';
import { cn } from '@/lib/utils';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { EVENT_LABELS, RECIPIENT_LABELS } from '@/lib/notifications/templates';
import type {
  Notification,
  NotificationChannel,
  NotificationEvent,
  NotificationStatus,
} from '@/lib/notifications/types';
import { retryNotification } from '@/app/admin/(dashboard)/actions';

/**
 * Historial del outbox (las últimas 150 filas que trae la página).
 *
 * Desde que el encolado dejó de devolver `[]` en silencio cuando la clienta no
 * tiene correo, cada solicitud/recordatorio/cumpleaños de una clienta sin
 * correo deja una fila `OMITIDO` con el motivo. En producción la mayoría de
 * las clientas no tiene correo, así que el historial pasó a ser mucho más
 * voluminoso y mucho más ruidoso. Todo lo de acá apunta a lo mismo: que a
 * simple vista se entienda QUÉ salió, QUÉ no y POR QUÉ.
 */

/** Forma mínima que necesita el historial de una campaña: solo para el título. */
export interface NotificationCampaignRef {
  id: string;
  title: string;
}

/**
 * Nombre de una clienta, para poder buscar por nombre. El outbox guarda a
 * quién se le escribió (correo, teléfono) pero no cómo se llama: lo resuelve
 * la página desde `notifications.client_id`.
 */
export interface NotificationClientRef {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<NotificationStatus, string> = {
  PENDIENTE: 'Pendiente',
  ENVIANDO: 'Enviando…',
  ENVIADO: 'Enviado',
  FALLIDO: 'Falló',
  OMITIDO: 'Omitido',
};

const STATUS_VARIANTS: Record<
  NotificationStatus,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
> = {
  PENDIENTE: 'warning',
  ENVIANDO: 'secondary',
  ENVIADO: 'success',
  FALLIDO: 'destructive',
  OMITIDO: 'outline',
};

const STATUS_FILTERS: Array<{ value: 'TODOS' | NotificationStatus; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ENVIADO', label: 'Enviados' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'FALLIDO', label: 'Fallidos' },
  { value: 'OMITIDO', label: 'Omitidos' },
];

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Correo',
  whatsapp: 'WhatsApp',
};

const EVENT_ORDER: NotificationEvent[] = [
  'booking_requested',
  'appointment_reminder',
  'birthday',
  'campaign',
];

/** Valor centinela de los `Select`: Radix no admite un `SelectItem` con value vacío. */
const ALL = '__todos__';

/** Solo se comparan dígitos: en la base los teléfonos vienen con +57, espacios o nada. */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export default function NotificationHistory({
  notifications,
  campaigns = [],
  clients = [],
}: {
  notifications: Notification[];
  /**
   * Opcional a propósito: la página puede no pasarla (por ejemplo antes de que
   * exista el módulo de campañas) y el historial sigue funcionando — las filas
   * de campaña se muestran igual, solo que sin el título.
   */
  campaigns?: NotificationCampaignRef[];
  /**
   * También opcional: sin ella el historial funciona igual, solo que la
   * búsqueda queda limitada a correo y teléfono (como antes de la 0017).
   */
  clients?: NotificationClientRef[];
}) {
  const [status, setStatus] = useState<'TODOS' | NotificationStatus>('TODOS');
  const [channel, setChannel] = useState<'TODOS' | NotificationChannel>('TODOS');
  const [event, setEvent] = useState<'TODOS' | NotificationEvent>('TODOS');
  const [campaignId, setCampaignId] = useState<string>(ALL);
  const [query, setQuery] = useState('');

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
   * Todo menos el estado. Los conteos de las píldoras se calculan sobre ESTE
   * conjunto y no sobre el total: con el filtro de canal en "Correo", el
   * contador de "Omitidos" tiene que decir cuántos correos se omitieron, no
   * cuántas notificaciones se omitieron en total.
   */
  const preFiltered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const digits = onlyDigits(term);

    return notifications.filter((notification) => {
      if (channel !== 'TODOS' && notification.channel !== channel) return false;
      if (event !== 'TODOS' && notification.event !== event) return false;
      if (campaignId !== ALL && notification.campaign_id !== campaignId) return false;
      if (!term) return true;

      const title = notification.campaign_id
        ? campaignTitles.get(notification.campaign_id) ?? ''
        : '';
      // El nombre va primero en la lista porque es por lo que más se busca.
      const name = notification.client_id
        ? clientNames.get(notification.client_id) ?? ''
        : '';
      const haystack = [name, notification.to_email, notification.to_phone, title]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (haystack.includes(term)) return true;
      // Búsqueda por teléfono tecleado con o sin indicativo/espacios.
      if (digits.length >= 3 && notification.to_phone) {
        return onlyDigits(notification.to_phone).includes(digits);
      }
      return false;
    });
  }, [notifications, channel, event, campaignId, query, campaignTitles, clientNames]);

  const filtered = useMemo(
    () =>
      status === 'TODOS'
        ? preFiltered
        : preFiltered.filter((notification) => notification.status === status),
    [preFiltered, status],
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = { TODOS: preFiltered.length };
    for (const notification of preFiltered) {
      result[notification.status] = (result[notification.status] ?? 0) + 1;
    }
    return result;
  }, [preFiltered]);

  const hasFilters =
    status !== 'TODOS' ||
    channel !== 'TODOS' ||
    event !== 'TODOS' ||
    campaignId !== ALL ||
    query.trim() !== '';

  function clearFilters() {
    setStatus('TODOS');
    setChannel('TODOS');
    setEvent('TODOS');
    setCampaignId(ALL);
    setQuery('');
  }

  return (
    <div className='space-y-4'>
      {/* Filtros. En móvil van apilados (una fila de tres selects se desborda
          a 360px, y la columna del panel recorta el desborde en silencio). */}
      <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
        <div className='space-y-1.5 sm:w-40'>
          <Label htmlFor='historial-canal' className='text-xs text-gray-500'>
            Canal
          </Label>
          <Select
            value={channel}
            onValueChange={(value) => setChannel(value as 'TODOS' | NotificationChannel)}
          >
            <SelectTrigger id='historial-canal' className='h-11 sm:h-9'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='TODOS'>Todos los canales</SelectItem>
              <SelectItem value='email'>Correo</SelectItem>
              <SelectItem value='whatsapp'>WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5 sm:w-56'>
          <Label htmlFor='historial-evento' className='text-xs text-gray-500'>
            Evento
          </Label>
          <Select
            value={event}
            onValueChange={(value) => setEvent(value as 'TODOS' | NotificationEvent)}
          >
            <SelectTrigger id='historial-evento' className='h-11 sm:h-9'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='TODOS'>Todos los eventos</SelectItem>
              {EVENT_ORDER.map((item) => (
                <SelectItem key={item} value={item}>
                  {EVENT_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {campaigns.length > 0 && (
          <div className='space-y-1.5 sm:w-56'>
            <Label htmlFor='historial-campana' className='text-xs text-gray-500'>
              Campaña
            </Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger id='historial-campana' className='h-11 sm:h-9'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las campañas</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className='space-y-1.5 sm:w-60'>
          <Label htmlFor='historial-busqueda' className='text-xs text-gray-500'>
            Destinatario
          </Label>
          <div className='relative'>
            <Search
              aria-hidden
              className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500'
            />
            <Input
              id='historial-busqueda'
              type='text'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Nombre, correo o teléfono'
              className='h-11 pl-9 pr-9 sm:h-9'
            />
            {query && (
              <button
                type='button'
                onClick={() => setQuery('')}
                aria-label='Limpiar la búsqueda'
                className='absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal'
              >
                <X aria-hidden className='h-4 w-4' />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Estado: se conserva en píldoras con conteo, que es lo que se mira de
          reojo ("¿cuántos fallaron hoy?"). */}
      <div className='flex flex-wrap gap-2'>
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.value}
            type='button'
            aria-pressed={status === item.value}
            onClick={() => setStatus(item.value)}
            className={cn(
              'inline-flex min-h-[44px] items-center rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 sm:min-h-0 sm:py-1.5',
              status === item.value
                ? 'bg-brand-teal/10 text-brand-teal'
                : 'text-gray-500 hover:text-brand-ink',
            )}
          >
            {item.label} ({counts[item.value] ?? 0})
          </button>
        ))}
        {hasFilters && (
          <button
            type='button'
            onClick={clearFilters}
            className='inline-flex min-h-[44px] items-center gap-1 rounded-full px-3.5 text-sm font-medium text-gray-500 underline-offset-4 hover:text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 sm:min-h-0 sm:py-1.5'
          >
            <X className='h-3.5 w-3.5' />
            Quitar filtros
          </button>
        )}
      </div>

      {/* Siempre montado y siempre con texto: es la región que le anuncia el
          resultado a quien filtra con lector de pantalla. Cuando no hay nada
          que mostrar se oculta a la vista (el EmptyState lo dice en grande)
          pero se sigue anunciando. */}
      <p
        aria-live='polite'
        className={cn('text-xs text-gray-500', filtered.length === 0 && 'sr-only')}
      >
        {filtered.length === 0
          ? 'Ninguna notificación con estos filtros.'
          : filtered.length === notifications.length
            ? `${notifications.length} notificaciones`
            : `${filtered.length} de ${notifications.length} notificaciones`}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          message='No hay notificaciones con ese filtro.'
          hint={
            hasFilters
              ? 'Prueba quitando algún filtro o buscando por otro destinatario.'
              : undefined
          }
          action={
            hasFilters ? (
              <Button variant='outline' size='sm' onClick={clearFilters}>
                <X aria-hidden className='h-3.5 w-3.5' />
                Quitar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Tarjetas apiladas: móvil y tablet angosta. Seis columnas en 360px
              no caben, y el desborde se recortaría sin aviso. */}
          <ul className='space-y-2 md:hidden'>
            {filtered.map((notification) => (
              <li key={notification.id}>
                <HistoryCard
                  notification={notification}
                  clientName={nameOf(notification)}
                  campaignTitle={
                    notification.campaign_id
                      ? campaignTitles.get(notification.campaign_id) ?? null
                      : null
                  }
                />
              </li>
            ))}
          </ul>

          {/* Tabla: de `md` en adelante. */}
          <div className='hidden overflow-x-auto md:block'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((notification) => (
                  <HistoryRow
                    key={notification.id}
                    notification={notification}
                    clientName={nameOf(notification)}
                    campaignTitle={
                      notification.campaign_id
                        ? campaignTitles.get(notification.campaign_id) ?? null
                        : null
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/** Reintento: mismo comportamiento en la tabla y en la tarjeta. */
function useRetry(notification: Notification) {
  const [isPending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await retryNotification(notification.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Reintentado.');
    });
  }

  // OMITIDO también se reintenta: el caso típico es la clienta que no tenía
  // correo, Manu se lo cargó en la ficha y ahora sí se le puede mandar
  // (`retryNotification` vuelve a resolver el destinatario).
  const canRetry = notification.status === 'FALLIDO' || notification.status === 'OMITIDO';

  return { isPending, retry, canRetry };
}

function RetryButton({
  isPending,
  onRetry,
  className,
}: {
  isPending: boolean;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Button variant='outline' size='sm' onClick={onRetry} disabled={isPending} className={className}>
      {isPending ? (
        <Loader2 className='h-4 w-4 animate-spin' />
      ) : (
        <RotateCcw className='h-4 w-4' />
      )}
      Reintentar
    </Button>
  );
}

function ChannelLabel({ channel }: { channel: NotificationChannel }) {
  return (
    <span className='inline-flex items-center gap-1.5 text-sm text-gray-600'>
      {channel === 'email' ? (
        <Mail aria-hidden className='h-3.5 w-3.5' />
      ) : (
        <MessageCircle aria-hidden className='h-3.5 w-3.5' />
      )}
      {CHANNEL_LABELS[channel]}
    </span>
  );
}

/**
 * Cómo se presenta el destinatario de una fila.
 *
 * Cuando se conoce el nombre de la clienta va PRIMERO: es lo que identifica a
 * la persona de un vistazo (un `+57300…` no le dice nada a nadie) y es por lo
 * que se busca. En un aviso interno el destinatario es Manu, así que ahí el
 * nombre no encabeza: se dice de quién se trata, para que una búsqueda por
 * nombre que traiga ese aviso se entienda igual.
 */
function recipientParts(notification: Notification, clientName: string | null) {
  const contact = notification.to_email ?? notification.to_phone ?? 'Sin destinatario';
  const isClient = notification.recipient_kind === 'client';
  const named = isClient && !!clientName;

  return {
    lead: named ? (clientName as string) : contact,
    support: named ? contact : null,
    label:
      RECIPIENT_LABELS[notification.recipient_kind] +
      (!isClient && clientName ? ` · sobre ${clientName}` : ''),
  };
}

function CampaignTag({ title }: { title: string | null }) {
  return (
    <span className='mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-gray-500'>
      <Megaphone aria-hidden className='h-3 w-3 shrink-0' />
      <span className='truncate'>{title ?? 'Campaña'}</span>
    </span>
  );
}

/**
 * El motivo de un OMITIDO/FALLIDO es la información más importante de la fila:
 * es la respuesta literal a "¿por qué no le llegó?". Por eso sale del rincón
 * de la celda de estado y ocupa su propio bloque a ancho completo, sin
 * truncar.
 */
function ReasonBlock({ status, error }: { status: NotificationStatus; error: string }) {
  const isFailure = status === 'FALLIDO';
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
        isFailure ? 'bg-destructive/5 text-destructive' : 'bg-amber-50 text-amber-900',
      )}
    >
      <AlertCircle aria-hidden className='mt-0.5 h-4 w-4 shrink-0' />
      <span>
        <span className='font-medium'>{isFailure ? 'Falló: ' : 'No se envió: '}</span>
        {error}
      </span>
    </p>
  );
}

function HistoryCard({
  notification,
  clientName,
  campaignTitle,
}: {
  notification: Notification;
  clientName: string | null;
  campaignTitle: string | null;
}) {
  const { isPending, retry, canRetry } = useRetry(notification);
  const recipient = recipientParts(notification, clientName);

  return (
    <div className='rounded-lg border bg-white p-3 shadow-sm'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-sm font-medium text-brand-ink'>
            {EVENT_LABELS[notification.event] ?? notification.event}
          </p>
          {notification.campaign_id && <CampaignTag title={campaignTitle} />}
        </div>
        <Badge variant={STATUS_VARIANTS[notification.status]} className='shrink-0'>
          {STATUS_LABELS[notification.status]}
        </Badge>
      </div>

      <p className='mt-2 break-words text-sm text-brand-ink'>{recipient.lead}</p>
      {recipient.support && (
        <p className='break-words text-xs text-gray-500'>{recipient.support}</p>
      )}
      <p className='text-xs text-gray-500'>
        {recipient.label} · {CHANNEL_LABELS[notification.channel]} ·{' '}
        {formatBogotaHuman(notification.sent_at ?? notification.created_at)}
      </p>

      {notification.error && (
        <div className='mt-2'>
          <ReasonBlock status={notification.status} error={notification.error} />
        </div>
      )}

      {canRetry && (
        <div className='mt-3'>
          <RetryButton isPending={isPending} onRetry={retry} className='h-11 w-full sm:w-auto' />
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  notification,
  clientName,
  campaignTitle,
}: {
  notification: Notification;
  clientName: string | null;
  campaignTitle: string | null;
}) {
  const { isPending, retry, canRetry } = useRetry(notification);
  const recipient = recipientParts(notification, clientName);
  const hasReason = !!notification.error;

  return (
    <>
      <TableRow className={cn(hasReason && 'border-b-0')}>
        <TableCell className='whitespace-nowrap align-top text-sm text-gray-500'>
          {formatBogotaHuman(notification.sent_at ?? notification.created_at)}
        </TableCell>
        <TableCell className='align-top text-sm'>
          <div className='text-brand-ink'>
            {EVENT_LABELS[notification.event] ?? notification.event}
          </div>
          {notification.campaign_id && <CampaignTag title={campaignTitle} />}
        </TableCell>
        <TableCell className='align-top'>
          <ChannelLabel channel={notification.channel} />
        </TableCell>
        <TableCell className='align-top text-sm'>
          <div className='max-w-[18rem] break-words text-brand-ink'>{recipient.lead}</div>
          {recipient.support && (
            <div className='max-w-[18rem] break-words text-xs text-gray-500'>
              {recipient.support}
            </div>
          )}
          <div className='text-xs text-gray-500'>{recipient.label}</div>
        </TableCell>
        <TableCell className='align-top'>
          <Badge variant={STATUS_VARIANTS[notification.status]}>
            {STATUS_LABELS[notification.status]}
          </Badge>
        </TableCell>
        <TableCell className='align-top text-right'>
          {canRetry && <RetryButton isPending={isPending} onRetry={retry} />}
        </TableCell>
      </TableRow>
      {hasReason && (
        <TableRow>
          <TableCell colSpan={6} className='pt-0'>
            <ReasonBlock status={notification.status} error={notification.error as string} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
