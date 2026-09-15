'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCOP } from '@/lib/format';
import { getBookableServices } from '@/app/admin/(dashboard)/actions';

export interface BookableService {
  id: string;
  name: string;
  duration_min: number;
  buffer_min: number;
  price: number | null;
  deposit_amount: number | null;
}

/**
 * Selector del servicio que realmente se hizo, compartido por los diálogos de
 * completar y de corregir una cita. Existe porque la clienta cambia de
 * servicio en el puesto con frecuencia, y eso hay que poder registrarlo en el
 * momento del cierre — no solo mientras la cita todavía no había pasado.
 *
 * El diálogo que lo usa decide qué hacer con el precio del servicio elegido
 * (al completar se propone como valor cobrado; al corregir no se toca el
 * monto ya registrado).
 */
export default function PerformedServiceSelect({
  open,
  value,
  bookedServiceId,
  bookedServiceName,
  bookedServicePrice,
  onChange,
}: {
  /** Estado del diálogo contenedor: los servicios se cargan al abrirlo. */
  open: boolean;
  value: string;
  bookedServiceId: string;
  bookedServiceName: string;
  bookedServicePrice: number | null;
  onChange: (serviceId: string, service: BookableService | undefined) => void;
}) {
  const [services, setServices] = useState<BookableService[]>([]);

  // Carga perezosa, igual que getAvailableRewards y el diálogo de editar cita:
  // el listado de la agenda ya trae un mes entero de citas.
  useEffect(() => {
    if (!open) return;
    getBookableServices().then(setServices);
  }, [open]);

  // El servicio agendado puede haber salido del catálogo (inactivo). Se añade
  // a mano para que el selector no arranque vacío en esa cita.
  const options = useMemo<BookableService[]>(() => {
    if (services.some((s) => s.id === bookedServiceId)) return services;
    return [
      {
        id: bookedServiceId,
        name: bookedServiceName,
        duration_min: 0,
        buffer_min: 0,
        price: bookedServicePrice,
        deposit_amount: null,
      },
      ...services,
    ];
  }, [services, bookedServiceId, bookedServiceName, bookedServicePrice]);

  const selected = options.find((s) => s.id === value);

  return (
    <div className='space-y-2'>
      <Label>Servicio realizado</Label>
      <Select
        value={value}
        onValueChange={(id) => onChange(id, options.find((s) => s.id === id))}
      >
        <SelectTrigger>
          <SelectValue placeholder='Selecciona el servicio' />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
              {s.price != null ? ` · ${formatCOP(s.price)}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== bookedServiceId && selected && (
        <p className='text-sm text-amber-600'>
          Se registrará <strong>{selected.name}</strong> en vez de {bookedServiceName} (lo que se
          agendó). Revisa que el valor cobrado corresponda.
        </p>
      )}
    </div>
  );
}
