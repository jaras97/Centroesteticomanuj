import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import AvailabilityEditor from '@/components/admin/availability-editor';
import type { Availability } from '@/lib/supabase/types';

export default async function HorariosPage() {
  const supabase = await createClient();

  const { data: windows } = await supabase
    .from('availability')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  return (
    <div>
      <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink mb-1'>
        <Clock className='h-6 w-6 text-brand-teal' />
        Horarios
      </h1>
      <p className='text-gray-500 mb-6'>
        Plantilla semanal de disponibilidad. Los cambios se reflejan de
        inmediato en el calendario de reservas público. Para bloquear un día
        puntual (ej. un domingo específico) usa &quot;Bloquear horario&quot; en
        la Agenda, en vez de quitarlo aquí.
      </p>
      <AvailabilityEditor windows={(windows ?? []) as Availability[]} />
    </div>
  );
}
