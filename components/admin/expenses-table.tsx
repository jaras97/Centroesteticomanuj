'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Receipt } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ExpenseFormDialog from '@/components/admin/expense-form-dialog';
import { deleteExpense } from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import { formatDateStrHuman } from '@/lib/booking/timezone';
import type { Expense } from '@/lib/supabase/types';

export default function ExpensesTable({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) {
    return <EmptyState icon={Receipt} message='No hay gastos registrados en este período.' />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} />
        ))}
      </TableBody>
    </Table>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <TableRow>
      <TableCell>{formatDateStrHuman(expense.expense_date)}</TableCell>
      <TableCell className='font-medium text-brand-ink'>{expense.category}</TableCell>
      <TableCell className='text-gray-500'>{expense.description || '—'}</TableCell>
      <TableCell>{formatCOP(expense.amount)}</TableCell>
      <TableCell>
        <div className='flex gap-2'>
          <ExpenseFormDialog expense={expense} />
          <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
            {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
            Eliminar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
