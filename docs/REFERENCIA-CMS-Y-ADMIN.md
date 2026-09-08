# Referencia técnica — CMS y panel administrativo

Documento de referencia (no narrativo, a diferencia de los `HANDOFF-*.md`) del estado **actual** de la aplicación: rutas, modelo de datos, Server Actions ("endpoints" — este proyecto no tiene API REST, todas las mutaciones son Server Actions de Next.js) y componentes. Si estás retomando este proyecto en una sesión nueva, este archivo + `docs/PRD-agendamiento.md` (el sistema de citas, anterior a todo esto) es todo lo que hace falta leer para tener el panorama completo, sin repasar los 6+ `HANDOFF-*.md` de esta sesión.

## Cómo está organizado el proyecto

Dos sistemas conviven sobre la misma base de Supabase:

1. **Agendamiento** (`docs/PRD-agendamiento.md` y sus `HANDOFF-fase-*.md`) — citas, clientes, disponibilidad, contabilidad, fidelización. No se tocó en esta sesión salvo donde se indica.
2. **CMS de contenido del sitio** (`docs/PRD-cms-contenido-y-promociones.md` y los `HANDOFF-cms-*`/`HANDOFF-rediseno-*`/`HANDOFF-orden-unificado-*`) — todo lo que antes estaba hardcodeado en los componentes públicos (carrusel, servicios, galería, sobre nosotros, misión/visión, footer, promociones) ahora se administra desde `/admin/contenido`, con imágenes en Supabase Storage.

Un solo admin autenticado (Supabase Auth, sin roles) tiene acceso total a ambos sistemas vía RLS `for all to authenticated using (true)`.

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
| `/admin/finanzas` | Resumen de ingresos/gastos, gastos |
| `/admin/clientes` | Listado y ficha de cliente (historial, fidelización) |
| `/admin/contenido` | **CMS** — 6 pestañas: Carrusel, Servicios (categorías), Galería, Promociones, Secciones, Sitio |
| `/admin/login` | Login (Supabase Auth email/password) |

## Modelo de datos

### Agendamiento (sin cambios en esta sesión — ver PRD-agendamiento.md)
`services`, `clients`, `availability`, `blocked_slots`, `appointments`, `expenses`, `loyalty_rewards`. Único cambio de esta sesión: `services.category_id` (FK opcional a `service_categories`, `on delete set null`) — enlaza un servicio agendable a su card de marketing.

### CMS de contenido (construido esta sesión)

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

### RLS de las tablas de contenido
Todas siguen el mismo patrón: `admin_full_access` (`for all to authenticated using (true) with check (true)`) + `public_read_active` (`for select to anon, authenticated using (active = true)`, con la condición extra de ventana de fechas en `promotions`). Es una excepción deliberada al patrón del resto de la app (donde el público nunca lee con la anon key) — es contenido de marketing de solo lectura, sin lógica sensible que proteger. `site_settings` no tiene condición `active` (es la única fila, siempre aplica).

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

### Público (fuera de `/admin`)
- `app/reservar/actions.ts` → `getAvailability(serviceId)`, `createBookingRequest(input)` — flujo de reserva pública, con honeypot + rate limit (`lib/booking/rate-limit.ts`), usa `createServiceClient()` (service role, bypassa RLS con validación propia).
- `app/promo-actions.ts` → `submitPromoLead(input)` — captura del modal de promoción cuando `requires_birthday=true`. Mismo patrón anti-abuso y de no-sobreescritura que `createBookingRequest`.

### Agendamiento (sin cambios funcionales esta sesión, listadas por completitud)
`confirmAppointment`, `markDepositReceived`, `rejectAppointment`, `completeAppointment`, `markNoShow`, `createBlockedSlot`, `deleteBlockedSlot`, `createAvailabilityWindow`, `deleteAvailabilityWindow`, `searchClients`, `createManualAppointment`, `updateAppointmentBooking` (servicio + fecha/hora + duración de una cita no cerrada; reemplaza al antiguo `rescheduleAppointment`), `getBookableServices`, `getAppointmentDetail` (detalle completo de una cita para el diálogo de la agenda, incluye cupón aplicado/generado), `updateAppointmentCharge` (corrige el cobro de una cita ya COMPLETADA), `createClientRecord`, `updateClient`, `updateClientNotes`, `createService`, `updateService`, `setServiceActive`, `createExpense`, `updateExpense`, `deleteExpense`, `getAvailableRewards`, `signOut`. Ver `docs/PRD-agendamiento.md` y `docs/HANDOFF-fase-*.md` para el diseño de cada una.

## Supabase Storage

Bucket único **`site-media`** (público, `unoptimized: true` en `next.config.mjs` así que Next no reprocesa las imágenes). RLS: lectura pública, escritura solo `authenticated`. Carpetas (por convención, no forzadas por el schema): `hero/`, `services/`, `gallery/`, `promos/`, `site/` (logo/favicon, fotos de la fundadora).

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

- `components/admin/image-upload.tsx` / `video-upload.tsx` — llaman a `uploadSiteMedia`, usados en todos los formularios de contenido.
- Patrón **tabla arrastrable + diálogo** (idéntico en las 4 listas ordenables): `Reorder.Group`/`Reorder.Item` de Framer Motion (no dnd-kit ni ninguna librería nueva — ya era dependencia del proyecto), con `useDragControls` + un handle (`GripVertical`) para no interferir con los botones de la fila. Update optimista en cliente (`useState` sincronizado con las props vía `useEffect`) + persistencia del orden completo al soltar (`reorder*(orderedIds: string[])`, no swaps de a pares).
  - `hero-slides-table.tsx` + `hero-slide-form-dialog.tsx`
  - `service-categories-table.tsx` + `service-category-form-dialog.tsx`
  - `gallery-images-table.tsx` + `gallery-image-form-dialog.tsx`
  - `site-sections-table.tsx` + `site-section-form-dialog.tsx` (filas marcador con renderizado especial: ícono fijo, sin Editar/Eliminar)
- `promotions-table.tsx` + `promotion-form-dialog.tsx` — mismo molde, sin reorder (no aplica, solo una activa a la vez).
- `site-settings-form.tsx` — formulario único (no lista), incluye la sub-sección `ThemeColorsCard`.

## Constantes de configuración (código, no base de datos)

- `lib/booking/config.ts` — `LEAD_TIME_HOURS`, `BOOKING_HORIZON_WEEKS`, `REQUEST_EXPIRATION_HOURS`, `RATE_LIMIT_*`, `LOYALTY_*`.
- `lib/promotions/config.ts` — `PROMO_DISMISS_COOKIE_DAYS` (7).

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

Todas aditivas desde la 0002 (no hacen `drop`). Se corren a mano en el SQL Editor de Supabase Studio — no hay CLI/CI conectado a este proyecto de Supabase desde este entorno de desarrollo (ver `docs/HANDOFF-cms-contenido-fase-1.md`, sección de por qué).

## Estado de entornos

- **Dev**: todas las migraciones (0001-0012) corridas, contenido real cargado, Manu ya usando el CMS activamente (confirmado varias veces en esta sesión: promo con flyer propio, video en el carrusel).
- **Producción**: no existe todavía. Todo el trabajo de esta sesión vive en la rama `preview`, sin mergear a `main`.
