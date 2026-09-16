# HANDOFF — Notificaciones, buscador de clientes, zona horaria y pulido

Bitácora narrativa de la sesión del **15-16 de septiembre de 2026**. Como el resto de los `HANDOFF-*.md`, es histórico: si contradice a `docs/REFERENCIA-CMS-Y-ADMIN.md`, `docs/PRD-notificaciones.md` o `CLAUDE.md`, mandan esos.

Se pidieron cinco cosas: buscador y paginación en clientes, un footer, notificaciones por correo y WhatsApp, arreglar la zona horaria de la agenda, y mejoras visuales. Se trabajó orquestando cuatro subagentes en fases (1A y 1B en paralelo, luego la 2, luego QA), con propiedad de archivos separada para que no se pisaran.

---

## Decisiones de producto tomadas al arrancar

| Tema | Decisión |
|---|---|
| WhatsApp | **No se automatiza todavía.** Correo automático + WhatsApp asistido, con la arquitectura lista para enchufar Cloud API cambiando un solo archivo. |
| Footer | El público ya existía y estaba bien; lo que faltaba era uno para `/admin`. |
| Correo | **Resend.** |
| Alcance | Todo, en fases. |

La de WhatsApp es la que más condicionó el diseño: automatizar de verdad exige WhatsApp Cloud API de Meta (verificación de negocio, número dedicado y plantillas aprobadas) o un BSP pago. Los `wa.me` que ya usaba el proyecto necesitan un humano que haga clic, así que no sirven para automatizar.

---

## 1. Zona horaria de la agenda

**El diagnóstico no era el obvio.** Los eventos siempre se pintaron bien: `components/admin/agenda-calendar.tsx` corre FullCalendar con `timeZone='UTC'` y convierte cada cita a un ISO "falso-UTC" con la hora de pared de Bogotá (`toFakeUtcIso`). Lo que estaba mal era el **"ahora"**, que FullCalendar calculaba con el UTC real, 5 horas adelante: la línea roja del `nowIndicator` aparecía corrida y el resaltado de "hoy" saltaba de día a las 19:00 de Bogotá.

Se verificó leyendo el bundle de FullCalendar 6.1.21, no de memoria: en `CalendarNowManager`, si la opción `now` es un **valor** se ancla una sola vez, pero si es una **función** se reinvoca en cada lectura. Por eso el arreglo (`now={fullCalendarNow}`, devolviendo `nowInBogota()`) corrige de un golpe el `nowIndicator`, el resaltado de hoy, `calendarApi.today()` y `buildValidRange`, **y la línea roja sigue avanzando en tiempo real**.

Se auditó el resto de la app buscando el mismo patrón y **no había más bugs reales**. Vale la pena registrar los descartes, porque volver a "arreglarlos" sería un error:

- `loyalty.ts`, `availability.ts`, `rate-limit.ts`, `reservar/actions.ts` — comparan dos instantes reales entre sí; la zona del proceso es irrelevante.
- `block-slot-dialog.tsx` y `step-datetime.tsx` usan `format(date,'yyyy-MM-dd')` de date-fns con getters locales. **No es bug**: el `Date` viene de `react-day-picker` a medianoche *local del navegador*, así que leerlo con getters locales es un round-trip exacto, y son componentes cliente que nunca corren con el reloj UTC de Vercel. Cambiarlo los rompería.
- `footer.tsx` con `new Date().getFullYear()` — mostraría el año siguiente entre las 19:00 y medianoche del 31 de diciembre en Bogotá. Cosmético, cinco horas al año; se dejó.

Helpers nuevos en `lib/booking/timezone.ts`: `nowInBogota()` y `todayInBogota()`.

---

## 2. Clientes: buscador y paginación

El problema real no era la falta del buscador, era que la página traía **todos** los clientes *y* **todas** las citas `COMPLETADA` para contar visitas en JavaScript.

Ahora agrega Postgres: vista `clients_with_stats` con **`security_invoker = true`** (sin eso la vista correría como su dueño y se saltaría la RLS de `clients`/`appointments`), más índices GIN `pg_trgm` para que el `ilike '%texto%'` no haga seq scan. Estado en la URL (`?q=&page=&orden=`), 25 por página, orden por columna.

Dos detalles que conviene no perder:

- El texto de búsqueda se sanea con **lista blanca** antes de entrar al filtro `.or()` de PostgREST. Una coma o un paréntesis del usuario romperían la sintaxis del filtro, y `%`/`_` son comodines de `ilike`. Se verificó construyendo la URL real con la librería.
- Si se pide una página fuera de rango, se reconsulta la última real en vez de mostrar una tabla vacía sin explicación.

