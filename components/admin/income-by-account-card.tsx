import { CircleHelp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCOP } from '@/lib/format';
import type { IncomeByAccountRow } from '@/lib/finance/types';

/**
 * De dónde entró la plata del mes, agrupada por cuenta.
 *
 * Las filas con `assigned: false` no son una cuenta: son el `payment_method`
 * histórico de citas anteriores a la migración 0016, cuando el método de pago
 * era texto libre y no se agregaba en ningún lado. Se marcan aparte para que
 * no parezcan cuentas reales y para que se note que conviene ir asignándolas.
 */
export default function IncomeByAccountCard({ rows }: { rows: IncomeByAccountRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const hasUnassigned = rows.some((r) => !r.assigned);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg font-semibold'>De dónde entró la plata</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className='text-sm text-gray-500'>No hay ingresos registrados en este mes.</p>
        ) : (
          <div className='space-y-3'>
            {rows.map((row) => (
              <div
                key={row.assigned ? `a:${row.accountId}` : `f:${row.name}`}
                className='flex items-start justify-between gap-3 text-sm'
              >
                <span className='flex min-w-0 items-center gap-1.5'>
                  {/* `role='img'`: un <svg> con `aria-label` pero sin rol
                      explícito no se anuncia de forma fiable. */}
                  {!row.assigned && (
                    <CircleHelp
                      role='img'
                      className='h-3.5 w-3.5 shrink-0 text-amber-600'
                      aria-label='Sin cuenta asignada'
                    />
                  )}
                  <span
                    className={row.assigned ? 'font-medium text-brand-ink' : 'text-gray-500'}
                  >
                    {row.name}
                  </span>
                </span>
                <span className='shrink-0 tabular-nums text-gray-600'>{formatCOP(row.total)}</span>
              </div>
            ))}

            <div className='flex items-center justify-between border-t pt-3 text-sm font-semibold text-brand-ink'>
              <span>Total</span>
              <span className='tabular-nums'>{formatCOP(total)}</span>
            </div>
          </div>
        )}

        {hasUnassigned && (
          <p className='mt-4 flex gap-1.5 text-xs text-gray-500'>
            <CircleHelp className='mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500' aria-hidden />
            <span>
              Las filas marcadas son citas anteriores a que existieran las cuentas: se agrupan por
              el método de pago que se escribió a mano y no suman al saldo de ninguna cuenta. De
              aquí en adelante, elige la cuenta al completar la cita.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
