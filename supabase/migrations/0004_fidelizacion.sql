-- Fase 2.2 — Fidelización de clientes (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva (como 0002/0003): no borra tablas ni datos existentes.

-- ============================================================
-- loyalty_rewards — cupones de descuento otorgados por acumular citas
-- COMPLETADA dentro de una ventana móvil (ver lib/booking/config.ts:
-- LOYALTY_THRESHOLD_APPOINTMENTS / LOYALTY_WINDOW_DAYS). No se guarda
-- un contador en clients: el progreso se calcula en consulta a partir
-- de appointments + la última recompensa, igual que ya se hace para
-- detectar "cliente nuevo" en confirmAppointment.
-- ============================================================
create table if not exists public.loyalty_rewards (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients(id) on delete cascade,
  discount_percent      int not null check (discount_percent > 0 and discount_percent <= 100),
  earned_at             timestamptz not null default now(),
  source_appointment_id uuid references public.appointments(id) on delete set null,
  used_at               timestamptz,
  used_appointment_id   uuid references public.appointments(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists loyalty_rewards_client_idx on public.loyalty_rewards (client_id);

alter table public.loyalty_rewards enable row level security;

drop policy if exists "admin_full_access" on public.loyalty_rewards;
create policy "admin_full_access" on public.loyalty_rewards
  for all to authenticated using (true) with check (true);
