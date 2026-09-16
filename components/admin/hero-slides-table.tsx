'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { Reorder, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import { GalleryHorizontal, GripVertical, Loader2, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import HeroSlideFormDialog from '@/components/admin/hero-slide-form-dialog';
import {
  deleteHeroSlide,
  reorderHeroSlides,
  setHeroSlideActive,
} from '@/app/admin/(dashboard)/actions';
import type { HeroSlide } from '@/lib/supabase/types';

export default function HeroSlidesTable({ slides: slidesProp }: { slides: HeroSlide[] }) {
  const [slides, setSlides] = useState(slidesProp);
  // El padre (Server Component) re-envía props frescas después de cada
  // revalidatePath (crear/editar/activar/eliminar) — se sincroniza acá.
  // El propio arrastre ya actualizó este mismo estado de forma optimista
  // antes de que la revalidación vuelva, así que esto no produce parpadeo.
  useEffect(() => setSlides(slidesProp), [slidesProp]);

  if (slides.length === 0) {
    return <EmptyState
        icon={GalleryHorizontal}
        message='Todavía no hay diapositivas.'
        hint='Usa el botón "Nueva diapositiva" para armar el carrusel de la página de inicio.'
      />;
  }

  function persistOrder(newOrder: HeroSlide[]) {
    reorderHeroSlides(newOrder.map((s) => s.id)).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Group
      as='ul'
      axis='y'
      values={slides}
      onReorder={setSlides}
      className='space-y-2'
    >
      {slides.map((slide) => (
        <SlideRow key={slide.id} slide={slide} onDragEnd={() => persistOrder(slides)} />
      ))}
    </Reorder.Group>
  );
}

function SlideRow({ slide, onDragEnd }: { slide: HeroSlide; onDragEnd: () => void }) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();

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
      whileDrag={{ boxShadow: '0 8px 20px rgba(0,0,0,0.12)', scale: 1.01 }}
    >
      <div className='flex items-center gap-3 min-w-0 w-full sm:w-auto'>
        <button
          type='button'
          onPointerDown={(e) => dragControls.start(e)}
          className='shrink-0 cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing'
          aria-label='Arrastrar para reordenar'
        >
          <GripVertical className='h-5 w-5' />
        </button>

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
