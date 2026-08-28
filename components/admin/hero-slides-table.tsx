'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, GalleryHorizontal, Loader2, Video } from 'lucide-react';
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
import HeroSlideFormDialog from '@/components/admin/hero-slide-form-dialog';
import {
  deleteHeroSlide,
  reorderHeroSlide,
  setHeroSlideActive,
} from '@/app/admin/(dashboard)/actions';
import type { HeroSlide } from '@/lib/supabase/types';

export default function HeroSlidesTable({ slides }: { slides: HeroSlide[] }) {
  if (slides.length === 0) {
    return <EmptyState icon={GalleryHorizontal} message='Todavía no hay diapositivas.' />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Orden</TableHead>
          <TableHead>Imagen</TableHead>
          <TableHead>Título</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slides.map((slide, index) => (
          <SlideRow
            key={slide.id}
            slide={slide}
            isFirst={index === 0}
            isLast={index === slides.length - 1}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function SlideRow({
  slide,
  isFirst,
  isLast,
}: {
  slide: HeroSlide;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function move(direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await reorderHeroSlide(slide.id, direction);
      if (!result.ok) toast.error(result.error);
    });
  }

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
        <div className='relative h-12 w-20 rounded overflow-hidden bg-gray-100 flex items-center justify-center'>
          {slide.image_url ? (
            <Image src={slide.image_url} alt='' fill className='object-cover' />
          ) : slide.media_type === 'video' ? (
            <Video className='h-5 w-5 text-gray-400' />
          ) : null}
        </div>
      </TableCell>
      <TableCell className='font-medium text-brand-ink'>
        {slide.title}
        {slide.media_type === 'video' && (
          <Badge variant='secondary' className='ml-2 gap-1 align-middle'>
            <Video className='h-3 w-3' />
            Video
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={slide.active ? 'success' : 'secondary'}>
          {slide.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className='flex gap-2'>
          <HeroSlideFormDialog slide={slide} />
          <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
            {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
            {slide.active ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
