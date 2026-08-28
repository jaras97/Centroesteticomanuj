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
import { createSiteSection, updateSiteSection } from '@/app/admin/(dashboard)/actions';
import type { SiteSection } from '@/lib/supabase/types';

export default function SiteSectionFormDialog({
  section,
  trigger,
}: {
  section?: SiteSection;
  trigger?: ReactNode;
}) {
  const isEditing = !!section;
  const [open, setOpen] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'color'>(
    section?.media_type ?? 'image',
  );
  const [imageUrl, setImageUrl] = useState(section?.image_url ?? '');
  const [videoUrl, setVideoUrl] = useState(section?.video_url ?? '');
  const [bgColor, setBgColor] = useState(section?.bg_color ?? '#0C0C0C');
  const [textColor, setTextColor] = useState(section?.text_color ?? '#FFFFFF');
  const [title, setTitle] = useState(section?.title ?? '');
  const [body, setBody] = useState(section?.body ?? '');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(
    section?.text_align ?? 'left',
  );
  const [ctaLabel, setCtaLabel] = useState(section?.cta_label ?? '');
  const [ctaHref, setCtaHref] = useState(section?.cta_href ?? '');
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (mediaType === 'video' && !videoUrl) {
      toast.error('Sube el video de la sección.');
      return;
    }
    if (mediaType === 'image' && !imageUrl) {
      toast.error('Sube una imagen para la sección.');
      return;
    }
    if (mediaType === 'color' && !bgColor) {
      toast.error('Elige un color de fondo.');
      return;
    }
    if (!title.trim()) {
      toast.error('El título es obligatorio.');
      return;
    }
    if (!body.trim()) {
      toast.error('El texto es obligatorio.');
      return;
    }

    const input = {
      mediaType,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      bgColor: bgColor || null,
      textColor,
      title: title.trim(),
      body: body.trim(),
      textAlign,
      ctaLabel: ctaLabel.trim() || null,
      ctaHref: ctaHref.trim() || null,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateSiteSection(section.id, input)
        : await createSiteSection(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Sección actualizada.' : 'Sección creada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva sección'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar sección' : 'Nueva sección'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='section-media-type'>Tipo</Label>
            <Select
              value={mediaType}
              onValueChange={(v) => setMediaType(v as 'image' | 'video' | 'color')}
            >
              <SelectTrigger id='section-media-type'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='image'>Imagen</SelectItem>
                <SelectItem value='video'>Video (clip corto)</SelectItem>
                <SelectItem value='color'>Color sólido (sin foto)</SelectItem>
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
                <ImageUpload folder='services' value={imageUrl} onChange={setImageUrl} />
              </div>
            </>
          ) : mediaType === 'color' ? (
            <div className='space-y-2'>
              <Label htmlFor='section-bg-color'>Color de fondo</Label>
              <Input
                id='section-bg-color'
                type='color'
                className='h-10 p-1'
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
              />
            </div>
          ) : (
            <div className='space-y-2'>
              <Label>Imagen de fondo</Label>
              <ImageUpload folder='services' value={imageUrl} onChange={setImageUrl} />
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='section-text-color'>Color del texto</Label>
            <Input
              id='section-text-color'
              type='color'
              className='h-10 p-1'
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='section-title'>Título</Label>
            <Input id='section-title' value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='section-body'>Texto</Label>
            <Textarea
              id='section-body'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='section-align'>Posición del texto sobre la imagen</Label>
            <Select value={textAlign} onValueChange={(v) => setTextAlign(v as typeof textAlign)}>
              <SelectTrigger id='section-align'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='left'>Izquierda</SelectItem>
                <SelectItem value='center'>Centro</SelectItem>
                <SelectItem value='right'>Derecha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='section-cta-label'>Texto del botón (opcional)</Label>
              <Input
                id='section-cta-label'
                placeholder='ej. Reservar cita'
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='section-cta-href'>Link del botón (opcional)</Label>
              <Input
                id='section-cta-href'
                placeholder='/reservar'
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
