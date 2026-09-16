# Referencia técnica — CMS y panel administrativo

Documento de referencia (no narrativo, a diferencia de los `HANDOFF-*.md`) del estado **actual** de la aplicación: rutas, modelo de datos, Server Actions ("endpoints" — este proyecto no tiene API REST, todas las mutaciones son Server Actions de Next.js) y componentes. Si estás retomando este proyecto en una sesión nueva, este archivo + `docs/PRD-agendamiento.md` (el sistema de citas, anterior a todo esto) es todo lo que hace falta leer para tener el panorama completo, sin repasar los `HANDOFF-*.md`, que son log histórico. **Si un handoff contradice a este archivo, manda este archivo.**

## Cómo está organizado el proyecto

Tres bloques conviven sobre la misma base de Supabase:

1. **Agendamiento** (`docs/PRD-agendamiento.md` y sus `HANDOFF-fase-*.md`) — citas, clientes, disponibilidad, fidelización.
2. **CMS de contenido del sitio** (`docs/PRD-cms-contenido-y-promociones.md` y los `HANDOFF-cms-*`/`HANDOFF-rediseno-*`/`HANDOFF-orden-unificado-*`) — todo lo que antes estaba hardcodeado en los componentes públicos (carrusel, servicios, galería, sobre nosotros, misión/visión, footer, promociones) ahora se administra desde `/admin/contenido`, con imágenes en Supabase Storage.
3. **Finanzas** (`docs/HANDOFF-finanzas-y-navegacion.md`) — libro de movimientos, cuentas, categorías de gasto y gastos fijos, reconstruido sobre el modelo de la migración `0016`. Se apoya en `appointments` para el ingreso por servicio, pero es un módulo aparte.

Un solo admin autenticado (Supabase Auth, sin roles) tiene acceso total a los tres vía RLS `for all to authenticated using (true)`.

## Rutas

### Públicas
| Ruta | Qué es | Caché |
|---|---|---|
| `/` | Home — Hero + bloques ordenables (ver "site_sections" abajo) + Footer | ISR `revalidate = 60` |
| `/galeria` | Galería completa (filtro por categoría + lightbox) | ISR `revalidate = 60` |
| `/reservar` | Wizard de reserva pública (servicio → fecha/hora → datos) | dinámico |

### Admin (`/admin/*`, protegidas por `middleware.ts` + `app/admin/(dashboard)/layout.tsx`)
| Ruta | Qué administra |
|---|---|
| `/admin` | Bandeja de solicitudes de cita |
| `/admin/agenda` | Calendario (FullCalendar), vista semana/día/mes |
| `/admin/reservar` | Crear cita manualmente |
| `/admin/horarios` | Plantilla semanal de disponibilidad + bloqueos puntuales |
| `/admin/servicios` | Catálogo de servicios agendables (duración/precio/anticipo/categoría de marketing) |
| `/admin/finanzas` | **Finanzas** — 4 pestañas (`?tab=`): Resumen, Movimientos, Gastos fijos, Cuentas. Mes por `?month=YYYY-MM`. Ver "Finanzas" abajo |
| `/admin/clientes` | Listado (buscador + paginación de 25) y ficha de cliente (historial, fidelización, preferencia de marketing) |
| `/admin/contenido` | **CMS** — 6 pestañas: Carrusel, Servicios (categorías), Galería, Promociones, Secciones, Sitio |
| `/admin/notificaciones` | **Notificaciones** — 3 pestañas: Plantillas (+ configuración), Pendientes de WhatsApp, Historial. Ver `docs/PRD-notificaciones.md` |
| `/admin/login` | Login (Supabase Auth email/password) |

### API HTTP (única excepción al patrón de Server Actions)
| Ruta | Qué es |
|---|---|
| `/api/cron/notificaciones` | Proceso diario del módulo de notificaciones: encola recordatorios, encola cumpleaños y despacha el outbox. `GET` y `POST`. **No** pasa por `middleware.ts` (que solo matchea `/admin/:path*`): se autentica sola. Si `CRON_SECRET` está configurado exige `Authorization: Bearer $CRON_SECRET`; si no, acepta la cabecera `x-vercel-cron`. Registrada en `vercel.json` (`0 13 * * *` UTC = 08:00 Bogotá) |

## Modelo de datos

### Agendamiento (ver PRD-agendamiento.md)
`services`, `clients`, `availability`, `blocked_slots`, `appointments`, `loyalty_rewards`, más `services.category_id` (FK opcional a `service_categories`, `on delete set null`) que enlaza un servicio agendable a su card de marketing.

`appointments` ganó en `0016` la columna **`account_id`** (FK a `financial_accounts`, `on delete set null`): a qué cuenta entró el ingreso de esa cita. `payment_method` (texto libre desde `0003`) **se conserva y se sigue escribiendo** con el nombre de la cuenta elegida — es lo que muestra el historial de citas, y las citas anteriores a `0016` cuyo método no calzó con ninguna cuenta siguen viviendo solo ahí.

**`expenses` es una tabla MUERTA desde `0016`.** Se conserva intacta (regla aditiva: los dos proyectos tienen datos reales) pero **nadie la lee ni le escribe**: sus filas se copiaron a `financial_movements` con `kind='GASTO'` y `legacy_expense_id`. No insertar ahí a mano — esas filas no aparecerían en Finanzas.

### CMS de contenido

**`hero_slides`** — diapositivas del carrusel de inicio.
`id, media_type ('image'|'video'), image_url, video_url, title, subtitle, description, cta_label, cta_href, display_order, active, created_at, updated_at`. `video_url` solo si `media_type='video'`; `image_url` sirve de poster mientras carga el video.

**`service_categories`** — cards de "Servicios" en la home (1 categoría agrupa N filas de `services`).
`id, name, description, image_url, features (jsonb string[]), display_order, active, created_at, updated_at`.

