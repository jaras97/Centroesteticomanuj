# Handoff — CMS de contenido, Fase 3 (configuración del sitio + video en el carrusel)

Continuación de [docs/HANDOFF-cms-contenido-fase-2-promociones.md](HANDOFF-cms-contenido-fase-2-promociones.md) y [docs/PRD-cms-contenido-y-promociones.md](PRD-cms-contenido-y-promociones.md).

## Qué es esto

Dos pedidos adicionales sobre el CMS ya entregado:
1. Extender la administración a lo que quedó "quemado" en el sitio: logo, teléfono/WhatsApp, redes sociales, email/dirección del footer, bio de la fundadora, misión y visión.
2. Poder usar clips de video cortos en el carrusel de inicio, no solo imágenes.

**Estado: código completo, `tsc --noEmit` y `pnpm build` sin ningún error. Pusheado a `preview` (commit `18fe9cd`). Migraciones `0009` y `0010` corridas en Supabase dev y verificadas de punta a punta con Playwright headless contra `pnpm dev` y datos reales**:
- Footer con teléfono/email/dirección/tagline reales de `site_settings`, año del copyright dinámico (`© 2026`, ya no el `2025` hardcodeado).
- `/reservar` (que reutiliza el mismo Footer) sigue funcionando tras volver el layout async.
- Sección "Sobre nosotros" con nombre/bio/badge de la fundadora reales.
- Video en el carrusel: se subió un clip real a Storage (`site-media/hero/`), se creó una diapositiva de prueba, y se confirmó en navegador que el `<video>` se reproduce (autoplay/muted/loop/playsInline correctos) con el mismo overlay de texto y botón que las diapositivas de imagen. Todo el contenido de prueba se limpió al terminar.
- De paso se confirmó que el modo "solo imagen" de promociones (Fase 2.1) ya está en uso real por Manu — apareció una promo de cumpleaños con un flyer diseñado.

## La solución

### 1. Configuración del sitio (`site_settings`)

Tabla **singleton** (una sola fila, siempre): `id boolean primary key default true` con `check (id)` — el truco estándar de Postgres para garantizar que nunca pueda existir una segunda fila (solo `true` es válido como PK). Contiene: `logo_url`, `phone_display`, `whatsapp_number`, `email`, `address`, `instagram_url`, `facebook_url`, `footer_tagline`, `about_intro`, `founder_name`, `founder_bio`, `founder_roles` (jsonb), `founder_image_url_1/2`, `mission_text`, `vision_text`.

La migración `0009_site_settings.sql` crea la tabla, RLS (lectura pública sin condición — a diferencia de hero_slides/gallery_images no hay noción de "activo", es la única fila) y **siembra la fila con el contenido actualmente hardcodeado**, para que nada quede en blanco al cambiar los componentes a leer de la base de datos.

**Mapa de uso descubierto antes de tocar nada** (importante, evitó romper `/reservar`): `Header`/`AboutSection`/`MissionVisionSection` solo se usan en la home; pero `Footer` se reutiliza también en `/reservar` (vía `app/reservar/layout.tsx`), y `/reservar` tiene su **propio** `ReservarHeader` (no el `Header` compartido) con el mismo logo hardcodeado por separado. Por eso:
- `app/page.tsx` y `app/reservar/layout.tsx` ambos llaman a `lib/content/site-settings.ts` → `getSiteSettings()` (nuevo helper, cliente público sin cookies, mismo patrón que el resto del CMS).
- `revalidateContenido()` en las Server Actions ahora también revalida `/reservar`, no solo `/`.

**Fallback defensivo**: `getSiteSettings()` devuelve un objeto de relleno si la fila todavía no existe (antes de correr `0009`) — sin esto, todo el sitio se rompe porque `<Image>` no acepta `src` vacío. No es un caso hipotético, es la secuencia real de despliegue mientras la migración está pendiente.

**Admin**: nueva pestaña "Sitio" en `/admin/contenido` (`components/admin/site-settings-form.tsx`) — a diferencia del resto del CMS (tablas con diálogos), esto es un formulario único con botón "Guardar cambios", porque es una fila singleton, no una lista. Reutiliza `ImageUpload` (carpeta nueva `site`) para el logo y las 2 fotos de la fundadora.

