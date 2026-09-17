'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { evaluateAndGrantLoyaltyReward, getAvailableRewards as getAvailableRewardsForClient } from '@/lib/booking/loyalty';
import { bogotaWallTimeToUtc } from '@/lib/booking/timezone';
import { dispatchQuietly } from '@/lib/notifications/dispatch';
import { emailConfigurationIssue, sendRawEmail } from '@/lib/notifications/channels/email';
import { PREVIEW_VARS, renderTemplate } from '@/lib/notifications/templates';
import {
  enqueueCampaign,
  loadNotificationContext,
  missingRecipientReason,
} from '@/lib/notifications/enqueue';
import {
  CampaignAudienceError,
  INVALID_AUDIENCE_ERROR,
  getCampaignAudienceStats,
  parseCampaignAudience,
  resolveCampaignAudience,
} from '@/lib/notifications/audience';
import type {
  Campaign,
  CampaignAudience,
  NotificationChannel,
} from '@/lib/notifications/types';
import type {
  ExpenseNature,
  FinancialAccountKind,
  MovementKind,
} from '@/lib/supabase/types';

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
  depositReceivedAmount?: number,
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

  // Si la cita queda esperando el anticipo obligatorio, el monto todavía no
  // se ha recibido — se registra después vía markDepositReceived.
  const depositToStore =
    !requiresDeposit && depositReceivedAmount && depositReceivedAmount > 0
      ? depositReceivedAmount
      : undefined;

  const { error } = await supabase
    .from('appointments')
    .update({
      status: requiresDeposit ? 'ESPERANDO_ANTICIPO' : 'CONFIRMADA',
      duration_min: durationMin,
      expires_at: expiresAt,
      ...(depositToStore !== undefined && { deposit_received_amount: depositToStore }),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo confirmar la cita.' };

  revalidateBooking();
  return { ok: true };
}

export async function markDepositReceived(id: string, depositReceivedAmount?: number) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'CONFIRMADA',
      expires_at: null,
      ...(depositReceivedAmount &&
        depositReceivedAmount > 0 && { deposit_received_amount: depositReceivedAmount }),
    })
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

export async function getAvailableRewards(clientId: string) {
  const supabase = await requireUser();
  return getAvailableRewardsForClient(supabase, clientId);
}

/**
 * Valida el servicio que se registra como realizado en una cita que ya
 * ocurrió (al completarla o al corregirla después). Es común que la clienta
 * cambie de servicio en el puesto, y hasta ahora eso solo se podía registrar
 * mientras la cita no hubiera pasado: al cerrarla quedaba el equivocado.
 *
 * Solo resuelve `service_id`. La duración y el buffer se dejan como quedaron:
 * son el tiempo que la cita realmente ocupó en la agenda, y reescribirlos
 * podría chocar con la cita siguiente vía el `exclude using gist`.
 */
async function resolvePerformedServiceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentServiceId: string,
  serviceId: string | undefined,
): Promise<{ ok: true; serviceId: string | null } | { ok: false; error: string }> {
  if (!serviceId || serviceId === currentServiceId) return { ok: true, serviceId: null };

  const { data: service } = await supabase
    .from('services')
    .select('id, active')
    .eq('id', serviceId)
    .maybeSingle();

  if (!service) return { ok: false, error: 'Servicio inválido.' };
  if (!service.active) return { ok: false, error: 'Ese servicio está inactivo.' };

  return { ok: true, serviceId: service.id };
}

/**
 * Resuelve la cuenta elegida en los diálogos de cobro. Devuelve además el
 * nombre, porque `appointments.payment_method` se SIGUE escribiendo con él:
 * es el texto que muestra el historial de citas desde 0003, y dejarlo vacío
 * borraría esa columna de las citas nuevas. `account_id` es el dato
 * agregable; `payment_method` queda como etiqueta legible y de respaldo.
 */
async function resolveChargeAccount(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  accountId: string | undefined,
): Promise<{ ok: true; accountId: string | null; name: string | null } | { ok: false; error: string }> {
  if (!accountId) return { ok: true, accountId: null, name: null };

  const { data: account } = await supabase
    .from('financial_accounts')
    .select('id, name')
    .eq('id', accountId)
    .maybeSingle();

  if (!account) return { ok: false, error: 'Esa cuenta ya no existe.' };
  return { ok: true, accountId: account.id, name: account.name };
}

/**
 * Campos de cobro de una cita, SIN pisar lo que ya estaba guardado cuando no
 * llegó cuenta ni método.
 *
 * `ChargeAccountSelect` no ofrece "sin asignar": una vez elegida, la cuenta no
 * se puede desasignar desde la UI, así que `accountId === undefined` siempre
 * significa "no me mandaron cuenta", nunca "bórrala". Escribir `null` a ciegas
 * borraba datos en dos casos reales:
 *
 *  · una cita anterior a 0016 con `payment_method` de texto libre que no calzó
 *    con ninguna cuenta ("Daviplata"): corregir solo el monto lo dejaba en
 *    null y el desglose "De dónde entró la plata" perdía la etiqueta;
 *  · una cita cuya cuenta ya está desactivada (el selector solo lista activas)
 *    o cuyo detalle todavía no terminó de cargar.
 */
function chargeAccountFields(
  account: { accountId: string | null; name: string | null },
  legacyPaymentMethod: string | undefined,
) {
  if (account.accountId) {
    // `payment_method` se sigue escribiendo con el nombre de la cuenta: es lo
    // que muestra el historial de citas desde 0003.
    return { account_id: account.accountId, payment_method: account.name };
  }
  if (legacyPaymentMethod) {
    return { payment_method: legacyPaymentMethod };
  }
  return {};
}

