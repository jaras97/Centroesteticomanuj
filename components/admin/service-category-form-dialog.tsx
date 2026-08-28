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
import ImageUpload from '@/components/admin/image-upload';
import {
  createServiceCategory,
  updateServiceCategory,
} from '@/app/admin/(dashboard)/actions';
import type { ServiceCategory } from '@/lib/supabase/types';

export default function ServiceCategoryFormDialog({
  category,
  trigger,
}: {
  category?: ServiceCategory;
  trigger?: ReactNode;
}) {
  const isEditing = !!category;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? '');
  const [featuresText, setFeaturesText] = useState((category?.features ?? []).join('\n'));
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    if (!imageUrl) {
      toast.error('Sube una imagen para la categoría.');
      return;
    }

    const input = {
      name: name.trim(),
      description: description.trim(),
      imageUrl,
      features: featuresText.split('\n'),
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateServiceCategory(category.id, input)
        : await createServiceCategory(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Categoría actualizada.' : 'Categoría creada.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nueva categoría'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar categoría' : 'Nueva categoría de servicio'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>Imagen</Label>
            <ImageUpload folder='services' value={imageUrl} onChange={setImageUrl} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='category-name'>Nombre</Label>
            <Input id='category-name' value={name} onChange={(e) => setName(e.target.value)} />
            <p className='text-xs text-gray-500'>
              Como se ve en la web, ej. &quot;Limpieza facial&quot;. Puede agrupar varios servicios
              agendables (revisa el campo &quot;Categoría&quot; en cada servicio de /admin/servicios).
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='category-description'>Descripción</Label>
            <Textarea
              id='category-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='category-features'>Puntos destacados (uno por línea)</Label>
            <Textarea
              id='category-features'
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={'Productos de alta calidad\nAsesoramiento personalizado'}
              rows={4}
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
