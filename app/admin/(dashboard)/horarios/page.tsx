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
        Esta es la plantilla base: se repite igual cada semana, hacia
        adelante indefinidamente. Un cambio aquí afecta{' '}
        <strong className='text-brand-ink'>todas las semanas futuras</strong>,
        no solo la actual.
      </p>
      <p className='text-gray-500 mb-6'>
        Si <strong className='text-brand-ink'>esta semana en particular</strong>{' '}
        trabajas menos horas o tienes un día distinto (ej. un domingo
        específico, una tarde libre), no edites la plantilla — usa
        &quot;Bloquear horario&quot; en la Agenda para esa fecha puntual. Así
        la plantilla base queda intacta para las demás semanas.
      </p>
      <AvailabilityEditor windows={(windows ?? []) as Availability[]} />
    </div>
  );
}
