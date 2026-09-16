'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EditAppointmentDialog from '@/components/admin/edit-appointment-dialog';
import EditChargeDialog from '@/components/admin/edit-charge-dialog';
import CompleteAppointmentDialog from '@/components/admin/complete-appointment-dialog';
import { formatBogotaHuman, formatTimeStr, toBogotaWallClock } from '@/lib/booking/timezone';
import { formatCOP } from '@/lib/format';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import {
  markNoShow,
  deleteBlockedSlot,
  getAppointmentDetail,
  type AppointmentDetail as AppointmentDetailData,
} from '@/app/admin/(dashboard)/actions';
import type { AgendaAppointment, AgendaBlockedSlot } from '@/components/admin/agenda-calendar';
import type { FinancialAccount } from '@/lib/supabase/types';

export type SelectedAgendaEvent =
  | { kind: 'appointment'; data: AgendaAppointment; isPast: boolean }
  | { kind: 'blocked'; data: AgendaBlockedSlot };

const STATUS_LABEL: Record<AgendaAppointment['status'], string> = {
  SOLICITADA: 'Solicitada',
  ESPERANDO_ANTICIPO: 'Esperando anticipo',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Completada',
};

const STATUS_VARIANT: Record<
  AgendaAppointment['status'],
  'warning' | 'outline' | 'default' | 'success'
> = {
  SOLICITADA: 'warning',
  ESPERANDO_ANTICIPO: 'outline',
  CONFIRMADA: 'default',
  COMPLETADA: 'success',
};

