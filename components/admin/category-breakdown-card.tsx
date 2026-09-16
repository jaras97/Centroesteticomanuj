import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCOP } from '@/lib/format';
import type { CategoryExpenseRow } from '@/lib/finance/types';

/**
 * En qué se fue la plata este mes. Solo gastos operativos: los retiros no
 * aparecen acá porque no son un gasto, y meterlos volvería a corromper el
 * desglose (era justo el problema del modelo anterior).
 *
 * La marca FIJO/VARIABLE sirve para leer la fila de un vistazo: lo FIJO es lo
 * que se repite mes a mes y se puede planear; lo VARIABLE es lo que se decide.
 */
export default function CategoryBreakdownCard({ rows }: { rows: CategoryExpenseRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg font-semibold'>Gastos por categoría</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className='text-sm text-gray-500'>No hay gastos registrados en este mes.</p>
        ) : (
          <div className='space-y-3'>
            {rows.map((row) => (
              <div
                key={row.categoryId ?? '__sin_categoria__'}
                className='flex items-start justify-between gap-3 text-sm'
              >
                <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
                  <span className='font-medium text-brand-ink'>{row.name}</span>
                  {row.nature ? (
                    <Badge variant={row.nature === 'FIJO' ? 'secondary' : 'outline'}>
                      {row.nature === 'FIJO' ? 'Fijo' : 'Variable'}
                    </Badge>
                  ) : (
                    <Badge variant='warning'>Sin clasificar</Badge>
                  )}
                  <span className='font-normal text-gray-500'>
                    ({row.count} {row.count === 1 ? 'movimiento' : 'movimientos'})
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

        {rows.some((r) => r.categoryId === null) && (
          <p className='mt-4 text-xs text-gray-500'>
            &ldquo;Sin categoría&rdquo; son gastos viejos cuya categoría de texto libre no calzó con
            ninguna de las actuales. Edítalos desde Movimientos para asignarles una.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
