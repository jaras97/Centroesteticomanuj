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
import ImageUpload from '@/components/admin/image-upload';
import { createGalleryImage, updateGalleryImage } from '@/app/admin/(dashboard)/actions';
import type { GalleryImage } from '@/lib/supabase/types';

export default function GalleryImageFormDialog({
  image,
  existingCategories,
  trigger,
}: {
  image?: GalleryImage;
  existingCategories: string[];
  trigger?: ReactNode;
}) {
  const isEditing = !!image;
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState(image?.image_url ?? '');
  const [altText, setAltText] = useState(image?.alt_text ?? '');
  const [category, setCategory] = useState(image?.category ?? '');
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!imageUrl) {
      toast.error('Sube una imagen.');
      return;
    }
    if (!category.trim()) {
      toast.error('La categoría es obligatoria.');
      return;
    }

    const input = { imageUrl, altText, category: category.trim() };

    startTransition(async () => {
      const result = isEditing
        ? await updateGalleryImage(image.id, input)
        : await createGalleryImage(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Imagen actualizada.' : 'Imagen agregada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva imagen'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar imagen' : 'Nueva imagen de galería'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>Imagen</Label>
            <ImageUpload folder='gallery' value={imageUrl} onChange={setImageUrl} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='gallery-category'>Categoría</Label>
            <Input
              id='gallery-category'
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list='gallery-existing-categories'
              placeholder='ej. Social, Artístico, Editorial'
            />
            <datalist id='gallery-existing-categories'>
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className='text-xs text-gray-500'>
              Escribe una categoría existente para agrupar esta foto con las demás, o una nueva.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='gallery-alt'>Descripción (texto alternativo)</Label>
            <Input
              id='gallery-alt'
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder='ej. Maquillaje social para evento'
            />
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