**`gallery_images`** — banco de imágenes de la galería (usado tanto en la preview del home como en `/galeria`).
`id, image_url, alt_text, category (texto libre), display_order, active, created_at`.

**`promotions`** — modal de promoción al entrar al sitio. Solo puede haber **una activa a la vez** (índice único parcial `unique index ... (active) where active`).
`id, title, body, image_url, cta_label, cta_href, requires_birthday, image_only, active, starts_at, ends_at, created_at, updated_at`. `image_only=true` → el modal muestra solo la imagen (sin recortar, sin título/texto encima) y se ajusta al tamaño exacto de la imagen. `requires_birthday=true` → pide nombre+teléfono+fecha de nacimiento antes de cerrar, y hace `upsert` en `clients` por teléfono (nunca sobreescribe nombre/cumpleaños ya existentes).

**`site_settings`** — fila **singleton** (`id boolean primary key default true`, solo puede existir una fila). Marca, contacto, "Sobre nosotros", Misión/Visión y colores de tema.
`id, logo_url, phone_display, whatsapp_number, email, address, instagram_url, facebook_url, footer_tagline, about_intro, founder_name, founder_bio, founder_roles (jsonb string[]), founder_image_url_1, founder_image_url_2, mission_text, vision_text, theme_ink, theme_sand, theme_teal, updated_at`. Los `theme_*` son hex nullable — `null` = usar el default de `app/globals.css`.

**`site_sections`** — **todos los bloques del home entre el Hero y el Footer**, en un único orden arrastrable. Columna `kind` distingue:
- `'editorial'` — bloque con contenido propio (foto/video/color de fondo + texto + CTA opcional). Es lo que el admin crea/edita libremente.
- `'services' | 'about' | 'mission_vision' | 'gallery'` — filas **marcador**, sembradas una sola vez por migración, sin contenido propio (ese sigue viviendo en `service_categories`/`site_settings`/`gallery_images`). Solo sirven para poder reordenar y activar/desactivar esas secciones fijas junto con las editoriales. No se pueden crear ni eliminar desde el admin (`createSiteSection` siempre inserta `kind='editorial'`; `deleteSiteSection` rechaza cualquier fila con `kind !== 'editorial'`, tanto en la UI como en el servidor).

Columnas: `id, kind, title, body, media_type ('image'|'video'|'color'), image_url, video_url, bg_color, text_color, text_align ('left'|'center'|'right'), cta_label, cta_href, display_order, active, created_at, updated_at`.

### Notificaciones (migración 0014 — ver `docs/PRD-notificaciones.md`)

**`notifications`** — el **outbox**. Nada se envía directo desde una Server Action: se encola una fila acá y un worker (`lib/notifications/dispatch.ts`) la despacha.
`id, event ('booking_requested'|'appointment_reminder'|'birthday'), channel ('email'|'whatsapp'), recipient_kind ('client'|'admin'), to_email, to_phone, client_id (FK null), appointment_id (FK null), subject, body (ya renderizado), status ('PENDIENTE'|'ENVIANDO'|'ENVIADO'|'FALLIDO'|'OMITIDO'), attempts, scheduled_for, sent_at, error, dedupe_key, created_at, updated_at`.
`dedupe_key` con **`unique index`** es la idempotencia del encolado (`on conflict do nothing`); `ENVIANDO` es el claim atómico que impide que dos despachos simultáneos manden el mismo correo dos veces.

**`notification_templates`** — plantillas editables desde el panel, una por `(event, channel, recipient_kind)` (unique).
`id, event, channel, recipient_kind, subject (solo correo), body, enabled, created_at, updated_at`. El cuerpo admite `{{cliente}}`, `{{servicio}}`, `{{fecha}}`, `{{hora}}`, `{{negocio}}`, `{{telefono}}`, `{{telefono_cliente}}`; se resuelven en `lib/notifications/templates.ts`, **escapando HTML** en los valores antes de interpolarlos en un correo.

**`notification_settings`** — fila **singleton** (mismo truco que `site_settings`).
`id (boolean pk), admin_email, admin_whatsapp, business_name, reminder_hours_before (1-168), birthday_send_day (1-28), updated_at`. `admin_email`/`admin_whatsapp` en `null` caen a `site_settings.email`/`whatsapp_number`.

Además, `clients.marketing_opt_out boolean default false`: el saludo de cumpleaños es marketing (Ley 1581 de 2012) y lo respeta; solicitud y recordatorio son transaccionales y no dependen de esa bandera.

### Vista `clients_with_stats` (migración 0013)

Vista sobre `clients` + un `left join lateral` que cuenta las citas `COMPLETADA` y toma la última. `/admin/clientes` consulta esta vista con `.range()` + `count: 'exact'` en vez de traer todos los clientes y todas las citas y agregar en JavaScript.
Columnas: las de `clients` (menos `marketing_opt_out`) + `visit_count int`, `last_visit timestamptz`.
Se crea `with (security_invoker = true)` (Postgres 15+) para que **herede la RLS** de `clients`/`appointments` en vez de ejecutarse como su dueño. `grant select` **solo a `authenticated`** — nunca a `anon`: son datos personales, no contenido de marketing.
Índices de apoyo: `pg_trgm` + GIN sobre `clients.name`/`clients.phone` (el buscador usa `ilike '%texto%'`, que sin trigramas degenera en seq scan) y un índice parcial `appointments (client_id, start_time desc) where status = 'COMPLETADA'`.

### Finanzas (migración 0016)

Cuatro tablas nuevas. Las cuatro llevan **solo** `admin_full_access` (`for all to authenticated`) — son datos financieros, **nunca** darles lectura pública a `anon` como sí tienen las tablas de contenido.