export async function completeAppointment(
  id: string,
  input: {
    chargedAmount: number;
    /** Cuenta (`financial_accounts`) a la que entró la plata. */
    accountId?: string;
    /** @deprecated Texto libre anterior a 0016. Solo se usa si no hay `accountId`. */
    paymentMethod?: string;
    appliedRewardId?: string;
    /** Servicio realmente realizado, si difiere del agendado. */
    serviceId?: string;
  },
) {
  const supabase = await requireUser();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('client_id, service_id')
    .eq('id', id)
    .maybeSingle();

  if (!appointment) return { ok: false, error: 'Cita no encontrada.' };

  // El monto llega de un <input type="number">: puede venir NaN, con decimales
  // o negativo. Sin esto, un NaN se serializa como null y la cita quedaba
  // COMPLETADA sin valor cobrado (invisible en Finanzas), y un decimal hacía
  // fallar el insert contra la columna `int`. Mismo criterio que
  // `updateAppointmentCharge`.
  if (!Number.isFinite(input.chargedAmount) || input.chargedAmount < 0) {
    return { ok: false, error: 'El valor cobrado no es válido.' };
  }

  // Antes de tocar el cupón: si el servicio no es válido, no se quema nada.
  const performed = await resolvePerformedServiceId(
    supabase,
    appointment.service_id,
    input.serviceId,
  );
  if (!performed.ok) return { ok: false, error: performed.error };

  const account = await resolveChargeAccount(supabase, input.accountId);
  if (!account.ok) return { ok: false, error: account.error };

  if (input.appliedRewardId) {
    const { data: reward } = await supabase
      .from('loyalty_rewards')
      .select('id, client_id, used_at')
      .eq('id', input.appliedRewardId)
      .maybeSingle();

    if (!reward || reward.client_id !== appointment.client_id || reward.used_at) {
      return { ok: false, error: 'Ese cupón ya no está disponible.' };
    }

    const { error: rewardError } = await supabase
      .from('loyalty_rewards')
      .update({ used_at: new Date().toISOString(), used_appointment_id: id })
      .eq('id', input.appliedRewardId);

    if (rewardError) return { ok: false, error: 'No se pudo aplicar el cupón.' };
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'COMPLETADA',
      charged_amount: Math.round(input.chargedAmount),
      ...chargeAccountFields(account, input.paymentMethod),
      ...(performed.serviceId && { service_id: performed.serviceId }),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  const { granted } = await evaluateAndGrantLoyaltyReward(supabase, appointment.client_id, id);

  revalidateBooking();
  revalidatePath('/admin/finanzas');
  revalidatePath(`/admin/clientes/${appointment.client_id}`);
  return { ok: true, loyaltyGranted: granted };
}

export interface AppointmentDetail {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  duration_min: number;
  buffer_min: number;
  charged_amount: number | null;
  payment_method: string | null;
  /** Cuenta a la que entró el ingreso (0016). Prellena el selector de cuenta. */
  account_id: string | null;
  deposit_received_amount: number | null;
  requested_name: string;
  client_note: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  client: { id: string; name: string; phone: string };
  service: { id: string; name: string; price: number | null; duration_min: number };
  /** Cupón de fidelización canjeado en esta cita (explica por qué el valor
   * cobrado es menor al precio de lista). */
  appliedReward: { id: string; discount_percent: number } | null;
  /** Cupón que esta cita generó al completarse. */
  earnedReward: { id: string; discount_percent: number; used_at: string | null } | null;
}

/**
 * Detalle completo de una cita, para el diálogo de la agenda. Se carga al
 * abrir (no viaja con el listado del mes) e incluye lo que la fila de
 * `appointments` no tiene por sí sola: el cupón aplicado y el generado.
 */
export async function getAppointmentDetail(id: string): Promise<AppointmentDetail | null> {
  const supabase = await requireUser();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('*, clients(id, name, phone), services(id, name, price, duration_min)')
    .eq('id', id)
    .maybeSingle();

  if (!appointment) return null;

  const [{ data: applied }, { data: earned }] = await Promise.all([
    supabase
      .from('loyalty_rewards')
      .select('id, discount_percent')
      .eq('used_appointment_id', id)
      .maybeSingle(),
    supabase
      .from('loyalty_rewards')
      .select('id, discount_percent, used_at')
      .eq('source_appointment_id', id)
      .maybeSingle(),
  ]);

  const row = appointment as unknown as {
    clients: { id: string; name: string; phone: string };
    services: { id: string; name: string; price: number | null; duration_min: number };
  } & Record<string, unknown>;

  return {
    id: row.id as string,
    status: row.status as string,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    duration_min: row.duration_min as number,
    buffer_min: row.buffer_min as number,
    charged_amount: (row.charged_amount as number | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    account_id: (row.account_id as string | null) ?? null,
    deposit_received_amount: (row.deposit_received_amount as number | null) ?? null,
    requested_name: row.requested_name as string,
    client_note: (row.client_note as string | null) ?? null,
    reject_reason: (row.reject_reason as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    client: row.clients,
    service: row.services,
    appliedReward: applied ?? null,
    earnedReward: earned ?? null,
  };
}

/**
 * Corrige una cita ya completada: servicio realizado, valor cobrado y cuenta a
 * la que entró la plata. Hasta ahora esos datos solo se podían escribir en la transición
 * CONFIRMADA → COMPLETADA, así que un error de tecleo — o un cambio de
 * servicio que se descubrió al cerrar la cita — quedaba fijo para siempre en
 * Finanzas. No re-evalúa fidelización (el cupón se otorga por número de
 * citas, no por servicio ni monto) ni cambia el estado.
 */
export async function updateAppointmentCharge(
  id: string,
  input: {
    chargedAmount: number;
    /** Cuenta (`financial_accounts`) a la que entró la plata. */
    accountId?: string;
    /** @deprecated Texto libre anterior a 0016. Solo se usa si no hay `accountId`. */
    paymentMethod?: string;
    serviceId?: string;
  },
) {
  const supabase = await requireUser();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('client_id, status, service_id')
    .eq('id', id)
    .maybeSingle();

  if (!appointment) return { ok: false, error: 'Cita no encontrada.' };
  if (appointment.status !== 'COMPLETADA') {
    return { ok: false, error: 'Solo se puede corregir una cita completada.' };
  }
  if (!Number.isFinite(input.chargedAmount) || input.chargedAmount < 0) {
    return { ok: false, error: 'El valor cobrado no es válido.' };
  }

  const performed = await resolvePerformedServiceId(
    supabase,
    appointment.service_id,
    input.serviceId,
  );
  if (!performed.ok) return { ok: false, error: performed.error };

  const account = await resolveChargeAccount(supabase, input.accountId);
  if (!account.ok) return { ok: false, error: account.error };

  const { error } = await supabase
    .from('appointments')
    .update({
      charged_amount: Math.round(input.chargedAmount),
      ...chargeAccountFields(account, input.paymentMethod),
      ...(performed.serviceId && { service_id: performed.serviceId }),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cita.' };

  revalidateBooking();
  revalidatePath('/admin/finanzas');
  revalidatePath(`/admin/clientes/${appointment.client_id}`);
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
  depositReceivedAmount?: number;
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
    deposit_received_amount:
      input.depositReceivedAmount && input.depositReceivedAmount > 0
        ? input.depositReceivedAmount
        : null,
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

/** Servicios agendables activos, para el selector del diálogo de edición. */
export async function getBookableServices() {
  const supabase = await requireUser();

  const { data } = await supabase
    .from('services')
    .select('id, name, duration_min, buffer_min, price, deposit_amount')
    .eq('active', true)
    .order('name', { ascending: true });

  return data ?? [];
}

/** Estados en los que la cita todavía no se cerró y admite cambios de
 * servicio/horario. Una COMPLETADA no entra aquí porque mover su horario ya
 * no tiene sentido (ocurrió a la hora que ocurrió); el servicio y el cobro sí
 * se le pueden corregir, por `updateAppointmentCharge`. Una
 * CANCELADA/NO_ASISTIO/EXPIRADA ya no ocupa la agenda. */
const EDITABLE_STATUSES = ['SOLICITADA', 'ESPERANDO_ANTICIPO', 'CONFIRMADA'];

/**
 * Reemplaza al antiguo `rescheduleAppointment`: cambia servicio, fecha/hora y
 * duración en una sola operación. Van juntos a propósito — al pasar a un
 * servicio más largo el horario actual suele dejar de caber, y con diálogos
 * separados el admin quedaría atascado contra la restricción de solapamiento.
 *
 * No hace falta recalcular `end_time`/`appt_range`: el trigger
 * `set_appointment_range` (migración 0001) los deriva al escribir
 * start_time/duration_min/buffer_min, y el `exclude using gist` rechaza el
 * solapamiento con otra cita (error 23P01).
 */
export async function updateAppointmentBooking(
  id: string,
  input: { serviceId: string; startTimeIso: string; durationMin?: number },
) {
  const supabase = await requireUser();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('client_id, service_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!appointment) return { ok: false, error: 'Cita no encontrada.' };

  if (!EDITABLE_STATUSES.includes(appointment.status)) {
    return {
      ok: false,
      error: 'Solo se pueden editar citas solicitadas, esperando anticipo o confirmadas.',
    };
  }

  const { data: service } = await supabase
    .from('services')
    .select('name, duration_min, buffer_min, active')
    .eq('id', input.serviceId)
    .maybeSingle();

  if (!service) return { ok: false, error: 'Servicio inválido.' };

  // Un servicio desactivado sigue siendo válido si es el que la cita ya tenía
  // (no se fuerza un cambio solo porque salió del catálogo público).
  if (!service.active && input.serviceId !== appointment.service_id) {
    return { ok: false, error: 'Ese servicio está inactivo.' };
  }

  const durationMin =
    input.durationMin && input.durationMin > 0 ? input.durationMin : service.duration_min;

  // El estado no se toca a propósito: si el servicio nuevo pide anticipo (o
  // deja de pedirlo), sigue siendo Manu quien decide confirmar — el principio
  // rector del PRD es que el sistema nunca confirma solo.
  const { error } = await supabase
    .from('appointments')
    .update({
      service_id: input.serviceId,
      start_time: input.startTimeIso,
      duration_min: durationMin,
      buffer_min: service.buffer_min,
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23P01') {
      return {
        ok: false,
        error: `No cabe: ${service.name} ocupa ${durationMin + service.buffer_min} min (con buffer) y se cruza con otra cita. Elige otro horario o ajusta la duración.`,
      };
    }
    return { ok: false, error: 'No se pudo actualizar la cita.' };
  }

  revalidateBooking();
  revalidatePath(`/admin/clientes/${appointment.client_id}`);
  return { ok: true };
}

export async function createClientRecord(input: {
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  notes?: string;
}) {
  const supabase = await requireUser();

  if (!input.name.trim() || !input.phone.trim()) {
    return { ok: false, error: 'Nombre y teléfono son obligatorios.' };
  }

  const { error } = await supabase.from('clients').insert({
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    birthday: input.birthday || null,
    notes: input.notes?.trim() || null,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe un cliente con ese teléfono.' };
    }
    return { ok: false, error: 'No se pudo registrar el cliente.' };
  }

  revalidatePath('/admin/clientes');
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

function revalidateServices() {
  revalidatePath('/admin/servicios');
  revalidatePath('/admin/reservar');
  revalidatePath('/reservar');
}

interface ServiceInput {
  name: string;
  description?: string;
  durationMin: number;
  bufferMin: number;
  price?: number | null;
  depositAmount?: number | null;
  categoryId?: string | null;
}

export async function createService(input: ServiceInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };

  const { error } = await supabase.from('services').insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    duration_min: input.durationMin,
    buffer_min: input.bufferMin,
    price: input.price ?? null,
    deposit_amount: input.depositAmount ?? null,
    category_id: input.categoryId ?? null,
  });

  if (error) return { ok: false, error: 'No se pudo crear el servicio.' };

  revalidateServices();
  return { ok: true };
}

export async function updateService(id: string, input: ServiceInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };

  const { error } = await supabase
    .from('services')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      duration_min: input.durationMin,
      buffer_min: input.bufferMin,
      price: input.price ?? null,
      deposit_amount: input.depositAmount ?? null,
      category_id: input.categoryId ?? null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el servicio.' };

  revalidateServices();
  return { ok: true };
}

export async function setServiceActive(id: string, active: boolean) {
  const supabase = await requireUser();

  const { error } = await supabase.from('services').update({ active }).eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el servicio.' };

  revalidateServices();
  return { ok: true };
}

// ============================================================
// Contenido del sitio público (carrusel, categorías de servicios,
// galería) — ver docs/PRD-cms-contenido-y-promociones.md
// ============================================================

function revalidateContenido() {
  revalidatePath('/admin/contenido');
  revalidatePath('/');
  // El Footer (y con site_settings, también el logo del header de /reservar)
  // se renderiza ahí también — ver app/reservar/layout.tsx.
  revalidatePath('/reservar');
}

const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB — clips cortos, no video largo

export async function uploadSiteMedia(
  folder: 'hero' | 'services' | 'gallery' | 'promos' | 'site' | 'campaigns',
  formData: FormData,
) {
  const supabase = await requireUser();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: 'Selecciona un archivo.' };
  }

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    return { ok: false as const, error: 'El archivo debe ser una imagen o un video.' };
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { ok: false as const, error: 'El video no puede pesar más de 15MB — usa un clip corto.' };
  }

  // El flyer de una campaña se embebe en un correo: ahí no sirve ni un video
  // ni un SVG (ningún cliente de correo mayoritario renderiza SVG dentro de
  // un <img> — Gmail y Outlook lo bloquean). Se ataja al subir, que es donde
  // se puede explicar, y no al enviar, que es tarde.
  if (folder === 'campaigns') {
    if (!isImage) {
      return { ok: false as const, error: 'El flyer debe ser una imagen PNG o JPG.' };
    }
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      return {
        ok: false as const,
        error:
          'Los correos no muestran SVG (Gmail y Outlook lo bloquean). Sube el flyer en PNG o JPG.',
      };
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('site-media')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false as const, error: 'No se pudo subir el archivo.' };

  const { data } = supabase.storage.from('site-media').getPublicUrl(path);
  return { ok: true as const, url: data.publicUrl };
}

type ReorderableTable =
  | 'hero_slides'
  | 'service_categories'
  | 'gallery_images'
  | 'site_sections'
  | 'financial_accounts'
  | 'expense_categories';

// Recibe el orden completo (ids) tal como quedó tras arrastrar en el admin
// (ver components/admin/*-table.tsx, framer-motion Reorder) y lo persiste
// de una sola vez — más simple y más barato que ir intercambiando de a
// pares, y es lo que un gesto de drag-and-drop produce naturalmente.
async function reorderRows(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  table: ReorderableTable,
  orderedIds: string[],
) {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from(table).update({ display_order: index }).eq('id', id),
    ),
  );

  if (results.some((r) => r.error)) return { ok: false, error: 'No se pudo reordenar.' };
  return { ok: true };
}

