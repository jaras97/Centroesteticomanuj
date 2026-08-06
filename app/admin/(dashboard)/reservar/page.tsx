import { CalendarPlus } from 'lucide-react';
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
      <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink mb-1'>
        <CalendarPlus className='h-6 w-6 text-brand-teal' />
        Nueva cita
      </h1>
      <p className='text-gray-500 mb-6'>
        Para clientes que te contactan directamente. La cita queda confirmada
        de inmediato, sin pasar por la bandeja de solicitudes.
      </p>
      <AdminBookingForm services={services ?? []} />
    </div>
  );
}
