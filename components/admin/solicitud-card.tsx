import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/admin/confirm-dialog';
import RejectDialog from '@/components/admin/reject-dialog';
import DepositReceivedButton from '@/components/admin/deposit-received-button';
import RescheduleDialog from '@/components/admin/reschedule-dialog';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export interface SolicitudRow {
  id: string;
  client_id: string;
  service_id: string;
  status: 'SOLICITADA' | 'ESPERANDO_ANTICIPO';
  start_time: string;
  duration_min: number;
  requested_name: string;
  client_note: string | null;
  expires_at: string | null;
  created_at: string;
  clients: { id: string; name: string; phone: string };
  services: {
    id: string;
    name: string;
    deposit_amount: number | null;
    price: number | null;
  };
}

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function SolicitudCard({
  request,
  isNewClient,
}: {
  request: SolicitudRow;
  isNewClient: boolean;
}) {
  const requiresDeposit = isNewClient && !!request.services.deposit_amount;
  const nameMismatch =
    request.requested_name.trim().toLowerCase() !==
    request.clients.name.trim().toLowerCase();

  const whatsappMessage = requiresDeposit
    ? `¡Hola ${request.clients.name}! Recibí tu solicitud de cita para ${request.services.name} el ${formatBogotaHuman(request.start_time)}. Como es tu primera cita, necesito un anticipo de ${currency.format(request.services.deposit_amount!)} para confirmarla. ¿Me cuentas cómo prefieres pagarlo?`
    : `¡Hola ${request.clients.name}! Recibí tu solicitud de cita para ${request.services.name} el ${formatBogotaHuman(request.start_time)}. Te confirmo en breve.`;

  return (
    <Card>
      <CardContent className='p-5'>
        <div className='flex flex-wrap items-start justify-between gap-3 mb-3'>
          <div>
            <div className='flex items-center gap-2 mb-1'>
              <h3 className='font-semibold text-brand-ink'>{request.clients.name}</h3>
              <Badge variant={isNewClient ? 'warning' : 'secondary'}>
                {isNewClient ? 'Nueva' : 'Recurrente'}
              </Badge>
              {request.status === 'ESPERANDO_ANTICIPO' && (
                <Badge variant='outline'>Esperando anticipo</Badge>
              )}
            </div>
            <p className='text-sm text-gray-600'>
              {request.services.name} · {formatBogotaHuman(request.start_time)} ·{' '}
              {request.duration_min} min
            </p>
            <p className='text-sm text-gray-500'>{request.clients.phone}</p>
            {nameMismatch && (
              <p className='text-sm text-amber-600 mt-1'>
                ⚠ Escribió: &quot;{request.requested_name}&quot;
              </p>
            )}
            {request.client_note && (
              <p className='text-sm text-gray-500 mt-1 italic'>
                “{request.client_note}”
              </p>
            )}
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          {request.status === 'SOLICITADA' && (
            <ConfirmDialog
              appointmentId={request.id}
              defaultDuration={request.duration_min}
              willRequireDeposit={requiresDeposit}
            />
          )}
          {request.status === 'ESPERANDO_ANTICIPO' && (
            <DepositReceivedButton appointmentId={request.id} />
          )}
          <RescheduleDialog appointmentId={request.id} currentStartTime={request.start_time} />
          <RejectDialog appointmentId={request.id} />
          <a
            href={buildWhatsAppLink(request.clients.phone, whatsappMessage)}
            target='_blank'
            rel='noopener noreferrer'
          >
            <Button size='sm' variant='outline'>
              WhatsApp
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
