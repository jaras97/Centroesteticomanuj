import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import InfoTooltip from '@/components/admin/info-tooltip';
import { cn } from '@/lib/utils';

/**
 * Tarjeta de cifra de Finanzas. Es una versión con contexto de `SummaryCard`:
 * además del número muestra la variación contra el mes anterior y, cuando
 * hace falta, una explicación.
 *
 * `higherIsBetter` existe porque el color del delta NO puede salir del signo:
 * que suban los ingresos es verde, que suban los gastos es rojo.
 *
 * `delta === null` significa que el mes anterior fue cero, así que no hay
 * porcentaje que calcular: se escribe "sin base" en vez de un ∞ o un 100%
 * inventado.
 */
export default function FinanceStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tooltip,
  delta,
  higherIsBetter = true,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  /** Subtítulo pequeño bajo el número (ej. "de 3 citas por completar"). */
  hint?: string;
  /** Texto del icono de ayuda, para lo que no se explica solo. */
  tooltip?: string;
  /** Variación % contra el mes anterior. `undefined` = no se muestra. */
  delta?: number | null;
  higherIsBetter?: boolean;
  /** Tipografía más chica, para las filas de 2 columnas en móvil. */
  compact?: boolean;
}) {
  return (
    <Card className='h-full'>
      <CardContent className={cn('flex h-full items-start justify-between gap-2', compact ? 'p-4' : 'p-5')}>
        <div className='min-w-0'>
          {/* La etiqueta envuelve en vez de truncarse: en la fila de dos
              columnas de móvil quedan ~130px por tarjeta y "Clientes nuevos /
              recurrentes" truncado no dice nada. */}
          <p className='flex items-start gap-1 text-sm leading-snug text-gray-500'>
            <span className='min-w-0'>{label}</span>
            {tooltip && (
              <span className='mt-0.5'>
                <InfoTooltip text={tooltip} label={`Qué significa: ${label}`} />
              </span>
            )}
          </p>

          {/* El tamaño baja de nuevo en la fila de cuatro columnas: ahí cada
              tarjeta mide ~230px y le quedan ~160px de texto, donde un monto
              de siete cifras a `text-3xl` no entra. `break-words` es la red
              de seguridad para los de ocho (la caja acumulada): parte el
              monto en dos líneas en vez de dejar que se salga de la tarjeta y
              lo recorte el `overflow-x-hidden` de la columna de contenido. */}
          <p
            className={cn(
              'break-words bg-gradient-to-r from-brand-teal to-brand-teal-dark bg-clip-text font-bold tabular-nums text-transparent',
              compact ? 'text-lg sm:text-2xl' : 'text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl',
            )}
          >
            {value}
          </p>

          {delta !== undefined && <DeltaBadge delta={delta} higherIsBetter={higherIsBetter} />}
          {hint && <p className='mt-0.5 text-xs text-gray-500'>{hint}</p>}
        </div>

        <Icon className='h-5 w-5 shrink-0 text-brand-teal/40' />
      </CardContent>
    </Card>
  );
}

function DeltaBadge({
  delta,
  higherIsBetter,
}: {
  delta: number | null;
  higherIsBetter: boolean;
}) {
  if (delta === null) {
    return (
      <p className='mt-1 text-xs text-gray-500'>
        Sin base: el mes anterior fue cero
      </p>
    );
  }

  const isUp = delta > 0;
  const isFlat = delta === 0;
  const isGood = isUp === higherIsBetter;

  const Arrow = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-0.5 text-xs font-medium tabular-nums',
        isFlat ? 'text-gray-500' : isGood ? 'text-emerald-700' : 'text-red-600',
      )}
    >
      <Arrow className='h-3.5 w-3.5 shrink-0' />
      {isFlat ? 'Igual que' : `${Math.abs(delta)}% vs`} el mes anterior
    </p>
  );
}
