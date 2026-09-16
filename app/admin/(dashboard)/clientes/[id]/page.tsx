import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import ClientEditForm from '@/components/admin/client-edit-form';
import LoyaltyCard from '@/components/admin/loyalty-card';
import NotificationOptOutToggle from '@/components/admin/notification-opt-out-toggle';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { getClientLoyaltyStatus } from '@/lib/booking/loyalty';
import { formatCOP } from '@/lib/format';
import type { AppointmentStatus, Client } from '@/lib/supabase/types';

const STATUS_VARIANT: Record<
  AppointmentStatus,
  'warning' | 'outline' | 'default' | 'success' | 'destructive' | 'secondary'
> = {
  SOLICITADA: 'warning',
  ESPERANDO_ANTICIPO: 'outline',
  CONFIRMADA: 'default',
  COMPLETADA: 'success',
  CANCELADA: 'destructive',
  NO_ASISTIO: 'destructive',
  EXPIRADA: 'secondary',
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!client) notFound();

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, services(name)')
    .eq('client_id', id)
    .order('start_time', { ascending: false });

  const loyaltyStatus = await getClientLoyaltyStatus(supabase, id);

  return (
    <div>
      <Link
        href='/admin/clientes'
        className='inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-teal mb-4'
      >
        <ChevronLeft className='h-4 w-4' /> Clientes
      </Link>

      <h1 className='text-2xl font-bold text-brand-ink mb-1'>{client.name}</h1>
      <p className='text-gray-500 mb-6'>{client.phone}</p>

      <div className='grid gap-8 md:grid-cols-3'>
        <div className='md:col-span-2'>
          <h2 className='font-semibold text-brand-ink mb-3'>
            Historial de citas
          </h2>
          {!appointments || appointments.length === 0 ? (
            <p className='text-gray-500 text-sm'>Sin citas registradas todavía.</p>
          ) : (
            <div className='space-y-3'>
              {appointments.map((appt) => (
                <div key={appt.id} className='border rounded-lg p-4 bg-white'>
                  <div className='flex items-center justify-between gap-2 mb-1'>
                    <span className='font-medium text-brand-ink'>
                      {(appt as unknown as { services: { name: string } }).services?.name}
                    </span>
                    <Badge variant={STATUS_VARIANT[appt.status as AppointmentStatus]}>
                      {appt.status}
                    </Badge>
                  </div>
                  <p className='text-sm text-gray-600'>
                    {formatBogotaHuman(appt.start_time)} · {appt.duration_min} min
                    {appt.charged_amount != null && ` · ${formatCOP(appt.charged_amount)}`}
                  </p>
                  {appt.deposit_received_amount != null && (
                    <p className='text-sm text-emerald-700 mt-1'>
                      💰 Anticipo recibido: {formatCOP(appt.deposit_received_amount)}
                    </p>
                  )}
                  {appt.requested_name.trim().toLowerCase() !==
                    client.name.trim().toLowerCase() && (
                    <p className='text-sm text-amber-600 mt-1'>
                      ⚠ Escribió: &quot;{appt.requested_name}&quot;
                    </p>
                  )}
                  {appt.client_note && (
                    <p className='text-sm text-gray-500 mt-1 italic'>
                      “{appt.client_note}”
                    </p>
                  )}
                  {appt.reject_reason && (
                    <p className='text-sm text-gray-500 mt-1'>
                      Motivo: {appt.reject_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='space-y-6'>
          <div>
            <h2 className='font-semibold text-brand-ink mb-3'>Datos del cliente</h2>
            <ClientEditForm client={client as Client} />
          </div>
          <LoyaltyCard status={loyaltyStatus} />
          <NotificationOptOutToggle
            clientId={client.id}
            optOut={(client as Client).marketing_opt_out ?? false}
          />
        </div>
      </div>
    </div>
  );
}
