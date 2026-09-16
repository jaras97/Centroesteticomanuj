import Link from 'next/link';
import { ExternalLink, MessageCircle } from 'lucide-react';
import pkg from '@/package.json';
import { getSiteSettings } from '@/lib/content/site-settings';
import { buildWhatsAppLink } from '@/lib/whatsapp';

// Accesos rápidos: un subconjunto del menú, las secciones que más se usan
// en el día a día. No duplica todo el nav a propósito.
const QUICK_LINKS = [
  { href: '/admin', label: 'Bandeja' },
  { href: '/admin/agenda', label: 'Agenda' },
  { href: '/admin/reservar', label: 'Nueva cita' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/contenido', label: 'Contenido' },
];

const LINK_CLASS =
  'rounded-sm transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2';

export default async function AdminFooter() {
  const settings = await getSiteSettings();
  const whatsappNumber = settings.whatsapp_number ?? '';
  const supportLink = whatsappNumber
    ? buildWhatsAppLink(whatsappNumber, 'Hola, necesito ayuda con el panel administrativo.')
    : null;

  return (
    <footer className='mt-12 border-t bg-white'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='font-medium text-brand-ink'>
              Centro Estético Manuj{' '}
              <span className='font-normal text-gray-400'>· Panel administrativo</span>
            </p>
            <p className='mt-1 text-xs text-gray-400'>
              © {new Date().getFullYear()} · Versión {pkg.version}
            </p>
          </div>

          <nav aria-label='Accesos rápidos'>
            <ul className='flex flex-wrap gap-x-4 gap-y-2'>
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            <a
              href='/'
              target='_blank'
              rel='noopener noreferrer'
              className={`inline-flex items-center gap-1.5 ${LINK_CLASS}`}
            >
              <ExternalLink className='h-4 w-4' />
              Ver sitio público
            </a>
            {supportLink && (
              <a
                href={supportLink}
                target='_blank'
                rel='noopener noreferrer'
                className={`inline-flex items-center gap-1.5 ${LINK_CLASS}`}
              >
                <MessageCircle className='h-4 w-4' />
                Soporte por WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
