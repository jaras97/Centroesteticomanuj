'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { GalleryHorizontal, Loader2, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import HeroSlideFormDialog from '@/components/admin/hero-slide-form-dialog';
import ReorderHandle, {
  ReorderAnnouncer,
  reorderItemMotion,
} from '@/components/admin/reorder-handle';
import {
  useKeyboardReorder,
  type ReorderHandleProps,
} from '@/lib/admin/use-keyboard-reorder';
import {
  deleteHeroSlide,
  reorderHeroSlides,
  setHeroSlideActive,
} from '@/app/admin/(dashboard)/actions';
import type { HeroSlide } from '@/lib/supabase/types';

export default function HeroSlidesTable({ slides: slidesProp }: { slides: HeroSlide[] }) {
  // Orden optimista + teclado + anuncio, compartido con las otras listas
  // ordenables (ver `lib/admin/use-keyboard-reorder.ts`).
  const { items: slides, setItems: setSlides, getHandleProps, onDragEnd, announcer } =
    useKeyboardReorder({
      items: slidesProp,
      getLabel: (slide) => slide.title,
      itemNoun: 'la diapositiva',
      persist: reorderHeroSlides,
    });

  if (slides.length === 0) {
    return <EmptyState
        icon={GalleryHorizontal}
        message='Todavía no hay diapositivas.'
        hint='Usa el botón "Nueva diapositiva" para armar el carrusel de la página de inicio.'
      />;
  }

  return (
    <>
      <ReorderAnnouncer {...announcer} />
      <Reorder.Group
        as='ul'
        axis='y'
        values={slides}
        onReorder={setSlides}
        className='space-y-2'
      >
        {slides.map((slide, index) => (
          <SlideRow
            key={slide.id}
            slide={slide}
            handle={getHandleProps(slide, index)}
            onDragEnd={onDragEnd}
          />
        ))}
      </Reorder.Group>
    </>
  );
}

function SlideRow({
  slide,
  handle,
  onDragEnd,
}: {
  slide: HeroSlide;
  handle: ReorderHandleProps;
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  function toggleActive() {
    startTransition(async () => {
      const result = await setHeroSlideActive(slide.id, !slide.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteHeroSlide(slide.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Item
      as='li'
      value={slide}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className='flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-white p-3 shadow-sm'
      {...reorderItemMotion(reduceMotion)}
    >
      <div className='flex items-center gap-3 min-w-0 w-full sm:w-auto'>
        <ReorderHandle dragControls={dragControls} {...handle} />

        <div className='relative h-12 w-20 shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center'>
          {slide.image_url ? (
            <Image src={slide.image_url} alt='' fill className='object-cover' draggable={false} />
          ) : slide.media_type === 'video' ? (
            <Video className='h-5 w-5 text-gray-400' />
          ) : null}
        </div>

        <div className='flex-1 min-w-0 font-medium text-brand-ink truncate'>
          {slide.title}
          {slide.media_type === 'video' && (
            <Badge variant='secondary' className='ml-2 gap-1 align-middle'>
              <Video className='h-3 w-3' />
              Video
            </Badge>
          )}
        </div>

        <Badge variant={slide.active ? 'success' : 'secondary'} className='shrink-0'>
          {slide.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className='flex flex-wrap shrink-0 gap-2 sm:ml-auto'>
        <HeroSlideFormDialog slide={slide} />
        <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          {slide.active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Reorder.Item>
  );
}
