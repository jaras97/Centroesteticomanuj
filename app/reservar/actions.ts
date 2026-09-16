'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAvailableSlots, type DayAvailability } from '@/lib/booking/availability';
import { bookingRequestSchema } from '@/lib/booking/schemas';
import { isRateLimited } from '@/lib/booking/rate-limit';
import {
  LEAD_TIME_HOURS,
  BOOKING_HORIZON_WEEKS,
  REQUEST_EXPIRATION_HOURS,
} from '@/lib/booking/config';
import { bogotaWallTimeToUtc, formatDateStrHuman } from '@/lib/booking/timezone';
import {
  enqueueBookingRequested,
  loadNotificationContext,
} from '@/lib/notifications/enqueue';
import { dispatchQuietly } from '@/lib/notifications/dispatch';

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

  const email = data.email?.trim() || null;

  // El teléfono es la llave de dedupe, pero el nombre de un cliente
  // existente NUNCA se sobreescribe desde el formulario público — de lo
  // contrario cualquiera podría "renombrar" a otra persona con solo
  // repetir su teléfono. El nombre canónico solo se edita desde el panel
  // admin. El nombre escrito en esta solicitud se guarda aparte, en
  // appointments.requested_name, para no perder trazabilidad.
  const { data: existingClient, error: lookupError } = await supabase
    .from('clients')
    .select('id, email')
    .eq('phone', data.phone)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: 'No pudimos registrar tus datos, intenta de nuevo.' };
  }

  let clientId = existingClient?.id;
  // Correo efectivo para las notificaciones de ESTA solicitud: el que ya
  // estaba guardado manda sobre el que se acaba de escribir.
  let clientEmail: string | null = existingClient?.email ?? email;

  if (!clientId) {
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({ name: data.name, phone: data.phone, email })
      .select('id')
      .single();

    if (insertError || !newClient) {
      return { ok: false, error: 'No pudimos registrar tus datos, intenta de nuevo.' };
    }
    clientId = newClient.id;
  } else if (email && !existingClient?.email) {
    // Mismo criterio que con el nombre: se RELLENA si estaba vacío, nunca
    // se pisa un correo ya registrado desde el formulario público (si no,
    // cualquiera podría redirigir las notificaciones de otra persona con
    // solo conocer su teléfono). Cambiarlo es cosa del panel admin.
    await supabase.from('clients').update({ email }).eq('id', clientId).is('email', null);
    clientEmail = email;
  }

  const expiresAt = new Date(
    now.getTime() + REQUEST_EXPIRATION_HOURS * 60 * 60_000,
  );

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert({
      client_id: clientId,
      service_id: service.id,
      status: 'SOLICITADA',
      start_time: startTime.toISOString(),
      duration_min: service.duration_min,
      buffer_min: service.buffer_min,
      requested_name: data.name,
      client_note: data.note || null,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

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

  // Notificaciones: efecto secundario, NUNCA parte del éxito de la reserva.
  // Todo va dentro de try/catch y el despacho corre en `after()` (después de
  // responderle a la clienta), así un fallo de Resend no rompe ni demora la
  // solicitud: la notificación queda FALLIDO en el outbox y se reintenta
  // desde /admin/notificaciones.
  if (appointment) {
    try {
      const context = await loadNotificationContext(supabase);
      await enqueueBookingRequested(supabase, context, {
        appointmentId: appointment.id,
        clientId,
        clientName: data.name,
        clientPhone: data.phone,
        clientEmail,
        serviceName: service.name,
        fecha: formatDateStrHuman(data.date),
        hora: data.time,
      });
      after(() => dispatchQuietly(supabase));
    } catch (err) {
      console.error('[notificaciones] no se pudo notificar la nueva solicitud', err);
    }
  }

  return {
    ok: true,
    summary: { serviceName: service.name, date: data.date, time: data.time },
  };
}
