# Handoff — CMS de contenido, Fase 1 (carrusel, servicios, galería)

Continuación de [docs/PRD-cms-contenido-y-promociones.md](PRD-cms-contenido-y-promociones.md) — pega ese archivo (con las decisiones y el modelo de datos completo) al iniciar una conversación nueva sobre este tema.

## Qué es esto

Manu pidió poder cambiar imágenes y textos del sitio (carrusel, servicios, galería) desde su panel admin, sin depender de un desarrollador, y que las imágenes vivan en Supabase Storage en vez de Cloudinary. Esta es la Fase 1 del PRD: CMS de contenido (sin promociones todavía, eso es Fase 2).

**Estado actual: código completo en la rama `preview`, `tsc --noEmit` y `pnpm build` sin errores** (el error preexistente de `hero-carousel.tsx` — conflicto de versión entre `embla-carousel-react@8.5.1` y `embla-carousel-autoplay@^8.6.0` — se corrigió pineando `embla-carousel-autoplay` a `8.5.1` exacto, igual que el resto de dependencias fijadas del proyecto).

**Migración `0006` corrida en Supabase dev** (por el usuario, en Supabase Studio — no en producción, que sigue sin crear). **Script `scripts/migrate-cms-content.mjs` ejecutado** contra esa misma base: 3 slides, 6 categorías de servicio y 15 imágenes de galería migradas de Cloudinary a Supabase Storage. Verificado con Playwright headless contra `pnpm dev`: la home renderiza el carrusel/servicios/galería con las imágenes reales de Supabase, cero errores de consola; `/admin/contenido` redirige correctamente a `/admin/login` cuando no hay sesión (no se verificó el contenido de las pestañas ya autenticado — no había credenciales de admin disponibles en esta sesión).

**Hallazgo real durante la migración**: el catálogo de servicios agendables de Manu creció más allá de los 6 servicios placeholder originales (17 servicios reales hoy, incluyendo 4 variantes distintas de "Limpieza facial"). El script solo enlazó por nombre exacto los 5 que coincidían con las categorías de marketing migradas; **12 servicios quedaron sin `category_id`** y hay que asignárselos manualmente en `/admin/servicios` (selector "Categoría (marketing)") cuando Manu quiera agruparlos bajo una card pública.

## La solución

Ver el PRD para el diseño completo y las decisiones (por qué `service_categories` en vez de fusionar con `services`, por qué RLS pública en estas tablas, por qué ISR). Resumen de lo construido:

- **Migración `0006_cms_contenido.sql`**: bucket `site-media` en Storage (público, escritura solo admin autenticado), tablas `hero_slides`, `service_categories`, `gallery_images`, y `services.category_id` (nullable, `on delete set null`).
- **Subida de imágenes**: `uploadSiteImage(folder, formData)` (Server Action, cliente autenticado) + `components/admin/image-upload.tsx` (input de archivo con preview, reutilizable). Sin compresión — confirmado con el negocio que no hace falta por el volumen bajo de imágenes.
- **CRUD admin** en `/admin/contenido` (pestañas Carrusel / Servicios / Galería, mismo molde tabla+diálogo que ya usa `servicios`/`gastos`): crear, editar, activar/desactivar, eliminar, reordenar (botones ↑/↓ que intercambian `display_order` con el vecino).
- **`/admin/servicios`** gana un selector "Categoría (marketing)" en `ServiceFormDialog`, para enlazar servicios agendables (ej. 5 variantes de limpieza facial) a una sola card pública.
- **Componentes públicos** (`HeroCarousel`, `ServicesSection`, `GallerySection`) pasaron de arrays hardcodeados a recibir los datos como props.
- **`app/page.tsx`**: ahora es un Server Component async con `export const revalidate = 60` (ISR) que lee de Supabase vía `lib/supabase/public.ts` (cliente anon sin cookies, para no volver la ruta dinámica). Las Server Actions de guardado llaman `revalidatePath('/')` para reflejo instantáneo; el revalidate de 60s es la red de seguridad.
- **`next.config.mjs`**: se agregó el hostname de Storage del proyecto Supabase a `images.remotePatterns` (Cloudinary sigue whitelisteado, se retira cuando ya no haya nada apuntando ahí).
- **`scripts/migrate-cms-content.mjs`**: script de un solo uso que descarga las imágenes actuales de Cloudinary (las mismas que estaban hardcodeadas en los 3 componentes), las sube a `site-media`, siembra las 3 tablas nuevas con ese contenido, y enlaza los 6 servicios agendables existentes a su categoría por nombre — para que el cutover no deje el sitio vacío el primer día.

## Archivos nuevos

```
supabase/migrations/0006_cms_contenido.sql

lib/supabase/public.ts

components/admin/image-upload.tsx
components/admin/hero-slide-form-dialog.tsx
components/admin/hero-slides-table.tsx
components/admin/service-category-form-dialog.tsx
components/admin/service-categories-table.tsx
components/admin/gallery-image-form-dialog.tsx
components/admin/gallery-images-table.tsx

app/admin/(dashboard)/contenido/page.tsx

scripts/migrate-cms-content.mjs

docs/PRD-cms-contenido-y-promociones.md
```

## Archivos modificados

```
lib/supabase/types.ts        # + HeroSlide, ServiceCategory, GalleryImage; Service.category_id
next.config.mjs              # + hostname de Supabase Storage

app/admin/(dashboard)/actions.ts       # + CRUD de contenido, uploadSiteImage, reorder
app/admin/(dashboard)/servicios/page.tsx

components/admin/services-table.tsx
components/admin/service-form-dialog.tsx   # + selector de categoría
components/admin/admin-nav.tsx             # + link "Contenido"

components/hero-carousel.tsx    # recibe `slides` por props
components/services-section.tsx # recibe `categories` por props
components/gallery-section.tsx  # recibe `images` por props

app/page.tsx   # Server Component async, ISR, fetch a Supabase
```

## Estado de entornos

- **Dev**: código listo en `preview`. Migración `0006` corrida, contenido migrado y verificado visualmente en la home.
- **Producción**: sigue sin crear (ver Fase 1 de agendamiento) — no aplica hasta validar en dev.

## Pendiente / próximos pasos

1. Probar `/admin/contenido` ya autenticado como Manu: editar/reordenar/subir imágenes nuevas en las 3 pestañas (no verificado en esta sesión por falta de credenciales de admin).
2. En `/admin/servicios`, asignar categoría de marketing a los 12 servicios que quedaron sin enlazar (ver "Hallazgo real" arriba) — o decidir con Manu cuáles ameritan una card pública nueva (ej. una para "Limpieza facial" que agrupe sus 4 variantes) vs. cuáles no necesitan aparecer en el sitio.
3. Una vez validado y sin nada apuntando a Cloudinary, se puede retirar `res.cloudinary.com` de `next.config.mjs`.
4. Fase 2 (siguiente): modal de promociones (`promotions`, cookie de 7 días, captura opcional de cumpleaños vía `clients`) — diseño ya en el PRD, falta implementar.
5. Cuando esté todo validado, considerar mergear `preview` a `main` y replicar `0006` (y el contenido) en el Supabase de producción cuando se cree.