export default function AgendaEventDialog({
  event,
  accounts,
  onOpenChange,
}: {
  event: SelectedAgendaEvent | null;
  /** Cuentas activas de Finanzas, para el selector de los diálogos de cobro. */
  accounts: FinancialAccount[];
  onOpenChange: (open: boolean) => void;
}) {
  const [lastEvent, setLastEvent] = useState<SelectedAgendaEvent | null>(null);

  useEffect(() => {
    if (event) setLastEvent(event);
  }, [event]);

  const shown = event ?? lastEvent;

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto'>
        {shown?.kind === 'appointment' && (
          <AppointmentDetail
            appointment={shown.data}
            isPast={shown.isPast}
            accounts={accounts}
            onDone={() => onOpenChange(false)}
          />
        )}
        {shown?.kind === 'blocked' && (
          <BlockedDetail block={shown.data} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Fila etiqueta/valor del bloque de cobro. */
function DetailRow({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className='flex items-baseline justify-between gap-4'>
      <span className={muted ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
      <span
        className={
          emphasis ? 'font-semibold text-brand-ink' : muted ? 'text-gray-400' : 'text-brand-ink'
        }
      >
        {value}
      </span>
    </div>
  );
}

function AppointmentDetail({
  appointment,
  isPast,
  accounts,
  onDone,
}: {
  appointment: AgendaAppointment;
  isPast: boolean;
  accounts: FinancialAccount[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<AppointmentDetailData | null>(null);

  // El listado de la agenda trae un mes entero de citas: el cupón de
  // fidelización y demás detalle se cargan solo al abrir esta cita (mismo
  // patrón perezoso que getAvailableRewards al completar).
  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    getAppointmentDetail(appointment.id).then((data) => {
      if (!cancelled) setDetail(data);
    });
    return () => {
      cancelled = true;
    };
  }, [appointment.id]);

  const isCompleted = appointment.status === 'COMPLETADA';
  const endWall = toBogotaWallClock(new Date(appointment.end_time));

  const listPrice = detail?.service.price ?? appointment.services.price ?? null;
  const charged = detail?.charged_amount ?? appointment.charged_amount ?? null;
  const deposit = detail?.deposit_received_amount ?? appointment.deposit_received_amount ?? null;
  const paymentMethod = detail?.payment_method ?? appointment.payment_method ?? null;
  const appliedReward = detail?.appliedReward ?? null;
  const earnedReward = detail?.earnedReward ?? null;
  const priceDelta = listPrice != null && charged != null ? charged - listPrice : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className='flex items-center gap-2'>
          {appointment.clients.name}
          <Badge variant={STATUS_VARIANT[appointment.status]}>
            {STATUS_LABEL[appointment.status]}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <div className='space-y-1 text-sm'>
        <p className='text-brand-ink font-medium'>
          {detail?.service.name ?? appointment.services.name}
        </p>
        <p className='text-gray-500'>
          {formatBogotaHuman(appointment.start_time)} – {formatTimeStr(endWall)} ·{' '}
          {appointment.duration_min} min
          {detail && detail.service.duration_min !== appointment.duration_min && (
            <span className='text-gray-400'> (catálogo: {detail.service.duration_min} min)</span>
          )}
        </p>
        <p className='text-gray-500'>{appointment.clients.phone}</p>
        {detail?.client_note && (
          <p className='text-gray-500 italic'>“{detail.client_note}”</p>
        )}
        {detail &&
          detail.requested_name.trim().toLowerCase() !==
            detail.client.name.trim().toLowerCase() && (
            <p className='text-amber-600'>⚠ Escribió: &quot;{detail.requested_name}&quot;</p>
          )}
      </div>

      {isCompleted ? (
        <div className='rounded-lg border bg-gray-50 p-3 space-y-1.5 text-sm'>
          <p className='font-medium text-brand-ink mb-1'>Detalle del cobro</p>

          {listPrice != null && (
            <DetailRow label='Valor de lista' value={formatCOP(listPrice)} muted />
          )}

          {appliedReward && (
            <DetailRow
              label={`Cupón de fidelización (−${appliedReward.discount_percent}%)`}
              value='aplicado'
              muted
            />
          )}

          {charged != null ? (
            <DetailRow label='Valor cobrado' value={formatCOP(charged)} emphasis />
          ) : (
            <p className='text-amber-600'>
              Esta cita se completó sin registrar el valor cobrado — no suma en Finanzas.
            </p>
          )}

          {priceDelta != null && priceDelta !== 0 && (
            <DetailRow
              label={priceDelta < 0 ? 'Descuento sobre la lista' : 'Cobrado por encima de la lista'}
              value={`${priceDelta < 0 ? '−' : '+'}${formatCOP(Math.abs(priceDelta))}`}
              muted
            />
          )}

          {!!deposit && (
            <>
              <DetailRow label='Anticipo ya recibido' value={formatCOP(deposit)} />
              {charged != null && (
                <DetailRow
                  label='Saldo cobrado ese día'
                  value={formatCOP(Math.max(charged - deposit, 0))}
                  emphasis
                />
              )}
            </>
          )}

          <DetailRow label='Método de pago' value={paymentMethod ?? 'sin registrar'} muted={!paymentMethod} />

          {earnedReward && (
            <p className='text-emerald-700 pt-1'>
              🎉 Esta cita generó un cupón de {earnedReward.discount_percent}%
              {earnedReward.used_at ? ' (ya usado)' : ' (disponible)'}.
            </p>
          )}

          {!detail && (
            <p className='flex items-center gap-1.5 text-gray-400 pt-1'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' /> Cargando detalle…
            </p>
          )}
        </div>
      ) : (
        !!deposit && (
          <p className='text-sm text-emerald-700 font-medium'>
            💰 Anticipo recibido: {formatCOP(deposit)}
          </p>
        )
      )}

      <div className='flex flex-wrap gap-2 pt-2'>
        {/* También en citas que ya pasaron pero siguen abiertas: el cambio de
            servicio suele descubrirse al terminar el servicio, no antes. Una
            COMPLETADA se corrige con el diálogo de abajo. */}
        {!isCompleted && (
          <EditAppointmentDialog
            appointmentId={appointment.id}
            currentServiceId={appointment.service_id}
            currentStartTime={appointment.start_time}
            currentDurationMin={appointment.duration_min}
          />
        )}
        {isPast && appointment.status === 'CONFIRMADA' && (
          <>
            <CompleteAppointmentDialog
              appointmentId={appointment.id}
              clientId={appointment.client_id}
              bookedServiceId={appointment.service_id}
              bookedServiceName={detail?.service.name ?? appointment.services.name}
              defaultAmount={listPrice ?? 0}
              depositReceivedAmount={appointment.deposit_received_amount}
              accounts={accounts}
              onDone={onDone}
            />
            <Button
              size='sm'
              variant='outline'
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await markNoShow(appointment.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  onDone();
                })
              }
            >
              No asistió
            </Button>
          </>
        )}
        {isCompleted && (
          <EditChargeDialog
            appointmentId={appointment.id}
            bookedServiceId={appointment.service_id}
            bookedServiceName={detail?.service.name ?? appointment.services.name}
            currentAmount={charged}
            currentAccountId={detail?.account_id ?? null}
            depositReceivedAmount={deposit}
            accounts={accounts}
            onDone={onDone}
          />
        )}
        <a
          href={buildWhatsAppLink(
            appointment.clients.phone,
            `¡Hola ${appointment.clients.name}!`,
          )}
          target='_blank'
          rel='noopener noreferrer'
        >
          <Button size='sm' variant='outline'>
            WhatsApp
          </Button>
        </a>
        <Link href={`/admin/clientes/${appointment.client_id}`}>
          <Button size='sm' variant='ghost'>
            Ver ficha <ExternalLink className='h-3.5 w-3.5' />
          </Button>
        </Link>
      </div>
    </>
  );
}

function BlockedDetail({ block, onDone }: { block: AgendaBlockedSlot; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Horario bloqueado</DialogTitle>
      </DialogHeader>

      <div className='space-y-1 text-sm'>
        <p className='text-brand-ink font-medium'>
          {formatBogotaHuman(block.start_at)} – {formatBogotaHuman(block.end_at)}
        </p>
        {block.reason && <p className='text-gray-500'>{block.reason}</p>}
      </div>

      <div className='pt-2'>
        <Button
          size='sm'
          variant='outline'
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteBlockedSlot(block.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              onDone();
            })
          }
        >
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          Eliminar bloqueo
        </Button>
      </div>
    </>
  );
}
