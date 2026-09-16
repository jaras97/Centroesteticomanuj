# PRD — Módulo de notificaciones

Correo automático (Resend) + WhatsApp asistido para el Centro Estético Manuj.
Documento de referencia del módulo: modelo de datos, flujo de cada evento, cómo se enchufa WhatsApp Cloud API más adelante y la puesta en marcha paso a paso.

Migración asociada: `supabase/migrations/0014_notificaciones.sql` (**pendiente de correr** — ver "Puesta en marcha").

---

## 1. Qué resuelve

Hoy Manu se entera de una solicitud de cita solo si entra al panel, y los recordatorios y felicitaciones los manda a mano. El módulo automatiza tres momentos:

| Evento | Cuándo | A quién |
|---|---|---|
| `booking_requested` | Al enviarse el formulario de `/reservar` | A Manu (aviso interno) y a la clienta (acuse de recibo) |
| `appointment_reminder` | El día anterior a una cita `CONFIRMADA` | A la clienta |
| `birthday` | El día configurado del mes, a quienes cumplen años ese mes | A la clienta |

Dos canales, con madurez distinta a propósito:

- **Correo**: se envía solo, vía Resend.
- **WhatsApp**: **asistido**. El sistema redacta el mensaje y lo deja en una bandeja del panel con un botón que abre `wa.me` con el texto ya escrito. Manu le da enviar y lo marca. No hay integración con la API de WhatsApp todavía — pero la arquitectura ya está lista para ella (sección 6).

---

## 2. Decisiones de diseño

### Outbox + worker, no "enviar y rezar"

Nada se envía directo desde una Server Action. Se **encola** una fila en `notifications` y un worker la despacha. Dos razones concretas:

1. **Un fallo de Resend no puede romper una reserva.** El encolado y el despacho van dentro de `try/catch` en `app/reservar/actions.ts`, y el despacho corre dentro de `after()` de Next (después de responderle a la clienta). Si el correo falla, la clienta ve su solicitud confirmada igual y la notificación queda `FALLIDO` para reintentar desde el panel.
2. **Un cron que se solapa no puede duplicar mensajes.** Son dos protecciones distintas, en dos momentos distintos:
   - **Encolado**: el **índice único sobre `notifications.dedupe_key`**. Todo insert va con `on conflict (dedupe_key) do nothing`. El cron puede correr diez veces el mismo día y no se encola un solo mensaje repetido.
   - **Despacho**: un **claim atómico** en `dispatch.ts`. Antes de llamar al canal, el worker reclama la fila con `update … set status='ENVIANDO' where id = … and status='PENDIENTE' returning *`. El `dedupe_key` protege el encolado, no el envío: sin el claim, el cron diario y el `dispatchQuietly()` que dispara una reserva entrante podrían leer la misma fila `PENDIENTE` y mandarle dos correos a la misma clienta. Solo despacha quien reclama; el que llega segundo recibe cero filas y sigue de largo.

### El canal no contamina la lógica de negocio

`enqueue.ts` y `dispatch.ts` no saben nada de Resend ni de `wa.me`. Solo conocen la interfaz `NotificationChannelAdapter` (`lib/notifications/types.ts`). Por eso cambiar WhatsApp de asistido a automático es cambiar **un archivo**.

### El historial guarda el mensaje ya renderizado

`notifications.body` guarda el texto final, con las variables resueltas. Editar una plantilla no reescribe lo que ya se mandó: el historial es un registro de lo que la clienta realmente recibió.

---

## 3. Modelo de datos

