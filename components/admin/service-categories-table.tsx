'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Sparkles } from 'lucide-react';
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
import ServiceCategoryFormDialog from '@/components/admin/service-category-form-dialog';
import {
  deleteServiceCategory,
  reorderServiceCategory,
  setServiceCategoryActive,
} from '@/app/admin/(dashboard)/actions';
import type { ServiceCategory } from '@/lib/supabase/types';

export default function ServiceCategoriesTable({
  categories,
}: {
  categories: ServiceCategory[];
}) {
  if (categories.length === 0) {
    return <EmptyState icon={Sparkles} message='Todavía no hay categorías de servicio.' />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Orden</TableHead>
          <TableHead>Imagen</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category, index) => (
          <CategoryRow
            key={category.id}
            category={category}
            isFirst={index === 0}
            isLast={index === categories.length - 1}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function CategoryRow({
  category,
  isFirst,
  isLast,
}: {
  category: ServiceCategory;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function move(direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await reorderServiceCategory(category.id, direction);
      if (!result.ok) toast.error(result.error);
    });
  }

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
    <TableRow>
      <TableCell>
        <div className='flex gap-1'>
          <Button
            size='sm'
            variant='outline'
            disabled={isPending || isFirst}
            onClick={() => move('up')}
          >
            <ArrowUp className='h-3.5 w-3.5' />
          </Button>
          <Button
            size='sm'
            variant='outline'
            disabled={isPending || isLast}
            onClick={() => move('down')}
          >
            <ArrowDown className='h-3.5 w-3.5' />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className='relative h-12 w-16 rounded overflow-hidden bg-gray-100'>
          <Image src={category.image_url} alt='' fill className='object-cover' />
        </div>
      </TableCell>
      <TableCell className='font-medium text-brand-ink'>{category.name}</TableCell>
      <TableCell>
        <Badge variant={category.active ? 'success' : 'secondary'}>
          {category.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className='flex gap-2'>
          <ServiceCategoryFormDialog category={category} />
          <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
            {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
            {category.active ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
