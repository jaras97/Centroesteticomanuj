# Handoff — Orden unificado de secciones + colores por sección editorial

Continuación de [docs/HANDOFF-rediseno-editorial-y-theming.md](HANDOFF-rediseno-editorial-y-theming.md). El plan quedó en `/Users/mateojaramillo/.claude/plans/fuzzy-juggling-wombat.md`.

## Qué es esto

Tras probar el rediseño, el usuario pidió 4 cosas más:

1. La foto de la fundadora no se veía en "Sobre nosotros" en mobile (sí en escritorio).
2. Poder intercalar las secciones editoriales nuevas con **cualquier** sección del home (Servicios, Sobre nosotros, Misión/Visión, Galería), no solo reordenarlas entre sí.
3. Colores por sección (fondo, texto), no solo los 3 colores de marca globales.
4. Que una sección editorial pueda tener un fondo de color sólido, sin foto ni video.
5. (Aparte) Migrar el favicon a Supabase Storage para retirar Cloudinary del todo.

**Estado: código completo, `tsc --noEmit` y `pnpm build` sin errores. Migración `0012` corrida en Supabase dev y verificada de punta a punta con Playwright.**

## 1. Bug: foto invisible en mobile (ya en `preview`, commit `8e957b4`)

**Causa real, no cosmética**: en CSS Grid, `margin: auto` en el eje que se centra **desactiva el `stretch` por defecto** del ítem, que pasa a dimensionarse por su contenido intrínseco. La imagen usaba `fill` (`position: absolute`), que no aporta ancho intrínseco al contenedor — el wrapper quedaba en `width: 0px` en mobile (confirmado con `getBoundingClientRect()`, no fue una suposición). Se corrigió agregando `w-full` antes de `max-w-md mx-auto` en `components/about-section.tsx`. El fix expuso 8px de overflow horizontal en la foto superpuesta (offset `-right-6` que antes quedaba oculto por el propio bug) — se corrigió con `right-0 sm:-right-6`.

## 2 y 3 — Orden unificado + colores por sección (esta entrega)

**Decisión de alcance**: los colores parametrizables aplican a las secciones **editoriales** (`site_sections`, `kind='editorial'`) — no a Servicios/Sobre nosotros/Misión-Visión/Galería, que mantienen su diseño ya afinado. Está documentado como decisión explícita en el plan por si se quiere extender después.

`site_sections` deja de ser "solo las editoriales" y pasa a representar **todos los bloques del home entre el Hero y el Footer**. Gana una columna `kind`:
- `'editorial'` — lo de siempre (foto/video/color + texto + CTA), administrable por completo.
- `'services' | 'about' | 'mission_vision' | 'gallery'` — filas **marcador**, sin contenido propio (ese sigue en `service_categories`/`site_settings`/`gallery_images`), solo existen para reordenar y activar/desactivar esas secciones fijas junto con las editoriales en la misma lista arrastrable.

`app/page.tsx` ya no tiene el orden hardcodeado en el JSX: trae todos los `site_sections` activos por `display_order` y renderiza el componente que corresponda según `kind` (switch). Hero y Footer quedan fuera de esta lista, como se confirmó con el usuario.

La migración `0012` siembra las 4 filas marcador con `display_order` que preserva el orden visual que ya existía (verificado: el home no cambió al correr la migración).

**Admin**: la pestaña "Secciones" (ya existía) ahora muestra las 4 filas marcador junto con las editoriales — mismo drag-and-drop de siempre. Una fila marcador muestra un ícono fijo en vez de miniatura, un texto ("Contenido en la pestaña X") en vez de poder editarse ahí, y **no tiene botón Eliminar** (protegido también del lado del servidor en `deleteSiteSection` — si se llama la action directamente sobre una fila marcador, la rechaza).

## 4 — Fondo de color sólido + color de texto

`site_sections` gana `bg_color` (hex, solo si `media_type='color'`) y `text_color` (hex, default blanco, reemplaza el `text-white` fijo de antes). `EditorialSection` (`components/site-sections.tsx`): si es color sólido, pinta un `<div>` con ese fondo, sin overlay de gradiente (no hace falta contraste extra sobre un color plano) ni imagen/video. El texto usa `style={{color: text_color}}` en vez de clases Tailwind fijas.

