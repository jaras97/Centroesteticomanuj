-- Logo en la cabecera de los correos de notificación (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva (como 0002-0014): no borra ni modifica nada existente.

-- ============================================================
-- notification_settings.email_logo_url
--
-- Por qué una columna nueva y no se reusa `site_settings.logo_url`:
-- el logo del sitio es un **SVG**, y ningún cliente de correo mayoritario
-- renderiza SVG dentro de un <img> (Gmail y Outlook lo bloquean; solo Apple
-- Mail lo soporta). Para el correo hace falta un PNG/JPG, que es un archivo
-- distinto. Son dos assets con formatos distintos, no el mismo dato.
--
-- Si queda en null, la cabecera del correo cae al nombre del negocio en
-- texto — que es exactamente como se veía antes de esta migración.
-- ============================================================
alter table public.notification_settings
  add column if not exists email_logo_url text;

-- Seed: el PNG generado a partir del SVG del sitio, ya subido al bucket
-- `site-media`. Solo se aplica si la columna todavía está vacía, para no
-- pisar un logo que se haya cambiado a mano desde el panel.
update public.notification_settings
set email_logo_url = 'https://rtmuaeonmqadbezygfrv.supabase.co/storage/v1/object/public/site-media/site/logo-email.png'
where id = true and email_logo_url is null;
