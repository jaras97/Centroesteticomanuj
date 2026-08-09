import type { createClient } from '@/lib/supabase/server';
import type { LoyaltyReward } from '@/lib/supabase/types';
import {
  LOYALTY_DISCOUNT_PERCENT,
  LOYALTY_THRESHOLD_APPOINTMENTS,
  LOYALTY_WINDOW_DAYS,
} from '@/lib/booking/config';

type AdminClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Evalúa si el cliente acumuló suficientes citas COMPLETADA (dentro de la
 * ventana móvil) desde su última recompensa y, si es así, otorga un nuevo
 * cupón. Se llama solo desde completeAppointment, justo tras marcar una
 * cita como COMPLETADA — no hay cron aparte para esto.
 */
export async function evaluateAndGrantLoyaltyReward(
  supabase: AdminClient,
  clientId: string,
  triggeringAppointmentId: string,
): Promise<{ granted: boolean }> {
  const { data: lastReward } = await supabase
    .from('loyalty_rewards')
    .select('earned_at')
    .eq('client_id', clientId)
    .order('earned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const windowStart = new Date(
    Date.now() - LOYALTY_WINDOW_DAYS * 24 * 60 * 60_000,
  ).toISOString();
  const since = lastReward?.earned_at ?? '-infinity';

  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'COMPLETADA')
    .gt('start_time', since)
    .gte('start_time', windowStart);

  if ((count ?? 0) < LOYALTY_THRESHOLD_APPOINTMENTS) {
    return { granted: false };
  }

  const { error } = await supabase.from('loyalty_rewards').insert({
    client_id: clientId,
    discount_percent: LOYALTY_DISCOUNT_PERCENT,
    source_appointment_id: triggeringAppointmentId,
  });

  return { granted: !error };
}

export interface LoyaltyStatus {
  completedSinceLastReward: number;
  threshold: number;
  windowDays: number;
  rewards: LoyaltyReward[];
}

/** Progreso actual + historial de cupones de un cliente, para su ficha. */
export async function getClientLoyaltyStatus(
  supabase: AdminClient,
  clientId: string,
): Promise<LoyaltyStatus> {
  const { data: rewards } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .eq('client_id', clientId)
    .order('earned_at', { ascending: false });

  const lastReward = rewards?.[0] ?? null;
  const windowStart = new Date(
    Date.now() - LOYALTY_WINDOW_DAYS * 24 * 60 * 60_000,
  ).toISOString();
  const since = lastReward?.earned_at ?? '-infinity';

  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'COMPLETADA')
    .gt('start_time', since)
    .gte('start_time', windowStart);

  return {
    completedSinceLastReward: Math.min(count ?? 0, LOYALTY_THRESHOLD_APPOINTMENTS),
    threshold: LOYALTY_THRESHOLD_APPOINTMENTS,
    windowDays: LOYALTY_WINDOW_DAYS,
    rewards: rewards ?? [],
  };
}

/** Cupones disponibles (no usados) de un cliente, para ofrecer al completar una cita. */
export async function getAvailableRewards(
  supabase: AdminClient,
  clientId: string,
): Promise<LoyaltyReward[]> {
  const { data } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .eq('client_id', clientId)
    .is('used_at', null)
    .order('earned_at', { ascending: true });

  return data ?? [];
}
