'use client';

import { useMemo, useTransition } from 'react';
import Image from 'next/image';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { ImageIcon, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import GalleryImageFormDialog from '@/components/admin/gallery-image-form-dialog';
import ReorderHandle, {
  ReorderAnnouncer,
  reorderItemMotion,
} from '@/components/admin/reorder-handle';
import {
  useKeyboardReorder,
  type ReorderHandleProps,
} from '@/lib/admin/use-keyboard-reorder';
import {
  deleteGalleryImage,
  reorderGalleryImages,
  setGalleryImageActive,
} from '@/app/admin/(dashboard)/actions';
import type { GalleryImage } from '@/lib/supabase/types';

export default function GalleryImagesTable({ images: imagesProp }: { images: GalleryImage[] }) {
  const { items: images, setItems: setImages, getHandleProps, onDragEnd, announcer } =
    useKeyboardReorder({
      items: imagesProp,
      // La imagen no tiene título: su categoría es lo único que la nombra en
      // esta lista, y es lo que se anuncia al moverla.
      getLabel: (image) => image.category,
      itemNoun: 'la imagen',
      persist: reorderGalleryImages,
    });

  const existingCategories = useMemo(
    () => Array.from(new Set(images.map((i) => i.category))).sort(),
    [images],
  );

  if (images.length === 0) {
    return <EmptyState
        icon={ImageIcon}
        message='Todavía no hay imágenes en la galería.'
        hint='Usa el botón "Nueva imagen" para publicar los primeros trabajos.'
      />;
  }

  return (
    <>
      <ReorderAnnouncer {...announcer} />
      <Reorder.Group as='ul' axis='y' values={images} onReorder={setImages} className='space-y-2'>
        {images.map((image, index) => (
          <ImageRow
            key={image.id}
            image={image}
            existingCategories={existingCategories}
            handle={getHandleProps(image, index)}
            onDragEnd={onDragEnd}
          />
        ))}
      </Reorder.Group>
    </>
  );
}

function ImageRow({
  image,
  existingCategories,
  handle,
  onDragEnd,
}: {
  image: GalleryImage;
  existingCategories: string[];
  handle: ReorderHandleProps;
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

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
    <Reorder.Item
      as='li'
      value={image}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className='flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-white p-3 shadow-sm'
      {...reorderItemMotion(reduceMotion)}
    >
      <div className='flex items-center gap-3 min-w-0 w-full sm:w-auto'>
        <ReorderHandle dragControls={dragControls} {...handle} />

        <div className='relative h-14 w-14 shrink-0 rounded overflow-hidden bg-gray-100'>
          <Image src={image.image_url} alt='' fill className='object-cover' draggable={false} />
        </div>

        <div className='flex-1 min-w-0 font-medium text-brand-ink truncate'>{image.category}</div>

        <Badge variant={image.active ? 'success' : 'secondary'} className='shrink-0'>
          {image.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className='flex flex-wrap shrink-0 gap-2 sm:ml-auto'>
        <GalleryImageFormDialog image={image} existingCategories={existingCategories} />
        <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          {image.active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Reorder.Item>
  );
}
