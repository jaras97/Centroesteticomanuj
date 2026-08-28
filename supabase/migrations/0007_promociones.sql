-- Fase CMS 2 — modal de promociones (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva. Ver docs/PRD-cms-contenido-y-promociones.md para el diseño.

create table if not exists public.promotions (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  body              text not null,
  image_url         text,
  cta_label         text,
  cta_href          text,
  requires_birthday boolean not null default false,
  active            boolean not null default false,
  starts_at         timestamptz,
  ends_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Una sola promo activa a la vez (evita apilar modales). Indexa la columna
-- "active" filtrada a las filas donde es true: como el valor indexado es el
-- mismo (true) para todas ellas, sólo puede haber una — mismo truco que
-- appointments_one_active_per_client en 0001, aplicado a "una sola en total"
-- en vez de "una por cliente".
create unique index if not exists promotions_one_active on public.promotions (active) where active;

alter table public.promotions enable row level security;

-- Lectura pública solo de la promo activa y vigente en su ventana de fechas.
create policy "public_read_active" on public.promotions
  for select to anon, authenticated
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );
create policy "admin_full_access" on public.promotions
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.promotions;
create trigger set_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();