### `notifications` — el outbox

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `event` | text | `booking_requested` \| `appointment_reminder` \| `birthday` |
| `channel` | text | `email` \| `whatsapp` |
| `recipient_kind` | text | `client` \| `admin` |
| `to_email`, `to_phone` | text null | El destinatario resuelto en el momento de encolar |
| `client_id`, `appointment_id` | uuid null | FK con `on delete set null` (borrar una cita no borra su historial) |
| `subject` | text null | Solo en correo |
| `body` | text | **Ya renderizado**: HTML en correo, texto plano en WhatsApp |
| `status` | text | `PENDIENTE` \| `ENVIANDO` \| `ENVIADO` \| `FALLIDO` \| `OMITIDO` |
| `attempts` | int | Intentos de despacho |
| `scheduled_for` | timestamptz | El worker solo toma lo que ya venció |
| `sent_at`, `error` | | |
| `dedupe_key` | text | **`unique index`** — la idempotencia real |

**Por qué `status` y no un booleano `sent`**: el canal de WhatsApp no envía, queda `PENDIENTE` esperando a que Manu lo mande. Y `OMITIDO` (sin `RESEND_API_KEY`, sin correo de la clienta) tiene que distinguirse de `FALLIDO` (Resend rechazó el envío) — son problemas distintos con soluciones distintas.

**`ENVIANDO` es transitorio**: lo pone el claim atómico del worker y dura lo que tarda el canal en responder. Si el proceso muere a mitad (timeout de la función, deploy en caliente), la fila quedaría colgada en ese estado y nadie la volvería a mirar; por eso cada corrida empieza devolviendo a `PENDIENTE` todo lo que lleve más de 10 minutos en `ENVIANDO` (`STALE_CLAIM_MS` en `dispatch.ts`). Ese margen tiene que ser holgadamente mayor que una corrida completa (`maxDuration = 60`): si se acorta de más, se reintenta un envío que en realidad sigue en curso.

Formato de los `dedupe_key`:

```
booking_requested:<appointment_id>:<admin|client>:<email|whatsapp>
reminder:<appointment_id>:client:<email|whatsapp>
birthday:<client_id>:<año>:client:<email|whatsapp>
```

El año en el de cumpleaños es lo que permite felicitar una vez por año y no una sola vez en la vida.

Índices: `notifications_dedupe_key_idx` (único), `notifications_queue_idx (status, scheduled_for)` para la consulta del worker, `notifications_channel_status_idx` para la bandeja de WhatsApp y `notifications_created_idx` para el historial.

### `notification_templates`

`id`, `event`, `channel`, `recipient_kind`, `subject` (null en WhatsApp), `body`, `enabled`, `created_at`, `updated_at`. Unique `(event, channel, recipient_kind)`.

Se siembran 8 plantillas en la migración (todas en español, editables desde el panel). `recipient_kind` está en la llave porque el mismo evento se le cuenta distinto a Manu que a la clienta.

Variables disponibles: `{{cliente}}`, `{{servicio}}`, `{{fecha}}`, `{{hora}}`, `{{negocio}}`, `{{telefono}}` (el del centro), `{{telefono_cliente}}`. El evento `birthday` no tiene servicio/fecha/hora.

### `notification_settings` — singleton (`id boolean pk default true`)

| Columna | Default | Para qué |
|---|---|---|
| `admin_email` | null | Dónde recibe Manu los avisos internos. Si es null → `site_settings.email` |
| `admin_whatsapp` | null | Ídem. Si es null → `site_settings.whatsapp_number` |
| `business_name` | `Centro Estético Manuj` | Lo que reemplaza a `{{negocio}}` y firma los correos |
| `reminder_hours_before` | 24 | Con el cron diario define **cuántos días antes** se avisa (24 → el día anterior, 48 → dos días antes) |
| `birthday_send_day` | 1 | Día del mes en que salen los saludos del mes en curso (1-28) |

### `clients.marketing_opt_out boolean default false`

El saludo de cumpleaños es **marketing**, no transaccional: la Ley 1581 de 2012 (Habeas Data) exige poder darse de baja. El cron filtra por esta columna y el correo de cumpleaños lleva una línea de baja al pie. Los avisos de solicitud y recordatorio nacen de una acción de la propia clienta: son transaccionales y no dependen de esta bandera.

### RLS

