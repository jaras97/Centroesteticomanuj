-- Fase CMS 5 — orden unificado de secciones del home + colores por sección
-- editorial. Aditiva, sobre 0011_site_sections_theme.sql ya corrida. Ver
-- el plan de esta sesión y docs/HANDOFF-rediseno-editorial-y-theming.md.
-- Pegar y correr completo en el SQL Editor de Supabase Studio.

-- kind distingue las secciones editoriales (contenido propio: foto/video/
-- color + texto) de las filas "marcador" que representan a Servicios,
-- Sobre nosotros, Misión/Visión y Galería — esas no tienen contenido
-- propio acá (sigue viviendo en service_categories/site_settings/
-- gallery_images), solo existen para poder reordenarlas y activarlas
-- junto con las editoriales en una sola lista arrastrable.
alter table public.site_sections
  add column if not exists kind text not null default 'editorial'
    check (kind in ('editorial', 'services', 'about', 'mission_vision', 'gallery'));

-- media_type ahora también admite 'color' (fondo sólido, sin foto/video).
alter table public.site_sections drop constraint if exists site_sections_media_type_check;
alter table public.site_sections
  add constraint site_sections_media_type_check check (media_type in ('image', 'video', 'color'));

alter table public.site_sections add column if not exists bg_color text;
alter table public.site_sections add column if not exists text_color text not null default '#FFFFFF';

-- Filas marcador — display_order preserva el orden visual actual sin
-- tocar las 3 secciones editoriales ya sembradas en 0011 (display_order
-- 0, 1, 2): Servicios queda antes que todas (-1), el resto después (3-5).
insert into public.site_sections (kind, title, body, media_type, text_color, display_order, active)
values
  ('services', 'Servicios', '', 'color', '#FFFFFF', -1, true),
  ('about', 'Sobre nosotros', '', 'color', '#FFFFFF', 3, true),
  ('mission_vision', 'Misión y visión', '', 'color', '#FFFFFF', 4, true),
  ('gallery', 'Galería', '', 'color', '#FFFFFF', 5, true)
on conflict do nothing;
