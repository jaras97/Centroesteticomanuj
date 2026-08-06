'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
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
import { createClientRecord } from '@/app/admin/(dashboard)/actions';

export default function ClientFormDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName('');
    setPhone('');
    setEmail('');
    setBirthday('');
    setNotes('');
  }

  function handleSubmit() {
    if (!name.trim() || !phone.trim()) {
      toast.error('Nombre y teléfono son obligatorios.');
      return;
    }

    startTransition(async () => {
      const result = await createClientRecord({ name, phone, email, birthday, notes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cliente creado.');
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size='sm'>
          <Plus className='h-3.5 w-3.5' />
          Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='new-client-name'>Nombre</Label>
            <Input id='new-client-name' value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='new-client-phone'>Teléfono</Label>
            <Input id='new-client-phone' value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='new-client-email'>Correo electrónico</Label>
            <Input
              id='new-client-email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='new-client-birthday'>Fecha de cumpleaños</Label>
            <Input
              id='new-client-birthday'
              type='date'
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='new-client-notes'>Notas</Label>
            <Textarea
              id='new-client-notes'
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Notas sobre este cliente...'
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
