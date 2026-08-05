import { createServiceClient } from '@/lib/supabase/service';
import BookingWizard from '@/components/reservar/booking-wizard';

export default async function ReservarPage() {
  const supabase = createServiceClient();
  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_min, price, deposit_amount')
    .eq('active', true)
    .order('name');

  return (
    <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
      <div className='text-center mb-10'>
        <h1 className='text-3xl md:text-4xl font-bold mb-3 text-brand-ink'>
          Reserva tu cita
        </h1>
        <p className='text-gray-600'>
          Elige tu servicio, la fecha y hora que prefieras. Te confirmaremos
          por WhatsApp lo antes posible.
        </p>
      </div>
      <BookingWizard services={services ?? []} />
    </div>
  );
}