**De paso**: se corrigió el año del copyright del footer, que estaba hardcodeado en `© 2025` (ya desactualizado) — ahora es `new Date().getFullYear()`.

### 2. Video en el carrusel

`hero_slides` gana `media_type` (`'image' | 'video'`, default `'image'`) y `video_url`; `image_url` pasa a ser opcional (una diapositiva de video puede no tener imagen de portada). Migración `0010_hero_video.sql`.

**Server Action generalizada**: `uploadSiteImage` se renombró a `uploadSiteMedia` — ahora acepta `image/*` o `video/*` (antes solo imágenes), con un tope de **15MB** para video (clip corto, no una toma larga). `components/admin/image-upload.tsx` solo cambió el nombre de la función que llama (sigue siendo el mismo componente para servicios/galería/promos/sitio, que solo suben imagen).

**Límite de tamaño de Server Actions**: Next.js limita el body de una Server Action a 1MB por defecto — insuficiente para un video. Se subió a **20MB** en `next.config.mjs` (`experimental.serverActions.bodySizeLimit`). Las imágenes (mucho más livianas) no se ven afectadas por este cambio.

**Admin**: `HeroSlideFormDialog` gana un selector "Tipo" (Imagen / Video). En modo Video: `components/admin/video-upload.tsx` (nuevo, mismo molde que `ImageUpload` pero con preview `<video controls>`) + una imagen de portada opcional (poster mientras carga). La tabla del carrusel (`hero-slides-table.tsx`) muestra una insignia "Video" y no rompe si la diapositiva no tiene imagen de portada.

**Público**: `HeroCarousel` renderiza `<video autoPlay muted loop playsInline poster={...}>` en vez de `<Image>` cuando `media_type === 'video'`.

**Simplificación consciente, no bloqueante**: el autoplay del carrusel (Embla, 3s por diapositiva) sigue rotando igual sin importar si la diapositiva activa es imagen o video — no se implementó pausar-en-video ni ritmo dinámico por diapositiva. El pedido fue "poder agregar clips cortos", no un comportamiento de autoplay a medida; con clips cortos y `loop`, no se ve roto, pero es un refinamiento posible a futuro si Manu lo pide.

## Archivos nuevos

```
supabase/migrations/0009_site_settings.sql
supabase/migrations/0010_hero_video.sql

lib/content/site-settings.ts

components/admin/site-settings-form.tsx
components/admin/video-upload.tsx

docs/HANDOFF-cms-contenido-fase-3-sitio-y-video.md
```

## Archivos modificados (relevantes)

```
app/admin/(dashboard)/actions.ts   # uploadSiteMedia, updateSiteSettings, hero slide video
app/admin/(dashboard)/contenido/page.tsx   # pestaña "Sitio"
app/page.tsx                       # fetch de settings, props a Header/Footer/About/MisiónVisión
app/reservar/layout.tsx            # ahora async, fetch de settings para ReservarHeader/Footer

components/header.tsx / footer.tsx / about-section.tsx / mission-vision-section.tsx
components/reservar/reservar-header.tsx / whatsapp-float-button.tsx
components/hero-carousel.tsx / hero-slide-form-dialog.tsx / hero-slides-table.tsx
components/admin/image-upload.tsx  # uploadSiteImage -> uploadSiteMedia

lib/supabase/types.ts   # + SiteSettings; HeroSlide.media_type/video_url
lib/whatsapp.ts         # se retira BUSINESS_WHATSAPP_NUMBER (ahora en site_settings)

next.config.mjs   # serverActions.bodySizeLimit: 20mb
```

## Estado de entornos

- **Dev**: código en `preview` (pusheado), migraciones `0009` y `0010` corridas y verificadas.
- **Producción**: sigue sin crear.

## Pendiente / próximos pasos

1. Probar la pestaña "Sitio" en `/admin/contenido` ya autenticada como Manu (guardar cambios, subir un logo/foto nueva) — no verificado en esta sesión por falta de credenciales de admin, mismo motivo que en fases anteriores.
2. Cuando todo esté validado: mergear `preview` a `main`, crear el proyecto de producción y replicar las 10 migraciones + el contenido.
