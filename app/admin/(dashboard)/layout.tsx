import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminSidebar from '@/components/admin/admin-sidebar';
import AdminSidebarPreferenceScript from '@/components/admin/admin-sidebar-script';
import AdminMobileHeader from '@/components/admin/admin-mobile-header';
import AdminMobileNav from '@/components/admin/admin-mobile-nav';
import AdminFooter from '@/components/admin/admin-footer';
import RouteProgress from '@/components/admin/route-progress';

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

  const email = user.email ?? '';

  return (
    <div className='min-h-screen bg-gray-50'>
      <RouteProgress />
      {/* Deja el sidebar en su ancho correcto antes del primer pintado. */}
      <AdminSidebarPreferenceScript />

      {/* Con el sidebar hay ~13 paradas de teclado antes del contenido en cada
          página; este enlace las saltea. Invisible hasta que recibe foco. */}
      <a
        href='#contenido-admin'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-brand-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2'
      >
        Saltar al contenido
      </a>

      {/* Los tres elementos de navegación son `fixed`, así que la columna de
          contenido reserva su espacio con padding. Se eligió `fixed` y no
          `sticky` porque el `overflow-x-hidden` de la columna la convierte en
          contenedor de scroll y eso rompe cualquier `position: sticky`
          adentro. */}
      <AdminSidebar email={email} />
      <AdminMobileHeader />

      {/* overflow-x-hidden como resguardo: si algún widget interno (tabs,
          fila con muchos botones, etc.) llega a ser más ancho que la pantalla
          en mobile, que se recorte/scrollee dentro de sí mismo en vez de
          arrastrar toda la página a scroll horizontal.
          flex-col + main flex-1: en páginas cortas el footer queda pegado abajo
          en vez de flotando a media pantalla.
          El padding inferior reserva el alto de la barra inferior de móvil
          (4rem) + el inset del notch, para que no tape ni el contenido ni el
          footer; en `lg:` esa barra no existe. */}
      <div className='flex min-h-screen flex-col overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] motion-safe:transition-[padding] motion-safe:duration-200 motion-safe:[transition-timing-function:cubic-bezier(0.25,0.1,0.25,1)] lg:pb-0 lg:pl-[var(--admin-sidebar-w)] lg:pt-0'>
        <main
          id='contenido-admin'
          tabIndex={-1}
          className='mx-auto w-full max-w-7xl flex-1 px-4 py-8 focus:outline-none sm:px-6 lg:px-8'
        >
          {children}
        </main>
        <AdminFooter />
      </div>

      <AdminMobileNav email={email} />
    </div>
  );
}
