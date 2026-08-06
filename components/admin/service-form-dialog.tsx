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
import { createService, updateService } from '@/app/admin/(dashboard)/actions';
import type { Service } from '@/lib/supabase/types';

export default function ServiceFormDialog({
  service,
  trigger,
}: {
  service?: Service;
  trigger?: ReactNode;
}) {
  const isEditing = !!service;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [durationMin, setDurationMin] = useState(String(service?.duration_min ?? 60));
  const [bufferMin, setBufferMin] = useState(String(service?.buffer_min ?? 0));
  const [price, setPrice] = useState(service?.price != null ? String(service.price) : '');
  const [depositAmount, setDepositAmount] = useState(
    service?.deposit_amount != null ? String(service.deposit_amount) : '',
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const trimmedName = name.trim();
    const duration = parseInt(durationMin, 10);
    const buffer = parseInt(bufferMin, 10);

    if (!trimmedName) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    if (!Number.isInteger(duration) || duration <= 0) {
      toast.error('La duración debe ser un número entero mayor a 0.');
      return;
    }
    if (!Number.isInteger(buffer) || buffer < 0) {
      toast.error('El buffer debe ser un número entero de 0 o más.');
      return;
    }

    const input = {
      name: trimmedName,
      description: description.trim() || undefined,
      durationMin: duration,
      bufferMin: buffer,
      price: price.trim() === '' ? null : Number(price),
      depositAmount: depositAmount.trim() === '' ? null : Number(depositAmount),
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateService(service.id, input)
        : await createService(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Servicio actualizado.' : 'Servicio creado.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' variant={isEditing ? 'outline' : 'default'}>
            {isEditing ? <Pencil className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
            {isEditing ? 'Editar' : 'Nuevo servicio'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='service-name'>Nombre</Label>
            <Input id='service-name' value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='service-description'>Descripción</Label>
            <Textarea
              id='service-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='service-duration'>Duración (min)</Label>
              <Input
                id='service-duration'
                type='number'
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='service-buffer'>Buffer (min)</Label>
              <Input
                id='service-buffer'
                type='number'
                min={0}
                value={bufferMin}
                onChange={(e) => setBufferMin(e.target.value)}
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='service-price'>Precio (COP)</Label>
              <Input
                id='service-price'
                type='number'
                min={0}
                step={1000}
                placeholder='Sin definir'
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='service-deposit'>Anticipo (COP)</Label>
              <Input
                id='service-deposit'
                type='number'
                min={0}
                step={1000}
                placeholder='Sin anticipo'
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
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
