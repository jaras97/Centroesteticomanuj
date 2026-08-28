import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from '@/components/admin/admin-nav';

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');

  return (
    // overflow-x-hidden como resguardo: si algún widget interno (tabs,
    // fila con muchos botones, etc.) llega a ser más ancho que la pantalla
    // en mobile, que se recorte/scrollee dentro de sí mismo en vez de
    // arrastrar toda la página a scroll horizontal.
    <div className='min-h-screen bg-gray-50 overflow-x-hidden'>
      <AdminNav email={user.email ?? ''} />
      <main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>{children}</main>
    </div>
  );
}
