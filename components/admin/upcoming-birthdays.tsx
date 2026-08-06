import Link from 'next/link';
import { Cake } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/admin/empty-state';
import { formatBirthdayDate, birthdayRelativeLabel } from '@/lib/booking/birthdays';

export interface UpcomingBirthdayRow {
  id: string;
  name: string;
  birthday: string;
  daysUntil: number;
}

export default function UpcomingBirthdays({ rows }: { rows: UpcomingBirthdayRow[] }) {
  return (
    <Card>
      <CardContent className='p-5'>
        <h2 className='font-semibold text-brand-ink mb-4'>Próximos cumpleaños</h2>

        {rows.length === 0 ? (
          <EmptyState icon={Cake} message='No hay cumpleaños registrados.' />
        ) : (
          <ul className='space-y-3'>
            {rows.map((row) => (
              <li key={row.id} className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                  <Link
                    href={`/admin/clientes/${row.id}`}
                    className='font-medium text-brand-teal hover:underline truncate block'
                  >
                    {row.name}
                  </Link>
                  <p className='text-sm text-gray-500'>{formatBirthdayDate(row.birthday)}</p>
                </div>
                <Badge variant={row.daysUntil <= 1 ? 'warning' : 'outline'} className='shrink-0'>
                  {birthdayRelativeLabel(row.daysUntil)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
