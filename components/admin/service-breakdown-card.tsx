'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCOP } from '@/lib/format';
import type { ServiceRevenueRow } from '@/lib/finance/types';

export type { ServiceRevenueRow };

export default function ServiceBreakdownCard({
  monthData,
  allTimeData,
}: {
  monthData: ServiceRevenueRow[];
  allTimeData: ServiceRevenueRow[];
}) {
  const [range, setRange] = useState<'month' | 'all'>('month');
  const [sortBy, setSortBy] = useState<'revenue' | 'count'>('revenue');

  const rows = [...(range === 'month' ? monthData : allTimeData)].sort((a, b) =>
    sortBy === 'revenue' ? b.total - a.total : b.count - a.count,
  );

  return (
    <Card>
      <CardHeader className='flex-row items-center justify-between gap-3 flex-wrap space-y-0'>
        <CardTitle className='text-lg font-semibold'>Servicios</CardTitle>
        <div className='flex items-center gap-3 flex-wrap'>
          <div className='flex items-center rounded-md border p-0.5 text-xs'>
            {(['month', 'all'] as const).map((r) => (
              <button
                key={r}
                type='button'
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                  range === r ? 'bg-brand-teal text-white' : 'text-gray-500 hover:text-brand-ink'
                }`}
              >
                {r === 'month' ? 'Este mes' : 'Histórico'}
              </button>
            ))}
          </div>
          <div className='flex items-center rounded-md border p-0.5 text-xs'>
            {(['revenue', 'count'] as const).map((s) => (
              <button
                key={s}
                type='button'
                aria-pressed={sortBy === s}
                onClick={() => setSortBy(s)}
                className={`rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                  sortBy === s ? 'bg-brand-teal text-white' : 'text-gray-500 hover:text-brand-ink'
                }`}
              >
                {s === 'revenue' ? 'Por ingreso' : 'Por veces'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className='text-sm text-gray-500'>
            No hay citas completadas con monto {range === 'month' ? 'en este mes' : 'todavía'}.
          </p>
        ) : (
          <div className='space-y-3'>
            {/* La key es `serviceId` y no el nombre: dos servicios pueden
                llamarse igual (o renombrarse) y React reusaría la fila
                equivocada. */}
            {rows.map((s) => (
              <div key={s.serviceId} className='flex items-start justify-between gap-3 text-sm'>
                <span className='min-w-0 font-medium text-brand-ink'>
                  {s.name}{' '}
                  <span className='font-normal text-gray-500'>({s.count} veces)</span>
                </span>
                <span className='shrink-0 tabular-nums text-gray-600'>{formatCOP(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
