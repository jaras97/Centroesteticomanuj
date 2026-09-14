'use client';

import { useState } from 'react';
import StepService, { type WizardService } from '@/components/reservar/step-service';
import StepDateTime from '@/components/reservar/step-datetime';
import StepDetails from '@/components/reservar/step-details';
import Confirmation from '@/components/reservar/confirmation';
import { gaEvent } from '@/lib/gtag';

type Step = 1 | 2 | 3 | 4;

interface Summary {
  serviceName: string;
  date: string;
  time: string;
}

const STEP_LABELS = ['Servicio', 'Fecha y hora', 'Tus datos'];

export default function BookingWizard({ services }: { services: WizardService[] }) {
  const [step, setStep] = useState<Step>(1);
  const [service, setService] = useState<WizardService | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  if (step === 4 && summary) {
    return <Confirmation summary={summary} />;
  }

  return (
    <div>
      <ol className='flex items-center justify-center gap-2 mb-10 text-sm'>
        {STEP_LABELS.map((label, idx) => {
          const stepNumber = idx + 1;
          const isActive = stepNumber === step;
          const isDone = stepNumber < step;
          return (
            <li key={label} className='flex items-center gap-2'>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-brand-teal text-white'
                    : isDone
                      ? 'bg-brand-teal/20 text-brand-teal'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {stepNumber}
              </span>
              <span className={isActive ? 'text-brand-ink font-medium' : 'text-gray-400'}>
                {label}
              </span>
              {idx < STEP_LABELS.length - 1 && (
                <span className='mx-2 h-px w-6 bg-gray-200' />
              )}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <StepService
          services={services}
          onSelect={(selected) => {
            setService(selected);
            // Embudo: un evento por paso superado. Comparando el volumen de
            // cada paso contra `reserva_enviada` se ve en qué punto abandona
            // la gente (elegir servicio, elegir hora o dejar los datos).
            gaEvent('reserva_paso', {
              paso: 1,
              paso_nombre: 'servicio',
              servicio: selected.name,
            });
            setStep(2);
          }}
        />
      )}

      {step === 2 && service && (
        <StepDateTime
          service={service}
          onBack={() => setStep(1)}
          onSelect={(selectedDate, selectedTime) => {
            setDate(selectedDate);
            setTime(selectedTime);
            gaEvent('reserva_paso', {
              paso: 2,
              paso_nombre: 'fecha_hora',
              servicio: service.name,
            });
            setStep(3);
          }}
        />
      )}

      {step === 3 && service && date && time && (
        <StepDetails
          serviceId={service.id}
          serviceName={service.name}
          date={date}
          time={time}
          onBack={() => setStep(2)}
          onSuccess={(result) => {
            // Conversión principal del sitio. Marcar `reserva_enviada` como
            // evento clave en GA4 (Admin → Eventos) para que cuente como
            // conversión en los informes.
            gaEvent('reserva_enviada', {
              servicio: result.serviceName,
              fecha: result.date,
              hora: result.time,
            });
            setSummary(result);
            setStep(4);
          }}
        />
      )}
    </div>
  );
}
