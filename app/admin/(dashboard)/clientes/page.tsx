import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ClientsTable, { type ClientRow } from '@/components/admin/clients-table';

export default async function ClientesPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: appointments }] = await Promise.all([
    supabase.from('clients').select('id, name, phone, notes, birthday').order('name'),
    supabase
      .from('appointments')
      .select('client_id, start_time, status')
      .eq('status', 'COMPLETADA'),
  ]);

  const stats = new Map<string, { count: number; lastVisit: string | null }>();
  for (const appt of appointments ?? []) {
    const current = stats.get(appt.client_id) ?? { count: 0, lastVisit: null };
    current.count += 1;
    if (!current.lastVisit || appt.start_time > current.lastVisit) {
      current.lastVisit = appt.start_time;
    }
    stats.set(appt.client_id, current);
  }

  const rows: ClientRow[] = (clients ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    phone: client.phone,
    notes: client.notes,
    birthday: client.birthday,
    visitCount: stats.get(client.id)?.count ?? 0,
    lastVisit: stats.get(client.id)?.lastVisit ?? null,
  }));

  return (
    <div>
      <h1 className='flex items-center gap-2 text-2xl font-bold text-brand-ink mb-6'>
        <Users className='h-6 w-6 text-brand-teal' />
        Clientes
      </h1>
      <ClientsTable clients={rows} />
    </div>
  );
}
