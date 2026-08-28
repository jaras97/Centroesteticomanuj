-- Fase CMS 4 — clips de video en el carrusel de inicio, además de imágenes.
-- Aditiva, sobre 0006_cms_contenido.sql ya corrida. Ver
-- docs/PRD-cms-contenido-y-promociones.md.
-- Pegar y correr completo en el SQL Editor de Supabase Studio.

-- image_url deja de ser obligatoria: una diapositiva de video puede no
-- tener imagen de portada (poster) todavía.
alter table public.hero_slides alter column image_url drop not null;

alter table public.hero_slides
  add column if not exists video_url text;

alter table public.hero_slides
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video'));