**`financial_accounts`** — dónde vive la plata (se siembran `Efectivo`, `Nequi`, `Transferencia / Banco`).
`id, name (unique), kind ('EFECTIVO'|'DIGITAL'|'BANCO'|'OTRO'), opening_balance int, display_order, active, created_at, updated_at`.
`opening_balance` es el saldo con el que arranca la cuenta: sin él la caja arrancaría en cero e ignoraría la plata que ya existía antes de usar el sistema. El `unique (name)` hace idempotente el seed y habilita el backfill de `appointments.account_id` por coincidencia de nombre con `payment_method`. **Las cuentas se desactivan, no se borran.**

**`expense_categories`** — categorías gestionadas, reemplazan el texto libre de `expenses.category` (con texto libre, "Insumos" e "insumos " son dos categorías y el desglose miente).
`id, name (unique), nature ('FIJO'|'VARIABLE'), display_order, active, created_at, updated_at`. `nature` es lo que permite leer cuánto del mes ya estaba comprometido sin pedirle a Manu que lo clasifique cada vez. Tampoco se borran, se desactivan.

**`financial_movements`** — **el libro**: todo lo que **no** es ingreso por cita. Una sola tabla con discriminador `kind` en vez de una tabla por concepto (son la misma forma y el mismo listado; separarlas obligaría a un `UNION` en cada consulta de caja).
`id, movement_date (date), kind ('INGRESO_OTRO'|'GASTO'|'RETIRO'|'APORTE'), amount int > 0, account_id (FK, on delete restrict), category_id (FK, on delete set null), description, recurring_template_id (FK, on delete set null), legacy_expense_id (unique), created_at, updated_at`.
- `movement_date` es un `date` simple, no `timestamptz`: un gasto no tiene hora relevante y así se compara como string `'YYYY-MM-DD'` sin conversión de zona.
- `account_id` es `on delete restrict` a propósito: borrar una cuenta con movimientos dejaría la caja descuadrada en silencio.
- `category_id` solo tiene sentido en `kind='GASTO'`; lo limpian las Server Actions, no un `check` (un check bloquearía correcciones).
- `legacy_expense_id` unique es la idempotencia del backfill desde `expenses`.

**`recurring_expenses`** — plantillas de gasto fijo mensual.
`id, name, category_id (FK), account_id (FK), amount int > 0, day_of_month (1-28), active, created_at, updated_at`. `day_of_month` va hasta 28 para que la plantilla exista en todos los meses, febrero incluido. **No generan movimientos solas** (ver abajo).

#### La postura contable — tres números, no uno

Es la decisión de diseño central del módulo y está escrita también en el encabezado de `0016_finanzas.sql` y de `lib/finance/queries.ts`. **No re-litigarla.**

| Número | Qué es | Entran RETIRO/APORTE |
|---|---|---|
| **Utilidad del negocio** (`netProfit`) | ingresos operativos − gastos operativos del mes | **No** |
| **Caja disponible** (`getCashPosition().totalCash`) | acumulado histórico: saldos iniciales + todo lo que entró − todo lo que salió | **Sí** |
| **Retirado en el mes** (`withdrawals`) | Σ `RETIRO` del mes | — |

Un retiro **no es un gasto**: es utilidad ya ganada que cambia de bolsillo. Ese era el problema original del módulo anterior (`ingresos − gastos` y nada más), donde registrar un retiro como gasto corrompía la utilidad y el desglose por categoría.

- **El ingreso por servicio vive solo en `appointments`**: se reconoce en la fecha de la cita (`start_time`, hora Bogotá) por `charged_amount` sobre citas `COMPLETADA`. `financial_movements` guarda todo lo demás. Ninguna consulta mezcla las dos fuentes para el mismo concepto, así que **no hay doble conteo**.
- **Los anticipos NO se suman como ingreso.** `deposit_received_amount` es un adelanto del mismo `charged_amount` que se registrará al cerrar la cita: sumarlo aparte contaría el mismo peso dos veces. Se expone como KPI aparte, **"Anticipos retenidos"** (`getHeldDeposits`), sobre las citas en `SOLICITADA`/`ESPERANDO_ANTICIPO`/`CONFIRMADA`.
- **Los gastos fijos no se registran solos, a propósito.** Un fijo puede cambiar de monto o no pagarse, y un movimiento inventado descuadraría utilidad y caja en silencio. La UI los ofrece como pendientes del mes (`getPendingRecurringExpenses` + `registerRecurringExpense`). Un mes futuro nunca tiene pendientes; dentro del mes en curso se ofrecen todos aunque su `day_of_month` no haya llegado (esconderlos obligaría a registrarlos a mano, sin vínculo a la plantilla, y volverían a aparecer como pendientes).
- Los movimientos y citas **sin `account_id`** igual cuentan en la caja global, pero no en el saldo de ninguna cuenta: caen en `unassignedBalance`, junto con lo que quedó pegado a una cuenta desactivada. Invariante: `totalCash === Σ byAccount.balance + unassignedBalance`.

#### `lib/finance/` — la capa de agregación

`lib/finance/queries.ts` **es el contrato con la UI**: la página no hace cuentas a mano (antes toda la agregación vivía suelta dentro de `finanzas/page.tsx`). Exporta `listFinancialAccounts`, `listExpenseCategories`, `listRecurringExpenses`, `getMonthlyFinancialSummary`, `getPreviousMonthComparison`, `getCashPosition`, `getHeldDeposits`, `getRevenueByService`, `getExpensesByCategory`, `getIncomeByAccount`, `getDailyCashFlow`, `listMovements`, `getMonthlyMovementsForCsv`, `getPendingRecurringExpenses`.

`lib/finance/month.ts` son helpers de `'YYYY-MM'` puros (los usan Server Components y componentes cliente), calculados con getters **UTC** sobre `Date.UTC(...)`. **Las dos escalas de tiempo son el error sutil del módulo**: `monthRange()` da `'YYYY-MM-DD'` para `financial_movements` (un `date`) y `monthUtcRange()` da instantes UTC para `appointments.start_time` (un `timestamptz`). Comparar un `timestamptz` contra `'YYYY-MM-01'` mete las 5 primeras horas del día 1 en el mes anterior.

