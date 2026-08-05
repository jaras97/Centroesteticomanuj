'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  return supabase;
}

function revalidateBooking() {
  revalidatePath('/admin');
  revalidatePath('/admin/agenda');
  revalidatePath('/admin/clientes');
}

export async function confirmAppointment(
  id: string,
  durationMinOverride?: number,
) {
  const supabase = await requireUser();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('client_id, service_id, duration_min')
    .eq('id', id)
    .maybeSingle();

  if (!appointment) return { ok: false, error: 'Cita no encontrada.' };

  const { count: completedCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', appointment.client_id)
    .eq('status', 'COMPLETADA');

  const { data: service } = await supabase
    .from('services')
    .select('deposit_amount')
    .eq('id', appointment.service_id)
    .maybeSingle();

  const isNewClient = (completedCount ?? 0) === 0;
  const requiresDeposit = isNewClient && !!service?.deposit_amount;

  const durationMin = durationMinOverride ?? appointment.duration_min;
  const expiresAt = requiresDeposit
    ? new Date(Date.now() + 24 * 60 * 60_000).toISOString()
    : null;

  const { error } = await supabase
    .from('appointments')
    .update({
      status: requiresDeposit ? 'ESPERANDO_ANTICIPO' : 'CONFIRMADA',
      duration_min: durationMin,
      expires_at: expiresAt,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo confirmar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function markDepositReceived(id: string) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'CONFIRMADA', expires_at: null })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function rejectAppointment(id: string, reason?: string) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'CANCELADA', reject_reason: reason || null, expires_at: null })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo rechazar la solicitud.' };

  revalidateBooking();
  return { ok: true };
}

export async function markCompleted(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'COMPLETADA' })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function markNoShow(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'NO_ASISTIO' })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function createBlockedSlot(input: {
  startAt: string;
  endAt: string;
  reason?: string;
}) {
  const supabase = await requireUser();

  const { error } = await supabase.from('blocked_slots').insert({
    start_at: input.startAt,
    end_at: input.endAt,
    reason: input.reason || null,
  });

  if (error) return { ok: false, error: 'No se pudo crear el bloqueo.' };

  revalidateBooking();
  return { ok: true };
}

export async function deleteBlockedSlot(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('blocked_slots').delete().eq('id', id);

  if (error) return { ok: false, error: 'No se pudo eliminar el bloqueo.' };

  revalidateBooking();
  return { ok: true };
}

export async function updateClientNotes(clientId: string, notes: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from('clients')
    .update({ notes })
    .eq('id', clientId);

  if (error) return { ok: false, error: 'No se pudieron guardar las notas.' };

  revalidatePath(`/admin/clientes/${clientId}`);
  return { ok: true };
}

export async function createAvailabilityWindow(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}) {
  const supabase = await requireUser();

  if (input.endTime <= input.startTime) {
    return { ok: false, error: 'La hora final debe ser después de la inicial.' };
  }

  const { error } = await supabase.from('availability').insert({
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
  });

  if (error) return { ok: false, error: 'No se pudo agregar el horario.' };

  revalidatePath('/admin/horarios');
  return { ok: true };
}

export async function deleteAvailabilityWindow(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('availability').delete().eq('id', id);

  if (error) return { ok: false, error: 'No se pudo eliminar el horario.' };

  revalidatePath('/admin/horarios');
  return { ok: true };
}

export async function searchClients(query: string) {
  const supabase = await requireUser();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data } = await supabase
    .from('clients')
    .select('id, name, phone')
    .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
    .limit(10);

  return data ?? [];
}

export async function createManualAppointment(input: {
  clientId?: string;
  newClientName?: string;
  newClientPhone?: string;
  serviceId: string;
  startTimeIso: string;
  note?: string;
}) {
  const supabase = await requireUser();

  let clientId = input.clientId ?? null;

  if (!clientId) {
    const phone = input.newClientPhone?.trim();
    const name = input.newClientName?.trim();
    if (!phone || !name) {
      return { ok: false, error: 'Falta el nombre o teléfono del cliente nuevo.' };
    }

    // Mismo criterio anti-suplantación que el flujo público: si el
    // teléfono ya pertenece a un cliente, se reutiliza sin tocar su nombre.
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from('clients')
        .insert({ name, phone })
        .select('id')
        .single();
      if (createError || !created) {
        return { ok: false, error: 'No se pudo registrar el cliente.' };
      }
      clientId = created.id;
    }
  }

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();

  const { data: service } = await supabase
    .from('services')
    .select('duration_min, buffer_min')
    .eq('id', input.serviceId)
    .maybeSingle();

  if (!service || !client) {
    return { ok: false, error: 'Servicio o cliente inválido.' };
  }

  const { error: appointmentError } = await supabase.from('appointments').insert({
    client_id: clientId,
    service_id: input.serviceId,
    status: 'CONFIRMADA',
    start_time: input.startTimeIso,
    duration_min: service.duration_min,
    buffer_min: service.buffer_min,
    requested_name: client.name,
    client_note: input.note || null,
  });

  if (appointmentError) {
    if (appointmentError.code === '23P01') {
      return { ok: false, error: 'Ese horario ya está ocupado.' };
    }
    return { ok: false, error: 'No se pudo crear la cita.' };
  }

  revalidateBooking();
  return { ok: true };
}

export async function rescheduleAppointment(id: string, newStartTimeIso: string) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('appointments')
    .update({ start_time: newStartTimeIso })
    .eq('id', id);

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, error: 'Ese horario ya está ocupado.' };
    }
    return { ok: false, error: 'No se pudo reagendar la cita.' };
  }

  revalidateBooking();
  return { ok: true };
}

export async function updateClient(
  id: string,
  input: {
    name: string;
    phone: string;
    email?: string;
    birthday?: string;
    notes?: string;
  },
) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('clients')
    .update({
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      birthday: input.birthday || null,
      notes: input.notes || null,
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe otro cliente con ese teléfono.' };
    }
    return { ok: false, error: 'No se pudieron guardar los datos del cliente.' };
  }

  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath('/admin/clientes');
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/admin', 'layout');
}
