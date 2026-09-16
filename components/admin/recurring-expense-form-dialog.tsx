'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createRecurringExpense,
  updateRecurringExpense,
} from '@/app/admin/(dashboard)/actions';
import type {
  ExpenseCategory,
  FinancialAccount,
  RecurringExpense,
} from '@/lib/finance/types';

const NO_ACCOUNT = '__sin_cuenta__';
const NO_CATEGORY = '__sin_categoria__';

export default function RecurringExpenseFormDialog({
  recurring,
  accounts,
  categories,
  trigger,
}: {
  recurring?: RecurringExpense;
  accounts: FinancialAccount[];
  categories: ExpenseCategory[];
  trigger?: ReactNode;
}) {
  const isEditing = !!recurring;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(recurring?.name ?? '');
  const [amount, setAmount] = useState(recurring ? String(recurring.amount) : '');
  const [dayOfMonth, setDayOfMonth] = useState(String(recurring?.day_of_month ?? 1));
  const [categoryId, setCategoryId] = useState(recurring?.category_id ?? NO_CATEGORY);
  const [accountId, setAccountId] = useState(recurring?.account_id ?? NO_ACCOUNT);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(recurring?.name ?? '');
      setAmount(recurring ? String(recurring.amount) : '');
      setDayOfMonth(String(recurring?.day_of_month ?? 1));
      setCategoryId(recurring?.category_id ?? NO_CATEGORY);
      setAccountId(recurring?.account_id ?? NO_ACCOUNT);
    }
    setOpen(next);
  }

  function handleSubmit() {
    const parsedAmount = Number(amount);
    const parsedDay = Number(dayOfMonth);

    if (!name.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('El monto debe ser mayor a cero.');
      return;
    }
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 28) {
      toast.error('El día del mes debe estar entre 1 y 28.');
      return;
    }

    const input = {
      name: name.trim(),
      amount: parsedAmount,
      dayOfMonth: parsedDay,
      categoryId: categoryId === NO_CATEGORY ? null : categoryId,
      accountId: accountId === NO_ACCOUNT ? null : accountId,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateRecurringExpense(recurring.id, input)
        : await createRecurringExpense(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Gasto fijo actualizado.' : 'Gasto fijo creado.');
      setOpen(false);
    });
  }

  const activeCategories = categories.filter((c) => c.active || c.id === recurring?.category_id);
  const activeAccounts = accounts.filter((a) => a.active || a.id === recurring?.account_id);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nuevo gasto fijo'}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className='max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</DialogTitle>
          <DialogDescription>
            Es una plantilla, no un gasto: cada mes te aparece como pendiente en Movimientos para
            que la confirmes con un clic.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='recurring-name'>Nombre</Label>
            <Input
              id='recurring-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ej. Arriendo del local'
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='recurring-amount'>Monto (COP)</Label>
              <Input
                id='recurring-amount'
                type='number'
                min={0}
                step={1000}
                inputMode='numeric'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='recurring-day'>Día del mes</Label>
              <Input
                id='recurring-day'
                type='number'
                min={1}
                max={28}
                inputMode='numeric'
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
              <p className='text-xs text-gray-500'>
                Del 1 al 28, para que la fecha exista también en febrero.
              </p>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='recurring-category'>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id='recurring-category'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                {activeCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='recurring-account'>¿De qué cuenta sale?</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id='recurring-account'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ACCOUNT}>Sin asignar</SelectItem>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)} disabled={isPending}>
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
