-- Módulo de notificaciones — correo automático (Resend) + WhatsApp asistido.
-- Aditiva: no borra ni modifica nada existente salvo agregar una columna a
-- public.clients. Ver docs/PRD-notificaciones.md.
-- Pegar y correr completo en el SQL Editor de Supabase Studio.

-- ---------------------------------------------------------------------------
-- 1. Consentimiento de marketing (Ley 1581 de 2012 — Habeas Data)
-- ---------------------------------------------------------------------------
-- El saludo de cumpleaños es marketing, no es transaccional: requiere poder
-- darse de baja. Las notificaciones de solicitud y recordatorio SÍ son
-- transaccionales (nacen de una acción de la propia clienta) y no dependen
-- de esta bandera.
alter table public.clients
  add column if not exists marketing_opt_out boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. notification_templates — plantillas editables desde /admin/notificaciones
-- ---------------------------------------------------------------------------
-- Una fila por combinación evento × canal. El cuerpo admite variables
-- {{cliente}}, {{servicio}}, {{fecha}}, {{hora}}, {{negocio}}, {{telefono}}
-- que se resuelven en TypeScript (lib/notifications/templates.ts), escapando
-- HTML antes de interpolar en los correos — los valores vienen de un
-- formulario público.
create table if not exists public.notification_templates (
  id          uuid primary key default gen_random_uuid(),
  event       text not null check (event in ('booking_requested', 'appointment_reminder', 'birthday')),
  channel     text not null check (channel in ('email', 'whatsapp')),
  -- Para quién es el mensaje: la clienta o Manu. La misma combinación
  -- evento+canal puede tener texto distinto según el destinatario.
  recipient_kind text not null default 'client' check (recipient_kind in ('client', 'admin')),
  subject     text,                    -- solo aplica a 'email'
  body        text not null,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint notification_templates_unique unique (event, channel, recipient_kind)
);

alter table public.notification_templates enable row level security;

drop policy if exists "admin_full_access" on public.notification_templates;
create policy "admin_full_access" on public.notification_templates
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.notification_templates;
create trigger set_updated_at before update on public.notification_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. notification_settings — singleton (mismo truco que site_settings)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_settings (
  id                    boolean primary key default true,
  -- Destinatarios de las notificaciones internas. Si quedan en null, el
  -- sistema cae a site_settings.email / site_settings.whatsapp_number.
  admin_email           text,
  admin_whatsapp        text,
  -- Nombre con el que se firman los mensajes ({{negocio}}).
  business_name         text not null default 'Centro Estético Manuj',
  -- Con qué antelación se avisa de una cita confirmada. El cron es diario,
  -- así que en la práctica esto define CUÁNTOS DÍAS antes se manda
  -- (24h = el día anterior, 48h = dos días antes), no la hora exacta.
  reminder_hours_before int not null default 24 check (reminder_hours_before between 1 and 168),
  -- Día del mes en que se mandan los saludos de cumpleaños del mes en curso.
  birthday_send_day     int not null default 1 check (birthday_send_day between 1 and 28),
  updated_at            timestamptz not null default now(),
  constraint notification_settings_singleton check (id)
);

alter table public.notification_settings enable row level security;

drop policy if exists "admin_full_access" on public.notification_settings;
create policy "admin_full_access" on public.notification_settings
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.notification_settings;
create trigger set_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();

insert into public.notification_settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. notifications — el outbox
-- ---------------------------------------------------------------------------
-- Patrón outbox + worker: nada se envía directo desde una Server Action. Se
-- encola una fila acá y un worker (lib/notifications/dispatch.ts, invocado
-- desde el cron o desde la propia acción) la despacha. Así un fallo de Resend
-- no rompe una reserva, y un cron que se solape no duplica mensajes.
--
-- dedupe_key + su índice único ES la idempotencia: se encola con
-- "on conflict (dedupe_key) do nothing". Formatos usados:
--   'booking_requested:<appointment_id>:admin:email'
--   'reminder:<appointment_id>:client:whatsapp'
--   'birthday:<client_id>:<año>:client:email'
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  event          text not null check (event in ('booking_requested', 'appointment_reminder', 'birthday')),
  channel        text not null check (channel in ('email', 'whatsapp')),
  recipient_kind text not null check (recipient_kind in ('client', 'admin')),
  to_email       text,
  to_phone       text,
  client_id      uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  subject        text,
  -- Ya renderizado, con las variables resueltas: lo que se manda es
  -- exactamente esto. Editar una plantilla no reescribe el historial.
  body           text not null,
  -- PENDIENTE: en cola. ENVIANDO: reclamada por el worker, en vuelo (estado
  -- transitorio, ver más abajo). ENVIADO: confirmado por el canal (o marcado
  -- a mano por Manu en la bandeja de WhatsApp). FALLIDO: el canal devolvió
  -- error. OMITIDO: no se intentó (falta RESEND_API_KEY, sin destinatario…).
  --
  -- ENVIANDO existe por el CLAIM ATÓMICO de lib/notifications/dispatch.ts:
  -- el dedupe_key protege el encolado, no el envío. Sin reclamar la fila,
  -- dos despachos simultáneos (el cron diario y el que dispara una reserva
  -- entrante) le mandarían dos correos a la misma clienta. Una fila que
  -- quede colgada en ENVIANDO la devuelve a PENDIENTE la corrida siguiente.
  status         text not null default 'PENDIENTE'
                   check (status in ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'FALLIDO', 'OMITIDO')),
  attempts       int not null default 0,
  scheduled_for  timestamptz not null default now(),
  sent_at        timestamptz,
  error          text,
  dedupe_key     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key);

