'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createExpense, updateExpense } from '@/app/admin/(dashboard)/actions';
import { formatDateStr, toBogotaWallClock } from '@/lib/booking/timezone';
import type { Expense } from '@/lib/supabase/types';

const SUGGESTED_CATEGORIES = ['Insumos', 'Arriendo', 'Servicios públicos', 'Marketing', 'Otro'];

export default function ExpenseFormDialog({
  expense,
  trigger,
}: {
  expense?: Expense;
  trigger?: ReactNode;
}) {
  const isEditing = !!expense;
  const [open, setOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(
    expense?.expense_date ?? formatDateStr(toBogotaWallClock(new Date())),
  );
  const [category, setCategory] = useState(expense?.category ?? '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense?.amount != null ? String(expense.amount) : '');
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const trimmedCategory = category.trim();
    const parsedAmount = Number(amount);

    if (!trimmedCategory) {
      toast.error('La categoría es obligatoria.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('El monto debe ser mayor a cero.');
      return;
    }

    const input = {
      expenseDate,
      category: trimmedCategory,
      description: description.trim() || undefined,
      amount: parsedAmount,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateExpense(expense.id, input)
        : await createExpense(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Gasto actualizado.' : 'Gasto registrado.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nuevo gasto'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='expense-date'>Fecha</Label>
            <Input
              id='expense-date'
              type='date'
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='expense-category'>Categoría</Label>
            <Input
              id='expense-category'
              list='expense-categories'
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder='Ej. Insumos'
            />
            <datalist id='expense-categories'>
              {SUGGESTED_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='expense-description'>Descripción (opcional)</Label>
            <Input
              id='expense-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='expense-amount'>Monto (COP)</Label>
            <Input
              id='expense-amount'
              type='number'
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
