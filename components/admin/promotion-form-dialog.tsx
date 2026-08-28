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
import { createPromotion, updatePromotion } from '@/app/admin/(dashboard)/actions';
import type { Promotion } from '@/lib/supabase/types';

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export default function PromotionFormDialog({
  promotion,
  trigger,
}: {
  promotion?: Promotion;
  trigger?: ReactNode;
}) {
  const isEditing = !!promotion;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(promotion?.title ?? '');
  const [body, setBody] = useState(promotion?.body ?? '');
  const [imageUrl, setImageUrl] = useState(promotion?.image_url ?? '');
  const [ctaLabel, setCtaLabel] = useState(promotion?.cta_label ?? '');
  const [ctaHref, setCtaHref] = useState(promotion?.cta_href ?? '');
  const [requiresBirthday, setRequiresBirthday] = useState(
    promotion?.requires_birthday ? 'si' : 'no',
  );
  const [imageOnly, setImageOnly] = useState(promotion?.image_only ? 'si' : 'no');
  const [startsAt, setStartsAt] = useState(toDateInputValue(promotion?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toDateInputValue(promotion?.ends_at ?? null));
  const [isPending, startTransition] = useTransition();

  const isImageOnly = imageOnly === 'si';

  function handleSubmit() {
    if (!title.trim()) {
      toast.error('El título es obligatorio.');
      return;
    }
    if (isImageOnly) {
      if (!imageUrl) {
        toast.error('Sube la imagen — el texto de la promo va incluido en ella.');
        return;
      }
    } else if (!body.trim()) {
      toast.error('El texto es obligatorio.');
      return;
    }

    const input = {
      title: title.trim(),
      body: body.trim(),
      imageUrl: imageUrl || null,
      ctaLabel: ctaLabel.trim() || null,
      ctaHref: ctaHref.trim() || null,
      requiresBirthday: requiresBirthday === 'si',
      imageOnly: isImageOnly,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updatePromotion(promotion.id, input)
        : await createPromotion(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Promoción actualizada.' : 'Promoción creada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva promoción'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar promoción' : 'Nueva promoción'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='promo-image-only'>¿El texto ya está diseñado en la imagen?</Label>
            <Select value={imageOnly} onValueChange={setImageOnly}>
              <SelectTrigger id='promo-image-only'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='no'>No, escribir título y texto acá</SelectItem>
                <SelectItem value='si'>Sí, la imagen ya trae todo el texto (ej. un flyer)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label>Imagen {isImageOnly ? '' : '(opcional)'}</Label>
            <ImageUpload folder='promos' value={imageUrl} onChange={setImageUrl} />
            {isImageOnly && (
              <p className='text-xs text-gray-500'>
                Se muestra completa, sin recortar y sin texto encima — sube el flyer o diseño final
                tal cual.
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='promo-title'>
              Título {isImageOnly ? '(solo para identificarla en esta lista, no se muestra)' : ''}
            </Label>
            <Input id='promo-title' value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {!isImageOnly && (
            <div className='space-y-2'>
              <Label htmlFor='promo-body'>Texto</Label>
              <Textarea
                id='promo-body'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
            </div>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='promo-cta-label'>Texto del botón (opcional)</Label>
              <Input
                id='promo-cta-label'
                placeholder='ej. Reservar cita'
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='promo-cta-href'>Link del botón (opcional)</Label>
              <Input
                id='promo-cta-href'
                placeholder='/reservar'
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='promo-birthday'>¿Pedir fecha de nacimiento?</Label>
            <Select value={requiresBirthday} onValueChange={setRequiresBirthday}>
              <SelectTrigger id='promo-birthday'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='no'>No, solo informativa</SelectItem>
                <SelectItem value='si'>Sí, pedir datos antes de cerrar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='promo-starts'>Empieza (opcional)</Label>
              <Input
                id='promo-starts'
                type='date'
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='promo-ends'>Termina (opcional)</Label>
              <Input
                id='promo-ends'
                type='date'
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <p className='text-xs text-gray-500'>
            Si dejas estas fechas vacías, la promoción se muestra mientras esté activa, sin
            vencimiento automático.
          </p>
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
