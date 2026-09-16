import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX, Users } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EmptyState from '@/components/admin/empty-state';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import { isBirthdaySoon } from '@/lib/booking/birthdays';

export interface ClientRow {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  birthday: string | null;
  visitCount: number;
  lastVisit: string | null;
}

/** Criterios de orden admitidos; viajan en la URL como `?orden=`. */
export const CLIENTS_ORDERS = ['nombre', 'visitas', 'ultima'] as const;
export type ClientsOrder = (typeof CLIENTS_ORDERS)[number];

export function parseClientsOrder(raw: string | undefined): ClientsOrder {
  return CLIENTS_ORDERS.includes(raw as ClientsOrder)
    ? (raw as ClientsOrder)
    : 'nombre';
}

/** Sentido natural de cada criterio: el nombre sube, las métricas bajan. */
const ORDER_DIRECTION: Record<ClientsOrder, 'asc' | 'desc'> = {
  nombre: 'asc',
  visitas: 'desc',
  ultima: 'desc',
};

export default function ClientsTable({
  clients,
  orden,
  query,
  basePath = '/admin/clientes',
}: {
  clients: ClientRow[];
  orden: ClientsOrder;
  query: string;
  basePath?: string;
}) {
  if (clients.length === 0) {
    // Dos vacíos distintos: "no hay nada todavía" pide crear un cliente;
    // "la búsqueda no encontró nada" pide limpiar el filtro.
    if (query) {
      return (
        <div className='flex flex-col items-center gap-3 py-12 text-center'>
          <SearchX className='h-10 w-10 text-gray-400' />
          <p className='text-sm text-gray-500'>
            Ningún cliente coincide con{' '}
            <span className='font-medium text-brand-ink'>«{query}»</span>.
          </p>
          <Link
            href={basePath}
            className='inline-flex h-9 items-center rounded-md border border-input px-3 text-sm text-brand-ink transition-colors hover:bg-brand-teal/10'
          >
            Limpiar búsqueda
          </Link>
        </div>
      );
    }
    return <EmptyState icon={Users} message='Todavía no hay clientes registrados.' />;
  }

  function sortHref(target: ClientsOrder): string {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (target !== 'nombre') params.set('orden', target);
    // Cambiar el orden reinicia la paginación: la página 3 del orden
    // anterior no tiene nada que ver con la página 3 del nuevo.
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className='rounded-lg border bg-white'>
      <Table className='min-w-[640px]'>
        <TableHeader>
          <TableRow>
            <SortableHead label='Nombre' order='nombre' active={orden} href={sortHref('nombre')} />
            <TableHead>Teléfono</TableHead>
            <TableHead>Cumpleaños</TableHead>
            <SortableHead
              label='Citas completadas'
              order='visitas'
              active={orden}
              href={sortHref('visitas')}
            />
            <SortableHead
              label='Última visita'
              order='ultima'
              active={orden}
              href={sortHref('ultima')}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link
                  href={`/admin/clientes/${client.id}`}
                  className='font-medium text-brand-teal hover:underline'
                >
                  {client.name}
                </Link>
              </TableCell>
              <TableCell className='whitespace-nowrap'>{client.phone}</TableCell>
              <TableCell>
                {client.birthday ? (
                  <span
                    className={isBirthdaySoon(client.birthday) ? 'font-medium text-brand-ink' : ''}
                  >
                    {client.birthday.slice(5).split('-').reverse().join('/')}
                    {isBirthdaySoon(client.birthday) && ' 🎂'}
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>{client.visitCount}</TableCell>
              <TableCell className='whitespace-nowrap'>
                {client.lastVisit ? formatBogotaHuman(client.lastVisit) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortableHead({
  label,
  order,
  active,
  href,
}: {
  label: string;
  order: ClientsOrder;
  active: ClientsOrder;
  href: string;
}) {
  const isActive = active === order;
  const Icon = !isActive ? ArrowUpDown : ORDER_DIRECTION[order] === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={
        !isActive ? 'none' : ORDER_DIRECTION[order] === 'asc' ? 'ascending' : 'descending'
      }
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-1 transition-colors hover:text-brand-ink ${
          isActive ? 'text-brand-ink' : ''
        }`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-brand-teal' : 'text-gray-300'}`} />
      </Link>
    </TableHead>
  );
}
