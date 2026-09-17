# Handoff — Campañas con flyer y trazabilidad del outbox

Continuación de `docs/PRD-notificaciones.md` y del módulo construido en `0014`. Formato narrativo, como los demás `HANDOFF-*`; si contradice a `docs/REFERENCIA-CMS-Y-ADMIN.md`, **manda la referencia**.

## Qué pidió Manu

1. Que en el historial de notificaciones "también aparezcan los correos", porque solo veía WhatsApp.
2. Poder mandar un **flyer** de una promoción a ciertas clientas, a un grupo o a todas, por correo o WhatsApp.

## El punto 1 no era lo que parecía

El historial **nunca tuvo un bug**: `notification-history.tsx` ya renderizaba los dos canales y la consulta de la página no filtraba por canal.

Se consultó la base de **producción** para diagnosticar. El outbox tenía **2 filas en total, ambas WhatsApp**, ambas `PENDIENTE`, del recordatorio diario. **Nunca se encoló un solo correo.** La causa estaba en `lib/notifications/enqueue.ts`:

```ts
if (input.channel === 'email' && !toEmail) return [];
```

Sin `clients.email`, no se encolaba nada **y no quedaba rastro**. En producción **40 de 59 clientas no tienen correo** — es un campo opcional en `/reservar` y casi nadie lo llena.

O sea: lo que Manu pedía como "que aparezcan los correos" era en realidad **que se vea qué pasó con cada correo, incluidos los que no salieron**. Esa ausencia era invisible.

**Cómo quedó**: cuando falta el destinatario (correo o teléfono), la fila **se encola igual con `status='OMITIDO'`** y un motivo en español — *"La clienta no tiene correo registrado."*. El cuerpo se renderiza igual, así que si después se carga el correo, el mensaje ya está escrito.

Decisiones asociadas:

- **Lo que sigue descartándose en silencio** es la plantilla apagada o inexistente: apagarla es una decisión deliberada de Manu y dejar rastro solo ensuciaría el historial.
- Una fila OMITIDA **no se despacha** (`dispatch.ts` filtra `status='PENDIENTE'`) ni aparece en la bandeja de WhatsApp.
- El `dedupe_key` sigue siendo la idempotencia: una fila OMITIDA no se duplica si el evento se vuelve a disparar.
- **`retryNotification` se endureció**: al reintentar, **vuelve a leer el correo/teléfono de la ficha de la clienta**. El caso real es que Manu le pida el correo por WhatsApp y lo cargue después. Solo para `recipient_kind='client'` — en un aviso interno el `client_id` apunta a la clienta de la cita, y copiarle su correo a Manu mandaría el aviso a la persona equivocada. Si sigue sin destinatario, queda OMITIDA con el mismo motivo en vez de colgada en PENDIENTE para siempre (importa sobre todo en WhatsApp, donde el despachador no interviene y una PENDIENTE sin teléfono se quedaría eternamente en la bandeja con un `wa.me` roto).

**Consecuencia que hay que tener presente**: el historial creció mucho en volumen y ruido. Cada solicitud, recordatorio o cumpleaños de una clienta sin correo deja ahora una fila OMITIDO, y la página trae las últimas 150. Por eso el historial ganó filtros.

## El punto 2 — campañas con flyer

### Modelo (migración `0017_campanas.sql`)

- **`campaigns`**: `title` (nombre interno), `subject`, `body`, `flyer_image_url`, `channels text[]`, `audience jsonb`, `status ('BORRADOR'|'ENVIADA')`, `sent_at`, `recipient_count`. RLS solo `admin_full_access`, **ninguna política `anon`**.
- **`notifications.campaign_id`** + índice `(campaign_id, status)`.
- Evento nuevo `'campaign'`.

**El paso delicado**: `notifications.event` y `notification_templates.event` tenían un `check` cerrado a tres valores, declarado *inline* en `0014`. Para admitir `'campaign'` hay que **recrear esas constraints** — el único paso no estrictamente aditivo de la migración. Es seguro (recrear un CHECK no toca ninguna fila, y el dominio nuevo es un superconjunto del viejo, así que el `add constraint` no puede fallar por datos existentes).

