import { Tag } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ServicesTable from '@/components/admin/services-table';
import ServiceFormDialog from '@/components/admin/service-form-dialog';

export default async function ServiciosPage() {
  const supabase = await createClient();

  const [{ data: services }, { data: categories }] = await Promise.all([
    supabase.from('services').select('*').order('active', { ascending: false }).order('name'),
    supabase.from('service_categories').select('*').order('display_order'),
  ]);

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink'>
          <Tag className='h-6 w-6 text-brand-teal' />
          Servicios
        </h1>
        <ServiceFormDialog categories={categories ?? []} />
      </div>
      <ServicesTable services={services ?? []} categories={categories ?? []} />
    </div>
  );
}