Las tres tablas llevan solo `admin_full_access` (`for all to authenticated using (true) with check (true)`), como el resto de tablas administradas. **No hay lectura pública**: a diferencia de las tablas de contenido, acá hay datos personales.

---

## 4. La capa `lib/notifications/`

```
lib/notifications/
  types.ts        NotificationEvent/Channel/Status, la interfaz NotificationChannelAdapter.
                  Sin imports de servidor: lo usa también el editor de plantillas del panel.
  templates.ts    renderTemplate() + escapeHtml() + variables por evento + valores de ejemplo.
                  Puro TS: la vista previa del panel renderiza con este mismo código.
  enqueue.ts      loadNotificationContext() + enqueueNotifications() + un constructor por evento.
  dispatch.ts     dispatchPending() / dispatchQuietly(): el worker del outbox.
  channels/
    email.ts      Adaptador Resend. sendsAutomatically = true.
    whatsapp.ts   Adaptador asistido. sendsAutomatically = false.
```

### Escapado de HTML — no es opcional

`{{cliente}}` sale del formulario público de `/reservar`. Un nombre con `<script>` terminaría dentro del HTML de un correo. `renderTemplate` escapa **los valores interpolados** antes de meterlos en el cuerpo del correo. No escapa el texto de la plantilla: ese lo escribe Manu desde el panel y es contenido de confianza.

En WhatsApp **no** se escapa: el texto va tal cual al deep link, escaparlo mostraría `&amp;` literal en el chat.

El asunto del correo tampoco se escapa **como HTML**: viaja en una cabecera de correo, que es texto plano, y escaparlo mostraría `&amp;` en la bandeja de entrada. Lo que sí se le quita son los saltos de línea y los caracteres de control (`sanitizeHeaderValue`): un nombre con un CR/LF adentro es el vector clásico de inyección de cabeceras de correo.

### Los cuatro resultados de un canal

```ts
type ChannelSendResult =
  | { ok: true; info?: string }          // → ENVIADO
  | { ok: false; error: string }         // → FALLIDO (reintentable desde el panel)
  | { deferred: true; reason: string }   // → sigue PENDIENTE (espera acción humana)
  | { skipped: true; reason: string }    // → OMITIDO (falta configuración o destinatario)
```

`skipped` es lo que permite la degradación con gracia: sin `RESEND_API_KEY` la aplicación entera funciona igual y los correos quedan `OMITIDO` con el motivo escrito, visible en el Historial del panel.

### `sendsAutomatically`

El worker **solo consulta los canales con `sendsAutomatically = true`**. Si WhatsApp entrara en la consulta, sus filas `PENDIENTE` se quedarían al frente de la cola para siempre y el worker las releería en cada corrida sin poder hacer nada con ellas.

---

## 5. Flujo de cada evento

### Nueva solicitud (`booking_requested`)

1. `app/reservar/actions.ts` → `createBookingRequest` inserta la cita y recupera su `id`.
2. Encola cuatro notificaciones: admin·correo, admin·whatsapp, clienta·correo (solo si dejó correo) y clienta·whatsapp.
3. `after(() => dispatchQuietly(supabase))` despacha después de responderle a la clienta.
4. Todo el bloque va dentro de `try/catch`: **la reserva se confirma pase lo que pase**.

**Captura del correo**: `/reservar` ahora pide correo electrónico, **opcional** (pedirlo obligatorio agrega fricción a la reserva). Se guarda en `clients.email` con el mismo criterio que ya se usaba para el nombre: **se rellena si estaba vacío, nunca se pisa uno ya registrado** desde el formulario público — si no, cualquiera podría redirigir las notificaciones de otra persona con solo conocer su teléfono. Cambiar un correo ya guardado es cosa del panel.

### Recordatorio (`appointment_reminder`)

Lo encola el cron diario. La ventana del día objetivo se calcula **siempre en hora de pared de Bogotá** (`formatDateStr(toBogotaWallClock(...))` + `addDaysToDateStr` + `bogotaWallTimeToUtc`), nunca con `new Date().getDate()`: en Vercel el proceso corre en UTC y entre las 19:00 y la medianoche de Bogotá mandaría los recordatorios del día equivocado.

