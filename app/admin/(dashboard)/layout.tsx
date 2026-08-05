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
    <div className='min-h-screen bg-gray-50'>
      <AdminNav email={user.email ?? ''} />
      <main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>{children}</main>
    </div>
  );
}
