'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCOP } from '@/lib/format';

export interface DailyRevenuePoint {
  day: number;
  amount: number;
}

export default function RevenueChart({ data }: { data: DailyRevenuePoint[] }) {
  return (
    <ResponsiveContainer width='100%' height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#e5e7eb' />
        <XAxis
          dataKey='day'
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#6b7280' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickFormatter={(v) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)}
          width={40}
        />
        <Tooltip
          cursor={{ fill: '#739DAA1a' }}
          formatter={(value: number) => [formatCOP(value), 'Ingresos']}
          labelFormatter={(day) => `Día ${day}`}
          contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb', fontSize: 13 }}
        />
        <Bar dataKey='amount' fill='#739DAA' radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
