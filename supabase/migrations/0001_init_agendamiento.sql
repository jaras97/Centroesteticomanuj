-- Fase 1 — Sistema de agendamiento (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Requisito previo: Database → Extensions → activar "pg_cron" ANTES de correr este archivo.
-- Este script es idempotente (se puede re-correr sin errores) mientras el
-- proyecto no tenga datos reales — útil mientras se itera en dev.

-- ============================================================
-- Limpieza (solo relevante en reintentos durante desarrollo)
-- ============================================================
do $$
begin
  perform cron.unschedule('expire-stale-appointments');
exception when others then
  null;
end $$;

drop table if exists public.appointments cascade;
drop table if exists public.blocked_slots cascade;
drop table if exists public.availability cascade;
drop table if exists public.clients cascade;
drop table if exists public.services cascade;
drop type if exists public.appointment_status cascade;

-- ============================================================
-- Extensiones
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- Enum de estados
-- ============================================================
create type public.appointment_status as enum (
  'SOLICITADA',
  'ESPERANDO_ANTICIPO',
  'CONFIRMADA',
  'COMPLETADA',
  'CANCELADA',
  'NO_ASISTIO',
  'EXPIRADA'
);

-- ============================================================
-- services
-- ============================================================
create table public.services (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  duration_min   int not null check (duration_min > 0),
  buffer_min     int not null default 0 check (buffer_min >= 0),
  price          int,
  deposit_amount int,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Placeholder: ajustar duración/precio/anticipo reales en Supabase Studio.
insert into public.services (name, duration_min, buffer_min) values
  ('Maquillaje social', 90, 15),
  ('Maquillaje artístico', 120, 15),
  ('Tratamientos faciales personalizados', 60, 15),
  ('Lifting de pestañas', 45, 15),
  ('Laminado de cejas', 45, 15),
  ('Hidralips', 30, 10);

-- ============================================================
-- clients
-- ============================================================
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null unique,
  email      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- availability (plantilla semanal)
-- ============================================================
create table public.availability (
  id          uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=domingo .. 6=sábado (Date.getDay())
  start_time  time not null,
  end_time    time not null,
  active      boolean not null default true,
  check (end_time > start_time)
);

-- Placeholder: ajustar horario real de Manu en Supabase Studio.
insert into public.availability (day_of_week, start_time, end_time) values
  (2,'09:00','13:00'), (2,'14:00','18:00'), -- martes
  (3,'09:00','13:00'), (3,'14:00','18:00'), -- miércoles
  (4,'09:00','13:00'), (4,'14:00','18:00'), -- jueves
  (5,'09:00','13:00'), (5,'14:00','18:00'), -- viernes
  (6,'09:00','14:00');                      -- sábado

-- ============================================================
-- blocked_slots (bloqueos puntuales)
-- ============================================================
create table public.blocked_slots (
  id         uuid primary key default gen_random_uuid(),
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index blocked_slots_range_idx on public.blocked_slots (start_at, end_at);

-- ============================================================
-- appointments
-- ============================================================
create table public.appointments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete restrict,
  service_id    uuid not null references public.services(id) on delete restrict,
  status        appointment_status not null default 'SOLICITADA',
  start_time    timestamptz not null,
  duration_min  int not null check (duration_min > 0),
  buffer_min    int not null default 0 check (buffer_min >= 0),
  -- end_time/appt_range no pueden ser columnas GENERATED: la suma
  -- timestamptz + interval es STABLE (no IMMUTABLE) en Postgres porque en
  -- general depende del TimeZone de la sesión. Se calculan con un trigger
  -- BEFORE INSERT/UPDATE en su lugar (ver más abajo).
  end_time      timestamptz not null,
  appt_range    tstzrange not null,
  client_note   text,
  reject_reason text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Impide doble reserva de horario (negocio de un solo profesional, sin resource_id).
  -- No requiere btree_gist: tstzrange tiene opclass GIST nativo.
  exclude using gist (appt_range with &&)
    where (status in ('SOLICITADA','ESPERANDO_ANTICIPO','CONFIRMADA','COMPLETADA'))
);

create index appointments_client_idx on public.appointments (client_id);
create index appointments_service_idx on public.appointments (service_id);
create index appointments_status_idx on public.appointments (status);
create index appointments_start_idx on public.appointments (start_time);

-- Máximo 1 solicitud activa por cliente, atómico a nivel de DB.
create unique index appointments_one_active_per_client
  on public.appointments (client_id)
  where (status in ('SOLICITADA','ESPERANDO_ANTICIPO'));

-- Calcula end_time/appt_range antes de insertar o de cambiar start_time,
-- duration_min o buffer_min (ej. al ajustar la duración desde el admin).
create or replace function public.set_appointment_range() returns trigger
language plpgsql as $$
begin
  new.end_time := new.start_time + make_interval(mins => new.duration_min + new.buffer_min);
  new.appt_range := tstzrange(new.start_time, new.end_time, '[)');
  return new;
end;
$$;

create trigger set_appointment_range
  before insert or update of start_time, duration_min, buffer_min
  on public.appointments
  for each row execute function public.set_appointment_range();

-- ============================================================
-- updated_at trigger compartido
-- ============================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — un solo admin autenticado tiene acceso total.
-- El flujo público nunca usa la anon key contra estas tablas: todas sus
-- lecturas/escrituras van por Server Actions con el cliente service_role
-- (que ignora RLS), con validación de app (honeypot, rate limit, dedup).
-- ============================================================
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.availability enable row level security;
alter table public.blocked_slots enable row level security;

create policy "admin_full_access" on public.clients
  for all to authenticated using (true) with check (true);
create policy "admin_full_access" on public.services
  for all to authenticated using (true) with check (true);
create policy "admin_full_access" on public.appointments
  for all to authenticated using (true) with check (true);
create policy "admin_full_access" on public.availability
  for all to authenticated using (true) with check (true);
create policy "admin_full_access" on public.blocked_slots
  for all to authenticated using (true) with check (true);

-- ============================================================
-- Expiración automática (pg_cron) — requiere activar la extensión
-- pg_cron desde Database → Extensions antes de correr este bloque.
-- ============================================================
create or replace function public.expire_stale_appointments() returns void
language sql as $$
  update public.appointments
  set status = 'EXPIRADA'
  where status in ('SOLICITADA','ESPERANDO_ANTICIPO')
    and expires_at is not null
    and expires_at < now();
$$;

select cron.schedule(
  'expire-stale-appointments',
  '*/10 * * * *',
  $$select public.expire_stale_appointments();$$
);