Se resuelve con un bloque `do $$` que busca la constraint **por definición** (`pg_get_constraintdef ilike '%booking_requested%'`) y **no por nombre**: un check inline lo bautiza Postgres, y puede quedar `notifications_event_check` o `..._check1` según el historial de cada base. **Las dos bases tienen historias distintas**, así que confiar en el nombre era exactamente el tipo de cosa que funciona en dev y falla en producción.

### Audiencia

`audience` es un `jsonb` con discriminador. Cinco segmentos: `all`, `birthday_month`, `inactive` (sin cita COMPLETADA en N meses), `new` (primera cita dentro de N meses) y `manual`.

Se resuelve con **funciones SQL**, no en TypeScript, por lo aprendido en la sesión de Finanzas: PostgREST corta todo `select` en `max_rows` (1000 por defecto) y una consulta que traiga filas crudas se trunca **en silencio**. Tres funciones:

| Función | Esquema | Para qué |
|---|---|---|
| `campaign_audience_raw` | **`private`** | Núcleo compartido. Devuelve también a las opt-out, con la bandera a la vista. |
| `campaign_audience` | `public` | Destinatarias reales, ya sin opt-out. **Única puerta para encolar.** |
| `campaign_audience_stats` | `public` | Una fila con los cuatro conteos, inmune a `max_rows`. |

`campaign_audience_raw` vive en el esquema **`private`**, que PostgREST no expone: así no existe ninguna URL `/rest/v1/rpc/campaign_audience_raw` y nadie puede obtener por error la lista *con* las opt-out. Devuelve a las opt-out a propósito, para que el filtro y el conteo de excluidas salgan de **la misma definición de segmento**.

`p_cutoff` llega **ya calculado desde TypeScript** (no `now() - interval`), para no duplicar el criterio de fechas Bogotá en SQL.

### Ley 1581 de 2012 (Habeas Data) — no es opcional

Una campaña con flyer es **marketing**, no transaccional:

- **`marketing_opt_out` se respeta en todos los segmentos, incluido `manual`**: si Manu elige a mano a alguien que pidió no recibir promociones, **no entra igual**. El filtro vive **dentro de la función SQL**, no en el código que la llama, justamente para que no dependa de que alguien se acuerde de filtrar. `enqueueCampaign` deliberadamente **no** vuelve a filtrar, y está comentado por qué (duplicar el filtro escondería el día que alguien llame con otra lista).
- **Línea de baja en los dos canales, siempre**, igual que el saludo de cumpleaños.
- Las notificaciones **transaccionales** (solicitud, recordatorio) **no** dependen del opt-out y siguen saliendo siempre. Es el error simétrico y es igual de grave.

### Encolado y envío

Se reusa el **outbox existente**: una fila por destinataria con `event='campaign'` y `campaign_id`. Eso hereda gratis el despachador, el `dedupe_key`, el claim atómico `ENVIANDO` y el historial. `dedupe_key` = `campaign:{campaignId}:{clientId}:{channel}`.

- **Correo**: sale solo, con el flyer embebido como `<img>`.
- **WhatsApp**: queda `PENDIENTE` en la bandeja asistida, con el **link público del flyer** en el texto — un deep link `wa.me` **no puede adjuntar imágenes**. WhatsApp genera la vista previa del link al enviarlo.
- **El flyer tiene que ser PNG/JPG, nunca SVG**: ningún cliente de correo mayoritario lo renderiza en un `<img>` (mismo motivo por el que `notification_settings.email_logo_url` es una columna aparte de `site_settings.logo_url`). Validado en tres lugares: cliente antes de subir, `uploadSiteMedia` y las Server Actions.

### La pantalla

Cuarta pestaña en `/admin/notificaciones`. El flujo: nombre → canales → asunto (solo si el canal incluye correo) → mensaje con chips de variables → flyer → segmento → **alcance real** → vista previa de los dos canales → borrador → enviar.

