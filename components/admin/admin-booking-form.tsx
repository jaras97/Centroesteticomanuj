'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bogotaWallTimeToUtc } from '@/lib/booking/timezone';
import { searchClients, createManualAppointment } from '@/app/admin/(dashboard)/actions';

interface ServiceOption {
  id: string;
  name: string;
  duration_min: number;
  price: number | null;
}

interface ClientResult {
  id: string;
  name: string;
  phone: string;
}

export default function AdminBookingForm({ services }: { services: ServiceOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  useEffect(() => {
    if (selectedClient || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const found = await searchClients(query);
      setResults(found as ClientResult[]);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, selectedClient]);

  function handleSubmit() {
    if (!selectedClient && (!newName.trim() || !newPhone.trim())) {
      toast.error('Elige un cliente existente o ingresa nombre y teléfono.');
      return;
    }
    if (!serviceId) {
      toast.error('Elige un servicio.');
      return;
    }
    if (!date || !time) {
      toast.error('Elige fecha y hora.');
      return;
    }

    const startTimeIso = bogotaWallTimeToUtc(date, time).toISOString();

    startTransition(async () => {
      const result = await createManualAppointment({
        clientId: selectedClient?.id,
        newClientName: newName,
        newClientPhone: newPhone,
        serviceId,
        startTimeIso,
        note,
        depositReceivedAmount: depositAmount ? Number(depositAmount) : undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success('Cita creada y confirmada.');
      router.push('/admin/agenda');
    });
  }

  return (
    <div className='max-w-xl space-y-6'>
      <div className='space-y-2'>
        <Label>Cliente</Label>

        {selectedClient ? (
          <div className='flex items-center justify-between rounded-md border bg-white px-3 py-2'>
            <div>
              <p className='text-sm font-medium text-brand-ink'>{selectedClient.name}</p>
              <p className='text-xs text-gray-500'>{selectedClient.phone}</p>
            </div>
            <button
              type='button'
              onClick={() => setSelectedClient(null)}
              className='text-gray-400 hover:text-destructive'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        ) : (
          <div className='space-y-2'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
              <Input
                className='pl-9'
                placeholder='Buscar cliente por nombre o teléfono...'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {results.length > 0 && (
              <div className='rounded-md border bg-white divide-y'>
                {results.map((c) => (
                  <button
                    key={c.id}
                    type='button'
                    onClick={() => {
                      setSelectedClient(c);
                      setResults([]);
                      setQuery('');
                    }}
                    className='w-full text-left px-3 py-2 hover:bg-gray-50'
                  >
                    <p className='text-sm font-medium text-brand-ink'>{c.name}</p>
                    <p className='text-xs text-gray-500'>{c.phone}</p>
                  </button>
                ))}
              </div>
            )}

            <p className='text-xs text-gray-400'>
              ¿No aparece? Completa los datos de un cliente nuevo:
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <Input
                placeholder='Nombre'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder='Teléfono'
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className='space-y-2'>
        <Label>Servicio</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger>
            <SelectValue placeholder='Elige un servicio' />
          </SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} · {s.duration_min} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-2'>
          <Label htmlFor='admin-date'>Fecha</Label>
          <Input id='admin-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='admin-time'>Hora</Label>
          <Input id='admin-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <p className='text-xs text-gray-400 -mt-3'>
        No está restringido a los horarios publicados — puedes agendar fuera
        de ellos si ya lo acordaste con la clienta.
      </p>

      <div className='space-y-2'>
        <Label htmlFor='admin-deposit'>Anticipo/abono recibido (opcional)</Label>
        <Input
          id='admin-deposit'
          type='number'
          min={0}
          placeholder='$0'
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='admin-note'>Nota (opcional)</Label>
        <Textarea id='admin-note' value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <Button onClick={handleSubmit} disabled={isPending} className='w-full'>
        {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
        Crear cita confirmada
      </Button>
    </div>
  );
}