La migración `0013` agrega `set search_path = public, extensions;` después del `create extension`: Supabase suele instalar las extensiones en el esquema `extensions`, y sin eso `gin_trgm_ops` puede no resolverse.

---

## 3. Notificaciones

### Brecha que bloqueaba todo

**No se capturaba el correo de la clienta.** `clients.email` existía desde la `0001`, pero el wizard de `/reservar` nunca lo pidió. Se agregó como campo **opcional** (obligatorio subiría la fricción de la reserva, y WhatsApp sigue siendo el canal principal en Colombia), guardado con el mismo criterio de no-sobreescritura que el nombre: rellena si está vacío, nunca pisa uno existente. Si no, bastaría conocer un teléfono ajeno para redirigir las notificaciones de otra persona.

### Outbox, no envío directo

Nada se envía desde la Server Action. `createBookingRequest` **encola** en `notifications` y un worker despacha. Si Resend está caído la cita se crea igual. Se verificó ejecutando el camino real con la `0014` sin correr: supabase-js devuelve el error en el objeto de resultado en vez de lanzar, el encolado corta antes de intentar ningún insert, y todo va en `try/catch` dentro de `after()`.

### Dos protecciones contra duplicados, no una

Es el punto más fino del módulo:

1. **Índice único sobre `dedupe_key`** → protege el **encolado**.
2. **Claim atómico** (`update ... where status='PENDIENTE' returning`) → protege el **envío**.

La segunda se agregó en QA. El índice solo no alcanza: hay dos disparadores independientes (el cron diario y el `dispatchQuietly()` de cada reserva) y el worker lee *todas* las filas pendientes, no solo las suyas — **dos reservas con segundos de diferencia bastan** para que ambas tomen la misma fila y manden dos correos. Las filas que quedan colgadas en `ENVIANDO` más de 10 minutos vuelven a la cola (`STALE_CLAIM_MS`, holgadamente mayor que el `maxDuration = 60` de la ruta).

### WhatsApp asistido, listo para escalar

El adaptador de WhatsApp no envía: deja la notificación `PENDIENTE` para una bandeja del panel con el mensaje redactado y un botón `wa.me`. Comparte interfaz con el de correo, y `dispatch.ts` decide qué despachar mirando su flag `sendsAutomatically` (los asistidos quedan fuera del query a propósito: si entraran, taponarían la cabeza de la cola para siempre).

Migrar a Cloud API = implementar `send()` en `lib/notifications/channels/whatsapp.ts`, cambiar el flag y agregar dos variables. No se toca el encolado, ni el cron, ni la UI.

### Habeas Data

El saludo de cumpleaños es **marketing**, no transaccional: respeta `clients.marketing_opt_out` (Ley 1581 de 2012), con interruptor en la ficha de la clienta y nota de baja en el correo. Los avisos de cita son transaccionales y se mandan siempre.

### Cron

Un solo job diario (`0 13 * * *` = 08:00 Bogotá) hace las tres cosas, porque el plan Hobby de Vercel admite 2 jobs y frecuencia diaria. **El panel de Vercel muestra los horarios en UTC** — ahí se lee "At 01:00 PM". Limitación conocida: con un cron diario, `reminder_hours_before` define *cuántos días* antes se avisa, no la hora exacta.

### Logo en los correos

Se pidió sobre el final. **El logo del sitio es un SVG y no sirve**: Gmail y Outlook no renderizan SVG dentro de un `<img>`; solo Apple Mail. Se generó un PNG de 240×242 con `sharp` a densidad 300 y se le dio su propia columna (`notification_settings.email_logo_url`), editable desde el panel. `updateNotificationSettings` rechaza explícitamente una URL `.svg`.

El `alt` lleva el nombre del centro **estilado con la tipografía y el color de la cabecera**: muchos clientes bloquean imágenes por defecto y esa línea es lo único visible hasta que la destinataria las habilita.

---

## 4. Footer del admin, estados de carga y pulido

No existía **ni un solo** `loading.tsx`, `error.tsx` ni `not-found.tsx` en toda la app, ni primitivo `Skeleton`. Las mutaciones sí estaban bien cubiertas con `useTransition` (~30 componentes); el hueco era la navegación entre rutas. Se agregaron 11 `loading.tsx` con esqueletos que imitan la forma real de cada página, un `error.tsx` y dos `not-found` (uno dentro del panel, porque el `notFound()` de una ficha inexistente expulsaba al 404 público).

La home **no** lleva esqueleto a propósito: es estática con `revalidate 60`, el HTML sale de caché al instante y un hero esquelético se ve peor que el hero real.

