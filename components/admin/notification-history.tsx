'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { History, Loader2, Mail, MessageCircle, RotateCcw } from 'lucide-react';
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
import EmptyState from '@/components/admin/empty-state';
import { cn } from '@/lib/utils';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { EVENT_LABELS, RECIPIENT_LABELS } from '@/lib/notifications/templates';
import type { Notification, NotificationStatus } from '@/lib/notifications/types';
import { retryNotification } from '@/app/admin/(dashboard)/actions';

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

const FILTERS: Array<{ value: 'TODOS' | NotificationStatus; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ENVIADO', label: 'Enviados' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'FALLIDO', label: 'Fallidos' },
  { value: 'OMITIDO', label: 'Omitidos' },
];

export default function NotificationHistory({
  notifications,
}: {
  notifications: Notification[];
}) {
  const [filter, setFilter] = useState<'TODOS' | NotificationStatus>('TODOS');

  const filtered = useMemo(
    () =>
      filter === 'TODOS'
        ? notifications
        : notifications.filter((n) => n.status === filter),
    [notifications, filter],
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = { TODOS: notifications.length };
    for (const notification of notifications) {
      result[notification.status] = (result[notification.status] ?? 0) + 1;
    }
    return result;
  }, [notifications]);

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-2'>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type='button'
            onClick={() => setFilter(item.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              filter === item.value
                ? 'bg-brand-teal/10 text-brand-teal'
                : 'text-gray-500 hover:text-brand-ink',
            )}
          >
            {item.label} ({counts[item.value] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={History} message='No hay notificaciones con ese filtro.' />
      ) : (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((notification) => (
                <HistoryRow key={notification.id} notification={notification} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ notification }: { notification: Notification }) {
  const [isPending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      const result = await retryNotification(notification.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Reintentado.');
    });
  }

  const canRetry = notification.status === 'FALLIDO' || notification.status === 'OMITIDO';

  return (
    <TableRow>
      <TableCell className='whitespace-nowrap text-sm text-gray-500'>
        {formatBogotaHuman(notification.sent_at ?? notification.created_at)}
      </TableCell>
      <TableCell className='text-sm'>{EVENT_LABELS[notification.event]}</TableCell>
      <TableCell>
        <span className='inline-flex items-center gap-1.5 text-sm text-gray-600'>
          {notification.channel === 'email' ? (
            <Mail className='h-3.5 w-3.5' />
          ) : (
            <MessageCircle className='h-3.5 w-3.5' />
          )}
          {notification.channel === 'email' ? 'Correo' : 'WhatsApp'}
        </span>
      </TableCell>
      <TableCell className='text-sm'>
        <div className='text-brand-ink'>
          {notification.to_email ?? notification.to_phone ?? '—'}
        </div>
        <div className='text-xs text-gray-400'>
          {RECIPIENT_LABELS[notification.recipient_kind]}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[notification.status]}>
          {STATUS_LABELS[notification.status]}
        </Badge>
        {notification.error && (
          <p className='mt-1 max-w-xs text-xs text-gray-500'>{notification.error}</p>
        )}
      </TableCell>
      <TableCell>
        {canRetry && (
          <Button variant='ghost' size='sm' onClick={handleRetry} disabled={isPending}>
            {isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <RotateCcw className='h-4 w-4' />
            )}
            Reintentar
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
