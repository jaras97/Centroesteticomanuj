-- Logo en la cabecera de los correos de notificación (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva (como 0002-0014): no borra ni modifica nada existente.
--
-- CORRER EN CADA PROYECTO (dev Y producción). Son bases distintas.

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

-- Seed oportunista y PORTABLE: si el logo del sitio ya fuera un PNG/JPG, se
-- reusa. Deliberadamente NO se escribe una URL fija acá: cada proyecto de
-- Supabase tiene su propio bucket de Storage, y hardcodear la URL de uno haría
-- que producción dependiera del Storage del proyecto de desarrollo.
--
-- Como hoy el logo del sitio es SVG, lo normal es que esto no haga nada y la
-- columna quede en null. Para ponerlo:
--   1. Subir el PNG a Storage → bucket `site-media`, carpeta `site/`,
--      EN ESTE MISMO PROYECTO de Supabase.
--   2. Copiar su URL pública.
--   3. Pegarla en /admin/notificaciones → Ajustes generales → "Logo de los correos".
update public.notification_settings
set email_logo_url = s.logo_url
from public.site_settings s
where public.notification_settings.id = true
  and public.notification_settings.email_logo_url is null
  and s.id = true
  and s.logo_url is not null
  and s.logo_url !~* '\.svg($|\?|#)';
