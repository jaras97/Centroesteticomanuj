'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { stepDetailsSchema, type StepDetailsInput } from '@/lib/booking/schemas';
import { createBookingRequest } from '@/app/reservar/actions';

interface Props {
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  onBack: () => void;
  onSuccess: (summary: { serviceName: string; date: string; time: string }) => void;
}

export default function StepDetails({
  serviceId,
  serviceName,
  date,
  time,
  onBack,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<StepDetailsInput>({
    resolver: zodResolver(stepDetailsSchema),
    defaultValues: { name: '', phone: '', note: '', website: '' },
  });

  function onSubmit(values: StepDetailsInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createBookingRequest({
        serviceId,
        date,
        time,
        ...values,
      });

      if (!result.ok) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }

      onSuccess({ serviceName, date, time });
    });
  }

  return (
    <div>
      <button
        type='button'
        onClick={onBack}
        className='inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-teal mb-4'
      >
        <ChevronLeft className='h-4 w-4' /> Cambiar fecha u hora
      </button>

      <p className='text-sm text-gray-600 mb-6'>
        <span className='font-medium text-brand-ink'>{serviceName}</span> ·{' '}
        {date} · {time}
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-5'>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre completo</FormLabel>
                <FormControl>
                  <Input placeholder='Tu nombre' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='phone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono (WhatsApp)</FormLabel>
                <FormControl>
                  <Input placeholder='+57 300 000 0000' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='note'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nota (opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder='Cuéntanos algo más sobre tu cita' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Honeypot — invisible para personas, los bots suelen llenarlo. */}
          <div className='hidden' aria-hidden='true'>
            <label htmlFor='website'>No llenar este campo</label>
            <input
              id='website'
              tabIndex={-1}
              autoComplete='off'
              {...form.register('website')}
            />
          </div>

          {serverError && (
            <p className='text-sm font-medium text-destructive'>{serverError}</p>
          )}

          <Button type='submit' className='w-full' disabled={isPending}>
            {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            Enviar solicitud
          </Button>

          <p className='text-xs text-gray-500 text-center'>
            Esta es una solicitud, no una cita confirmada. Manu se pondrá en
            contacto contigo por WhatsApp para confirmarla.
          </p>
        </form>
      </Form>
    </div>
  );
}
