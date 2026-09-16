'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, MoreHorizontal } from 'lucide-react';
import { signOut } from '@/app/admin/(dashboard)/actions';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  MOBILE_PRIMARY_LINKS,
  MOBILE_SECONDARY_GROUPS,
  isAdminLinkActive,
} from '@/components/admin/admin-nav-links';
import { cn } from '@/lib/utils';

// h-16 = 64px de alto real, bastante más que los 44px mínimos de target
// táctil. El layout reserva este alto con padding-bottom en la columna de
// contenido (ver app/admin/(dashboard)/layout.tsx).
const TAB =
  'flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal';

/**
 * Navegación de móvil (por debajo de `lg:`): barra inferior fija con los 4
 * módulos del día a día + "Más", que abre una hoja con el resto agrupado
 * igual que en el sidebar. La hoja usa el primitivo de Radix, así que el trap
 * de foco, el cierre con Escape y el bloqueo del scroll vienen de fábrica.
 */
export default function AdminMobileNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Si la navegación ocurre desde la hoja (o desde cualquier otro lado), se
  // cierra sola al cambiar de ruta.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const restIsActive = MOBILE_SECONDARY_GROUPS.some((group) =>
    group.links.some((link) => isAdminLinkActive(pathname, link.href)),
  );

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <nav
      aria-label='Navegación del panel'
      className='fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden'
    >
      <ul className='grid grid-cols-5'>
        {MOBILE_PRIMARY_LINKS.map((link) => {
          const active = isAdminLinkActive(pathname, link.href);

          return (
            <li key={link.href} className='min-w-0'>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(TAB, active ? 'text-brand-teal-dark' : 'text-gray-500')}
              >
                <link.icon className='h-5 w-5 shrink-0' />
                <span className='w-full truncate text-center'>
                  {link.shortLabel ?? link.label}
                </span>
              </Link>
            </li>
          );
        })}

        <li className='min-w-0'>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(TAB, restIsActive || open ? 'text-brand-teal-dark' : 'text-gray-500')}
            >
              <MoreHorizontal className='h-5 w-5 shrink-0' />
              <span className='w-full truncate text-center'>Más</span>
            </SheetTrigger>

            <SheetContent
              side='bottom'
              aria-describedby={undefined}
              className='max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5'
            >
              <SheetHeader className='pr-10 text-left'>
                <SheetTitle>Más secciones</SheetTitle>
              </SheetHeader>

              <div className='mt-5 space-y-5'>
                {MOBILE_SECONDARY_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className='px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500'>
                      {group.label}
                    </p>
                    <ul className='space-y-1'>
                      {group.links.map((link) => {
                        const active = isAdminLinkActive(pathname, link.href);

                        return (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1',
                                active
                                  ? 'bg-brand-teal/10 text-brand-teal-dark'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-brand-ink',
                              )}
                            >
                              <link.icon className='h-5 w-5 shrink-0' />
                              {link.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              <div className='mt-5 border-t pt-4'>
                <p className='truncate px-3 pb-2 text-xs text-gray-500'>{email}</p>
                <button
                  type='button'
                  onClick={handleSignOut}
                  className='flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1'
                >
                  <LogOut className='h-5 w-5 shrink-0' />
                  Salir
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