La barra de progreso de navegación (`route-progress.tsx`) usa un listener de click en **fase de captura sobre `document`**, no instrumentación de enlaces: `useLinkStatus` llegó en Next 15.3 y el repo está en 15.2.8, y `usePathname()` solo cambia cuando la navegación ya se comprometió. Detecta el fin comparando `pathname + search`, porque la paginación de clientes y las flechas de mes de Finanzas solo cambian el query string.

Hallazgo no pedido: **los tiles de la galería pública eran inalcanzables por teclado** (eran `motion.div` con `onClick` y nada más). Ya tienen `role`, `tabIndex`, Enter/Espacio y `aria-label`.

Se verificó que los "Enlaces Rápidos" del footer público **no estaban rotos**, contra la sospecha inicial: las secciones siguen emitiendo sus `id`, el orden dinámico cambió la posición, no los anclajes. Quedan dos observaciones sin actuar: si Manu desactiva una sección desde el CMS ese ancla desaparece y el enlace falla en silencio; y "Galería" apunta al preview del home en vez de a `/galeria`.

---

## 5. Lo que encontró QA

Tres defectos que las fases de implementación no vieron:

1. **Carrera en el despacho** (arriba). Confirmada y arreglada.
2. **Inyección de cabeceras de correo** vía el nombre de la clienta: `bookingRequestSchema.name` aceptaba CR/LF y `{{cliente}}` aparece en el asunto de dos plantillas. Se agregó `sanitizeHeaderValue()`.
3. **La `0014` no era re-ejecutable**: sus `create policy` no llevaban `drop policy if exists` delante, y con `create table if not exists` una segunda corrida llegaba intacta hasta ahí y moría. Escenario nada hipotético con alguien pegando SQL a mano.

También se corrigió que `.env.local.example` estaba capturado por la regla `.env*` de `.gitignore` y nunca se habría commiteado, y un archivo que había quedado con **bytes de control literales** dentro de un regex (git y grep lo trataban como binario, así que sus diffs habrían salido como "Binary files differ").

---

## 6. El problema que se llevó más tiempo al final

Con todo desplegado, `/admin/clientes` mostraba en producción el aviso de "revisa que la migración 0013 se haya corrido", aunque estaba corrida.

Se descartó todo lo demás antes de dar con la causa: con la clave de servicio la vista devolvía las 21 filas, y creando un usuario temporal para probar con una sesión real (rol `authenticated`, el que usa la página) también. La consulta y los permisos estaban bien.

**La causa: hay dos proyectos de Supabase.** Dev (`rtmuaeonmqadbezygfrv`) y producción (`rlpwmheokkrttxyfusyp`), sin nada compartido. Las migraciones se habían corrido solo en dev. Se detectó extrayendo la URL de Supabase del bundle desplegado, que la lleva por ser `NEXT_PUBLIC_`.

Dos consecuencias que hay que recordar:

- **Cada migración se corre dos veces**, una por proyecto.
- **El Storage es independiente**, así que ninguna migración debe sembrar una URL de Storage fija. La `0015` lo hacía (error introducido en esta sesión) y se reescribió: habría dejado los correos de producción sirviendo el logo desde el bucket de desarrollo.

Esto quedó documentado en `CLAUDE.md` y en `docs/REFERENCIA-CMS-Y-ADMIN.md`, que decía "Producción: no existe todavía" — desactualizado desde antes de esta sesión.

---

## Migraciones que dejó la sesión

| # | Qué hace |
|---|---|
| 0013 | `pg_trgm` + índices GIN, vista `clients_with_stats` (`security_invoker`) |
| 0014 | `notifications` (outbox), `notification_templates` (+seed de 8), `notification_settings`, `clients.marketing_opt_out` |
| 0015 | `notification_settings.email_logo_url` |

Las tres corridas en **ambos** proyectos.

---

## Limitaciones conocidas

- Con un cron diario, la hora exacta del recordatorio la fija el horario del job.
- No existe el evento `booking_confirmed` (avisar cuando Manu confirma). Agregarlo exige `drop constraint`/`add constraint` en `notifications` y `notification_templates`, más dos filas de seed.
- `enqueueNotifications` devuelve `rows.length`, no las filas realmente insertadas: con `ignoreDuplicates` un conflicto se cuenta igual. Solo infla el JSON que devuelve el cron en corridas repetidas.
- Sigue en pie la de antes: **una cita = un servicio**.
- No hay ESLint configurado: `next lint` abre un asistente interactivo y no es ejecutable en CI tal como está.
