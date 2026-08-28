'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { Reorder, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import { GripVertical, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import ServiceCategoryFormDialog from '@/components/admin/service-category-form-dialog';
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
  const [categories, setCategories] = useState(categoriesProp);
  useEffect(() => setCategories(categoriesProp), [categoriesProp]);

  if (categories.length === 0) {
    return <EmptyState icon={Sparkles} message='Todavía no hay categorías de servicio.' />;
  }

  function persistOrder(newOrder: ServiceCategory[]) {
    reorderServiceCategories(newOrder.map((c) => c.id)).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Group
      as='ul'
      axis='y'
      values={categories}
      onReorder={setCategories}
      className='space-y-2'
    >
      {categories.map((category) => (
        <CategoryRow
          key={category.id}
          category={category}
          onDragEnd={() => persistOrder(categories)}
        />
      ))}
    </Reorder.Group>
  );
}

function CategoryRow({
  category,
  onDragEnd,
}: {
  category: ServiceCategory;
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();

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
      className='flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm'
      whileDrag={{ boxShadow: '0 8px 20px rgba(0,0,0,0.12)', scale: 1.01 }}
    >
      <button
        type='button'
        onPointerDown={(e) => dragControls.start(e)}
        className='cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing'
        aria-label='Arrastrar para reordenar'
      >
        <GripVertical className='h-5 w-5' />
      </button>

      <div className='relative h-12 w-16 shrink-0 rounded overflow-hidden bg-gray-100'>
        <Image src={category.image_url} alt='' fill className='object-cover' draggable={false} />
      </div>

      <div className='flex-1 min-w-0 font-medium text-brand-ink truncate'>{category.name}</div>

      <Badge variant={category.active ? 'success' : 'secondary'} className='shrink-0'>
        {category.active ? 'Activa' : 'Inactiva'}
      </Badge>

      <div className='flex shrink-0 gap-2'>
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
