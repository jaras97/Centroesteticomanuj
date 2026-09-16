'use client';

import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from '@/components/admin/empty-state';
import { formatCOP } from '@/lib/format';
import type { DailyCashFlowPoint } from '@/lib/finance/types';

/**
 * Flujo diario del mes: ingresos operativos contra gastos operativos.
 *
 * Es **P&L, no caja**: los retiros y aportes quedan fuera a propósito (los
 * excluye `getDailyCashFlow`). Si entraran, un retiro de fin de mes se vería
 * como un día de gastos enorme, que es exactamente la confusión que este
 * módulo viene a eliminar. El pie del gráfico lo dice en la página.
 *
 * Color: `fill='currentColor'` + una clase de Tailwind en la serie, en vez del
 * hex que tenía la versión anterior. Los colores de marca son
 * `hsl(var(--brand-*))` y se re-tematizan en runtime desde `site_settings`; un
 * hex quemado acá se quedaba con el teal original aunque Manu cambiara la
 * paleta. Recharts no entiende clases, pero sí hereda `color` del `<g>` de la
 * serie, y de ahí lo resuelve `currentColor`.
 *
 * Por lo mismo la leyenda es propia y no la de recharts: la de recharts pinta
 * su cuadrito con el valor literal de `fill` ("currentColor"), fuera del `<g>`
 * de la serie, y saldría del color equivocado.
 *
 * ACCESIBILIDAD: un `<svg>` de barras no le dice nada a un lector de pantalla.
 * El gráfico (con su leyenda) va dentro de un contenedor `aria-hidden` y la
 * misma serie se publica como una `<table>` `sr-only` — invisible, pero en el
 * árbol de accesibilidad. Nada de esto cambia un pixel de lo que se ve.
 */
export default function DailyCashFlowChart({ data }: { data: DailyCashFlowPoint[] }) {
  // Un mes sin nada no se dibuja: recharts, con todas las barras en cero,
  // inventa un dominio de [0, 1] y pinta un eje de cinco "0k" idénticos, que
  // parece un error de la página y no un mes vacío.
  const hasData = data.some((point) => point.income > 0 || point.expense > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={BarChart3}
        message='Todavía no hay movimientos en este mes.'
        hint='Al completar una cita o registrar un gasto aparece acá el día a día del mes.'
      />
    );
  }

  // Para la tabla se dejan fuera los días sin movimiento. El gráfico SÍ los
  // necesita (si no, el eje X queda con huecos y las barras se despegan del
  // calendario), pero escuchar "día 3, cero pesos, cero pesos" veinte veces
  // seguidas es hostil: la información útil son los días que tuvieron algo. El
  // pie de la tabla aclara que el resto del mes quedó en cero, así que no se
  // pierde nada. Acá siempre queda al menos una fila: si no hubiera ninguna,
  // `hasData` ya habría devuelto el estado vacío de arriba.
  const daysWithMovement = data.filter((point) => point.income > 0 || point.expense > 0);
  const totalIncome = data.reduce((sum, point) => sum + point.income, 0);
  const totalExpense = data.reduce((sum, point) => sum + point.expense, 0);

  return (
    <figure className='m-0'>
      <figcaption className='sr-only'>
        Gráfico de barras de ingresos y gastos operativos por día del mes. Los mismos datos
        están en la tabla que sigue.
      </figcaption>

      <div aria-hidden='true'>
        <div className='mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500'>
          <span className='flex items-center gap-1.5'>
            <span className='h-2.5 w-2.5 rounded-sm bg-brand-teal' aria-hidden />
            Ingresos
          </span>
          <span className='flex items-center gap-1.5'>
            <span className='h-2.5 w-2.5 rounded-sm bg-brand-sand-dark' aria-hidden />
            Gastos
          </span>
        </div>

        <ResponsiveContainer width='100%' height={260}>
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#e5e7eb' />
            <XAxis
              dataKey='day'
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              interval='preserveStartEnd'
              minTickGap={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={formatAxisAmount}
              allowDecimals={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              formatter={(value: number, key) => [
                formatCOP(value),
                key === 'income' ? 'Ingresos' : 'Gastos',
              ]}
              labelFormatter={(day) => `Día ${day}`}
              contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb', fontSize: 13 }}
            />
            <Bar
              dataKey='income'
              className='text-brand-teal'
              fill='currentColor'
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
            <Bar
              dataKey='expense'
              className='text-brand-sand-dark'
              fill='currentColor'
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* La alternativa textual del gráfico. `sr-only` = fuera de la vista, dentro del árbol
          de accesibilidad. El pie repite lo mismo que la nota bajo el gráfico en la página:
          esto es el resultado del negocio (P&L), no la caja. */}
      <table className='sr-only'>
        <caption>
          Ingresos y gastos operativos por día. Solo se listan los días con movimiento; los
          demás días del mes quedaron en cero. Los retiros y los aportes no entran a
          propósito: es el resultado del negocio, no la caja.
        </caption>
        <thead>
          <tr>
            <th scope='col'>Día</th>
            <th scope='col'>Ingresos</th>
            <th scope='col'>Gastos</th>
          </tr>
        </thead>
        <tbody>
          {daysWithMovement.map((point) => (
            <tr key={point.day}>
              <th scope='row'>Día {point.day}</th>
              <td>{formatCOP(point.income)}</td>
              <td>{formatCOP(point.expense)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope='row'>Total del mes</th>
            <td>{formatCOP(totalIncome)}</td>
            <td>{formatCOP(totalExpense)}</td>
          </tr>
        </tfoot>
      </table>
    </figure>
  );
}

/**
 * El eje en pesos colombianos es larguísimo ($1.500.000 son 10 caracteres) y a
 * 360px se come el gráfico: se abrevia a "1,5M" / "150k" para que el eje quepa
 * en 44px. El monto exacto sigue estando en el tooltip.
 */
function formatAxisAmount(value: number): string {
  // Por debajo de mil no se abrevia: "0k" para 250 no dice nada.
  if (Math.abs(value) < 1000) return String(Math.round(value));
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toFixed(millions >= 10 ? 0 : 1).replace('.', ',')}M`;
  }
  return `${Math.round(value / 1000)}k`;
}