Solo se consideran citas `CONFIRMADA`.

### Cumpleaños (`birthday`)

El día `birthday_send_day` de cada mes, el cron felicita a todas las clientas cuyo mes de cumpleaños es el actual y que **no** tienen `marketing_opt_out`. El mes se lee del string `YYYY-MM-DD` de la columna `date`, sin construir un `Date` (que lo interpretaría en la zona del proceso).

---

## 6. Cómo se escala a WhatsApp Cloud API

Cuando se quiera automatizar WhatsApp, **el único archivo que cambia es `lib/notifications/channels/whatsapp.ts`**:

1. Implementar `send(notification)` llamando a la Graph API:
   `POST https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages` con `Authorization: Bearer <WHATSAPP_TOKEN>`, devolviendo `{ ok: true }` / `{ ok: false, error }` según la respuesta.
2. Cambiar `sendsAutomatically` de `false` a `true`. Con eso `dispatch.ts` empieza a despachar el canal solo — no hay nada más que tocar en `enqueue.ts`, `dispatch.ts`, el cron ni la Server Action de reserva.
3. Agregar las variables de entorno: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (y `WHATSAPP_API_VERSION` si se quiere fijar la versión). Documentarlas en `.env.local.example` con el mismo criterio de degradación: sin ellas, `send()` devuelve `{ skipped: true, reason }` y las notificaciones quedan `OMITIDO`.

Consideración de negocio, no de código: Meta exige **plantillas aprobadas** para escribirle primero a alguien fuera de la ventana de 24 horas. Los tres eventos de este módulo caen en ese caso, así que habrá que registrar las plantillas en el WhatsApp Manager y mandar el `template name` + parámetros en vez del texto libre. Los cuerpos sembrados en la migración sirven de base para redactarlas.

La pestaña "Pendientes de WhatsApp" del panel puede quedarse igual: con el canal automático simplemente dejará de llenarse.

---

## 7. El cron

`app/api/cron/notificaciones/route.ts` (`dynamic = 'force-dynamic'`, `maxDuration = 60`). Un **único** job diario que hace las tres cosas: encola recordatorios, encola cumpleaños y despacha el outbox.

**Por qué uno solo**: el plan Hobby de Vercel permite máximo 2 cron jobs y solo frecuencia diaria. Partirlo en tres no cabía.

Registrado en `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/notificaciones", "schedule": "0 13 * * *" }] }
```

`0 13 * * *` es UTC → **08:00 en Bogotá** (UTC-5, sin horario de verano).

**Autenticación**: `middleware.ts` solo matchea `/admin/:path*`, así que las rutas `/api/*` no pasan por él y se autentican solas. El orden es:

1. Si `CRON_SECRET` está configurado, **se exige** `Authorization: Bearer $CRON_SECRET`. Vercel agrega esa cabecera a sus invocaciones de cron justo cuando esa variable existe, así que exigirla no rompe nada.
2. Si no está configurado, la única credencial disponible es la cabecera `x-vercel-cron` (que Vercel pone y elimina de cualquier petición externa).

Cualquier otro caso responde `401`. El secreto manda sobre la cabecera a propósito: confiar en una cabecera deja de ser seguro el día que el proyecto quede detrás de otro proxy o se despliegue fuera de Vercel.

