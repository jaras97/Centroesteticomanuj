'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

export interface WizardService {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number | null;
  deposit_amount: number | null;
}

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function StepService({
  services,
  onSelect,
}: {
  services: WizardService[];
  onSelect: (service: WizardService) => void;
}) {
  if (services.length === 0) {
    return (
      <p className='text-center text-gray-600'>
        No hay servicios disponibles en este momento. Escríbenos por WhatsApp
        para agendar tu cita.
      </p>
    );
  }

  return (
    <div className='space-y-3'>
      {services.map((service) => (
        <button
          key={service.id}
          type='button'
          onClick={() => onSelect(service)}
          className='w-full text-left'
        >
          <Card className='hover:shadow-md hover:border-brand-teal/50 transition-all border'>
            <CardContent className='p-5 flex items-center justify-between gap-4'>
              <div>
                <h3 className='font-semibold text-brand-ink'>{service.name}</h3>
                {service.description && (
                  <p className='text-sm text-gray-600 mt-1 line-clamp-2'>
                    {service.description}
                  </p>
                )}
                <p className='text-sm text-gray-500 mt-2'>
                  {service.duration_min} min
                  {service.price ? ` · ${currency.format(service.price)}` : ''}
                </p>
              </div>
              <ChevronRight className='h-5 w-5 text-brand-teal shrink-0' />
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
