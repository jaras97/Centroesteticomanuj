'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
} from '@/app/admin/(dashboard)/actions';
import type { Availability } from '@/lib/supabase/types';

const DAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export default function AvailabilityEditor({
  windows,
}: {
  windows: Availability[];
}) {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {DAY_LABELS.map((label, dayOfWeek) => (
        <DayCard
          key={dayOfWeek}
          dayOfWeek={dayOfWeek}
          label={label}
          windows={windows.filter((w) => w.day_of_week === dayOfWeek)}
        />
      ))}
    </div>
  );
}

function DayCard({
  dayOfWeek,
  label,
  windows,
}: {
  dayOfWeek: number;
  label: string;
  windows: Availability[];
}) {
  const [adding, setAdding] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await createAvailabilityWindow({ dayOfWeek, startTime, endTime });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Horario agregado.');
      setAdding(false);
    });
  }

  return (
    <div className='bg-white border rounded-lg p-4'>
      <p className='font-semibold text-brand-ink mb-3'>{label}</p>

      <div className='space-y-2 mb-3'>
        {windows.length === 0 && !adding && (
          <p className='text-xs text-gray-400'>Sin horario — día no disponible.</p>
        )}
        {windows.map((w) => (
          <WindowRow key={w.id} window={w} />
        ))}
      </div>

      {adding ? (
        <div className='space-y-2 border-t pt-3'>
          <div className='grid grid-cols-2 gap-2'>
            <Input
              type='time'
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input type='time' value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className='flex gap-2'>
            <Button size='sm' onClick={handleAdd} disabled={isPending}>
              {isPending && <Loader2 className='h-3 w-3 animate-spin' />}
              Guardar
            </Button>
            <Button size='sm' variant='outline' onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size='sm'
          variant='outline'
          className='w-full'
          onClick={() => setAdding(true)}
        >
          <Plus className='h-3 w-3' /> Agregar horario
        </Button>
      )}
    </div>
  );
}

function WindowRow({ window }: { window: Availability }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className='flex items-center justify-between rounded-md bg-gray-50 px-2 py-1.5 text-sm'>
      <span className='text-brand-ink'>
        {window.start_time.slice(0, 5)} – {window.end_time.slice(0, 5)}
      </span>
      <button
        type='button'
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteAvailabilityWindow(window.id);
            if (!result.ok) toast.error(result.error);
          })
        }
        className='text-gray-400 hover:text-destructive'
      >
        {isPending ? <Loader2 className='h-3 w-3 animate-spin' /> : <X className='h-3 w-3' />}
      </button>
    </div>
  );
}
