'use client';

import { Repeat, Trash2, Wallet } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ConfirmActionDialog from '@/components/admin/confirm-action-dialog';
import MovementFormDialog from '@/components/admin/movement-form-dialog';
import { deleteFinancialMovement } from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import { formatDateStrHuman } from '@/lib/booking/timezone';
import { MOVEMENT_KIND_LABEL, MOVEMENT_KIND_SIGN } from '@/lib/finance/types';
import { cn } from '@/lib/utils';
import type {
  ExpenseCategory,
  FinancialAccount,
  MonthStr,
  MovementKind,
  MovementListRow,
} from '@/lib/finance/types';

/**
 * El libro del mes. En pantalla ancha es una tabla; en móvil colapsa a
 * tarjetas apiladas, no a una tabla con scroll horizontal: siete columnas en
 * 360px se vuelven ilegibles aunque scrolleen, y Finanzas es uno de los cuatro
 * módulos de la barra inferior (o sea, se usa desde el celular).
 */
export default function MovementsTable({
  movements,
  month,
  accounts,
  categories,
  hasFilters,
}: {
  movements: MovementListRow[];
  month: MonthStr;
  accounts: FinancialAccount[];
  categories: ExpenseCategory[];
  hasFilters: boolean;
}) {
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        message={
          hasFilters
            ? 'Ningún movimiento coincide con los filtros.'
            : 'No hay movimientos registrados en este mes.'
        }
        hint={
          hasFilters
            ? 'Prueba quitando algún filtro o cambiando de mes.'
            : 'Los ingresos por cita no se registran acá: entran solos al completar la cita. Acá van gastos, ingresos extra, retiros y aportes.'
        }
      />
    );
  }

  return (
    <>
      {/* Tarjetas: móvil y tablet angosta. */}
      <ul className='space-y-2 md:hidden'>
        {movements.map((movement) => (
          <li key={movement.id} className='rounded-lg border bg-white p-3 shadow-sm'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <KindBadge kind={movement.kind} />
                  {movement.recurring_template_id && <RecurringBadge />}
                </div>
                <p className='mt-1 text-sm font-medium text-brand-ink'>
                  {movement.description || MOVEMENT_KIND_LABEL[movement.kind]}
                </p>
                <p className='text-xs text-gray-500'>
                  {formatDateStrHuman(movement.movement_date)}
                  {movement.category && ` · ${movement.category.name}`}
                  {movement.account && ` · ${movement.account.name}`}
                </p>
              </div>
              <SignedAmount kind={movement.kind} amount={movement.amount} />
            </div>

            <div className='mt-3 flex flex-wrap gap-2'>
              <RowActions
                movement={movement}
                month={month}
                accounts={accounts}
                categories={categories}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Tabla: de `md` en adelante, donde las siete columnas sí caben. */}
      <div className='hidden overflow-x-auto md:block'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className='text-right'>Monto</TableHead>
              <TableHead className='text-right'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className='whitespace-nowrap'>
                  {formatDateStrHuman(movement.movement_date)}
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap items-center gap-1.5'>
                    <KindBadge kind={movement.kind} />
                    {movement.recurring_template_id && <RecurringBadge />}
                  </div>
                </TableCell>
                <TableCell className='text-gray-500'>{movement.category?.name ?? '—'}</TableCell>
                <TableCell className='text-gray-500'>{movement.account?.name ?? 'Sin asignar'}</TableCell>
                <TableCell className='max-w-[16rem] truncate text-gray-500'>
                  {movement.description || '—'}
                </TableCell>
                <TableCell className='text-right'>
                  <SignedAmount kind={movement.kind} amount={movement.amount} />
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-2'>
                    <RowActions
                      movement={movement}
                      month={month}
                      accounts={accounts}
                      categories={categories}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function RowActions({
  movement,
  month,
  accounts,
  categories,
}: {
  movement: MovementListRow;
  month: MonthStr;
  accounts: FinancialAccount[];
  categories: ExpenseCategory[];
}) {
  return (
    <>
      <MovementFormDialog
        movement={movement}
        month={month}
        accounts={accounts}
        categories={categories}
      />
      <ConfirmActionDialog
        trigger={
          <Button size='sm' variant='outline'>
            <Trash2 className='h-3.5 w-3.5' />
            Eliminar
          </Button>
        }
        title='Eliminar movimiento'
        description={`Se borrará "${
          movement.description || MOVEMENT_KIND_LABEL[movement.kind]
        }" por ${formatCOP(movement.amount)}. Los totales del mes y la caja se recalculan enseguida.`}
        successMessage='Movimiento eliminado.'
        onConfirm={() => deleteFinancialMovement(movement.id)}
      />
    </>
  );
}

/**
 * El signo NO sale del tipo "ingreso/gasto" sino de `MOVEMENT_KIND_SIGN`: un
 * retiro sale de la caja igual que un gasto aunque no sea un gasto, y un
 * aporte entra igual que un ingreso aunque no sea utilidad.
 */
function SignedAmount({ kind, amount }: { kind: MovementKind; amount: number }) {
  const sign = MOVEMENT_KIND_SIGN[kind];
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums',
        sign === 1 ? 'text-emerald-700' : 'text-red-600',
      )}
    >
      {sign === 1 ? '+' : '−'} {formatCOP(amount)}
    </span>
  );
}

const KIND_BADGE_VARIANT: Record<
  MovementKind,
  'success' | 'secondary' | 'warning' | 'outline'
> = {
  INGRESO_OTRO: 'success',
  GASTO: 'secondary',
  RETIRO: 'warning',
  APORTE: 'outline',
};

function KindBadge({ kind }: { kind: MovementKind }) {
  return <Badge variant={KIND_BADGE_VARIANT[kind]}>{MOVEMENT_KIND_LABEL[kind]}</Badge>;
}

function RecurringBadge() {
  return (
    <Badge variant='outline' className='gap-1'>
      <Repeat className='h-3 w-3' />
      Fijo
    </Badge>
  );
}
