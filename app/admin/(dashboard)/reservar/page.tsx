import { createClient } from '@/lib/supabase/server';
import AdminBookingForm from '@/components/admin/admin-booking-form';

export default async function AdminReservarPage() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_min, buffer_min, price')
    .eq('active', true)
    .order('name');

  return (
    <div>
      <h1 className='text-2xl font-bold text-brand-ink mb-1'>Nueva cita</h1>
      <p className='text-gray-500 mb-6'>
        Para clientes que te contactan directamente. La cita queda confirmada
        de inmediato, sin pasar por la bandeja de solicitudes.
      </p>
      <AdminBookingForm services={services ?? []} />
    </div>
  );
}
