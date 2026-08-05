'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { updateClient } from '@/app/admin/(dashboard)/actions';
import type { Client } from '@/lib/supabase/types';

export default function ClientEditForm({ client }: { client: Client }) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [email, setEmail] = useState(client.email ?? '');
  const [birthday, setBirthday] = useState(client.birthday ?? '');
  const [notes, setNotes] = useState(client.notes ?? '');
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!name.trim() || !phone.trim()) {
      toast.error('Nombre y teléfono son obligatorios.');
      return;
    }

    startTransition(async () => {
      const result = await updateClient(client.id, { name, phone, email, birthday, notes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Cliente actualizado.');
    });
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='client-name'>Nombre</Label>
        <Input id='client-name' value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='client-phone'>Teléfono</Label>
        <Input id='client-phone' value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='client-email'>Correo electrónico</Label>
        <Input
          id='client-email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='client-birthday'>Fecha de cumpleaños</Label>
        <Input
          id='client-birthday'
          type='date'
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='client-notes'>Notas</Label>
        <Textarea
          id='client-notes'
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='Notas sobre este cliente...'
        />
      </div>
      <Button size='sm' disabled={isPending} onClick={handleSave}>
        {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
        Guardar cambios
      </Button>
    </div>
  );
}
