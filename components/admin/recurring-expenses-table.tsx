'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Repeat, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ConfirmActionDialog from '@/components/admin/confirm-action-dialog';
import RecurringExpenseFormDialog from '@/components/admin/recurring-expense-form-dialog';
import {
  deleteRecurringExpense,
  setRecurringExpenseActive,
} from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import type {
  ExpenseCategory,
  FinancialAccount,
  RecurringExpense,
} from '@/lib/finance/types';

/**
 * Plantillas de gasto fijo. Se muestran como tarjetas apiladas (no tabla): son
 * pocas filas con cinco datos cada una, y así se leen igual en 360px que en
 * pantalla ancha sin duplicar el marcado.
 */
export default function RecurringExpensesTable({
  recurring,
  accounts,
  categories,
}: {
  recurring: RecurringExpense[];
  accounts: FinancialAccount[];
  categories: ExpenseCategory[];
}) {
  if (recurring.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        message='Todavía no hay gastos fijos.'
        hint='Arriendo, servicios públicos, plan de datos… Crear la plantilla evita tener que acordarse del monto cada mes.'
      />
    );
  }

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <ul className='space-y-2'>
      {recurring.map((item) => (
        <RecurringRow
          key={item.id}
          item={item}
          accounts={accounts}
          categories={categories}
          categoryLabel={item.category_id ? categoryName.get(item.category_id) ?? null : null}
          accountLabel={item.account_id ? accountName.get(item.account_id) ?? null : null}
        />
      ))}
    </ul>
  );
}

function RecurringRow({
  item,
  accounts,
  categories,
  categoryLabel,
  accountLabel,
}: {
  item: RecurringExpense;
  accounts: FinancialAccount[];
  categories: ExpenseCategory[];
  categoryLabel: string | null;
  accountLabel: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await setRecurringExpenseActive(item.id, !item.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <li className='flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-sm sm:flex-row sm:items-center'>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-medium text-brand-ink'>{item.name}</span>
          <Badge variant={item.active ? 'success' : 'secondary'}>
            {item.active ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <p className='mt-0.5 text-sm tabular-nums text-gray-600'>
          {formatCOP(item.amount)}{' '}
          <span className='text-gray-500'>· cada mes el día {item.day_of_month}</span>
        </p>
        <p className='text-xs text-gray-500'>
          {categoryLabel ?? 'Sin categoría'} · {accountLabel ?? 'Sin cuenta asignada'}
        </p>
      </div>

      <div className='flex flex-wrap gap-2 sm:shrink-0'>
        <RecurringExpenseFormDialog
          recurring={item}
          accounts={accounts}
          categories={categories}
        />
        <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          {item.active ? 'Desactivar' : 'Activar'}
        </Button>
        <ConfirmActionDialog
          trigger={
            <Button size='sm' variant='outline'>
              <Trash2 className='h-3.5 w-3.5' />
              Eliminar
            </Button>
          }
          title='Eliminar gasto fijo'
          description={`Se borra la plantilla "${item.name}". Los movimientos que ya se registraron con ella no se tocan: ninguna cifra cambia.`}
          successMessage='Gasto fijo eliminado.'
          onConfirm={() => deleteRecurringExpense(item.id)}
        />
      </div>
    </li>
  );
}