interface HeroSlideInput {
  mediaType: 'image' | 'video';
  imageUrl?: string | null;
  /** Obligatorio si mediaType es 'video'; imageUrl queda como poster opcional. */
  videoUrl?: string | null;
  title: string;
  subtitle?: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

function validateHeroSlideInput(input: HeroSlideInput): string | null {
  if (!input.title.trim()) return 'El título es obligatorio.';
  if (input.mediaType === 'video') {
    if (!input.videoUrl) return 'Sube el video.';
  } else if (!input.imageUrl) {
    return 'La imagen es obligatoria.';
  }
  return null;
}

function heroSlideDbFields(input: HeroSlideInput) {
  return {
    media_type: input.mediaType,
    image_url: input.imageUrl || null,
    video_url: input.mediaType === 'video' ? input.videoUrl || null : null,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    description: input.description.trim(),
    cta_label: input.ctaLabel.trim() || 'Reservar cita',
    cta_href: input.ctaHref.trim() || '/reservar',
  };
}

export async function createHeroSlide(input: HeroSlideInput) {
  const supabase = await requireUser();

  const validationError = validateHeroSlideInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { count } = await supabase.from('hero_slides').select('id', { count: 'exact', head: true });

  const { error } = await supabase
    .from('hero_slides')
    .insert({ ...heroSlideDbFields(input), display_order: count ?? 0 });

  if (error) return { ok: false, error: 'No se pudo crear la diapositiva.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateHeroSlide(id: string, input: HeroSlideInput) {
  const supabase = await requireUser();

  const validationError = validateHeroSlideInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await supabase
    .from('hero_slides')
    .update(heroSlideDbFields(input))
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la diapositiva.' };

  revalidateContenido();
  return { ok: true };
}

export async function setHeroSlideActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('hero_slides').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la diapositiva.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteHeroSlide(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('hero_slides').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la diapositiva.' };
  revalidateContenido();
  return { ok: true };
}

export async function reorderHeroSlides(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'hero_slides', orderedIds);
  revalidateContenido();
  return result;
}

interface ServiceCategoryInput {
  name: string;
  description: string;
  imageUrl: string;
  features: string[];
}

export async function createServiceCategory(input: ServiceCategoryInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };
  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };

  const { count } = await supabase
    .from('service_categories')
    .select('id', { count: 'exact', head: true });

  const { error } = await supabase.from('service_categories').insert({
    name: input.name.trim(),
    description: input.description.trim(),
    image_url: input.imageUrl,
    features: input.features.filter((f) => f.trim()).map((f) => f.trim()),
    display_order: count ?? 0,
  });

  if (error) return { ok: false, error: 'No se pudo crear la categoría.' };

  revalidateContenido();
  revalidateServices();
  return { ok: true };
}

export async function updateServiceCategory(id: string, input: ServiceCategoryInput) {
  const supabase = await requireUser();

  if (!input.name.trim()) return { ok: false, error: 'El nombre es obligatorio.' };
  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };

  const { error } = await supabase
    .from('service_categories')
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      image_url: input.imageUrl,
      features: input.features.filter((f) => f.trim()).map((f) => f.trim()),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la categoría.' };

  revalidateContenido();
  revalidateServices();
  return { ok: true };
}

export async function setServiceCategoryActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('service_categories').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la categoría.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteServiceCategory(id: string) {
  const supabase = await requireUser();
  // category_id usa "on delete set null": los servicios que la usaban quedan
  // sin categoría de marketing, pero siguen agendables sin problema.
  const { error } = await supabase.from('service_categories').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la categoría.' };
  revalidateContenido();
  revalidateServices();
  return { ok: true };
}

export async function reorderServiceCategories(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'service_categories', orderedIds);
  revalidateContenido();
  return result;
}

interface GalleryImageInput {
  imageUrl: string;
  altText: string;
  category: string;
}

