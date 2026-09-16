'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronsLeft, LogOut } from 'lucide-react';
import { signOut } from '@/app/admin/(dashboard)/actions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ADMIN_NAV_GROUPS,
  isAdminLinkActive,
  type AdminNavLink,
} from '@/components/admin/admin-nav-links';
import { readSidebarState, writeSidebarState } from '@/lib/admin/sidebar-preference';
import { cn } from '@/lib/utils';

const ROW =
  'admin-sidebar-row flex w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1';

/**
 * Sidebar del panel, solo de `lg:` para arriba (en móvil manda
 * `admin-mobile-nav.tsx`). Es `fixed` y no `sticky` a propósito: el contenedor
 * del contenido lleva `overflow-x-hidden` como resguardo, lo que lo convierte
 * en contenedor de scroll y rompería cualquier `position: sticky` adentro.
 *
 * El ancho y lo que se oculta al colapsar se resuelven por CSS
 * (`--admin-sidebar-w` + `data-admin-sidebar` en el <html>, ver
 * `app/globals.css`). El estado de React de acá abajo NO pinta nada: solo
 * decide si hace falta tooltip y qué dice el `aria-label` del botón, cosas
 * que únicamente importan después de hidratar.
 */
export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Se sincroniza desde el DOM (no desde localStorage) porque el script
  // inline ya resolvió cuál es el valor bueno.
  useEffect(() => {
    setCollapsed(readSidebarState() === 'collapsed');
  }, []);

  const toggle = () => {
    const next = readSidebarState() === 'collapsed' ? 'expanded' : 'collapsed';
    writeSidebarState(next);
    setCollapsed(next === 'collapsed');
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin/login');
    router.refresh();
  };

  /** Envuelve en tooltip solo cuando el item quedó reducido a su ícono. */
  const withTooltip = (label: string, trigger: React.ReactElement) =>
    collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side='right'>{label}</TooltipContent>
      </Tooltip>
    ) : (
      trigger
    );

  const renderLink = (link: AdminNavLink) => {
    const active = isAdminLinkActive(pathname, link.href);

    return (
      <li key={link.href}>
        {withTooltip(
          link.label,
          <Link
            href={link.href}
            aria-current={active ? 'page' : undefined}
            // Colapsado, la etiqueta se oculta por CSS y el enlace se queda
            // sin nombre accesible (el tooltip describe, no nombra).
            aria-label={link.label}
            className={cn(
              ROW,
              'h-11',
              active
                ? 'bg-brand-teal/10 text-brand-teal-dark'
                : 'text-gray-500 hover:bg-gray-100 hover:text-brand-ink',
            )}
          >
            <link.icon className='h-5 w-5 shrink-0' />
            <span className='admin-sidebar-expanded-only truncate'>{link.label}</span>
          </Link>,
        )}
      </li>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className='fixed inset-y-0 left-0 z-40 hidden w-[var(--admin-sidebar-w)] flex-col border-r bg-white motion-safe:transition-[width] motion-safe:duration-200 motion-safe:[transition-timing-function:cubic-bezier(0.25,0.1,0.25,1)] lg:flex'
      >
        {/* Marca */}
        <div className='admin-sidebar-row flex h-16 shrink-0 items-center gap-3 border-b px-4'>
          <Link
            href='/admin'
            aria-label='Centro Estético Manuj — ir a la Bandeja'
            className='flex items-center gap-3 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2'
          >
            <span
              aria-hidden='true'
              className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-ink font-display text-lg italic leading-none text-white'
            >
              M
            </span>
            <span className='admin-sidebar-expanded-only min-w-0'>
              <span className='block truncate text-sm font-semibold text-brand-ink'>
                Centro Estético Manuj
              </span>
              <span className='block truncate text-xs text-gray-500'>Panel administrativo</span>
            </span>
          </Link>
        </div>

        {/* Módulos */}
        <nav aria-label='Navegación del panel' className='min-h-0 flex-1 overflow-y-auto px-2 py-4'>
          <ul className='space-y-6'>
            {ADMIN_NAV_GROUPS.map((group) => (
              <li key={group.label}>
                <p className='admin-sidebar-expanded-only px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500'>
                  {group.label}
                </p>
                {/* Separador para el modo colapsado, donde no hay título visible. */}
                <div
                  aria-hidden='true'
                  className='admin-sidebar-collapsed-only mx-3 mb-2 h-px bg-gray-100'
                />
                <ul className='space-y-1'>{group.links.map(renderLink)}</ul>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sesión + colapsar */}
        <div className='shrink-0 space-y-1 border-t p-2'>
          {withTooltip(
            'Expandir menú',
            <button
              type='button'
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
              className={cn(ROW, 'h-11 text-gray-500 hover:bg-gray-100 hover:text-brand-ink')}
            >
              <ChevronsLeft className='admin-sidebar-toggle-icon h-5 w-5 shrink-0 motion-safe:transition-transform motion-safe:duration-200' />
              <span className='admin-sidebar-expanded-only truncate'>Contraer menú</span>
            </button>,
          )}

          <p
            className='admin-sidebar-expanded-only truncate px-3 py-1 text-xs text-gray-500'
            title={email}
          >
            {email}
          </p>

          {withTooltip(
            'Salir',
            <button
              type='button'
              onClick={handleSignOut}
              aria-label='Salir'
              className={cn(ROW, 'h-11 text-gray-500 hover:bg-gray-100 hover:text-brand-ink')}
            >
              <LogOut className='h-5 w-5 shrink-0' />
              <span className='admin-sidebar-expanded-only truncate'>Salir</span>
            </button>,
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
