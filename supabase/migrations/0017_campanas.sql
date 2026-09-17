-- Campañas con flyer + trazabilidad de los mensajes que NO salieron
-- (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva (como 0002-0016): no borra tablas, columnas ni datos existentes.
--
-- CORRER EN CADA PROYECTO (dev Y producción). Son bases distintas.
--
-- ============================================================
-- QUÉ RESUELVE
-- ============================================================
-- 1. MANU QUIERE MANDAR PROMOCIONES. Hasta ahora el módulo de notificaciones
--    solo reaccionaba a eventos (una reserva, un recordatorio, un cumpleaños).
--    No había forma de sacar una promoción con un flyer y mandársela a un
--    grupo de clientas. Esta migración agrega `campaigns`: un envío masivo
--    con segmento, flyer y canal, que **reusa el outbox existente** en vez de
--    inventar un mecanismo de envío paralelo. Cada destinataria es una fila
--    más en `notifications` (con `event = 'campaign'` y `campaign_id`), así
--    que hereda gratis el despachador, el claim atómico, el `dedupe_key` y el
--    historial que ya funcionan.
--
-- 2. LOS CORREOS QUE NUNCA EXISTIERON. En producción el outbox tenía 2 filas,
--    las dos de WhatsApp: parecía que el correo estaba roto. No lo estaba.
--    `lib/notifications/enqueue.ts` descartaba en SILENCIO la notificación
--    cuando la clienta no tenía correo registrado (40 de 59 clientas en
--    producción: el correo es opcional en /reservar). Desde ahora esas filas
--    se encolan igual con `status = 'OMITIDO'` y el motivo escrito en
--    `error`, para que el historial diga la verdad. Eso es puro TypeScript y
--    no necesita cambios de esquema — se documenta acá porque es el mismo
--    problema que hace tan importante el conteo de alcance de una campaña
--    ("de 59 clientas, 19 tienen correo").
--
-- ============================================================
-- LEY 1581 DE 2012 (HABEAS DATA) — NO ES OPCIONAL
-- ============================================================
-- Una campaña con flyer es MARKETING, no transaccional: exactamente el mismo
-- criterio que el saludo de cumpleaños. Por eso la resolución de audiencia de
-- abajo (`campaign_audience`) EXCLUYE SIEMPRE a quien tenga
-- `clients.marketing_opt_out = true`, sea cual sea el segmento, y todo
-- mensaje de campaña lleva línea de baja (la agrega
-- `lib/notifications/templates.ts`).

-- ============================================================
-- 1. Ampliar el dominio de `event` a 'campaign'
-- ============================================================
-- ESTE ES EL ÚNICO PASO DE TODO EL PLAN QUE NO ES ESTRICTAMENTE ADITIVO, y
-- por eso va primero y con explicación larga.
--
-- `notifications.event` y `notification_templates.event` nacieron en 0014 con
-- un `check (event in ('booking_requested','appointment_reminder','birthday'))`
-- declarado *inline*. Postgres le pone nombre solo — normalmente
-- `notifications_event_check` — pero ese nombre no está garantizado (depende
-- de qué otras constraints existían al crearla), así que no se puede hacer un
-- `drop constraint if exists <nombre>` a ciegas y quedarse tranquilo.
--
-- POR QUÉ ES SEGURO: recrear un CHECK **no toca ni una sola fila**. Solo
-- cambia la regla de validación, y la regla nueva es un SUPERCONJUNTO de la
-- vieja (los tres eventos de siempre + 'campaign'). Ninguna fila existente
-- puede quedar fuera, así que el `add constraint` no puede fallar por datos.
--
-- CÓMO SE HACE IDEMPOTENTE: un bloque `do $$` busca en `pg_constraint` TODA
-- constraint de tipo check sobre la tabla cuya definición mencione
-- 'booking_requested' y la borra, se llame como se llame. En la segunda
-- corrida eso incluye a la que crea esta misma migración, que se vuelve a
-- crear idéntica dos líneas más abajo. Correrla diez veces deja siempre el
-- mismo estado.
do $$
declare
  c record;
begin
  for c in
    select rel.relname as table_name, con.conname as constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('notifications', 'notification_templates')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%booking_requested%'
  loop
    execute format(
      'alter table public.%I drop constraint %I',
      c.table_name,
      c.constraint_name
    );
  end loop;
end $$;

alter table public.notifications
  add constraint notifications_event_check
  check (event in ('booking_requested', 'appointment_reminder', 'birthday', 'campaign'));

alter table public.notification_templates
  add constraint notification_templates_event_check
  check (event in ('booking_requested', 'appointment_reminder', 'birthday', 'campaign'));

-- OJO: NO se siembra ninguna plantilla de 'campaign' en
-- `notification_templates`. Una campaña trae su propio `subject`/`body` (cada
-- promoción dice algo distinto); el dominio se amplía en las dos tablas
-- solamente para que sigan siendo el mismo conjunto de eventos y para no
-- cerrarle la puerta a una plantilla de campaña más adelante.

-- ============================================================
-- 2. campaigns — una promoción que se le manda a un segmento
-- ============================================================
-- `channels` es un `text[]` y no dos booleanos: el orden no importa, el
-- conjunto sí, y así agregar un canal el día de mañana (WhatsApp Cloud API,
-- SMS) no obliga a otra columna.
--
-- `audience` es `jsonb` con un discriminador `kind` en vez de columnas
-- sueltas (`segment_type`, `segment_month`, `segment_months`, …) porque cada
-- segmento tiene parámetros distintos y la mitad de las columnas quedaría
-- siempre en null. Formas admitidas (ver lib/notifications/audience.ts, que
-- es el contrato de verdad):
--   {"kind":"all"}
--   {"kind":"birthday_month","month":8}     -- 1..12
--   {"kind":"inactive","months":6}          -- sin cita COMPLETADA hace N meses
--   {"kind":"new","months":3}               -- primera cita COMPLETADA hace <N meses
--   {"kind":"manual","clientIds":["…"]}
--
-- `flyer_image_url` apunta a Storage (bucket `site-media`, carpeta
-- `campaigns/`). TIENE QUE SER PNG O JPG: ningún cliente de correo
-- mayoritario renderiza SVG dentro de un <img> (Gmail y Outlook lo bloquean)
-- — el mismo motivo por el que 0015 creó `notification_settings.email_logo_url`
-- aparte del logo SVG del sitio. La validación vive en las Server Actions
-- (`createCampaign`/`updateCampaign`/`sendCampaign`) y en `uploadSiteMedia`.
-- Acá NO hay check de formato porque la URL puede no tener extensión.
--
-- NUNCA sembrar una URL de Storage fija en una migración: cada proyecto de
-- Supabase tiene su propio bucket y producción terminaría sirviendo el
-- archivo del proyecto de desarrollo.
--
-- `status` solo tiene dos valores a propósito. Una campaña ENVIADA es
-- histórico: no se edita ni se borra (lo impiden las Server Actions), y
-- reenviarla se rechaza explícitamente además de estar protegido por el
-- `dedupe_key` del outbox.
--
-- `recipient_count` es el ALCANCE REAL, no el tamaño del segmento: cuenta las
-- destinatarias que quedaron con al menos un mensaje encolable (PENDIENTE).
-- Una clienta del segmento que no tiene correo y a la que la campaña iba solo
-- por correo NO suma acá — su fila queda en el outbox como OMITIDO con el
-- motivo, que es justo lo que hay que poder mirar después.
create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  -- Nombre interno, para que Manu la reconozca en la lista. No se le manda a
  -- nadie: lo que ve la clienta es `subject` (correo) y `body`.
  title           text not null,
  subject         text,
  body            text not null,
  flyer_image_url text,
  channels        text[] not null default '{}',
  audience        jsonb not null default '{"kind":"all"}'::jsonb,
  status          text not null default 'BORRADOR'
                    check (status in ('BORRADOR', 'ENVIADA')),
  sent_at         timestamptz,
  recipient_count int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- La lista del panel: borradores primero, y dentro de cada grupo lo más nuevo
-- arriba.
create index if not exists campaigns_status_created_idx
  on public.campaigns (status, created_at desc);

alter table public.campaigns enable row level security;

-- Datos de clientas (a quién se le manda qué). SOLO acceso autenticado: acá
-- NO hay política de lectura pública para `anon`, ni la debe haber nunca —
-- mismo criterio que las tablas de Finanzas en 0016, y lo contrario de las
-- tablas de contenido (hero_slides, gallery_images…).
drop policy if exists "admin_full_access" on public.campaigns;
create policy "admin_full_access" on public.campaigns
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.campaigns;
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. notifications.campaign_id — de qué campaña salió cada mensaje
-- ============================================================
-- `on delete set null` (no cascade): si alguna vez se borrara una campaña
-- BORRADOR, el historial de lo ya enviado no se puede evaporar.
alter table public.notifications
  add column if not exists campaign_id uuid
  references public.campaigns(id) on delete set null;

-- "Mostrame cómo le fue a esta campaña" (cuántos ENVIADO / OMITIDO / FALLIDO).
create index if not exists notifications_campaign_idx
  on public.notifications (campaign_id, status);

-- ============================================================
-- 4. Resolución de audiencia — por qué vive en Postgres
-- ============================================================
-- Mismo motivo que las tres funciones de la sección 7 de 0016: PostgREST
-- corta todo `select` en `max_rows` (1000 por defecto en Supabase). Un
-- segmento como "sin cita COMPLETADA en los últimos 6 meses" resuelto en
-- TypeScript tendría que traerse las citas de todas las clientas y cruzarlas
-- a mano; pasado el corte no daría error, simplemente dejaría gente afuera en
-- silencio. Para una campaña eso es peor que un error: nadie se entera.
--
-- Son SECURITY INVOKER (el default, explícito por claridad): heredan la RLS de
-- quien las llama. NO son `security definer` — eso saltaría la RLS de
-- `clients`/`appointments`. Además se les revoca el EXECUTE a `public`/`anon`.
--
-- DÓNDE VIVE CADA UNA. Las dos envolturas que sí se pueden llamar
-- (`campaign_audience`, `campaign_audience_stats`) van en `public`, porque
-- `lib/notifications/audience.ts` las invoca por RPC y PostgREST solo publica
-- los esquemas expuestos (`public`, `graphql_public`). El núcleo
-- `campaign_audience_raw` va en el esquema `private`, que NO está expuesto:
-- así no existe ninguna URL `/rest/v1/rpc/campaign_audience_raw` que alguien
-- pueda llamar por error para armar una lista de envío — y esa lista incluye
-- a quienes pidieron no recibir marketing. Es la diferencia entre confiar en
-- un comentario y que la función no esté al alcance.
--
-- `p_cutoff` (el instante a partir del cual se mira el historial) llega YA
-- CALCULADO desde TypeScript. No se calcula acá con `now() - interval` a
-- propósito: toda la aritmética de fechas del proyecto es hora de pared de
-- Bogotá (UTC-5 fijo) y vive en `lib/booking/timezone.ts`. Duplicar ese
-- criterio en SQL es exactamente el tipo de regla de dos cabezas que 0016
-- advierte que hay que evitar.

-- ------------------------------------------------------------
-- 4a. Esquema `private` — lo que PostgREST no debe poder llamar.
--
--     PostgREST publica únicamente los esquemas expuestos del proyecto
--     (`public` y `graphql_public` por defecto). Todo lo que viva acá adentro
--     es invocable desde SQL pero NO tiene endpoint REST.
--
--     Se le da USAGE a `authenticated` (y a `service_role`) porque
--     `public.campaign_audience` es SECURITY INVOKER: la ejecuta el rol de
--     quien llama, y sin USAGE sobre el esquema no podría entrar. A `anon` no
--     se le da nada, nunca.
-- ------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ------------------------------------------------------------
-- 4b. private.campaign_audience_raw — el núcleo COMPARTIDO.
--
--     ¡OJO! Esta función devuelve TAMBIÉN a quienes pidieron no recibir
--     marketing, con la bandera `marketing_opt_out` a la vista. Existe para
--     que el filtro de opt-out y el conteo de excluidas salgan de la MISMA
--     definición de segmento (si se duplicara el `where` en las dos funciones
--     de abajo, tarde o temprano una de las dos copias quedaría vieja).
--
--     NADIE debe llamarla directo para mandar nada: para eso está
--     `campaign_audience`, que es la única que aplica la exclusión.
--     `lib/notifications/audience.ts` solo usa las dos envolturas.
--
--     Vive en `private` justamente para que no haya forma de llamarla por
--     RPC. El `drop` de la versión vieja en `public` está para que, si esta
--     migración llegó a correrse en alguna base antes de este cambio, no
--     quede una copia expuesta.
-- ------------------------------------------------------------
drop function if exists public.campaign_audience_raw(text, int, timestamptz, uuid[]);
drop function if exists private.campaign_audience_raw(text, int, timestamptz, uuid[]);
create function private.campaign_audience_raw(
  p_kind       text,
  p_month      int         default null,
  p_cutoff     timestamptz default null,
  p_client_ids uuid[]      default null
)
returns table (
  id                uuid,
  name              text,
  phone             text,
  email             text,
  marketing_opt_out boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.name, c.phone, c.email, c.marketing_opt_out
  from public.clients c
  where
    case p_kind
      -- Todas las clientas registradas.
      when 'all' then true

      -- Cumpleañeras del mes N. `birthday` es un `date`, así que el mes sale
      -- de la fecha sin convertir zonas horarias.
      when 'birthday_month' then
        c.birthday is not null
        and p_month is not null
        and extract(month from c.birthday) = p_month

      -- "Hace rato no viene": ninguna cita COMPLETADA desde `p_cutoff`.
      -- Incluye a propósito a quien nunca tuvo una cita completada (una
      -- clienta que reservó y nunca volvió es justamente a quien se le quiere
      -- escribir).
      when 'inactive' then
        p_cutoff is not null
        and not exists (
          select 1
          from public.appointments a
          where a.client_id = c.id
            and a.status = 'COMPLETADA'
            and a.start_time >= p_cutoff
        )

      -- "Recién llegada": su PRIMERA cita COMPLETADA cae dentro de la
      -- ventana. Si nunca completó ninguna, el `min` es null y la comparación
      -- da null → queda fuera, que es lo correcto (todavía no es clienta).
      when 'new' then
        p_cutoff is not null
        and (
          select min(a.start_time)
          from public.appointments a
          where a.client_id = c.id
            and a.status = 'COMPLETADA'
        ) >= p_cutoff

      -- Selección a mano desde el panel.
      when 'manual' then
        p_client_ids is not null
        and c.id = any(p_client_ids)

      -- Segmento desconocido: no le manda a nadie. Fallar vacío es lo seguro
      -- acá; el caso contrario sería mandarle la campaña a toda la base por
      -- un typo.
      else false
    end;
$$;

revoke all on function private.campaign_audience_raw(text, int, timestamptz, uuid[]) from public, anon;
grant execute on function private.campaign_audience_raw(text, int, timestamptz, uuid[]) to authenticated, service_role;

-- ------------------------------------------------------------
-- 4c. campaign_audience — LAS DESTINATARIAS REALES.
--     Única puerta de entrada para encolar: acá se aplica la exclusión por
--     `marketing_opt_out` (Ley 1581 de 2012).
-- ------------------------------------------------------------
drop function if exists public.campaign_audience(text, int, timestamptz, uuid[]);
create function public.campaign_audience(
  p_kind       text,
  p_month      int         default null,
  p_cutoff     timestamptz default null,
  p_client_ids uuid[]      default null
)
returns table (
  id    uuid,
  name  text,
  phone text,
  email text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.name, r.phone, r.email
  from private.campaign_audience_raw(p_kind, p_month, p_cutoff, p_client_ids) r
  where not r.marketing_opt_out
  order by r.id;
$$;

revoke all on function public.campaign_audience(text, int, timestamptz, uuid[]) from public, anon;
grant execute on function public.campaign_audience(text, int, timestamptz, uuid[]) to authenticated, service_role;

-- ------------------------------------------------------------
-- 4d. campaign_audience_stats — el alcance, ANTES de enviar.
--     Devuelve UNA fila con cuatro conteos, así que no la toca `max_rows`
--     por grande que se ponga la base.
--
--     `reachable_email` / `reachable_whatsapp` son el número que evita la
--     decepción: el segmento puede tener 59 clientas y llegar solo a 19 por
--     correo. La UI tiene que mostrarlo antes de que Manu apriete "Enviar".
-- ------------------------------------------------------------
drop function if exists public.campaign_audience_stats(text, int, timestamptz, uuid[]);
create function public.campaign_audience_stats(
  p_kind       text,
  p_month      int         default null,
  p_cutoff     timestamptz default null,
  p_client_ids uuid[]      default null
)
returns table (
  total              bigint,
  reachable_email    bigint,
  reachable_whatsapp bigint,
  excluded_opt_out   bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    -- `total` ya es NETO de opt-out: es la audiencia que se va a encolar.
    count(*) filter (where not r.marketing_opt_out)::bigint,
    count(*) filter (
      where not r.marketing_opt_out and coalesce(btrim(r.email), '') <> ''
    )::bigint,
    count(*) filter (
      where not r.marketing_opt_out and coalesce(btrim(r.phone), '') <> ''
    )::bigint,
    count(*) filter (where r.marketing_opt_out)::bigint
  from private.campaign_audience_raw(p_kind, p_month, p_cutoff, p_client_ids) r;
$$;

revoke all on function public.campaign_audience_stats(text, int, timestamptz, uuid[]) from public, anon;
grant execute on function public.campaign_audience_stats(text, int, timestamptz, uuid[]) to authenticated, service_role;
