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
  createExpenseCategory,
  updateExpenseCategory,
} from '@/app/admin/(dashboard)/actions';
import type { ExpenseCategory, ExpenseNature } from '@/lib/finance/types';

export const EXPENSE_NATURE_LABEL: Record<ExpenseNature, string> = {
  FIJO: 'Fijo',
  VARIABLE: 'Variable',
};

export default function ExpenseCategoryFormDialog({
  category,
  trigger,
}: {
  category?: ExpenseCategory;
  trigger?: ReactNode;
}) {
  const isEditing = !!category;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? '');
  const [nature, setNature] = useState<ExpenseNature>(category?.nature ?? 'VARIABLE');
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(category?.name ?? '');
      setNature(category?.nature ?? 'VARIABLE');
    }
    setOpen(next);
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }

    const input = { name: name.trim(), nature };

    startTransition(async () => {
      const result = isEditing
        ? await updateExpenseCategory(category.id, input)
        : await createExpenseCategory(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Categoría actualizada.' : 'Categoría creada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva categoría'}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>
            Las categorías son las que hacen que el desglose de gastos diga algo. Antes eran texto
            libre y cada variante contaba como una categoría distinta.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='category-name'>Nombre</Label>
            <Input
              id='category-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ej. Insumos'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='category-nature'>Tipo de gasto</Label>
            <Select value={nature} onValueChange={(v) => setNature(v as ExpenseNature)}>
              <SelectTrigger id='category-nature'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='FIJO'>Fijo (se repite cada mes)</SelectItem>
                <SelectItem value='VARIABLE'>Variable (puntual)</SelectItem>
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
