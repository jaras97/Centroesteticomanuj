import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Clock,
  Image as ImageIcon,
  Inbox,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavLink {
  href: string;
  label: string;
  /** Etiqueta corta para la barra inferior de móvil (5 columnas en 360px). */
  shortLabel?: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  links: AdminNavLink[];
}

/**
 * Fuente única del menú del panel. Los 9 módulos agrupados por para qué se
 * usan, no por cuándo se construyeron: "Operación" es el día a día con las
 * citas, "Negocio" la parte administrativa y "Sitio" lo que ve el público.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Operación',
    links: [
      { href: '/admin', label: 'Bandeja', icon: Inbox },
      { href: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
      { href: '/admin/reservar', label: 'Nueva cita', shortLabel: 'Nueva', icon: CalendarPlus },
      { href: '/admin/horarios', label: 'Horarios', icon: Clock },
    ],
  },
  {
    label: 'Negocio',
    links: [
      { href: '/admin/finanzas', label: 'Finanzas', icon: Wallet },
      { href: '/admin/clientes', label: 'Clientes', icon: Users },
      { href: '/admin/servicios', label: 'Servicios', icon: Tag },
    ],
  },
  {
    label: 'Sitio',
    links: [
      { href: '/admin/contenido', label: 'Contenido', icon: ImageIcon },
      { href: '/admin/notificaciones', label: 'Notificaciones', icon: Bell },
    ],
  },
];

export const ADMIN_NAV_LINKS: AdminNavLink[] = ADMIN_NAV_GROUPS.flatMap((group) => group.links);

/** Los cuatro módulos que Manu abre a diario: van fijos en la barra inferior. */
const MOBILE_PRIMARY_HREFS = ['/admin', '/admin/agenda', '/admin/reservar', '/admin/finanzas'];

export const MOBILE_PRIMARY_LINKS: AdminNavLink[] = MOBILE_PRIMARY_HREFS.map(
  (href) => ADMIN_NAV_LINKS.find((link) => link.href === href)!,
);

/** El resto, con la misma agrupación, para la hoja de "Más". */
export const MOBILE_SECONDARY_GROUPS: AdminNavGroup[] = ADMIN_NAV_GROUPS.map((group) => ({
  ...group,
  links: group.links.filter((link) => !MOBILE_PRIMARY_HREFS.includes(link.href)),
})).filter((group) => group.links.length > 0);

/**
 * `/admin` es prefijo de todas las demás rutas del panel, así que solo puede
 * matchear exacto; el resto matchea por prefijo para que las subrutas
 * (`/admin/clientes/[id]`, `/admin/finanzas?month=…`) dejen su módulo marcado
 * como activo.
 */
export function isAdminLinkActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Título de la sección actual, para la barra compacta de móvil. */
export function adminSectionTitle(pathname: string): string {
  return ADMIN_NAV_LINKS.find((link) => isAdminLinkActive(pathname, link.href))?.label ?? 'Panel';
}
