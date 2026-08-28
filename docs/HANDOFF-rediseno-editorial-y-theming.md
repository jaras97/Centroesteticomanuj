# Handoff — Rediseño editorial del sitio + theming de colores

Continuación de [docs/HANDOFF-cms-contenido-fase-3-sitio-y-video.md](HANDOFF-cms-contenido-fase-3-sitio-y-video.md). El plan completo (con el análisis de diseño y las decisiones tomadas) quedó guardado en `/Users/mateojaramillo/.claude/plans/fuzzy-juggling-wombat.md`.

## Qué es esto

El usuario mostró [jamesnadereducation.com](https://www.jamesnadereducation.com/) como referencia visual y pidió: un carrusel "con más vida" (zoom, variedad de animación), una vista previa de galería (no la completa) que lleve a una página dedicada, 3-4 secciones nuevas de foto de fondo + texto, y que todo —incluidos los colores de marca— sea parametrizable desde `/admin/contenido`, con opción de restaurar los colores por defecto.

**Estado: código completo, `tsc --noEmit` y `pnpm build` sin errores. Migración `0011` corrida en Supabase dev y verificada de punta a punta con Playwright** (home completa, `/galeria`, mobile 375px, admin con las pestañas nuevas, cambio de color en vivo + restaurar). Pendiente pushear a `preview`.

## Decisiones de diseño (ver el plan para el razonamiento completo)

1. **Paleta de marca sin cambios** (ink/sand/teal) — ya tenía el registro "elegante y contenido" de la referencia. El salto de calidad viene de tipografía/layout/animación, no de un cambio de colores.
2. **Playfair Display reemplaza a Copperplate** en `--font-display` (`app/layout.tsx`) — Copperplate estaba cargada desde el inicio del proyecto pero **nunca se usaba en ningún componente** (verificado por grep antes de tocar nada). Copperplate es una caps serif geométrica; Playfair Display (vía `next/font/google`, sin dependencia npm nueva) da el serif-itálico fluido de la referencia.
3. **El carrusel no cambia de eje horizontal→vertical literalmente** (habría roto la semántica de las flechas/dots). En su lugar: Ken Burns alternado (zoom in en pares, zoom out en impares) + texto en cascada con dirección de entrada alternada (desde abajo / desde el costado) — sensación de "vida" sin romper la navegación.

## La solución

### Galería: preview + página dedicada
- `components/gallery-preview-section.tsx` (nuevo, home): primeras 3 imágenes activas de `gallery_images`, grilla sobre fondo oscuro, CTA a `/galeria`. Sin cambios de esquema ni de admin — reutiliza `gallery_images` tal cual.
- `app/galeria/page.tsx` (nuevo): la experiencia completa de galería (filtro + lightbox, `components/gallery-section.tsx`, sin cambios) en su propia ruta con Header/Footer propios.

### Secciones editoriales nuevas
- Tabla `site_sections` (migración `0011`, mismo molde que `hero_slides`: imagen u opcionalmente video, `display_order` reordenable por drag-and-drop, `active`). Sembrada con 3 secciones de ejemplo (copy + fotos de Unsplash como placeholder) para que no se vea vacía.
- `components/site-sections.tsx` (público): bloque full-bleed por sección, overlay con gradiente según `text_align` (izquierda/centro/derecha), titular Playfair Display itálico, animación `whileInView` con stagger.
- Admin: pestaña nueva "Secciones" en `/admin/contenido` — `site-sections-table.tsx` + `site-section-form-dialog.tsx`, calcados de los de Carrusel (mismo `ImageUpload`/`VideoUpload`, mismo patrón de reorder).
- Se insertan en `app/page.tsx` entre "Servicios" y "Sobre nosotros".

### "Sobre nosotros" restilizado
Sin cambios de datos (sigue usando `site_settings.founder_*`, ya en uso real por Manu). Solo visual: fondo `bg-brand-ink`, dos columnas (fotos con collage superpuesto / bio+badges+CTA), Playfair Display.

### Carrusel con más vida
`components/hero-carousel.tsx`: se mantiene Embla (swipe/dots/flechas intactos). Cada diapositiva envuelve su imagen/video en un `motion.div` con `scale` animado (zoom in/out alternado por paridad de índice, atado a `selectedIndex === i`, 6s lineal). El bloque de texto pasa de animar solo al montar a animar cada vez que `isActive` cambia (`animate={isActive ? 'show' : 'hidden'}`), con `staggerChildren` y dirección alternada (`y` en pares, `x` en impares).

### Colores de marca parametrizables
**El cambio técnico más delicado de esta fase**: `brand.ink/sand/teal(+variantes)` en `tailwind.config.ts` pasaron de hex fijo a `hsl(var(--brand-*))` — mismo patrón que ya usaban `background`/`foreground`/etc. Defaults (convertidos exactos de los hex anteriores) en `app/globals.css :root`. Esto significa que **ningún componente que ya usa `bg-brand-teal`, `text-brand-ink`, etc. tuvo que cambiar** — se re-pintan solos.

- `site_settings` gana `theme_ink`/`theme_sand`/`theme_teal` (hex, nullable — `null` = default).
- `lib/theme/colors.ts`: conversión hex→HSL + derivación automática de variantes light/dark (ajuste de luminosidad ±12 puntos) — el admin solo elige 3 colores base, no 7 tonos.
- `app/layout.tsx` (root, envuelve TODA la app incluido `/admin`) lee `site_settings` e inyecta un `<style>` inline con el override si hay algo seteado — **el theming aplica también dentro del panel admin**, no solo en el sitio público.
- Admin: sub-sección "Colores de marca" en la pestaña "Sitio" (`site-settings-form.tsx`), 3 `<input type="color">` nativos + botón "Restaurar colores por defecto" (limpia las 3 columnas).

## Archivos nuevos

```
supabase/migrations/0011_site_sections_theme.sql

lib/theme/colors.ts

app/galeria/page.tsx

components/site-sections.tsx
components/gallery-preview-section.tsx
components/admin/site-section-form-dialog.tsx
components/admin/site-sections-table.tsx

docs/HANDOFF-rediseno-editorial-y-theming.md
```

## Archivos modificados (relevantes)

```
tailwind.config.ts   # brand.* -> hsl(var(--brand-*))
app/globals.css      # defaults --brand-* en :root
app/layout.tsx        # Playfair Display (reemplaza Copperplate en --font-display), inyección de theme override
app/page.tsx           # nuevo orden de secciones

app/admin/(dashboard)/actions.ts          # CRUD site_sections, updateThemeColors, resetThemeColors
app/admin/(dashboard)/contenido/page.tsx  # tab "Secciones", fetch de site_sections

components/hero-carousel.tsx        # Ken Burns + stagger direccional
components/about-section.tsx        # restilizado fondo oscuro
components/admin/site-settings-form.tsx   # sección "Colores de marca"

lib/content/site-settings.ts   # SiteSettings fallback +theme_*
lib/supabase/types.ts          # +SiteSection; SiteSettings +theme_ink/sand/teal
```

## Verificación hecha en esta sesión

Con Playwright headless contra `pnpm dev` y datos reales de Supabase dev (no solo build):
- Home completa en escritorio: hero con Ken Burns confirmado matemáticamente (`transform: scale()` cambiando de 1.018 a 1.054 en 2.5s), las 3 secciones editoriales con overlay/alineación correctos, "Sobre nosotros" restilizado, galería preview (3 imágenes, fondo oscuro), footer — cero errores de consola.
- Mobile (375px): las mismas secciones, sin overflow horizontal (confirmado programáticamente: `scrollWidth === innerWidth`).
- `/galeria`: filtro por categoría + lightbox siguen funcionando igual que antes.
- Admin (usuario de prueba temporal, creado y eliminado en la sesión): pestaña "Secciones" con las 3 filas sembradas (thumbnails cargando correctamente); pestaña "Sitio" → cambié el color de acento a un rojo vino de prueba, confirmé que se guardó en la base de datos, que la conversión hex→HSL fue matemáticamente exacta, y que el sitio público (botones, íconos) cambió de color en vivo; luego "Restaurar colores por defecto" devolvió todo a `null`/los valores originales.
- Se descubrió de paso que Manu ya está usando la promo "solo imagen" y el carrusel de video de fases anteriores — nada de esta sesión rompió esas funciones (se verificó explícitamente).

## Pendiente / próximos pasos

1. Que Manu revise el copy/fotos placeholder de las 3 secciones editoriales sembradas (son de Unsplash, genéricas) y las reemplace por las suyas desde `/admin/contenido` → Secciones.
2. Probar la personalización de colores con ella en vivo — confirmar que el resultado le gusta antes de considerarlo definitivo.
3. Cuando todo esté validado: mergear `preview` a `main`, crear el proyecto de producción y replicar las 11 migraciones + el contenido.