Como es idempotente, se puede disparar a mano sin riesgo:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tudominio.com/api/cron/notificaciones
```

**Alternativa con `pg_cron` + `pg_net`**: queda escrita y comentada al final de la migración 0014. El proyecto ya tiene `pg_cron` activo (0001 lo usa para expirar solicitudes). Se dejó comentada porque obliga a guardar el `CRON_SECRET` dentro de la base de datos y porque tener las dos vías activas duplicaría llamadas (mensajes no: el `dedupe_key` lo impide).

---

## 8. El panel — `/admin/notificaciones`

Tres pestañas (`components/ui/tabs.tsx`, mismo molde que `/admin/contenido`):

1. **Plantillas** — configuración del módulo arriba (correo/WhatsApp de avisos, nombre del centro, antelación del recordatorio, día de envío de cumpleaños) y debajo el editor: lista de plantillas por evento × canal × destinatario, editor de asunto y mensaje, **variables clickeables** que se insertan donde está el cursor, **vista previa en vivo** (el correo se renderiza en un `iframe` con el mismo `renderTemplate` del envío real; WhatsApp se muestra como burbuja de chat), botón de encender/apagar y **"Enviar correo de prueba"** — indispensable para verificar Resend sin tener que reservar una cita de mentiras.
2. **Pendientes de WhatsApp** — la bandeja asistida: el mensaje redactado, "Abrir WhatsApp" (deep link `wa.me` con el texto), "Ya lo envié" y "Descartar".
3. **Historial** — el outbox filtrable por estado, con el motivo del fallo/omisión y botón "Reintentar" en lo `FALLIDO`/`OMITIDO`.

Si la migración 0014 todavía no corrió, la página lo dice explícitamente en vez de mostrar tablas vacías.

### Server Actions (en `app/admin/(dashboard)/actions.ts`)

`updateNotificationTemplate`, `setNotificationTemplateEnabled`, `updateNotificationSettings`, `markWhatsAppNotificationSent`, `skipWhatsAppNotification`, `retryNotification`, `sendTestNotificationEmail`, `setClientMarketingOptOut`. Todas con `requireUser()` y `{ ok: true } | { ok: false, error }`.

---

## 9. Variables de entorno

Las cuatro son **opcionales**: sin ninguna de ellas la aplicación funciona completa.

| Variable | Si falta |
|---|---|
| `RESEND_API_KEY` | No se envía ningún correo. Quedan `OMITIDO` con el motivo en el Historial. El panel muestra un aviso ámbar y el botón de prueba queda deshabilitado. |
| `RESEND_FROM` | Igual que arriba. Formato: `Centro Estético Manuj <citas@tudominio.com>`. El dominio tiene que estar verificado en Resend. |
| `CRON_SECRET` | `/api/cron/notificaciones` responde `401`: no corren recordatorios ni cumpleaños. Todo lo demás (solicitudes, bandeja de WhatsApp) sigue funcionando. |
| `NEXT_PUBLIC_SITE_URL` | Solo afecta enlaces absolutos. |

Documentadas en `.env.local.example`.

---

## 10. Puesta en marcha (paso a paso)

### Paso 1 — Correr la migración

1. Abrir Supabase Studio → **SQL Editor** → New query.
2. Pegar **completo** el contenido de `supabase/migrations/0014_notificaciones.sql` y ejecutarlo.
3. Verificar en **Table Editor** que aparecen `notifications`, `notification_templates` (con 8 filas) y `notification_settings` (con 1 fila), y que `clients` tiene la columna `marketing_opt_out`.

Hasta acá `/admin/notificaciones` ya funciona con WhatsApp asistido, sin necesidad de Resend.

### Paso 2 — Crear la cuenta de Resend

1. Registrarse en [resend.com](https://resend.com) (el plan gratuito da 3.000 correos al mes / 100 al día — de sobra).
2. **Domains → Add Domain** y escribir el dominio del sitio (p. ej. `centroesteticomanuj.com`).

### Paso 3 — Verificar el dominio (DNS)

Resend muestra 3 registros que hay que crear donde esté comprado el dominio (Namecheap, GoDaddy, Cloudflare, el panel de Vercel…):

| Tipo | Para qué |
|---|---|
| `TXT` (SPF) | Autoriza a Resend a enviar en nombre del dominio |
| `TXT` (DKIM) | Firma criptográfica de los correos |
| `MX` (opcional, para rebotes) | Recibe las notificaciones de entrega |

Se copian y pegan tal cual los muestra Resend. La propagación suele tardar minutos, a veces horas. Cuando el dominio aparezca en verde ("Verified"), seguir.

> Sin dominio verificado se puede probar con el remitente de pruebas `onboarding@resend.dev`, pero solo entrega a la dirección con la que se registró la cuenta. Para escribirle a las clientas hace falta el dominio propio.

### Paso 4 — Crear la API key

Resend → **API Keys** → *Create API Key* (permiso "Sending access"). Se muestra **una sola vez**: copiarla en ese momento.

### Paso 5 — Configurar las variables en Vercel

Vercel → proyecto `cemanuj` → **Settings → Environment Variables**. Agregar en *Production* (y en *Preview* si se quiere probar ahí):

```
RESEND_API_KEY       = re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM          = Centro Estético Manuj <citas@tudominio.com>
CRON_SECRET          = (generar con: openssl rand -hex 32)
NEXT_PUBLIC_SITE_URL = https://tudominio.com
```

**Volver a desplegar** después de agregarlas: las variables de entorno solo se leen en un despliegue nuevo.

Para probar en local, las mismas cuatro van en `.env.local`.

### Paso 6 — Verificar que el correo sale

1. Entrar a `/admin/notificaciones` → pestaña **Plantillas**.
2. Llenar "Correo para los avisos internos" y guardar.
3. Elegir una plantilla de correo y darle **"Enviar correo de prueba"**.
4. Revisar la bandeja (y la carpeta de spam la primera vez).

Si algo falla, el mensaje de error dice qué: falta una variable, Resend rechazó el remitente, etc.

### Paso 7 — Verificar que el cron quedó registrado

1. Vercel → proyecto → pestaña **Cron Jobs**. Debe aparecer `/api/cron/notificaciones` con el horario `0 13 * * *` y su próxima ejecución. (Solo aparece después de un despliegue a producción con `vercel.json` incluido.)
2. Dispararlo a mano para no esperar al día siguiente:
   ```bash
   curl -i -H "Authorization: Bearer EL_CRON_SECRET" https://tudominio.com/api/cron/notificaciones
   ```
   Responde un JSON con cuántos recordatorios y cumpleaños encoló y cuántos despachó. Es idempotente: repetirlo no duplica nada.
3. Revisar el resultado en `/admin/notificaciones` → **Historial**.

> En el plan Hobby de Vercel los cron jobs se ejecutan **una vez al día, en algún momento dentro de la hora indicada** (no al minuto exacto), y hay un máximo de 2 jobs por proyecto. Este módulo usa 1.

---

## 11. Limitaciones conocidas

- **El recordatorio se manda a la hora del cron, no con la antelación exacta.** Con un job diario, `reminder_hours_before` define cuántos días antes se avisa (24 → el día anterior), no la hora. Para respetar la hora exacta haría falta un cron horario, que el plan Hobby no permite.
- **El envío de WhatsApp se confirma a mano.** No hay forma de saber si Manu efectivamente mandó el mensaje mientras no exista la integración con la Cloud API.
- **Sin reintento automático.** Una notificación `FALLIDO` se reintenta desde el panel. No hay backoff programado (`attempts` está guardado por si se quiere agregar).
- **El correo de la clienta es opcional.** Quien no lo deje solo recibirá WhatsApp (asistido). Es una decisión deliberada: pedirlo obligatorio le agrega fricción a la reserva.
- **No hay evento al confirmar la cita.** El `check` de `notifications.event` admite solo `booking_requested`, `appointment_reminder` y `birthday`. Avisarle a la clienta cuando Manu confirma su cita exige una migración nueva (`alter table … drop constraint … / add constraint …` sobre `notifications` y `notification_templates`) más el seed de las dos plantillas. Hoy esa confirmación se manda a mano por WhatsApp.
- **El historial se muestra recortado** (últimos 150 movimientos). La tabla guarda todo; si algún día estorba, hará falta paginación o una limpieza programada.
