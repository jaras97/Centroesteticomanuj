import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export default function ClientsTable({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return <p className='text-gray-500'>Todavía no hay clientes registrados.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Cumpleaños</TableHead>
          <TableHead>Citas completadas</TableHead>
          <TableHead>Última visita</TableHead>
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
            <TableCell>{client.phone}</TableCell>
            <TableCell>
              {client.birthday ? (
                <span className={isBirthdaySoon(client.birthday) ? 'font-medium text-brand-ink' : ''}>
                  {client.birthday.slice(5).split('-').reverse().join('/')}
                  {isBirthdaySoon(client.birthday) && ' 🎂'}
                </span>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell>{client.visitCount}</TableCell>
            <TableCell>
              {client.lastVisit ? formatBogotaHuman(client.lastVisit) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