Lo más importante de esa pantalla es **el alcance real antes de enviar**. Con 40 de 59 clientas sin correo, ese número es la diferencia entre una expectativa y una decepción:

> El grupo tiene **59** clientas. Llega a **19** por correo y a **59** por WhatsApp. **3** quedaron fuera porque pidieron no recibir promociones.

Y tres advertencias, porque son consecuencias reales del diseño y no errores:

1. **`total` y `recipient_count` no son lo mismo.** El preview cuenta el segmento neto de opt-out; `recipient_count` cuenta las que quedaron con al menos un mensaje encolable. Ver un número más chico después **no es un error**. La advertencia solo aparece cuando de verdad van a diferir.
2. **Las campañas de WhatsApp caen en la bandeja asistida**: una campaña a 50 clientas son 50 clics de Manu.
3. **Los correos no salen todos de golpe**: el despachador procesa por tandas, así que una campaña grande se reparte en varias corridas del cron diario.

Una campaña ENVIADA no se edita ni se borra, solo se **duplica**: es histórico.

**Detalle no obvio del envío**: al enviar, el `revalidatePath` cambia la fila a ENVIADA *mientras el diálogo de resultado está abierto*. Si el diálogo se renderizara solo para borradores, se desmontaría y el desglose desaparecería justo al llegar. Por eso `CampaignSendDialog` se monta **siempre y en la misma posición del fragmento**; lo que desaparece es el disparador.

### Historial y bandeja

**Historial**: filtros por canal, evento y campaña, más buscador por nombre, correo o teléfono (normaliza dígitos, así que `3215487690` y `+57 321 548 7690` encuentran lo mismo). Los conteos de las píldoras de estado se calculan sobre el conjunto **ya filtrado**: con "Correo" seleccionado, "Omitidos (40)" significa 40 correos omitidos.

El **motivo de un OMITIDO** salió de la celda de estado (era un `<p>` de 12px truncado con `max-w-xs`) y pasó a un bloque a ancho completo con prefijo explícito — *"No se envió: La clienta no tiene correo registrado."*. Es la fila que ahora existe en masa y es la respuesta a "¿por qué no le llegó?".

El outbox **no guarda el nombre de la clienta**, solo correo y teléfono. El nombre llega por props desde la página (`clients`), porque buscar "María" es lo primero que Manu iba a intentar.

**Bandeja de WhatsApp**: los mensajes sueltos del día van **primero y siempre visibles**; las campañas quedan abajo, plegables, con progreso. El recordatorio de la cita de mañana no puede quedar debajo de 50 filas de promoción. Dentro de un grupo, la vista previa se muestra **una sola vez** arriba (todas reciben el mismo texto salvo el nombre), así cada fila queda compacta y el flujo de a uno no se ralentiza.

Hay un botón **"Verificar el enlace del flyer"**: comprobar que el público de Storage funciona antes de mandarle a 50 personas un link roto.

**No hay "marcar todas como enviadas", a propósito.** El `ENVIADO` de una fila de WhatsApp es la única constancia de que la clienta recibió el mensaje, y con WhatsApp abriéndose de a uno es seguro que varias quedarían marcadas sin haberse mandado. El módulo entero existe para trazabilidad. Si algún día se pide, la forma correcta es una Server Action en lote que escriba un motivo explícito ("marcada en lote sin confirmación de envío") detrás de un `ConfirmActionDialog`, no un botón al lado de "Ya lo envié".

## Archivos

**Creados**: `supabase/migrations/0017_campanas.sql`, `lib/notifications/audience.ts`, y en `components/admin/`: `campaign-reach.tsx`, `campaign-audience-field.tsx`, `campaign-form-dialog.tsx`, `campaign-send-dialog.tsx`, `campaigns-list.tsx`.

**Modificados**: `lib/notifications/types.ts`, `templates.ts`, `enqueue.ts`; `app/admin/(dashboard)/actions.ts`; `app/admin/(dashboard)/notificaciones/page.tsx`; `components/admin/notification-history.tsx`, `notification-whatsapp-inbox.tsx`.

## Verificación hecha

