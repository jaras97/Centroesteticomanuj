'use client';

import { useTransition } from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ReorderHandle, {
  ReorderAnnouncer,
  reorderItemMotion,
} from '@/components/admin/reorder-handle';
import {
  useKeyboardReorder,
  type ReorderHandleProps,
} from '@/lib/admin/use-keyboard-reorder';
import ExpenseCategoryFormDialog, {
  EXPENSE_NATURE_LABEL,
} from '@/components/admin/expense-category-form-dialog';
import {
  reorderExpenseCategories,
  setExpenseCategoryActive,
} from '@/app/admin/(dashboard)/actions';
import type { ExpenseCategory } from '@/lib/finance/types';

/**
 * Categorías de gasto, arrastrables (mismo patrón que las cuentas y que
 * `hero-slides-table.tsx`). Tampoco hay borrado duro: borrar una categoría
 * dejaría huérfanos los gastos históricos y su desglose mentiría.
 */
export default function ExpenseCategoriesTable({
  categories: categoriesProp,
}: {
  categories: ExpenseCategory[];
}) {
  // Orden optimista + teclado + anuncio, compartido con las otras listas
  // ordenables (ver `lib/admin/use-keyboard-reorder.ts`).
  const { items: categories, setItems: setCategories, getHandleProps, onDragEnd, announcer } =
    useKeyboardReorder({
      items: categoriesProp,
      getLabel: (category) => category.name,
      itemNoun: 'la categoría',
      persist: reorderExpenseCategories,
    });

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        message='Todavía no hay categorías de gasto.'
        hint='Insumos, arriendo, publicidad… Con categorías el desglose del resumen deja de ser una sola bolsa.'
      />
    );
  }

  return (
    <>
      <ReorderAnnouncer {...announcer} />
      <Reorder.Group
        as='ul'
        axis='y'
        values={categories}
        onReorder={setCategories}
        className='space-y-2'
      >
        {categories.map((category, index) => (
          <CategoryRow
            key={category.id}
            category={category}
            handle={getHandleProps(category, index)}
            onDragEnd={onDragEnd}
          />
        ))}
      </Reorder.Group>
    </>
  );
}

function CategoryRow({
  category,
  handle,
  onDragEnd,
}: {
  category: ExpenseCategory;
  handle: ReorderHandleProps;
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  function toggleActive() {
    startTransition(async () => {
      const result = await setExpenseCategoryActive(category.id, !category.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Item
      as='li'
      value={category}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className='flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-sm sm:flex-row sm:items-center'
      {...reorderItemMotion(reduceMotion)}
    >
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        <ReorderHandle dragControls={dragControls} {...handle} />

        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <span className='font-medium text-brand-ink'>{category.name}</span>
          <Badge variant={category.nature === 'FIJO' ? 'secondary' : 'outline'}>
            {EXPENSE_NATURE_LABEL[category.nature]}
          </Badge>
          {!category.active && <Badge variant='secondary'>Inactiva</Badge>}
        </div>
      </div>

      <div className='flex flex-wrap gap-2 sm:shrink-0'>
        <ExpenseCategoryFormDialog category={category} />
        <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          {category.active ? 'Desactivar' : 'Activar'}
        </Button>
      </div>
    </Reorder.Item>
  );
}
