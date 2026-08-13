'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCOP } from '@/lib/format';

export interface ServiceBreakdownRow {
  name: string;
  total: number;
  count: number;
}

export default function ServiceBreakdownCard({
  monthData,
  allTimeData,
}: {
  monthData: ServiceBreakdownRow[];
  allTimeData: ServiceBreakdownRow[];
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
                onClick={() => setRange(r)}
                className={`rounded px-2 py-1 transition-colors ${
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
                onClick={() => setSortBy(s)}
                className={`rounded px-2 py-1 transition-colors ${
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
            {rows.map((s) => (
              <div key={s.name} className='flex items-center justify-between text-sm'>
                <span className='text-brand-ink font-medium'>
                  {s.name} <span className='text-gray-400 font-normal'>({s.count} veces)</span>
                </span>
                <span className='text-gray-600'>{formatCOP(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