`lib/finance/types.ts` re-exporta las filas de tabla desde `lib/supabase/types.ts` (la convención del proyecto) y define los tipos agregados.

> **La agregación histórica corre en Postgres.** `getCashPosition()`, `getRevenueByService()` y el reparto de clientes nuevos vs. recurrentes no traen filas crudas: llaman por `supabase.rpc()` a las funciones `finance_cash_flow_by_account()`, `finance_revenue_by_service(p_start, p_end)` y `finance_client_mix(p_start, p_end)` (migración `0016`, sección 7). El motivo es cómo fallaba antes: PostgREST corta todo `select` en `max_rows` (1000 por defecto) y estas consultas pedían el histórico entero para sumarlo en TypeScript — pasado el corte **la caja disponible quedaba subestimada sin dar error**. Ahora lo que viaja por el cable es una fila por cuenta o por servicio. Las funciones son `security invoker` (heredan la RLS de quien llama, igual que la vista `clients_with_stats` de 0013) y tienen el `EXECUTE` revocado a `anon`/`public`; **nunca pasarlas a `security definer`**, eso saltaría la RLS de `appointments`/`financial_movements`. Ante un error lanzan `FinanceAggregateError` en vez de devolver ceros: un cero silencioso en un número de plata es peor que un error visible.

> **Regla duplicada, señalizada.** Qué `kind` entra al P&L y con qué signo se decide en `MOVEMENT_KIND_IS_OPERATING` y `MOVEMENT_KIND_SIGN` (`lib/finance/types.ts`); `getMonthlyTotals` **deriva** de ahí en vez de repetir la regla. Queda una copia inevitable en el `case when` de `finance_cash_flow_by_account()` (`0016` §7a) — Postgres no importa un `Record` de TypeScript. Si cambiás un signo o agregás un `kind`, hay que tocar la función **y correr la migración en los dos proyectos**; si no, la caja y la utilidad dejan de cuadrar en silencio.

### RLS de las tablas de contenido
Todas siguen el mismo patrón: `admin_full_access` (`for all to authenticated using (true) with check (true)`) + `public_read_active` (`for select to anon, authenticated using (active = true)`, con la condición extra de ventana de fechas en `promotions`). Es una excepción deliberada al patrón del resto de la app (donde el público nunca lee con la anon key) — es contenido de marketing de solo lectura, sin lógica sensible que proteger. `site_settings` no tiene condición `active` (es la única fila, siempre aplica).

Las tres tablas de notificaciones **no** son contenido público: llevan solo `admin_full_access`, sin `public_read_active`. El cron las lee con el cliente `service_role`, que bypassa RLS.

Las cuatro tablas de Finanzas tampoco: solo `admin_full_access`. Son datos financieros y **nunca** deben recibir una política de lectura para `anon`.

## Server Actions

Todas en `app/admin/(dashboard)/actions.ts` salvo las dos marcadas como públicas. Patrón uniforme: `requireUser()` exige sesión antes de cualquier mutación de admin; todas devuelven `{ ok: true }` o `{ ok: false, error: string }`; las de contenido llaman `revalidateContenido()` (revalida `/`, `/admin/contenido`, `/reservar`) al final.

### Contenido — Carrusel (`hero_slides`)
`createHeroSlide`, `updateHeroSlide`, `setHeroSlideActive`, `deleteHeroSlide`, `reorderHeroSlides(orderedIds)`

### Contenido — Categorías de servicio (`service_categories`)
`createServiceCategory`, `updateServiceCategory`, `setServiceCategoryActive`, `deleteServiceCategory`, `reorderServiceCategories(orderedIds)`

### Contenido — Galería (`gallery_images`)
`createGalleryImage`, `updateGalleryImage`, `setGalleryImageActive`, `deleteGalleryImage`, `reorderGalleryImages(orderedIds)`

### Contenido — Promociones (`promotions`)
`createPromotion`, `updatePromotion`, `setPromotionActive` (desactiva cualquier otra activa antes de activar esta, para no chocar con el índice único), `deletePromotion`

### Contenido — Secciones del home (`site_sections`)
`createSiteSection` (siempre `kind='editorial'`), `updateSiteSection`, `setSiteSectionActive`, `deleteSiteSection` (rechaza filas no-editoriales), `reorderSiteSections(orderedIds)`

### Contenido — Configuración del sitio (`site_settings`)
`updateSiteSettings(input)` — todos los campos de marca/contacto/sobre-nosotros/misión-visión.
`updateThemeColors({ ink, sand, teal })`, `resetThemeColors()` — colores de marca.

### Contenido — Subida de archivos
`uploadSiteMedia(folder, formData)` — acepta `image/*` o `video/*` (tope de 15MB para video), sube a Supabase Storage bucket `site-media`, devuelve la URL pública. `folder` es una de `'hero' | 'services' | 'gallery' | 'promos' | 'site'` (organización de carpetas, no hay lógica distinta por carpeta).

### Finanzas (`financial_movements`, `financial_accounts`, `expense_categories`, `recurring_expenses`)

Todas revalidan `/admin/finanzas`.