Exactamente esto, ni más:

- `npx tsc --noEmit` → **exit 0, sin salida**. `pnpm build` → **verde, 16/16 páginas**.
- `pnpm lint` → **no se pudo correr** (no hay `.eslintrc` en el repo; ver `CLAUDE.md`).
- **La migración `0017` se ejecutó de verdad**, contra un PostgreSQL 14 desechable levantado en local con stubs de las tablas de migraciones anteriores, **dos veces seguidas**:
  - Idempotente: la segunda corrida no falla ni duplica.
  - El `check` del `event` admite `'campaign'` y sigue rechazando valores inventados.
  - **Caso borde del nombre**: se renombró la constraint a mano a `notifications_event_check1` y se volvió a correr — la encontró por definición y la dejó correcta.
  - Los 5 segmentos devuelven lo esperado. **El caso legalmente crítico está probado**: elegir a mano a una clienta con `marketing_opt_out=true` y que quede excluida igual.
  - `campaign_audience_stats` sobre el juego de prueba: `total=3, reachable_email=2, reachable_whatsapp=3, excluded_opt_out=1`.
  - Permisos: `anon` no puede llamar `campaign_audience`/`campaign_audience_stats` ni alcanzar el esquema `private`; `authenticated` (con los privilegios de tabla que Supabase concede por default) obtiene los datos correctos. RLS activa en `campaigns`, cero políticas con `anon`.
- **No se probó nada contra Supabase real** ni contra Resend: la migración `0017` no está corrida en ninguno de los dos proyectos. Todo lo que dependa de PostgREST (los `Range` de las RPC, `max_rows` real, los default privileges reales) sigue sin verificar.
- **No hubo verificación visual en navegador** de las páginas autenticadas: el gate de auth no se tocó a propósito. El responsive se validó por análisis de código.

## Pendiente cuando se corra `0017`

Correrla en **los DOS proyectos** (dev `rtmuaeonmqadbezygfrv` y producción `rlpwmheokkrttxyfusyp`). Recordar el precedente del `0013`.

1. **Correrla primero en dev y verificar que las tres pestañas viejas siguen funcionando** — recrea dos constraints `check`, es lo más invasivo de la migración.
2. Que la pestaña Campañas deje de mostrar el aviso de migración faltante.
3. Crear una campaña de prueba con segmento `manual` de una sola clienta **propia**, enviarla, y verificar: que llegue el correo con el flyer embebido, que la fila de WhatsApp aparezca en la bandeja, y que el `wa.me` abra con el texto y el link correctos.
4. Confirmar que el conteo del preview coincide con lo que devuelve la SQL.
5. Verificar que una clienta con `marketing_opt_out=true` **no** recibe la campaña aunque se la elija a mano.
6. Confirmar que un cumpleaños o una reserva de clienta sin correo deja la fila OMITIDO con el motivo visible en el historial.
7. Probar `retryNotification` sobre esa fila después de cargarle el correo a la clienta: debería salir.
8. **Medir el volumen real**: si una campaña grande tarda días en salir por el límite del despachador, hay que subirlo o llamar a `dispatchPending` en bucle tras `sendCampaign`.

## Riesgos abiertos

1. **Nada probado contra Supabase.** Es el riesgo principal hasta que se corra la migración.
2. **Volumen de Resend**: el despachador procesa 40 por corrida (100 desde el cron diario). Una campaña grande se reparte en varias corridas, o sea **días**. No está resuelto; ver el punto 8 de arriba.
3. **El alcance por correo es de un tercio de la base** (19 de 59). No se atacó la captura de correo en `/reservar` — fue decisión explícita del usuario. Mientras no se carguen esos correos, el canal correo sigue siendo minoritario.
4. **El progreso de una campaña en la bandeja es por sesión** (`baselineRef`): al recargar vuelve a "0 de N". El texto lo explica, pero conviene confirmar que se entiende.
5. **La fila de motivo del historial** usa un `<TableRow>` con `colSpan={6}`: si alguien cambia las columnas de esa tabla, hay que actualizar ese número.
