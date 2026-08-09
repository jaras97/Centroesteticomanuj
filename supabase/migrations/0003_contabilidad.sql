-- Fase 2.1 — Contabilidad de citas y gastos (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva (como 0002): no borra tablas ni datos existentes.

-- ============================================================
-- appointments.charged_amount / payment_method — monto realmente
-- cobrado al completar una cita (puede diferir de services.price:
-- descuentos, fidelización, ajustes puntuales) y método de pago.
-- Nullable: las citas COMPLETADA previas a esta migración quedan sin
-- monto y se excluyen de las sumas de ingresos en el dashboard.
-- ============================================================
alter table public.appointments add column if not exists charged_amount int;
alter table public.appointments add column if not exists payment_method text;

-- ============================================================
-- expenses — gastos del centro estético.
-- ============================================================
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category     text not null,
  description  text,
  amount       int not null check (amount > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (expense_date);

alter table public.expenses enable row level security;

drop policy if exists "admin_full_access" on public.expenses;
create policy "admin_full_access" on public.expenses
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.expenses;
create trigger set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