- **Movimientos**: `createFinancialMovement(input)`, `updateFinancialMovement(id, input)`, `deleteFinancialMovement(id)`. Comparten `buildMovementRow`, que valida el `kind`, valida la fecha con getters UTC sobre `Date.UTC` (atrapa cosas como `'2026-02-31'`), redondea el monto a entero (pesos colombianos, sin centavos) y **descarta `category_id` en silencio si el `kind` no es `GASTO`** (una categoría de gasto en un retiro ensuciaría el desglose).
- **Cuentas**: `createFinancialAccount`, `updateFinancialAccount`, `setFinancialAccountActive`, `reorderFinancialAccounts`. **Sin borrado duro** (la FK es `on delete restrict`).
- **Categorías de gasto**: `createExpenseCategory`, `updateExpenseCategory`, `setExpenseCategoryActive`, `reorderExpenseCategories`. **Sin borrado duro** (aunque la FK sea `on delete set null`, borrar dejaría huérfanos los gastos históricos). El `23505` del unique se traduce a "Ya existe una categoría con ese nombre".
- **Gastos fijos**: `createRecurringExpense`, `updateRecurringExpense`, `setRecurringExpenseActive`, `deleteRecurringExpense` (**acá sí hay borrado duro**: una plantilla es una conveniencia, no un dato contable, y sus movimientos sobreviven vía `on delete set null`), `registerRecurringExpense(templateId, month)` — materializa el gasto de una plantilla en un mes. El chequeo de duplicados es por consulta, no por índice único: el mismo fijo podría legítimamente pagarse dos veces en un mes por un ajuste.

**`createExpense` / `updateExpense` / `deleteExpense` fueron ELIMINADAS** junto con su UI (`expenses-table.tsx`, `expense-form-dialog.tsx`). Un export de un archivo `'use server'` es un endpoint público y no tiene sentido mantener tres que nadie llama. Todo gasto nuevo entra por `createFinancialMovement` con `kind='GASTO'`.

### Notificaciones (`notification_templates`, `notification_settings`, `notifications`)
`updateNotificationTemplate(id, {subject, body})`, `setNotificationTemplateEnabled(id, enabled)`, `updateNotificationSettings(input)`, `markWhatsAppNotificationSent(id)` (bandeja asistida: Manu manda el mensaje por `wa.me` y lo cierra acá), `skipWhatsAppNotification(id)`, `retryNotification(id)` (vuelve a `PENDIENTE` y despacha), `sendTestNotificationEmail(templateId, toOverride?)` (correo de prueba con valores de ejemplo), `setClientMarketingOptOut(clientId, optOut)`.

### Público (fuera de `/admin`)
- `app/reservar/actions.ts` → `getAvailability(serviceId)`, `createBookingRequest(input)` — flujo de reserva pública, con honeypot + rate limit (`lib/booking/rate-limit.ts`), usa `createServiceClient()` (service role, bypassa RLS con validación propia). El wizard pide además un **correo opcional** (`clients.email`, que se rellena si estaba vacío pero nunca se pisa desde el formulario público). Tras el insert de la cita encola las notificaciones y las despacha dentro de `after()`: todo va en `try/catch`, un fallo de correo no puede tumbar una reserva.
- `app/promo-actions.ts` → `submitPromoLead(input)` — captura del modal de promoción cuando `requires_birthday=true`. Mismo patrón anti-abuso y de no-sobreescritura que `createBookingRequest`.

### Agendamiento
`confirmAppointment`, `markDepositReceived`, `rejectAppointment`, `completeAppointment` (cierra la cita: registra servicio realizado + valor cobrado + **cuenta**, y evalúa fidelización), `markNoShow`, `createBlockedSlot`, `deleteBlockedSlot`, `createAvailabilityWindow`, `deleteAvailabilityWindow`, `searchClients`, `createManualAppointment`, `updateAppointmentBooking` (servicio + fecha/hora + duración de una cita no cerrada; reemplaza al antiguo `rescheduleAppointment`), `getBookableServices`, `getAppointmentDetail` (detalle completo de una cita para el diálogo de la agenda, incluye cupón aplicado/generado), `updateAppointmentCharge` (corrige servicio realizado + cobro de una cita ya COMPLETADA), `createClientRecord`, `updateClient`, `updateClientNotes`, `createService`, `updateService`, `setServiceActive`, `getAvailableRewards`, `signOut`. Ver `docs/PRD-agendamiento.md` y `docs/HANDOFF-fase-*.md` para el diseño de cada una.

**Cobro y cuenta (desde `0016`)**: `completeAppointment` y `updateAppointmentCharge` reciben `accountId` y pasan por `resolveChargeAccount`, que escribe `account_id` **y** `payment_method` (con el nombre de la cuenta, para no vaciar esa columna en las citas nuevas). Si no se manda `accountId`, **conservan el `payment_method` que ya estaba**: corregir el monto de una cita vieja cuyo método era un texto libre que no calzó (p. ej. "Daviplata") no debe borrar ese texto. El campo `paymentMethod` de esos inputs quedó `@deprecated`.

#### Servicio agendado vs. servicio realizado
La clienta cambia de servicio en el puesto con frecuencia, y eso normalmente se descubre **al terminar**, no antes. Por eso el servicio de una cita se puede cambiar en tres momentos, y no solo mientras la cita está en el futuro:

1. Antes de que ocurra, o mientras sigue abierta → `updateAppointmentBooking` (servicio + fecha/hora + duración). El botón "Editar cita" del diálogo de la agenda ya no se esconde cuando la cita quedó en el pasado: se esconde solo cuando está COMPLETADA.
2. Al cerrarla → el diálogo "Completar cita" tiene un selector **"Servicio realizado"** (`components/admin/performed-service-select.tsx`, compartido) que precarga el agendado; al cambiarlo propone el precio del servicio nuevo como valor cobrado.
3. Después de cerrada → "Corregir cita completada" (`updateAppointmentCharge`) admite servicio + valor + método de pago.

En los casos 2 y 3 **solo** se reescribe `service_id`: `duration_min`/`buffer_min` se dejan como quedaron (es el tiempo que la cita realmente ocupó en la agenda, y reescribirlos podría chocar con la cita siguiente vía el `exclude using gist`). Cambiar el servicio de una COMPLETADA es seguro: la fidelización cuenta citas, no servicios ni montos, y Finanzas agrupa por `service_id` sumando `charged_amount` — re-atribuir es exactamente lo que se busca corregir.

