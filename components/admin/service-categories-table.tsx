'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ServiceCategoryFormDialog from '@/components/admin/service-category-form-dialog';
import ReorderHandle, {
  ReorderAnnouncer,
  reorderItemMotion,
} from '@/components/admin/reorder-handle';
import {
  useKeyboardReorder,
  type ReorderHandleProps,
} from '@/lib/admin/use-keyboard-reorder';
import {
  deleteServiceCategory,
  reorderServiceCategories,
  setServiceCategoryActive,
} from '@/app/admin/(dashboard)/actions';
import type { ServiceCategory } from '@/lib/supabase/types';

export default function ServiceCategoriesTable({
  categories: categoriesProp,
}: {
  categories: ServiceCategory[];
}) {
  const { items: categories, setItems: setCategories, getHandleProps, onDragEnd, announcer } =
    useKeyboardReorder({
      items: categoriesProp,
      getLabel: (category) => category.name,
      itemNoun: 'la categoría',
      persist: reorderServiceCategories,
    });

  if (categories.length === 0) {
    return <EmptyState
        icon={Sparkles}
        message='Todavía no hay categorías de servicio.'
        hint='Usa el botón "Nueva categoría" para llenar la sección de servicios del sitio.'
      />;
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
  category: ServiceCategory;
  handle: ReorderHandleProps;
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  function toggleActive() {
    startTransition(async () => {
      const result = await setServiceCategoryActive(category.id, !category.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteServiceCategory(category.id);
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
      className='flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-white p-3 shadow-sm'
      {...reorderItemMotion(reduceMotion)}
    >
      <div className='flex items-center gap-3 min-w-0 w-full sm:w-auto'>
        <ReorderHandle dragControls={dragControls} {...handle} />

        <div className='relative h-12 w-16 shrink-0 rounded overflow-hidden bg-gray-100'>
          <Image src={category.image_url} alt='' fill className='object-cover' draggable={false} />
        </div>

        <div className='flex-1 min-w-0 font-medium text-brand-ink truncate'>{category.name}</div>

        <Badge variant={category.active ? 'success' : 'secondary'} className='shrink-0'>
          {category.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className='flex flex-wrap shrink-0 gap-2 sm:ml-auto'>
        <ServiceCategoryFormDialog category={category} />
        <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          {category.active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Reorder.Item>
  );
}