Admin: el selector "Tipo" del diálogo de sección gana la opción "Color sólido (sin foto)" — oculta la subida de imagen/video y muestra un `<input type="color">` para el fondo; el color de texto es un segundo `<input type="color">`, siempre visible (útil incluso con foto, para fotos claras que necesiten texto oscuro).

## 5 — Favicon a Supabase Storage (ya en `preview`, commit `8e957b4`)

El logo (`site_settings.logo_url`) todavía apuntaba al Cloudinary original — se migró con un script puntual (mismo patrón que `scripts/migrate-cms-content.mjs`) a `site-media/site/` en Supabase Storage, y se actualizó la fila. `app/layout.tsx` pasó de `metadata` estático a `generateMetadata()` para leer `site_settings.logo_url` como favicon — ahora es editable desde el admin igual que el logo del header. Se retiró `res.cloudinary.com` de `next.config.mjs`; no queda ninguna referencia a Cloudinary en el código.

## Migración `0012_home_blocks.sql`

```sql
alter table public.site_sections
  add column if not exists kind text not null default 'editorial'
    check (kind in ('editorial', 'services', 'about', 'mission_vision', 'gallery'));

alter table public.site_sections drop constraint if exists site_sections_media_type_check;
alter table public.site_sections
  add constraint site_sections_media_type_check check (media_type in ('image', 'video', 'color'));

alter table public.site_sections add column if not exists bg_color text;
alter table public.site_sections add column if not exists text_color text not null default '#FFFFFF';

insert into public.site_sections (kind, title, body, media_type, text_color, display_order, active)
values
  ('services', 'Servicios', '', 'color', '#FFFFFF', -1, true),
  ('about', 'Sobre nosotros', '', 'color', '#FFFFFF', 3, true),
  ('mission_vision', 'Misión y visión', '', 'color', '#FFFFFF', 4, true),
  ('gallery', 'Galería', '', 'color', '#FFFFFF', 5, true)
on conflict do nothing;
```

## Archivos modificados

```
supabase/migrations/0012_home_blocks.sql   # nuevo

lib/supabase/types.ts   # SiteSection: +kind, +bg_color, +text_color, media_type +'color'

app/admin/(dashboard)/actions.ts   # +bgColor/textColor en el CRUD, deleteSiteSection rechaza marcadores
app/admin/(dashboard)/contenido/page.tsx   # copy de la pestaña Secciones actualizado

components/admin/site-section-form-dialog.tsx   # opción "Color sólido" + 2 color pickers
components/admin/site-sections-table.tsx        # renderizado distinto para filas marcador
components/site-sections.tsx   # rama media_type='color'; exporta EditorialSection individual

app/page.tsx   # fetch de site_sections + switch por kind, reemplaza el orden fijo en JSX
```

## Verificación hecha en esta sesión

Con Playwright y un usuario admin de prueba (creado y eliminado en la sesión):
- **Regresión**: tras correr la migración, el home mostró exactamente el mismo orden que antes (7 encabezados en la misma secuencia) — las filas marcador no movieron nada por sí solas.
- **Reordenar entre kinds distintos**: arrastré la fila marcador "Galería" (antes al final) hasta la segunda posición, intercalada entre "Servicios" y las 3 secciones editoriales — confirmado tanto en la lista del admin como en el home público.
- **Activar/desactivar una fila marcador**: desactivé "Sobre nosotros" desde la pestaña Secciones y confirmé que esa sección completa desapareció del home.
- **Guard de eliminación**: confirmé que la fila marcador "Servicios" no tiene botón Eliminar en la UI.
- **Color sólido**: creé una sección de prueba con fondo `#4A1224` y texto `#E8C468` — confirmé por `getComputedStyle` que el `background-color` renderizado es exactamente ese RGB, sin imagen ni overlay, y por captura que se ve como se esperaba.
- Todos los datos de prueba se limpiaron y el orden/estado original se restauró exactamente al terminar (verificado con una comparación final del home).

## Pendiente / próximos pasos

1. Que Manu pruebe el drag-and-drop y los colores con su propia sesión.
2. Cuando todo esté validado: mergear `preview` a `main`, crear el proyecto de producción y replicar las 12 migraciones + el contenido.