export async function createGalleryImage(input: GalleryImageInput) {
  const supabase = await requireUser();

  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };
  if (!input.category.trim()) return { ok: false, error: 'La categoría es obligatoria.' };

  const { count } = await supabase.from('gallery_images').select('id', { count: 'exact', head: true });

  const { error } = await supabase.from('gallery_images').insert({
    image_url: input.imageUrl,
    alt_text: input.altText.trim() || input.category.trim(),
    category: input.category.trim(),
    display_order: count ?? 0,
  });

  if (error) return { ok: false, error: 'No se pudo agregar la imagen.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateGalleryImage(id: string, input: GalleryImageInput) {
  const supabase = await requireUser();

  if (!input.imageUrl) return { ok: false, error: 'La imagen es obligatoria.' };
  if (!input.category.trim()) return { ok: false, error: 'La categoría es obligatoria.' };

  const { error } = await supabase
    .from('gallery_images')
    .update({
      image_url: input.imageUrl,
      alt_text: input.altText.trim() || input.category.trim(),
      category: input.category.trim(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la imagen.' };

  revalidateContenido();
  return { ok: true };
}

export async function setGalleryImageActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('gallery_images').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la imagen.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteGalleryImage(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('gallery_images').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la imagen.' };
  revalidateContenido();
  return { ok: true };
}

export async function reorderGalleryImages(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'gallery_images', orderedIds);
  revalidateContenido();
  return result;
}

interface PromotionInput {
  title: string;
  body: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  requiresBirthday: boolean;
  /** Si es true, la imagen ya trae el texto diseñado — body es opcional. */
  imageOnly: boolean;
  /** Fechas simples 'YYYY-MM-DD' (hora de Bogotá), no ISO — se convierten acá. */
  startsAt?: string | null;
  endsAt?: string | null;
}

function validatePromotionInput(input: PromotionInput): string | null {
  if (!input.title.trim()) return 'El título es obligatorio.';
  if (input.imageOnly) {
    if (!input.imageUrl) return 'Sube la imagen — el texto de la promo va incluido en ella.';
  } else if (!input.body.trim()) {
    return 'El texto es obligatorio.';
  }
  return null;
}

function promotionDbFields(input: PromotionInput) {
  return {
    title: input.title.trim(),
    body: input.body.trim() || null,
    image_url: input.imageUrl || null,
    cta_label: input.ctaLabel?.trim() || null,
    cta_href: input.ctaHref?.trim() || null,
    requires_birthday: input.requiresBirthday,
    image_only: input.imageOnly,
    // starts_at cuenta desde el inicio del día; ends_at hasta el final del
    // día, para que una promo que "termina hoy" siga vigente todo hoy.
    starts_at: input.startsAt ? bogotaWallTimeToUtc(input.startsAt, '00:00').toISOString() : null,
    ends_at: input.endsAt ? bogotaWallTimeToUtc(input.endsAt, '23:59').toISOString() : null,
  };
}

export async function createPromotion(input: PromotionInput) {
  const supabase = await requireUser();

  const validationError = validatePromotionInput(input);
  if (validationError) return { ok: false, error: validationError };

  // active queda en false por defecto (ver 0007): crear una promo no la
  // publica sola, Manu la activa aparte una vez está lista.
  const { error } = await supabase.from('promotions').insert(promotionDbFields(input));

  if (error) return { ok: false, error: 'No se pudo crear la promoción.' };

  revalidateContenido();
  return { ok: true };
}

export async function updatePromotion(id: string, input: PromotionInput) {
  const supabase = await requireUser();

  const validationError = validatePromotionInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await supabase
    .from('promotions')
    .update(promotionDbFields(input))
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la promoción.' };

  revalidateContenido();
  return { ok: true };
}

export async function setPromotionActive(id: string, active: boolean) {
  const supabase = await requireUser();

  if (active) {
    // Solo una promo activa a la vez (índice único parcial en 0007) — se
    // desactivan las demás primero para no chocar contra esa restricción.
    const { error: deactivateError } = await supabase
      .from('promotions')
      .update({ active: false })
      .neq('id', id)
      .eq('active', true);
    if (deactivateError) return { ok: false, error: 'No se pudo activar la promoción.' };
  }

  const { error } = await supabase.from('promotions').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la promoción.' };

  revalidateContenido();
  return { ok: true };
}

export async function deletePromotion(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la promoción.' };
  revalidateContenido();
  return { ok: true };
}

interface SiteSettingsInput {
  logoUrl?: string | null;
  phoneDisplay?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  footerTagline?: string | null;
  aboutIntro?: string | null;
  founderName?: string | null;
  founderBio?: string | null;
  founderRoles: string[];
  founderImageUrl1?: string | null;
  founderImageUrl2?: string | null;
  missionText?: string | null;
  visionText?: string | null;
}

// site_settings es una tabla singleton (id boolean, siempre `true` — ver
// 0009_site_settings.sql), así que "actualizar" es siempre sobre esa
// única fila. No hay create/delete: la fila la siembra la migración.
export async function updateSiteSettings(input: SiteSettingsInput) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('site_settings')
    .update({
      logo_url: input.logoUrl || null,
      phone_display: input.phoneDisplay?.trim() || null,
      whatsapp_number: input.whatsappNumber?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      instagram_url: input.instagramUrl?.trim() || null,
      facebook_url: input.facebookUrl?.trim() || null,
      footer_tagline: input.footerTagline?.trim() || null,
      about_intro: input.aboutIntro?.trim() || null,
      founder_name: input.founderName?.trim() || null,
      founder_bio: input.founderBio?.trim() || null,
      founder_roles: input.founderRoles.filter((r) => r.trim()).map((r) => r.trim()),
      founder_image_url_1: input.founderImageUrl1 || null,
      founder_image_url_2: input.founderImageUrl2 || null,
      mission_text: input.missionText?.trim() || null,
      vision_text: input.visionText?.trim() || null,
    })
    .eq('id', true);

  if (error) return { ok: false, error: 'No se pudo guardar la configuración.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateThemeColors(input: { ink: string; sand: string; teal: string }) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('site_settings')
    .update({ theme_ink: input.ink, theme_sand: input.sand, theme_teal: input.teal })
    .eq('id', true);

  if (error) return { ok: false, error: 'No se pudo guardar los colores.' };

  revalidateContenido();
  return { ok: true };
}

export async function resetThemeColors() {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('site_settings')
    .update({ theme_ink: null, theme_sand: null, theme_teal: null })
    .eq('id', true);

  if (error) return { ok: false, error: 'No se pudo restaurar los colores.' };

  revalidateContenido();
  return { ok: true };
}

// ============================================================
// site_sections — bloques "foto de fondo + texto" del home. Mismo molde
// exacto que hero_slides (createHeroSlide/updateHeroSlide más arriba).
// ============================================================

interface SiteSectionInput {
  title: string;
  body: string;
  mediaType: 'image' | 'video' | 'color';
  imageUrl?: string | null;
  videoUrl?: string | null;
  bgColor?: string | null;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  ctaLabel?: string | null;
  ctaHref?: string | null;
}

function validateSiteSectionInput(input: SiteSectionInput): string | null {
  if (!input.title.trim()) return 'El título es obligatorio.';
  if (!input.body.trim()) return 'El texto es obligatorio.';
  if (input.mediaType === 'video') {
    if (!input.videoUrl) return 'Sube el video.';
  } else if (input.mediaType === 'color') {
    if (!input.bgColor) return 'Elige un color de fondo.';
  } else if (!input.imageUrl) {
    return 'La imagen es obligatoria.';
  }
  return null;
}

function siteSectionDbFields(input: SiteSectionInput) {
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    media_type: input.mediaType,
    image_url: input.mediaType !== 'color' ? input.imageUrl || null : null,
    video_url: input.mediaType === 'video' ? input.videoUrl || null : null,
    bg_color: input.mediaType === 'color' ? input.bgColor || null : null,
    text_color: input.textColor,
    text_align: input.textAlign,
    cta_label: input.ctaLabel?.trim() || null,
    cta_href: input.ctaHref?.trim() || null,
  };
}

export async function createSiteSection(input: SiteSectionInput) {
  const supabase = await requireUser();

  const validationError = validateSiteSectionInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { count } = await supabase.from('site_sections').select('id', { count: 'exact', head: true });

  // Siempre 'editorial': las filas marcador (servicios/sobre-nosotros/...)
  // solo se crean por la migración de siembra, nunca desde este formulario.
  const { error } = await supabase
    .from('site_sections')
    .insert({ ...siteSectionDbFields(input), kind: 'editorial', display_order: count ?? 0 });

  if (error) return { ok: false, error: 'No se pudo crear la sección.' };

  revalidateContenido();
  return { ok: true };
}

export async function updateSiteSection(id: string, input: SiteSectionInput) {
  const supabase = await requireUser();

  const validationError = validateSiteSectionInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await supabase
    .from('site_sections')
    .update(siteSectionDbFields(input))
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la sección.' };

  revalidateContenido();
  return { ok: true };
}

export async function setSiteSectionActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('site_sections').update({ active }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo actualizar la sección.' };
  revalidateContenido();
  return { ok: true };
}

export async function deleteSiteSection(id: string) {
  const supabase = await requireUser();

  // Las filas marcador (servicios/sobre-nosotros/misión-visión/galería) no
  // se pueden borrar — solo desactivar. Si se borraran, esa sección
  // desaparecería del home sin forma de recuperarla desde el admin.
  const { data: section } = await supabase
    .from('site_sections')
    .select('kind')
    .eq('id', id)
    .maybeSingle();

  if (section && section.kind !== 'editorial') {
    return { ok: false, error: 'Esta sección no se puede eliminar, solo desactivar.' };
  }

  const { error } = await supabase.from('site_sections').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar la sección.' };
  revalidateContenido();
  return { ok: true };
}

export async function reorderSiteSections(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'site_sections', orderedIds);
  revalidateContenido();
  return result;
}

