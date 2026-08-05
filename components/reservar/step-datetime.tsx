'use client';

import { useEffect, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { getAvailability } from '@/app/reservar/actions';
import type { DayAvailability } from '@/lib/booking/availability';
import type { WizardService } from '@/components/reservar/step-service';

export default function StepDateTime({
  service,
  onBack,
  onSelect,
}: {
  service: WizardService;
  onBack: () => void;
  onSelect: (date: string, time: string) => void;
}) {
  const [availability, setAvailability] = useState<DayAvailability[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setAvailability(null);
    setSelectedDate(undefined);
    startTransition(async () => {
      const days = await getAvailability(service.id);
      setAvailability(days);
    });
  }, [service.id]);

  const availableDates = new Set((availability ?? []).map((d) => d.date));
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const slotsForDate =
    availability?.find((d) => d.date === selectedDateStr)?.slots ?? [];

  return (
    <div>
      <button
        type='button'
        onClick={onBack}
        className='inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-teal mb-4'
      >
        <ChevronLeft className='h-4 w-4' /> Cambiar servicio
      </button>

      <p className='text-sm text-gray-600 mb-4'>
        <span className='font-medium text-brand-ink'>{service.name}</span> ·{' '}
        {service.duration_min} min
      </p>

      {!availability ? (
        <div className='flex items-center justify-center py-16 text-gray-400'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </div>
      ) : availability.length === 0 ? (
        <p className='text-center text-gray-600 py-8'>
          No hay horarios disponibles para este servicio en las próximas
          semanas. Escríbenos por WhatsApp para revisar otras opciones.
        </p>
      ) : (
        <div className='grid gap-8 sm:grid-cols-2'>
          <div className='flex justify-center'>
            <Calendar
              mode='single'
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => !availableDates.has(format(date, 'yyyy-MM-dd'))}
            />
          </div>
          <div>
            {!selectedDateStr ? (
              <p className='text-sm text-gray-500'>
                Elige una fecha para ver los horarios disponibles.
              </p>
            ) : slotsForDate.length > 0 ? (
              <div className='grid grid-cols-3 gap-2'>
                {slotsForDate.map((time) => (
                  <Button
                    key={time}
                    type='button'
                    variant='outline'
                    onClick={() => onSelect(selectedDateStr, time)}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            ) : (
              <p className='text-sm text-gray-500'>No hay horarios ese día.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
