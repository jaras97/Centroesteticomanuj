-- Fase CMS — contenido del sitio público (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva: no borra tablas ni datos existentes (mismo criterio desde 0002).
-- Ver docs/PRD-cms-contenido-y-promociones.md para el diseño completo.

-- ============================================================
-- Storage: bucket público para imágenes del sitio (reemplaza Cloudinary)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;

drop policy if exists "public_read_site_media" on storage.objects;
create policy "public_read_site_media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'site-media');

drop policy if exists "admin_write_site_media" on storage.objects;
create policy "admin_write_site_media" on storage.objects
  for all to authenticated
  using (bucket_id = 'site-media')
  with check (bucket_id = 'site-media');

-- ============================================================
-- hero_slides — carrusel de inicio
-- ============================================================
create table if not exists public.hero_slides (
  id             uuid primary key default gen_random_uuid(),
  image_url      text not null,
  title          text not null,
  subtitle       text,
  description    text not null,
  cta_label      text not null default 'Reservar cita',
  cta_href       text not null default '/reservar',
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- service_categories — "servicios" de marketing (1 categoría agrupa
-- N servicios agendables de public.services, ver category_id más abajo).
-- ============================================================
create table if not exists public.service_categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text not null,
  image_url      text not null,
  features       jsonb not null default '[]',
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.services
  add column if not exists category_id uuid references public.service_categories(id) on delete set null;

-- ============================================================
-- gallery_images
-- ============================================================
create table if not exists public.gallery_images (
  id             uuid primary key default gen_random_uuid(),
  image_url      text not null,
  alt_text       text not null,
  category       text not null,
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- RLS — lectura pública de contenido activo (deliberadamente distinto
-- del resto de tablas, que no dan select a anon): esto es contenido de
-- marketing de solo lectura, sin lógica sensible que proteger, a
-- diferencia de clients/appointments. Escritura solo admin autenticado.
-- ============================================================
alter table public.hero_slides enable row level security;
alter table public.service_categories enable row level security;
alter table public.gallery_images enable row level security;

create policy "public_read_active" on public.hero_slides
  for select to anon, authenticated using (active = true);
create policy "admin_full_access" on public.hero_slides
  for all to authenticated using (true) with check (true);

create policy "public_read_active" on public.service_categories
  for select to anon, authenticated using (active = true);
create policy "admin_full_access" on public.service_categories
  for all to authenticated using (true) with check (true);

create policy "public_read_active" on public.gallery_images
  for select to anon, authenticated using (active = true);
create policy "admin_full_access" on public.gallery_images
  for all to authenticated using (true) with check (true);

-- ============================================================
-- updated_at trigger compartido (definido en 0001)
-- ============================================================
drop trigger if exists set_updated_at on public.hero_slides;
create trigger set_updated_at before update on public.hero_slides
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.service_categories;
create trigger set_updated_at before update on public.service_categories
  for each row execute function public.set_updated_at();