**Limitación conocida**: una cita = un servicio. Si la clienta se hace dos cosas, el monto absorbe la diferencia pero el desglose por servicio de Finanzas solo cuenta una. La solución sería una tabla de líneas (`appointment_services`); no está construida.

## Supabase Storage

Bucket **`site-media`** (uno por proyecto de Supabase — el de dev y el de producción son independientes, ver "Entornos" al final) (público, `unoptimized: true` en `next.config.mjs` así que Next no reprocesa las imágenes). RLS: lectura pública, escritura solo `authenticated`. Carpetas (por convención, no forzadas por el schema): `hero/`, `services/`, `gallery/`, `promos/`, `site/` (logo/favicon, fotos de la fundadora).

Cloudinary está **completamente retirado** — no queda ninguna referencia en el código (se verificó con grep en el HANDOFF de la fase de theming). Todo el contenido histórico se migró con scripts puntuales (`scripts/migrate-cms-content.mjs` para el contenido inicial; los del logo/favicon fueron temporales y se borraron tras usarse).

## Sistema de theming (colores de marca en runtime)

`tailwind.config.ts` define `brand.ink/sand/sand-light/sand-dark/teal/teal-light/teal-dark` como `hsl(var(--brand-*))` (no hex fijo). Los defaults viven en `app/globals.css` (`:root`). `app/layout.tsx` (root, envuelve toda la app incluido `/admin`) lee `site_settings.theme_*` vía `getSiteSettings()` y, si hay algo seteado, inyecta un `<style>` con el override — `lib/theme/colors.ts` convierte los 3 hex elegidos por el admin a HSL y deriva las variantes light/dark automáticamente (±12 puntos de luminosidad). El admin solo ve 3 selectores de color (Ink/Sand/Teal) en `/admin/contenido` → Sitio → "Colores de marca", con botón "Restaurar colores por defecto" (limpia las 3 columnas a `null`).

Las secciones editoriales (`site_sections`) tienen además su **propio** `bg_color`/`text_color` independientes de este sistema global — dos capas de personalización: colores de marca (todo el sitio) y colores por sección (cada bloque editorial).

## Componentes públicos — de dónde sale cada uno

| Componente | Fuente de datos | Notas |
|---|---|---|
| `components/header.tsx` | props desde `site_settings` (`app/page.tsx`/`app/galeria/page.tsx`) | logo, teléfono, redes |
| `components/hero-carousel.tsx` | `hero_slides` | Embla (swipe/dots) + Framer Motion (Ken Burns alternado por paridad de índice, texto en cascada direccional alternada) |
| `components/services-section.tsx` | `service_categories` | rediseño editorial: cards numeradas (01/02/03), Playfair itálico, CTA de link con flecha |
| `components/site-sections.tsx` (`EditorialSection`) | una fila de `site_sections` (`kind='editorial'`) | full-bleed, overlay según `text_align`, o color sólido si `media_type='color'` |
| `components/about-section.tsx` | `site_settings` (founder_*) | fondo oscuro, collage de 2 fotos superpuestas |
| `components/mission-vision-section.tsx` | `site_settings` (mission_text/vision_text) | |
| `components/gallery-preview-section.tsx` | primeras 3 `gallery_images` activas | fondo oscuro, enlaza a `/galeria` |
| `components/gallery-section.tsx` | todas las `gallery_images` activas | filtro por categoría + lightbox; usado en `/galeria` (antes vivía en el home) |
| `components/promo-modal.tsx` | la promoción activa (`app/page.tsx`) | cookie de primera parte `promo_dismissed_<id>`, 7 días (`lib/promotions/config.ts`) |
| `components/footer.tsx` | `site_settings` | |

`app/page.tsx` es el único lugar que decide **el orden real** del home: trae `site_sections` (todos los `kind`, activos, por `display_order`) y por cada fila hace un switch para renderizar `ServicesSection` / `EditorialSection` / `AboutSection` / `MissionVisionSection` / `GalleryPreviewSection` según corresponda. No hay orden hardcodeado en el JSX.

## Componentes admin clave

### Navegación del panel

**`components/admin/admin-nav.tsx` ya no existe.** La barra horizontal de 9 links se reemplazó por sidebar (escritorio) + barra inferior (móvil):

- `admin-nav-links.ts` — **fuente única del menú**. Los 9 módulos agrupados por para qué se usan, no por cuándo se construyeron: **Operación** (Bandeja, Agenda, Nueva cita, Horarios), **Negocio** (Finanzas, Clientes, Servicios), **Sitio** (Contenido, Notificaciones). Exporta también `isAdminLinkActive` (`/admin` matchea exacto porque es prefijo de todo lo demás; el resto por prefijo, para que `/admin/clientes/[id]` deje su módulo marcado) y `adminSectionTitle`.
- `admin-sidebar.tsx` — sidebar colapsable, solo `lg:`+. Colapsado, cada item queda reducido a su ícono con tooltip.
- `admin-mobile-nav.tsx` — barra inferior fija por debajo de `lg:`: 4 módulos del día a día (Bandeja, Agenda, Nueva cita, Finanzas) + "Más", que abre una hoja (`components/ui/sheet.tsx`, Radix dialog reposicionado) con el resto, agrupado igual.
- `admin-mobile-header.tsx` — barra compacta arriba: marca + nombre de la sección actual.
- `admin-sidebar-script.tsx` + `lib/admin/sidebar-preference.ts` + el bloque `--admin-sidebar-w` de `app/globals.css`.

Dos decisiones que **no hay que deshacer**:

