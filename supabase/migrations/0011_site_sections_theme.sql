-- Fase CMS 4 — secciones editoriales (foto de fondo + texto) y colores de
-- marca parametrizables. Aditiva. Ver docs/PRD-cms-contenido-y-promociones.md
-- y el plan de rediseño de esta sesión.
-- Pegar y correr completo en el SQL Editor de Supabase Studio.

-- ============================================================
-- site_sections — bloques full-bleed "foto de fondo + texto" que se
-- muestran seguidos entre Servicios y Sobre nosotros en la home. Mismo
-- molde que hero_slides (imagen u opcionalmente video, reordenable).
-- ============================================================
create table if not exists public.site_sections (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  body           text not null,
  image_url      text,
  video_url      text,
  media_type     text not null default 'image' check (media_type in ('image', 'video')),
  text_align     text not null default 'left' check (text_align in ('left', 'center', 'right')),
  cta_label      text,
  cta_href       text,
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.site_sections enable row level security;

create policy "public_read_active" on public.site_sections
  for select to anon, authenticated using (active = true);
create policy "admin_full_access" on public.site_sections
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.site_sections;
create trigger set_updated_at before update on public.site_sections
  for each row execute function public.set_updated_at();

-- Semillas de ejemplo para que la sección no se vea vacía el primer día —
-- copy genérico, pensado para que Manu lo edite/reemplace a su gusto desde
-- /admin/contenido -> Secciones. Imágenes de Unsplash (libres de uso),
-- solo como placeholder hasta que ella suba las suyas.
insert into public.site_sections (title, body, image_url, text_align, cta_label, cta_href, display_order)
values
  (
    'La belleza es un ritual, no un evento',
    'Creemos en el cuidado constante: pequeños rituales que se acumulan en una piel más sana y una confianza que se nota todos los días, no solo para ocasiones especiales.',
    'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?q=80&w=2000&auto=format&fit=crop',
    'left',
    'Agenda tu ritual',
    '/reservar',
    0
  ),
  (
    'Técnica y sensibilidad, en igual medida',
    'Cada tratamiento combina conocimiento técnico actualizado con la atención de escuchar qué necesita realmente tu piel — no un protocolo genérico, uno pensado para ti.',
    'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=2000&auto=format&fit=crop',
    'right',
    null,
    null,
    1
  ),
  (
    'Un espacio para desconectar',
    'Más que un servicio, un momento propio: viene a cuidarte, no solo a que te maquillen o te hagan un procedimiento.',
    'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?q=80&w=2000&auto=format&fit=crop',
    'center',
    null,
    null,
    2
  )
on conflict do nothing;

-- ============================================================
-- site_settings — colores de marca opcionales. NULL = usar el default de
-- app/globals.css (:root). Solo se piden 3 tonos base al admin; las
-- variantes light/dark se derivan en lib/theme/colors.ts.
-- ============================================================
alter table public.site_settings add column if not exists theme_ink text;
alter table public.site_settings add column if not exists theme_sand text;
alter table public.site_settings add column if not exists theme_teal text;
