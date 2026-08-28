'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { Reorder, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import { GripVertical, ImageIcon, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import GalleryImageFormDialog from '@/components/admin/gallery-image-form-dialog';
import {
  deleteGalleryImage,
  reorderGalleryImages,
  setGalleryImageActive,
} from '@/app/admin/(dashboard)/actions';
import type { GalleryImage } from '@/lib/supabase/types';

export default function GalleryImagesTable({ images: imagesProp }: { images: GalleryImage[] }) {
  const [images, setImages] = useState(imagesProp);
  useEffect(() => setImages(imagesProp), [imagesProp]);

  const existingCategories = useMemo(
    () => Array.from(new Set(images.map((i) => i.category))).sort(),
    [images],
  );

  if (images.length === 0) {
    return <EmptyState icon={ImageIcon} message='Todavía no hay imágenes en la galería.' />;
  }

  function persistOrder(newOrder: GalleryImage[]) {
    reorderGalleryImages(newOrder.map((i) => i.id)).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Group as='ul' axis='y' values={images} onReorder={setImages} className='space-y-2'>
      {images.map((image) => (
        <ImageRow
          key={image.id}
          image={image}
          existingCategories={existingCategories}
          onDragEnd={() => persistOrder(images)}
        />
      ))}
    </Reorder.Group>
  );
}

function ImageRow({
  image,
  existingCategories,
  onDragEnd,
}: {
  image: GalleryImage;
  existingCategories: string[];
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();

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

      <div className='relative h-14 w-14 shrink-0 rounded overflow-hidden bg-gray-100'>
        <Image src={image.image_url} alt='' fill className='object-cover' draggable={false} />
      </div>

      <div className='flex-1 min-w-0 font-medium text-brand-ink truncate'>{image.category}</div>

      <Badge variant={image.active ? 'success' : 'secondary'} className='shrink-0'>
        {image.active ? 'Activa' : 'Inactiva'}
      </Badge>

      <div className='flex shrink-0 gap-2'>
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