1. **El chrome es `fixed`, no `sticky`.** La columna de contenido lleva `overflow-x-hidden` (resguardo contra scroll horizontal en móvil), y eso la convierte en contenedor de scroll, lo que **rompe cualquier `position: sticky` adentro**. El layout reserva el espacio con padding.
2. **El colapsado no vive en estado de React.** Se persiste en `localStorage` (`manuj-admin-sidebar`) y lo aplica un `<script>` inline **antes del primer pintado**, seteando `data-admin-sidebar` en el `<html>`; el ancho sale de la variable CSS `--admin-sidebar-w` y lo que se oculta al colapsar también se resuelve por CSS. Así el HTML de servidor y el de cliente son idénticos (cero mismatch de hidratación) y no hay salto al hidratar. Va como `<script>` literal y no con `next/script` porque ni `beforeInteractive` garantiza correr antes del pintado de este subárbol. El estado de React del sidebar solo decide si hace falta tooltip y qué dice el `aria-label`; se sincroniza leyendo el DOM, no `localStorage`.

El layout agrega además un enlace "Saltar al contenido": con el sidebar hay ~13 paradas de teclado antes del contenido en cada página.

### Finanzas

`finance-stat-card.tsx` (cifra + delta vs. mes anterior; `higherIsBetter` porque el color no puede salir del signo —que suban los gastos es rojo— y "sin base" cuando el mes anterior fue cero), `daily-cash-flow-chart.tsx` (recharts, **reemplaza a `revenue-chart.tsx`**), `category-breakdown-card.tsx`, `income-by-account-card.tsx`, `movements-table.tsx` + `movement-form-dialog.tsx` + `movements-filters.tsx` (estado en la URL), `export-movements-button.tsx`, `pending-recurring-notice.tsx`, `recurring-expenses-table.tsx` + `recurring-expense-form-dialog.tsx`, `financial-accounts-table.tsx` + `financial-account-form-dialog.tsx`, `expense-categories-table.tsx` + `expense-category-form-dialog.tsx`.

Transversales nuevos: `charge-account-select.tsx` (reemplaza el array `PAYMENT_METHODS` hardcodeado en los diálogos de cobro; las cuentas viajan por props desde el Server Component de la agenda), `confirm-action-dialog.tsx` (el "¿seguro?" reusable — **no confundir con `confirm-dialog.tsx`**, que es "confirmar una cita"), `info-tooltip.tsx` (controlado por `onClick` y no por hover, porque Finanzas se usa mucho desde el celular y ahí no hay hover).

El **CSV** se arma a mano, sin librería: separador `;`, BOM UTF-8 (sin él Excel en español destroza tildes y ñ), monto crudo sin separador de miles para que se lea como número, y escape que además neutraliza el arranque con `= + - @` (Excel lo interpretaría como fórmula). Incluye **también los ingresos por servicio**, que viven en `appointments`: un export solo del libro no cuadraría con ningún KPI de la pantalla.

### Contenido

- `components/admin/image-upload.tsx` / `video-upload.tsx` — llaman a `uploadSiteMedia`, usados en todos los formularios de contenido.
- Patrón **tabla arrastrable + diálogo** (idéntico en las listas ordenables — hoy son **6**: las 4 de contenido más `financial-accounts-table.tsx` y `expense-categories-table.tsx`): `Reorder.Group`/`Reorder.Item` de Framer Motion (no dnd-kit ni ninguna librería nueva — ya era dependencia del proyecto), con `useDragControls` + un handle (`GripVertical`) para no interferir con los botones de la fila. Update optimista en cliente (`useState` sincronizado con las props vía `useEffect`) + persistencia del orden completo al soltar (`reorder*(orderedIds: string[])`, no swaps de a pares).
  - `hero-slides-table.tsx` + `hero-slide-form-dialog.tsx`
  - `service-categories-table.tsx` + `service-category-form-dialog.tsx`
  - `gallery-images-table.tsx` + `gallery-image-form-dialog.tsx`
  - `site-sections-table.tsx` + `site-section-form-dialog.tsx` (filas marcador con renderizado especial: ícono fijo, sin Editar/Eliminar)
- `promotions-table.tsx` + `promotion-form-dialog.tsx` — mismo molde, sin reorder (no aplica, solo una activa a la vez).
- `site-settings-form.tsx` — formulario único (no lista), incluye la sub-sección `ThemeColorsCard`.

> **Reordenamiento por teclado**: las 6 listas comparten `lib/admin/use-keyboard-reorder.ts` (estado del orden, teclado, foco, anuncio y persistencia con debounce) y `components/admin/reorder-handle.tsx` (handle + región `aria-live`). Con el handle enfocado, ↑/↓ mueven la fila e Inicio/Fin la llevan a los extremos; el foco vuelve al mismo handle tras cada movimiento y el orden se guarda una sola vez (debounce de 700 ms, forzado al salir del foco, al soltar el arrastre y al desmontar). El arrastre con puntero sigue igual.

### Nota sobre `agenda-calendar.tsx` y los colores de marca

Los colores de los eventos **no** se resuelven en JavaScript: cada evento lleva `classNames` (`STATUS_CLASS`) y las clases, en `agenda-calendar.css`, redefinen `--fc-event-bg-color`/`--fc-event-border-color` sobre el elemento del evento con `theme('colors.brand.teal')`, que compila a `hsl(var(--brand-teal))`. Así el theming en runtime repinta la agenda sin `useEffect`, sin render extra y sin parpadeo, y cubre tanto el bloque de Semana/Día como el puntito de la vista Mes. Los colores semánticos (ámbar, esmeralda, gris) también son clases, pero deliberadamente no siguen al theming.

El trade-off: si alguien cambia los colores de marca desde `/admin/contenido` → Sitio, los eventos de la agenda **no** siguen el cambio. Se aceptó porque es una pantalla interna y el parpadeo sería visible siempre, mientras que el desfase solo se nota si se re-tematiza. No "arreglarlo" sin saber esto.

## Constantes de configuración (código, no base de datos)

- `lib/booking/config.ts` — `LEAD_TIME_HOURS`, `BOOKING_HORIZON_WEEKS`, `REQUEST_EXPIRATION_HOURS`, `RATE_LIMIT_*`, `LOYALTY_*`.
- `lib/promotions/config.ts` — `PROMO_DISMISS_COOKIE_DAYS` (7).
- `lib/finance/queries.ts` — `MOVEMENTS_PAGE_SIZE` (20, el listado del libro).

