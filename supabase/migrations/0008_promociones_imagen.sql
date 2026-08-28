-- Fase CMS 2.1 — promoción "solo imagen" (el texto ya viene diseñado en la
-- imagen, ej. un flyer). Aditiva, sobre 0007_promociones.sql ya corrida.
-- Pegar y correr completo en el SQL Editor de Supabase Studio.

-- body deja de ser obligatorio: si image_only=true, la imagen es el mensaje
-- completo y no hace falta duplicar el texto.
alter table public.promotions alter column body drop not null;

alter table public.promotions
  add column if not exists image_only boolean not null default false;
