'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ImageUpload from '@/components/admin/image-upload';
import VideoUpload from '@/components/admin/video-upload';
import { createHeroSlide, updateHeroSlide } from '@/app/admin/(dashboard)/actions';
import type { HeroSlide } from '@/lib/supabase/types';

export default function HeroSlideFormDialog({
  slide,
  trigger,
}: {
  slide?: HeroSlide;
  trigger?: ReactNode;
}) {
  const isEditing = !!slide;
  const [open, setOpen] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>(slide?.media_type ?? 'image');
  const [imageUrl, setImageUrl] = useState(slide?.image_url ?? '');
  const [videoUrl, setVideoUrl] = useState(slide?.video_url ?? '');
  const [title, setTitle] = useState(slide?.title ?? '');
  const [subtitle, setSubtitle] = useState(slide?.subtitle ?? '');
  const [description, setDescription] = useState(slide?.description ?? '');
  const [ctaLabel, setCtaLabel] = useState(slide?.cta_label ?? 'Reservar cita');
  const [ctaHref, setCtaHref] = useState(slide?.cta_href ?? '/reservar');
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (mediaType === 'video' && !videoUrl) {
      toast.error('Sube el video de la diapositiva.');
      return;
    }
    if (mediaType === 'image' && !imageUrl) {
      toast.error('Sube una imagen para la diapositiva.');
      return;
    }
    if (!title.trim()) {
      toast.error('El título es obligatorio.');
      return;
    }

    const input = {
      mediaType,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      description: description.trim(),
      ctaLabel: ctaLabel.trim(),
      ctaHref: ctaHref.trim(),
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateHeroSlide(slide.id, input)
        : await createHeroSlide(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Diapositiva actualizada.' : 'Diapositiva creada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva diapositiva'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar diapositiva' : 'Nueva diapositiva'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='slide-media-type'>Tipo</Label>
            <Select value={mediaType} onValueChange={(v) => setMediaType(v as 'image' | 'video')}>
              <SelectTrigger id='slide-media-type'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='image'>Imagen</SelectItem>
                <SelectItem value='video'>Video (clip corto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mediaType === 'video' ? (
            <>
              <div className='space-y-2'>
                <Label>Video</Label>
                <VideoUpload value={videoUrl} onChange={setVideoUrl} />
              </div>
              <div className='space-y-2'>
                <Label>Imagen de portada (opcional)</Label>
                <ImageUpload folder='hero' value={imageUrl} onChange={setImageUrl} />
                <p className='text-xs text-gray-500'>
                  Se muestra mientras el video carga. Si no subes una, arranca directo con el video.
                </p>
              </div>
            </>
          ) : (
            <div className='space-y-2'>
              <Label>Imagen</Label>
              <ImageUpload folder='hero' value={imageUrl} onChange={setImageUrl} />
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='slide-title'>Título</Label>
            <Input id='slide-title' value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='slide-subtitle'>Subtítulo (opcional)</Label>
            <Input
              id='slide-subtitle'
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='slide-description'>Descripción</Label>
            <Textarea
              id='slide-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='slide-cta-label'>Texto del botón</Label>
              <Input
                id='slide-cta-label'
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='slide-cta-href'>Link del botón</Label>
              <Input
                id='slide-cta-href'
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
