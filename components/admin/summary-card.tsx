import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className='p-5 flex items-start justify-between gap-3'>
        <div>
          <p className='text-sm text-gray-500'>{label}</p>
          <p className='text-3xl font-bold bg-gradient-to-r from-brand-teal to-brand-teal-dark bg-clip-text text-transparent'>
            {value}
          </p>
        </div>
        <Icon className='h-5 w-5 text-brand-teal/40 shrink-0' />
      </CardContent>
    </Card>
  );
}