-- Consulta del worker: "PENDIENTE, del canal X, con scheduled_for vencido".
create index if not exists notifications_queue_idx
  on public.notifications (status, scheduled_for);

-- Bandeja asistida de WhatsApp e historial filtrado por estado.
create index if not exists notifications_channel_status_idx
  on public.notifications (channel, status, scheduled_for desc);

-- Historial ordenado por fecha (pestaña "Historial" del admin).
create index if not exists notifications_created_idx
  on public.notifications (created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "admin_full_access" on public.notifications;
create policy "admin_full_access" on public.notifications
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.notifications;
create trigger set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Seed de las plantillas por defecto
-- ---------------------------------------------------------------------------
-- Texto plano con variables. Los saltos de línea se convierten a párrafos al
-- armar el HTML del correo (lib/notifications/templates.ts), así que Manu
-- puede editarlas sin saber HTML. El texto de WhatsApp se usa tal cual en el
-- deep link wa.me.
insert into public.notification_templates (event, channel, recipient_kind, subject, body) values

-- Nueva solicitud → aviso interno para Manu
('booking_requested', 'email', 'admin',
 'Nueva solicitud de cita: {{cliente}} — {{fecha}}',
 'Tienes una nueva solicitud de cita.

Clienta: {{cliente}}
Teléfono: {{telefono_cliente}}
Servicio: {{servicio}}
Fecha: {{fecha}}
Hora: {{hora}}

Recuerda que la cita queda en estado SOLICITADA hasta que la confirmes desde la bandeja del panel.'),

('booking_requested', 'whatsapp', 'admin',
 null,
 'Nueva solicitud de cita ✨
{{cliente}} ({{telefono_cliente}}) pidió {{servicio}} para el {{fecha}} a las {{hora}}. Confírmala desde el panel.'),

-- Nueva solicitud → acuse de recibo para la clienta
('booking_requested', 'email', 'client',
 'Recibimos tu solicitud de cita — {{negocio}}',
 'Hola {{cliente}}, ¡qué alegría tenerte por acá!

Ya recibimos tu solicitud y la estamos revisando con cariño:

Servicio: {{servicio}}
Fecha: {{fecha}}
Hora: {{hora}}

Ten en cuenta que todavía es una solicitud, no una cita confirmada. Te escribimos por WhatsApp muy pronto para confirmarte el espacio.

Si necesitas cambiar algo, escríbenos al {{telefono}}.

Con cariño,
{{negocio}}'),

('booking_requested', 'whatsapp', 'client',
 null,
 '¡Hola {{cliente}}! 💛 Recibimos tu solicitud de {{servicio}} para el {{fecha}} a las {{hora}}. La estamos revisando y te confirmamos en un momentico. — {{negocio}}'),

-- Recordatorio de cita confirmada
('appointment_reminder', 'email', 'client',
 'Te esperamos mañana: {{servicio}} a las {{hora}}',
 'Hola {{cliente}}, te escribimos para recordarte tu cita.

Servicio: {{servicio}}
Fecha: {{fecha}}
Hora: {{hora}}

Te pedimos el favor de llegar unos minutos antes para atenderte con calma. Si te surge algo y no vas a poder asistir, avísanos al {{telefono}} para reorganizar tu espacio.

¡Te esperamos!
{{negocio}}'),

('appointment_reminder', 'whatsapp', 'client',
 null,
 '¡Hola {{cliente}}! 💫 Te recordamos tu cita de {{servicio}} el {{fecha}} a las {{hora}}. Si necesitas moverla, avísanos por acá. ¡Te esperamos! — {{negocio}}'),

-- Cumpleaños (marketing: respeta marketing_opt_out)
('birthday', 'email', 'client',
 '¡Feliz cumpleaños, {{cliente}}! 🎉',
 'Hola {{cliente}},

De parte de todo el equipo de {{negocio}}, ¡feliz cumpleaños!

Que este año te traiga salud, calma y muchos motivos para consentirte. Si quieres celebrarlo regalándote un momento para ti, acá te esperamos con todo el cariño.

Escríbenos al {{telefono}} y con gusto te separamos tu espacio.

¡Feliz vuelta al sol!
{{negocio}}'),

('birthday', 'whatsapp', 'client',
 null,
 '¡Feliz cumpleaños, {{cliente}}! 🎂💛 Te deseamos un día hermoso. Cuando quieras consentirte, acá te esperamos. — {{negocio}}')

on conflict (event, channel, recipient_kind) do nothing;

-- ---------------------------------------------------------------------------
-- 6. ALTERNATIVA: correr el worker desde Postgres en vez de Vercel Cron
-- ---------------------------------------------------------------------------
-- El plan Hobby de Vercel solo permite 2 cron jobs y frecuencia diaria; por
-- eso vercel.json declara UN SOLO job que hace las tres cosas (recordatorios,
-- cumpleaños y despacho del outbox).
--
-- Si algún día se prefiere no depender de Vercel Cron, este proyecto ya tiene
-- pg_cron activo (0001 lo usa para expire-stale-appointments) y se puede
-- llamar la misma ruta HTTP desde la base con pg_net. Queda comentado porque
-- exige guardar el CRON_SECRET dentro de la base de datos, y porque tener los
-- dos activos a la vez duplicaría trabajo (no mensajes: el dedupe_key lo
-- impide, pero sí llamadas).
--
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'notificaciones-diarias',
--   '0 13 * * *',  -- 13:00 UTC = 08:00 en Bogotá (UTC-5, sin horario de verano)
--   $$
--   select net.http_post(
--     url     := 'https://TU-DOMINIO/api/cron/notificaciones',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || 'EL_MISMO_VALOR_DE_CRON_SECRET'
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- Para desactivarlo: select cron.unschedule('notificaciones-diarias');