// ---------------------------------------------------------------------------
// Finanzas (/admin/finanzas) — modelo de la migración 0016
// ---------------------------------------------------------------------------
// Tres números que antes eran uno solo y no hay que volver a confundir:
//   · Utilidad del negocio (P&L) = ingresos operativos − gastos operativos.
//     RETIRO y APORTE **no** entran.
//   · Caja disponible = acumulado histórico real; RETIRO y APORTE **sí** entran.
//   · Retirado en el mes = Σ RETIRO.
// Un retiro no es un gasto: es utilidad ya ganada que cambia de bolsillo.
// La agregación vive en lib/finance/queries.ts; acá solo se escribe.

function revalidateFinanzas() {
  revalidatePath('/admin/finanzas');
}

const DATE_STR_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_STR_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Los montos son pesos colombianos enteros: no hay centavos en COP. */
function normalizeAmount(amount: number): number | null {
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  return rounded > 0 ? rounded : null;
}

function isValidDateStr(value: string): boolean {
  if (!DATE_STR_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  // Se valida con getters UTC sobre Date.UTC: el proceso corre en UTC y los
  // getters locales darían otro día. Atrapa cosas como '2026-02-31'.
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

export interface FinancialMovementInput {
  /** 'YYYY-MM-DD'. `movement_date` es un `date` simple, sin hora ni zona. */
  movementDate: string;
  kind: MovementKind;
  amount: number;
  accountId?: string | null;
  /** Solo se guarda en kind='GASTO'; en el resto se limpia. */
  categoryId?: string | null;
  description?: string | null;
  recurringTemplateId?: string | null;
}

const MOVEMENT_KINDS: MovementKind[] = ['INGRESO_OTRO', 'GASTO', 'RETIRO', 'APORTE'];

type MovementRow = {
  movement_date: string;
  kind: MovementKind;
  amount: number;
  account_id: string | null;
  category_id: string | null;
  description: string | null;
  recurring_template_id: string | null;
};

function buildMovementRow(
  input: FinancialMovementInput,
): { ok: true; row: MovementRow } | { ok: false; error: string } {
  if (!MOVEMENT_KINDS.includes(input.kind)) {
    return { ok: false, error: 'Tipo de movimiento inválido.' };
  }
  if (!isValidDateStr(input.movementDate)) {
    return { ok: false, error: 'La fecha no es válida.' };
  }

  const amount = normalizeAmount(input.amount);
  if (amount === null) return { ok: false, error: 'El monto debe ser mayor a cero.' };

  return {
    ok: true,
    row: {
      movement_date: input.movementDate,
      kind: input.kind,
      amount,
      account_id: input.accountId || null,
      // Una categoría de gasto en un retiro o en un ingreso no significa nada
      // y ensuciaría el desglose por categoría: se descarta en silencio.
      category_id: input.kind === 'GASTO' ? input.categoryId || null : null,
      description: input.description?.trim() || null,
      recurring_template_id: input.recurringTemplateId || null,
    },
  };
}

export async function createFinancialMovement(input: FinancialMovementInput) {
  const supabase = await requireUser();

  const built = buildMovementRow(input);
  if (!built.ok) return { ok: false, error: built.error };

  const { error } = await supabase.from('financial_movements').insert(built.row);
  if (error) return { ok: false, error: 'No se pudo registrar el movimiento.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function updateFinancialMovement(id: string, input: FinancialMovementInput) {
  const supabase = await requireUser();

  const built = buildMovementRow(input);
  if (!built.ok) return { ok: false, error: built.error };

  const { error } = await supabase
    .from('financial_movements')
    .update(built.row)
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el movimiento.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function deleteFinancialMovement(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('financial_movements').delete().eq('id', id);

  if (error) return { ok: false, error: 'No se pudo eliminar el movimiento.' };

  revalidateFinanzas();
  return { ok: true };
}

// --- Cuentas ---------------------------------------------------------------
// Sin borrado duro: `financial_movements.account_id` es `on delete restrict`
// (borrar una cuenta con movimientos descuadraría la caja en silencio) y una
// cuenta vieja sigue explicando de dónde salió la plata del histórico.

export interface FinancialAccountInput {
  name: string;
  kind: FinancialAccountKind;
  openingBalance?: number;
}

const ACCOUNT_KINDS: FinancialAccountKind[] = ['EFECTIVO', 'DIGITAL', 'BANCO', 'OTRO'];

function validateAccountInput(input: FinancialAccountInput): string | null {
  if (!input.name.trim()) return 'El nombre es obligatorio.';
  if (!ACCOUNT_KINDS.includes(input.kind)) return 'El tipo de cuenta no es válido.';
  const opening = input.openingBalance ?? 0;
  if (!Number.isFinite(opening)) return 'El saldo inicial no es válido.';
  return null;
}

export async function createFinancialAccount(input: FinancialAccountInput) {
  const supabase = await requireUser();

  const invalid = validateAccountInput(input);
  if (invalid) return { ok: false, error: invalid };

  const { data: last } = await supabase
    .from('financial_accounts')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('financial_accounts').insert({
    name: input.name.trim(),
    kind: input.kind,
    opening_balance: Math.round(input.openingBalance ?? 0),
    display_order: (last?.display_order ?? -1) + 1,
  });

  if (error) {
    // El unique en `name` es lo que hace idempotente el seed de 0016.
    if (error.code === '23505') return { ok: false, error: 'Ya existe una cuenta con ese nombre.' };
    return { ok: false, error: 'No se pudo crear la cuenta.' };
  }

  revalidateFinanzas();
  return { ok: true };
}

export async function updateFinancialAccount(id: string, input: FinancialAccountInput) {
  const supabase = await requireUser();

  const invalid = validateAccountInput(input);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase
    .from('financial_accounts')
    .update({
      name: input.name.trim(),
      kind: input.kind,
      opening_balance: Math.round(input.openingBalance ?? 0),
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe una cuenta con ese nombre.' };
    return { ok: false, error: 'No se pudo actualizar la cuenta.' };
  }

  revalidateFinanzas();
  return { ok: true };
}

export async function setFinancialAccountActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('financial_accounts').update({ active }).eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la cuenta.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function reorderFinancialAccounts(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'financial_accounts', orderedIds);
  revalidateFinanzas();
  return result;
}

// --- Categorías de gasto ---------------------------------------------------
// También sin borrado duro: aunque la FK es `on delete set null`, borrar una
// categoría dejaría huérfanos los gastos históricos y su desglose mentiría.

export interface ExpenseCategoryInput {
  name: string;
  nature: ExpenseNature;
}

const EXPENSE_NATURES: ExpenseNature[] = ['FIJO', 'VARIABLE'];

function validateCategoryInput(input: ExpenseCategoryInput): string | null {
  if (!input.name.trim()) return 'El nombre es obligatorio.';
  if (!EXPENSE_NATURES.includes(input.nature)) return 'El tipo de gasto no es válido.';
  return null;
}

export async function createExpenseCategory(input: ExpenseCategoryInput) {
  const supabase = await requireUser();

  const invalid = validateCategoryInput(input);
  if (invalid) return { ok: false, error: invalid };

  const { data: last } = await supabase
    .from('expense_categories')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('expense_categories').insert({
    name: input.name.trim(),
    nature: input.nature,
    display_order: (last?.display_order ?? -1) + 1,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe una categoría con ese nombre.' };
    return { ok: false, error: 'No se pudo crear la categoría.' };
  }

  revalidateFinanzas();
  return { ok: true };
}

export async function updateExpenseCategory(id: string, input: ExpenseCategoryInput) {
  const supabase = await requireUser();

  const invalid = validateCategoryInput(input);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase
    .from('expense_categories')
    .update({ name: input.name.trim(), nature: input.nature })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe una categoría con ese nombre.' };
    return { ok: false, error: 'No se pudo actualizar la categoría.' };
  }

  revalidateFinanzas();
  return { ok: true };
}

export async function setExpenseCategoryActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('expense_categories').update({ active }).eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la categoría.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function reorderExpenseCategories(orderedIds: string[]) {
  const supabase = await requireUser();
  const result = await reorderRows(supabase, 'expense_categories', orderedIds);
  revalidateFinanzas();
  return result;
}

// --- Gastos recurrentes ----------------------------------------------------
// Acá SÍ hay borrado duro: una plantilla es una conveniencia, no un dato
// contable. Los movimientos que generó sobreviven (`recurring_template_id` es
// `on delete set null`), así que borrarla no altera ninguna cifra.

export interface RecurringExpenseInput {
  name: string;
  amount: number;
  /** 1-28, para que la plantilla exista en todos los meses (febrero incluido). */
  dayOfMonth: number;
  categoryId?: string | null;
  accountId?: string | null;
}

function validateRecurringInput(input: RecurringExpenseInput): string | null {
  if (!input.name.trim()) return 'El nombre es obligatorio.';
  if (normalizeAmount(input.amount) === null) return 'El monto debe ser mayor a cero.';
  if (
    !Number.isInteger(input.dayOfMonth) ||
    input.dayOfMonth < 1 ||
    input.dayOfMonth > 28
  ) {
    return 'El día del mes debe estar entre 1 y 28.';
  }
  return null;
}

export async function createRecurringExpense(input: RecurringExpenseInput) {
  const supabase = await requireUser();

  const invalid = validateRecurringInput(input);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.from('recurring_expenses').insert({
    name: input.name.trim(),
    amount: normalizeAmount(input.amount)!,
    day_of_month: input.dayOfMonth,
    category_id: input.categoryId || null,
    account_id: input.accountId || null,
  });

  if (error) return { ok: false, error: 'No se pudo crear el gasto recurrente.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function updateRecurringExpense(id: string, input: RecurringExpenseInput) {
  const supabase = await requireUser();

  const invalid = validateRecurringInput(input);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase
    .from('recurring_expenses')
    .update({
      name: input.name.trim(),
      amount: normalizeAmount(input.amount)!,
      day_of_month: input.dayOfMonth,
      category_id: input.categoryId || null,
      account_id: input.accountId || null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el gasto recurrente.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function setRecurringExpenseActive(id: string, active: boolean) {
  const supabase = await requireUser();
  const { error } = await supabase.from('recurring_expenses').update({ active }).eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar el gasto recurrente.' };

  revalidateFinanzas();
  return { ok: true };
}

export async function deleteRecurringExpense(id: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);

  if (error) return { ok: false, error: 'No se pudo eliminar el gasto recurrente.' };

  revalidateFinanzas();
  return { ok: true };
}

/**
 * Registra el gasto de una plantilla recurrente en un mes concreto ('YYYY-MM').
 * No hay cron que lo haga solo, a propósito: un gasto fijo puede cambiar de
 * monto o no pagarse, y un movimiento inventado es peor que ninguno.
 *
 * El chequeo de duplicados se hace en consulta (no hay índice único: el mismo
 * gasto fijo podría legítimamente pagarse dos veces en un mes por un ajuste),
 * lo cual alcanza para un panel de un solo usuario.
 */
export async function registerRecurringExpense(templateId: string, month: string) {
  const supabase = await requireUser();

  if (!MONTH_STR_RE.test(month)) return { ok: false, error: 'El mes no es válido.' };

  const { data: template } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) return { ok: false, error: 'Ese gasto recurrente no existe.' };

  const monthStart = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(y, m, 1));
  const monthEndExclusive = `${nextMonth.getUTCFullYear()}-${String(
    nextMonth.getUTCMonth() + 1,
  ).padStart(2, '0')}-01`;

  const { count } = await supabase
    .from('financial_movements')
    .select('id', { count: 'exact', head: true })
    .eq('recurring_template_id', templateId)
    .gte('movement_date', monthStart)
    .lt('movement_date', monthEndExclusive);

  if ((count ?? 0) > 0) {
    return { ok: false, error: 'Ese gasto ya está registrado este mes.' };
  }

  const { error } = await supabase.from('financial_movements').insert({
    movement_date: `${month}-${String(template.day_of_month).padStart(2, '0')}`,
    kind: 'GASTO',
    amount: template.amount,
    account_id: template.account_id,
    category_id: template.category_id,
    description: template.name,
    recurring_template_id: template.id,
  });

  if (error) return { ok: false, error: 'No se pudo registrar el gasto.' };

  revalidateFinanzas();
  return { ok: true };
}

// La tabla `expenses` quedó MUERTA con la migración 0016: se conserva intacta
// (regla aditiva del proyecto, los dos proyectos de Supabase tienen datos
// reales) pero nadie la lee ni le escribe — sus filas se copiaron a
// `financial_movements` con kind='GASTO' y `legacy_expense_id`. Las acciones
// de compatibilidad `createExpense`/`updateExpense`/`deleteExpense` se
// eliminaron junto con la UI que las usaba (`expenses-table.tsx`,
// `expense-form-dialog.tsx`): un export de un archivo 'use server' es un
// endpoint público, y no tiene sentido mantener tres que nadie llama.
// Todo gasto nuevo entra por `createFinancialMovement` con kind='GASTO'.

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/admin', 'layout');
}

// ---------------------------------------------------------------------------
// Notificaciones (/admin/notificaciones)
// ---------------------------------------------------------------------------

function revalidateNotificaciones() {
  revalidatePath('/admin/notificaciones');
}

export async function updateNotificationTemplate(
  id: string,
  input: { subject: string | null; body: string },
) {
  const supabase = await requireUser();

  if (!input.body.trim()) {
    return { ok: false, error: 'El mensaje no puede quedar vacío.' };
  }

  const { error } = await supabase
    .from('notification_templates')
    .update({
      subject: input.subject?.trim() || null,
      body: input.body.trim(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo guardar la plantilla.' };

  revalidateNotificaciones();
  return { ok: true };
}

export async function setNotificationTemplateEnabled(id: string, enabled: boolean) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('notification_templates')
    .update({ enabled })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo actualizar la plantilla.' };

  revalidateNotificaciones();
  return { ok: true };
}

export async function updateNotificationSettings(input: {
  adminEmail: string;
  adminWhatsapp: string;
  businessName: string;
  emailLogoUrl: string;
  reminderHoursBefore: number;
  birthdaySendDay: number;
}) {
  const supabase = await requireUser();

  if (!input.businessName.trim()) {
    return { ok: false, error: 'El nombre del centro es obligatorio.' };
  }
  if (input.adminEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.adminEmail.trim())) {
    return { ok: false, error: 'El correo de avisos no es válido.' };
  }
  if (input.reminderHoursBefore < 1 || input.reminderHoursBefore > 168) {
    return { ok: false, error: 'La antelación debe estar entre 1 y 168 horas.' };
  }
  if (input.birthdaySendDay < 1 || input.birthdaySendDay > 28) {
    return { ok: false, error: 'El día de envío debe estar entre 1 y 28.' };
  }
  // Se valida el formato y se rechaza SVG: ningún cliente de correo
  // mayoritario lo renderiza, así que guardarlo sería configurar un logo que
  // en la práctica no se ve (ver buildEmailHtml en lib/notifications/templates).
  const logo = input.emailLogoUrl.trim();
  if (logo) {
    if (!/^https:\/\//i.test(logo)) {
      return { ok: false, error: 'El logo debe ser una URL https.' };
    }
    if (/\.svg(\?|#|$)/i.test(logo)) {
      return {
        ok: false,
        error: 'Los correos no pueden usar SVG (Gmail y Outlook no lo muestran). Sube el logo en PNG o JPG.',
      };
    }
  }

  const { error } = await supabase
    .from('notification_settings')
    .update({
      admin_email: input.adminEmail.trim() || null,
      admin_whatsapp: input.adminWhatsapp.trim() || null,
      business_name: input.businessName.trim(),
      email_logo_url: logo || null,
      reminder_hours_before: input.reminderHoursBefore,
      birthday_send_day: input.birthdaySendDay,
    })
    .eq('id', true);

  if (error) return { ok: false, error: 'No se pudo guardar la configuración.' };

  revalidateNotificaciones();
  return { ok: true };
}

/**
 * Bandeja asistida de WhatsApp: Manu abre el link wa.me, manda el mensaje y
 * marca la notificación acá. No hay forma de confirmarlo automáticamente
 * mientras no exista la integración con la Cloud API — por eso es manual.
 */
export async function markWhatsAppNotificationSent(id: string) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('notifications')
    .update({ status: 'ENVIADO', sent_at: new Date().toISOString(), error: null })
    .eq('id', id)
    .eq('channel', 'whatsapp');

  if (error) return { ok: false, error: 'No se pudo marcar como enviado.' };

  revalidateNotificaciones();
  return { ok: true };
}

/** Descarta una notificación de WhatsApp pendiente sin enviarla. */
export async function skipWhatsAppNotification(id: string) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('notifications')
    .update({ status: 'OMITIDO', error: 'Descartada manualmente desde el panel.' })
    .eq('id', id)
    .eq('channel', 'whatsapp');

  if (error) return { ok: false, error: 'No se pudo descartar el mensaje.' };

  revalidateNotificaciones();
  return { ok: true };
}

/**
 * Vuelve a poner una notificación FALLIDO/OMITIDO en la cola y la despacha.
 *
 * Hace dos cosas más que un simple `update status='PENDIENTE'`, y las dos
 * nacen de que ahora existen filas OMITIDO por falta de destinatario:
 *
 * 1. RE-RESUELVE el correo/teléfono contra la ficha de la clienta. El caso
 *    típico es justamente ese: la notificación quedó OMITIDA porque la
 *    clienta no tenía correo, Manu se lo pidió por WhatsApp, lo cargó en la
 *    ficha y ahora reintenta. Sin esto, la fila seguiría con `to_email` en
 *    null y volvería a omitirse para siempre. Solo aplica a los mensajes
 *    `recipient_kind = 'client'`: en los internos el `client_id` apunta a la
 *    clienta de la cita, y copiarle su correo a Manu sería mandarle el aviso
 *    interno a la persona equivocada.
 *
 * 2. Si SIGUE sin destinatario, la deja OMITIDA con el mismo motivo en vez de
 *    dejarla colgada en PENDIENTE. Es importante en WhatsApp: el despachador
 *    no mira ese canal (`sendsAutomatically = false`), así que una fila
 *    PENDIENTE sin teléfono se quedaría para siempre en la bandeja asistida
 *    con un botón de wa.me que no lleva a ningún lado.
 */
export async function retryNotification(id: string) {
  const supabase = await requireUser();

  const { data: notification } = await supabase
    .from('notifications')
    .select('id, channel, recipient_kind, client_id, to_email, to_phone')
    .eq('id', id)
    .maybeSingle();

  if (!notification) return { ok: false, error: 'No se encontró la notificación.' };

  let toEmail: string | null = notification.to_email;
  let toPhone: string | null = notification.to_phone;

  if (notification.recipient_kind === 'client' && notification.client_id && (!toEmail || !toPhone)) {
    const { data: client } = await supabase
      .from('clients')
      .select('email, phone')
      .eq('id', notification.client_id)
      .maybeSingle();

    toEmail = toEmail || client?.email?.trim() || null;
    toPhone = toPhone || client?.phone?.trim() || null;
  }

  const missing = missingRecipientReason(
    notification.channel,
    notification.recipient_kind,
    toEmail,
    toPhone,
  );

  if (missing) {
    await supabase
      .from('notifications')
      .update({ status: 'OMITIDO', error: missing })
      .eq('id', id);

    revalidateNotificaciones();
    return { ok: false, error: `No se puede reintentar: ${missing}` };
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      status: 'PENDIENTE',
      scheduled_for: new Date().toISOString(),
      to_email: toEmail,
      to_phone: toPhone,
      error: null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'No se pudo reintentar el envío.' };

  await dispatchQuietly(supabase);

  revalidateNotificaciones();
  return { ok: true };
}

/**
 * Manda un correo de prueba con la plantilla elegida y valores de ejemplo.
 * Es la única forma de verificar que Resend y el dominio están bien
 * configurados sin tener que reservar una cita de mentiras.
 */
export async function sendTestNotificationEmail(templateId: string, toOverride?: string) {
  const supabase = await requireUser();

  const configIssue = emailConfigurationIssue();
  if (configIssue) return { ok: false, error: configIssue };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: template } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) return { ok: false, error: 'No se encontró la plantilla.' };
  if (template.channel !== 'email') {
    return { ok: false, error: 'Solo se pueden probar las plantillas de correo.' };
  }

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('admin_email, business_name, email_logo_url')
    .eq('id', true)
    .maybeSingle();

  const to = toOverride?.trim() || settings?.admin_email || user?.email;
  if (!to) {
    return {
      ok: false,
      error: 'No hay a dónde mandar la prueba: configura el correo de avisos.',
    };
  }

  const businessName = settings?.business_name || 'Centro Estético Manuj';
  const rendered = renderTemplate(template, PREVIEW_VARS, {
    businessName,
    logoUrl: settings?.email_logo_url ?? null,
  });

  const result = await sendRawEmail({
    to,
    subject: `[PRUEBA] ${rendered.subject ?? businessName}`,
    html: rendered.body,
    text: rendered.text,
  });

  if ('skipped' in result) return { ok: false, error: result.reason };
  if ('deferred' in result) return { ok: false, error: 'El canal no envía automáticamente.' };
  if (!result.ok) return { ok: false, error: `Resend rechazó el envío: ${result.error}` };

  return { ok: true, sentTo: to };
}

/** Permite marcar/desmarcar a una clienta como "no quiero correos de marketing". */
export async function setClientMarketingOptOut(clientId: string, optOut: boolean) {
  const supabase = await requireUser();

  const { error } = await supabase
    .from('clients')
    .update({ marketing_opt_out: optOut })
    .eq('id', clientId);

  if (error) return { ok: false, error: 'No se pudo actualizar la preferencia.' };

  revalidatePath('/admin/clientes');
  revalidatePath(`/admin/clientes/${clientId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Campañas (/admin/notificaciones → Campañas) — migración 0017
// ---------------------------------------------------------------------------
// Una campaña es una promoción con flyer que Manu le manda a un segmento de
// clientas. NO inventa un mecanismo de envío nuevo: encola una fila por
// destinataria en el mismo outbox de siempre (`notifications`, con
// `event='campaign'` y `campaign_id`), así que hereda el despachador, el
// claim atómico, el `dedupe_key` y el historial.
//
// El correo lleva el flyer EMBEBIDO; WhatsApp lleva texto + el link público
// al flyer, porque un deep link `wa.me` no puede adjuntar imágenes (WhatsApp
// arma la vista previa del link solo). El envío de WhatsApp sigue siendo
// asistido, como todo el WhatsApp del proyecto.
//
// Es MARKETING (Ley 1581 de 2012): la audiencia excluye siempre a quien tenga
// `marketing_opt_out`, y el mensaje lleva línea de baja en los dos canales.

export interface CampaignInput {
  title: string;
  subject: string | null;
  body: string;
  flyerImageUrl: string | null;
  channels: NotificationChannel[];
  audience: CampaignAudience;
}

const CAMPAIGN_CHANNELS: NotificationChannel[] = ['email', 'whatsapp'];

/**
 * Valida el flyer. Se hace tres veces (al subir, al guardar y al enviar) a
 * propósito: la URL también se puede pegar a mano, y mandar 60 correos con
 * una imagen que no se ve no tiene vuelta atrás.
 */
function validateFlyerUrl(url: string | null): string | null {
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) return 'El flyer debe ser una URL https.';
  if (/\.svg(\?|#|$)/i.test(url)) {
    return 'Los correos no muestran SVG (Gmail y Outlook lo bloquean). Sube el flyer en PNG o JPG.';
  }
  return null;
}

/** Validación común de crear y editar. Devuelve el error en español, o `null`. */
function validateCampaignInput(input: CampaignInput): string | null {
  if (!input.title.trim()) return 'Ponle un nombre a la campaña.';
  if (!input.body.trim()) return 'El mensaje no puede quedar vacío.';

  const channels = input.channels.filter((c) => CAMPAIGN_CHANNELS.includes(c));
  if (channels.length === 0) return 'Elige al menos un canal (correo o WhatsApp).';
  if (channels.includes('email') && !input.subject?.trim()) {
    return 'El correo necesita un asunto.';
  }

  const flyerIssue = validateFlyerUrl(input.flyerImageUrl?.trim() || null);
  if (flyerIssue) return flyerIssue;

  if (!parseCampaignAudience(input.audience)) return INVALID_AUDIENCE_ERROR;

  return null;
}

function campaignDbFields(input: CampaignInput) {
  return {
    title: input.title.trim(),
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    flyer_image_url: input.flyerImageUrl?.trim() || null,
    // Se normaliza el orden y se quitan repetidos: `channels` es un conjunto.
    channels: CAMPAIGN_CHANNELS.filter((c) => input.channels.includes(c)),
    audience: parseCampaignAudience(input.audience),
  };
}

export async function createCampaign(input: CampaignInput) {
  const supabase = await requireUser();

  const issue = validateCampaignInput(input);
  if (issue) return { ok: false as const, error: issue };

  const { data, error } = await supabase
    .from('campaigns')
    .insert({ ...campaignDbFields(input), status: 'BORRADOR' })
    .select('id')
    .maybeSingle();

  if (error || !data) return { ok: false as const, error: 'No se pudo crear la campaña.' };

  revalidateNotificaciones();
  return { ok: true as const, id: data.id as string };
}

/** Solo se edita un BORRADOR: una campaña ENVIADA es histórico de lo que salió. */
export async function updateCampaign(id: string, input: CampaignInput) {
  const supabase = await requireUser();

  const issue = validateCampaignInput(input);
  if (issue) return { ok: false as const, error: issue };

  const { data, error } = await supabase
    .from('campaigns')
    .update(campaignDbFields(input))
    .eq('id', id)
    .eq('status', 'BORRADOR')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false as const, error: 'No se pudo guardar la campaña.' };
  if (!data) {
    return {
      ok: false as const,
      error: 'Esta campaña ya se envió: no se puede editar lo que las clientas recibieron.',
    };
  }

  revalidateNotificaciones();
  return { ok: true as const };
}

/** Borra un BORRADOR. Una campaña ENVIADA no se borra: es el historial. */
export async function deleteCampaign(id: string) {
  const supabase = await requireUser();

  const { data, error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('status', 'BORRADOR')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false as const, error: 'No se pudo eliminar la campaña.' };
  if (!data) {
    return {
      ok: false as const,
      error: 'Una campaña ya enviada no se elimina: queda como historial.',
    };
  }

  revalidateNotificaciones();
  return { ok: true as const };
}

/**
 * Alcance del segmento ANTES de enviar. La UI lo muestra al elegir la
 * audiencia: con 40 de 59 clientas sin correo, `reachableByEmail` es la
 * diferencia entre una expectativa y una decepción.
 */
export async function previewCampaignAudience(audience: CampaignAudience) {
  const supabase = await requireUser();

  const parsed = parseCampaignAudience(audience);
  if (!parsed) return { ok: false as const, error: INVALID_AUDIENCE_ERROR };

  try {
    const stats = await getCampaignAudienceStats(supabase, parsed);
    return { ok: true as const, ...stats };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof CampaignAudienceError
          ? err.message
          : 'No se pudo calcular el alcance de la campaña.',
    };
  }
}

/**
 * Resuelve la audiencia, encola un mensaje por destinataria y canal, y marca
 * la campaña como ENVIADA.
 *
 * DOS PROTECCIONES CONTRA EL DOBLE ENVÍO, y hacen falta las dos:
 *   · El claim atómico `update ... where status='BORRADOR' returning`, igual
 *     que el del despachador. Dos clics seguidos en "Enviar" son dos
 *     ejecuciones en paralelo: la segunda no encuentra el BORRADOR y se cae
 *     acá, antes de encolar nada.
 *   · El índice único sobre `dedupe_key` (`campaign:<id>:<clienta>:<canal>`),
 *     que ataja cualquier otro camino.
 * Si el encolado falla, la campaña vuelve a BORRADOR: quedaría marcada como
 * enviada sin haberle escrito a nadie.
 */
export async function sendCampaign(campaignId: string) {
  const supabase = await requireUser();

  const { data: campaignRow } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaignRow) return { ok: false as const, error: 'No se encontró la campaña.' };

  const campaign = campaignRow as Campaign;

  if (campaign.status === 'ENVIADA') {
    return {
      ok: false as const,
      error: 'Esta campaña ya se envió. Duplica la campaña si quieres volver a mandarla.',
    };
  }

  const issue = validateCampaignInput({
    title: campaign.title,
    subject: campaign.subject,
    body: campaign.body,
    flyerImageUrl: campaign.flyer_image_url,
    channels: campaign.channels ?? [],
    audience: campaign.audience,
  });
  if (issue) return { ok: false as const, error: issue };

  const audience = parseCampaignAudience(campaign.audience);
  if (!audience) return { ok: false as const, error: INVALID_AUDIENCE_ERROR };

  let recipients;
  try {
    recipients = await resolveCampaignAudience(supabase, audience);
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof CampaignAudienceError
          ? err.message
          : 'No se pudieron resolver las destinatarias.',
    };
  }

  if (recipients.length === 0) {
    return {
      ok: false as const,
      error:
        'No hay ninguna destinataria en este segmento (recuerda que se excluye a quienes pidieron no recibir promociones).',
    };
  }

  // Claim atómico: quien se lleva el BORRADOR es quien envía.
  const { data: claimed, error: claimError } = await supabase
    .from('campaigns')
    .update({ status: 'ENVIADA', sent_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('status', 'BORRADOR')
    .select('id')
    .maybeSingle();

  if (claimError) return { ok: false as const, error: 'No se pudo enviar la campaña.' };
  if (!claimed) {
    return { ok: false as const, error: 'Esta campaña ya se está enviando o ya se envió.' };
  }

  const context = await loadNotificationContext(supabase);
  const result = await enqueueCampaign(supabase, context, campaign, recipients);

  if (!result.ok) {
    await supabase
      .from('campaigns')
      .update({ status: 'BORRADOR', sent_at: null })
      .eq('id', campaignId);

    return {
      ok: false as const,
      error: 'No se pudieron encolar los mensajes. La campaña sigue en borrador.',
    };
  }

  await supabase
    .from('campaigns')
    .update({ recipient_count: result.recipients })
    .eq('id', campaignId);

  // Los correos salen por el despachador; los de WhatsApp se quedan
  // PENDIENTE en la bandeja asistida (su canal no envía solo).
  await dispatchQuietly(supabase);

  revalidateNotificaciones();
  return {
    ok: true as const,
    recipientCount: result.recipients,
    queuedEmail: result.queuedEmail,
    queuedWhatsapp: result.queuedWhatsapp,
    skipped: result.skipped,
  };
}
