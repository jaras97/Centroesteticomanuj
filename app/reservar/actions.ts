'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { getAvailableSlots, type DayAvailability } from '@/lib/booking/availability';
import { bookingRequestSchema } from '@/lib/booking/schemas';
import { isRateLimited } from '@/lib/booking/rate-limit';
import {
  LEAD_TIME_HOURS,
  BOOKING_HORIZON_WEEKS,
  REQUEST_EXPIRATION_HOURS,
} from '@/lib/booking/config';
import { bogotaWallTimeToUtc } from '@/lib/booking/timezone';

export async function getAvailability(serviceId: string): Promise<DayAvailability[]> {
  return getAvailableSlots(serviceId);
}

export type CreateBookingResult =
  | { ok: true; summary: { serviceName: string; date: string; time: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createBookingRequest(
  input: unknown,
): Promise<CreateBookingResult> {
  const parsed = bookingRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Revisa los datos del formulario.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // Honeypot: si el campo está lleno, es un bot. Respondemos éxito sin
  // escribir nada, para no delatar la validación.
  if (data.website) {
    return {
      ok: true,
      summary: { serviceName: '', date: data.date, time: data.time },
    };
  }

  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(ip)) {
    return {
      ok: false,
      error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
    };
  }

  const startTime = bogotaWallTimeToUtc(data.date, data.time);
  const now = new Date();
  const minStart = new Date(now.getTime() + LEAD_TIME_HOURS * 60 * 60_000);
  const maxStart = new Date(
    now.getTime() + BOOKING_HORIZON_WEEKS * 7 * 24 * 60 * 60_000,
  );

  if (startTime < minStart || startTime > maxStart) {
    return {
      ok: false,
      error: 'Ese horario ya no está disponible, elige otro.',
    };
  }

  const supabase = createServiceClient();

  const { data: service } = await supabase
    .from('services')
    .select('id, name, duration_min, buffer_min, active')
    .eq('id', data.serviceId)
    .maybeSingle();

  if (!service || !service.active) {
    return { ok: false, error: 'El servicio seleccionado ya no está disponible.' };
  }

  // El teléfono es la llave de dedupe, pero el nombre de un cliente
  // existente NUNCA se sobreescribe desde el formulario público — de lo
  // contrario cualquiera podría "renombrar" a otra persona con solo
  // repetir su teléfono. El nombre canónico solo se edita desde el panel
  // admin. El nombre escrito en esta solicitud se guarda aparte, en
  // appointments.requested_name, para no perder trazabilidad.
  const { data: existingClient, error: lookupError } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', data.phone)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: 'No pudimos registrar tus datos, intenta de nuevo.' };
  }

  let clientId = existingClient?.id;

  if (!clientId) {
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({ name: data.name, phone: data.phone })
      .select('id')
      .single();

    if (insertError || !newClient) {
      return { ok: false, error: 'No pudimos registrar tus datos, intenta de nuevo.' };
    }
    clientId = newClient.id;
  }

  const expiresAt = new Date(
    now.getTime() + REQUEST_EXPIRATION_HOURS * 60 * 60_000,
  );

  const { error: appointmentError } = await supabase.from('appointments').insert({
    client_id: clientId,
    service_id: service.id,
    status: 'SOLICITADA',
    start_time: startTime.toISOString(),
    duration_min: service.duration_min,
    buffer_min: service.buffer_min,
    requested_name: data.name,
    client_note: data.note || null,
    expires_at: expiresAt.toISOString(),
  });

  if (appointmentError) {
    if (appointmentError.code === '23505') {
      return {
        ok: false,
        error: 'Ya tienes una solicitud activa. Espera la confirmación antes de solicitar otra cita.',
      };
    }
    if (appointmentError.code === '23P01') {
      return {
        ok: false,
        error: 'Ese horario ya no está disponible, elige otro.',
      };
    }
    return { ok: false, error: 'No pudimos enviar tu solicitud, intenta de nuevo.' };
  }

  return {
    ok: true,
    summary: { serviceName: service.name, date: data.date, time: data.time },
  };
}