## Migraciones (orden de ejecución)

| # | Qué hace |
|---|---|
| 0001 | Esquema base de agendamiento (services, clients, availability, blocked_slots, appointments) |
| 0002 | Identidad de cliente (`birthday`), `requested_name` |
| 0003 | Contabilidad (`charged_amount`, `payment_method`, tabla `expenses`) |
| 0004 | Fidelización (`loyalty_rewards`) |
| 0005 | Anticipo recibido (`deposit_received_amount`) |
| 0006 | CMS base: `hero_slides`, `service_categories` (+`services.category_id`), `gallery_images`, bucket `site-media` |
| 0007 | `promotions` |
| 0008 | Promoción "solo imagen" (`image_only`, `body` nullable) |
| 0009 | `site_settings` (singleton) + seed del contenido hardcodeado anterior |
| 0010 | Video en el carrusel (`hero_slides.media_type`/`video_url`, `image_url` nullable) |
| 0011 | `site_sections` (secciones editoriales) + `site_settings.theme_*` |
| 0012 | `site_sections.kind` (unifica el orden con Servicios/Sobre-nosotros/Misión-Visión/Galería) + `bg_color`/`text_color` + `media_type` admite `'color'` |
| 0013 | Búsqueda y paginación de clientes: `pg_trgm` + índices, vista `clients_with_stats` (`security_invoker`) |
| 0014 | Notificaciones: `clients.marketing_opt_out`, `notification_templates` (+seed de plantillas), `notification_settings` (singleton), `notifications` (outbox) |
| 0015 | `notification_settings.email_logo_url` — logo PNG de la cabecera de los correos (el del sitio es SVG y los clientes de correo no lo renderizan) |
| 0016 | **Finanzas**: `financial_accounts`, `expense_categories`, `financial_movements`, `recurring_expenses`, `appointments.account_id` (+backfill por nombre contra `payment_method`) y backfill de `expenses` → `financial_movements` (`legacy_expense_id`). Deja `expenses` muerta. **SIN CORRER en ningún proyecto** |

Todas aditivas desde la 0002 (no hacen `drop`). Se corren a mano en el SQL Editor de Supabase Studio — no hay CLI/CI conectado a este proyecto de Supabase desde este entorno de desarrollo (ver `docs/HANDOFF-cms-contenido-fase-1.md`, sección de por qué).

## Entornos — **hay DOS proyectos de Supabase**

Es el dato más importante de esta sección y el que más fácil se olvida: **desarrollo y producción son dos proyectos de Supabase separados**, con su propia base, su propio Auth y su propio Storage. No comparten nada.

| | Proyecto | Apunta desde |
|---|---|---|
| Desarrollo | `rtmuaeonmqadbezygfrv` | `.env.local` (y por lo tanto `pnpm dev`) |
| Producción | `rlpwmheokkrttxyfusyp` | variables de entorno de Vercel → `centroesteticomanuj.com` |

Consecuencias prácticas, todas aprendidas a golpes:

- **Cada migración hay que correrla DOS veces**, una en cada proyecto. Correrla solo en dev y probar en producción da errores que parecen bugs de código y no lo son (fue exactamente lo que pasó con `0013`: `/admin/clientes` mostraba "revisa que la migración se haya corrido" en producción mientras en dev funcionaba perfecto).
- **El Storage es independiente.** Un archivo subido al bucket `site-media` de dev no existe en producción. Por eso ninguna migración debe sembrar una URL de Storage fija (ver el comentario de `0015`, que se corrigió justamente por esto).
- **El contenido del CMS, los servicios y las clientas son independientes.** Lo que se carga en el panel queda en el proyecto por el que se entró.
- Los usuarios de Supabase Auth también son distintos: la cuenta de admin de dev no sirve en producción.

### Variables de entorno en Vercel

`RESEND_API_KEY`, `RESEND_FROM` y `CRON_SECRET` están configuradas **solo en el entorno Production**. En los despliegues de Preview los correos quedan `OMITIDO` y `/api/cron/notificaciones` responde 401 — degrada como está diseñado, pero conviene saberlo antes de concluir que algo está roto. `NEXT_PUBLIC_SITE_URL` sí está en los tres entornos.

`.env.local.example` es la referencia de qué hay que configurar. Está **explícitamente des-ignorado** en `.gitignore` (la regla `.env*` se lo comía y nunca se habría commiteado).

### Cron de Vercel

`vercel.json` registra un job diario, `0 13 * * *`. **El panel de Vercel muestra los horarios en UTC**, así que ahí se lee "At 01:00 PM" — son las **8:00 de la mañana en Bogotá**. En plan Hobby se ejecuta una vez al día en algún momento dentro de esa hora (no al minuto exacto) y hay un máximo de 2 jobs por proyecto; por eso un solo job hace las tres cosas.

### Estado

> ## ⚠️ `0016_finanzas.sql` está SIN CORRER en los DOS proyectos
>
> Ni dev ni producción la tienen. Sin ella, `/admin/finanzas` falla entera: las cuatro tablas y `appointments.account_id` no existen. **Es lo primero que hay que hacer antes de probar cualquier cosa de Finanzas**, y hay que correrla **dos veces, una por proyecto** (ver el checklist de `docs/HANDOFF-finanzas-y-navegacion.md`).

- **Dev** (`rtmuaeonmqadbezygfrv`): migraciones **0001-0015** corridas. **`0016` pendiente.** Contenido real cargado, Manu usando el CMS activamente.
- **Producción** (`rlpwmheokkrttxyfusyp`): desplegada en `centroesteticomanuj.com`, migraciones **0001-0015** corridas, **`0016` pendiente**. Notificaciones configuradas y verificadas con un envío real.
