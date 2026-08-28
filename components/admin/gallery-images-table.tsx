'use client';

import { useMemo, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ImageIcon, Loader2 } from 'lucide-react';
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
import GalleryImageFormDialog from '@/components/admin/gallery-image-form-dialog';
import {
  deleteGalleryImage,
  reorderGalleryImage,
  setGalleryImageActive,
} from '@/app/admin/(dashboard)/actions';
import type { GalleryImage } from '@/lib/supabase/types';

export default function GalleryImagesTable({ images }: { images: GalleryImage[] }) {
  const existingCategories = useMemo(
    () => Array.from(new Set(images.map((i) => i.category))).sort(),
    [images],
  );

  if (images.length === 0) {
    return <EmptyState icon={ImageIcon} message='Todavía no hay imágenes en la galería.' />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Orden</TableHead>
          <TableHead>Imagen</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {images.map((image, index) => (
          <ImageRow
            key={image.id}
            image={image}
            existingCategories={existingCategories}
            isFirst={index === 0}
            isLast={index === images.length - 1}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function ImageRow({
  image,
  existingCategories,
  isFirst,
  isLast,
}: {
  image: GalleryImage;
  existingCategories: string[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function move(direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await reorderGalleryImage(image.id, direction);
      if (!result.ok) toast.error(result.error);
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await setGalleryImageActive(image.id, !image.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGalleryImage(image.id);
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
        <div className='relative h-14 w-14 rounded overflow-hidden bg-gray-100'>
          <Image src={image.image_url} alt='' fill className='object-cover' />
        </div>
      </TableCell>
      <TableCell className='font-medium text-brand-ink'>{image.category}</TableCell>
      <TableCell>
        <Badge variant={image.active ? 'success' : 'secondary'}>
          {image.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className='flex gap-2'>
          <GalleryImageFormDialog image={image} existingCategories={existingCategories} />
          <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
            {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
            {image.active ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
