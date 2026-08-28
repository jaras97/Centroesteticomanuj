# Handoff — CMS de contenido, Fase 2 (modal de promociones)

Continuación de [docs/HANDOFF-cms-contenido-fase-1.md](HANDOFF-cms-contenido-fase-1.md) y [docs/PRD-cms-contenido-y-promociones.md](PRD-cms-contenido-y-promociones.md).

## Qué es esto

Segunda mitad del CMS: el modal de promociones que aparece al entrar a la home, informativo o pidiendo fecha de nacimiento, administrable por Manu desde `/admin/contenido`.

**Estado: código completo en `preview`, `tsc --noEmit` y `pnpm build` sin ningún error. Migraciones `0007` y `0008` corridas en Supabase dev. Verificado de punta a punta con Playwright headless contra `pnpm dev` y datos reales** (no solo el build) — ver sección de verificación.

**Adición sobre la marcha (`0008_promociones_imagen.sql`)**: Manu pidió poder subir una promo donde el texto ya viene diseñado dentro de la imagen (un flyer), sin tener que volver a escribirlo. Se agregó `promotions.image_only` (boolean) y `body` pasó a ser nullable. En el admin, un selector "¿El texto ya está diseñado en la imagen?" oculta el campo de texto cuando es así (el título sigue siendo obligatorio, pero solo como referencia interna en la lista — no se muestra en el modal). En el modal público, cuando `image_only=true` la imagen se muestra completa con `object-contain` (sin recortar, a diferencia del banner normal que usa `object-cover` a una altura fija) y el título queda `sr-only` (accesible para lectores de pantalla, invisible en pantalla) en vez de duplicarse sobre la imagen.

## La solución

Ver el PRD para el diseño completo (Decisión 4). Resumen de lo construido:

- **Migración `0007_promociones.sql`**: tabla `promotions` (título, cuerpo, imagen opcional, CTA opcional, `requires_birthday`, `active`, `starts_at`/`ends_at` opcionales), con un índice único parcial (`unique index ... (active) where active`) que garantiza que solo puede haber una promo activa a la vez — mismo truco que `appointments_one_active_per_client` de la Fase 1 de agendamiento, aplicado a "una en total" en vez de "una por cliente". RLS de solo lectura pública para la promo activa y vigente en su ventana de fechas.
- **`setPromotionActive`** (Server Action): al activar una promo, primero desactiva cualquier otra activa, para no chocar contra el índice único — Manu no tiene que desactivar manualmente la anterior.
- **Fechas de vigencia**: el formulario admin pide fecha simple ("Empieza"/"Termina"); el servidor las convierte a UTC con `bogotaWallTimeToUtc` (00:00 y 23:59 hora Bogotá respectivamente, para que una promo que "termina hoy" siga vigente todo el día). La tabla admin reconvierte de vuelta con `toBogotaWallClock` al mostrarlas — se encontró y corrigió un desfase de un día al mostrar `ends_at` antes de esa conversión.
- **`components/promo-modal.tsx`** (público, montado solo en `app/page.tsx`): recibe la promo activa por props (fetch server-side en `HomePage`, mismo patrón que hero/servicios/galería). Se abre automáticamente si no existe la cookie `promo_dismissed_<id>`; al cerrar (X, overlay, "Entendido", o tras enviar el formulario) setea esa cookie por `PROMO_DISMISS_COOKIE_DAYS` (7 días, `lib/promotions/config.ts`) — cookie de primera parte, no `sessionStorage`, para que persista entre sesiones del navegador como en los popups de sitios profesionales. Al estar atada al `id` de la promo, una promo nueva siempre aparece sin importar cookies viejas.
- **`app/promo-actions.ts` → `submitPromoLead`**: Server Action pública que hace `upsert` en `clients` por teléfono, con las mismas reglas de `app/reservar/actions.ts` — nunca sobreescribe el nombre de un cliente existente, y solo completa el cumpleaños si el cliente no tenía uno guardado. Mismo honeypot + `lib/booking/rate-limit.ts` reutilizado tal cual (comparte el balde de rate-limit por IP con el formulario de reserva — deliberado, evita mantener un segundo mapa en memoria). No crea ninguna cita, no otorga ningún cupón automático (confirmado con el usuario: Manu aplica el descuento a mano al confirmar/completar la cita).
- **Admin**: pestaña "Promociones" en `/admin/contenido`, mismo molde tabla+diálogo. Reutiliza `ImageUpload` (carpeta `promos`) y `bogotaWallTimeToUtc`/`toBogotaWallClock` ya existentes.

## Archivos nuevos

```
supabase/migrations/0007_promociones.sql
supabase/migrations/0008_promociones_imagen.sql

lib/promotions/config.ts
lib/promotions/schemas.ts

app/promo-actions.ts
app/admin/(dashboard)/contenido/page.tsx   # ya existía de Fase 1, +pestaña Promociones

components/admin/promotion-form-dialog.tsx
components/admin/promotions-table.tsx
components/promo-modal.tsx

docs/HANDOFF-cms-contenido-fase-2-promociones.md
```

## Archivos modificados

```
app/admin/(dashboard)/actions.ts   # + CRUD de promotions, setPromotionActive
app/page.tsx                       # fetch de la promo activa, monta <PromoModal>
```

## Bugs encontrados y corregidos en esta sesión (no relacionados con promociones)

1. **Conflicto de versión Embla** (preexistente desde la Fase 1 de agendamiento, documentado en varios handoffs anteriores como "error no relacionado"): `embla-carousel-react@8.5.1` y `embla-carousel-autoplay@^8.6.0` resolvían a dos versiones distintas del core `embla-carousel`, rompiendo los tipos. Se corrigió pineando `embla-carousel-autoplay` a `8.5.1` exacto (`package.json`/`pnpm-lock.yaml`) — mismo patrón de versiones fijadas que el resto del proyecto (FullCalendar, etc.). `tsc --noEmit` queda en cero errores por primera vez desde que existe registro en las HANDOFF.
2. **Dos instancias de `next dev` compitiendo por el puerto 3000** durante la verificación (una quedó huérfana de una sesión anterior) — causaba 404 de assets y una página en blanco. No es un bug del código, es un artefacto del proceso de verificación; se documenta por si se repite: `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill` antes de levantar `pnpm dev`.

## Verificación hecha en esta sesión

- `tsc --noEmit` y `pnpm build`: cero errores.
- **Playwright headless contra `pnpm dev` con datos reales de Supabase dev** (no solo el build):
  - Promo informativa: aparece al cargar la home, botón CTA + "Entendido" visibles, cierre correcto, cookie `promo_dismissed_<id>` queda puesta, no reaparece tras recargar la página.
  - Promo con `requires_birthday`: formulario nombre/teléfono/fecha visible, envío exitoso, mensaje de agradecimiento, y se confirmó en la base de datos que `clients` quedó con el registro correcto (`birthday: '1995-05-20'`, sin desfase de zona horaria).
  - Promo `image_only`: imagen mostrada completa sin recortar (`object-contain`), sin título/texto duplicado encima, botón CTA funcionando.
  - Los datos y promociones de prueba (prefijo `[TEST]`, teléfono `3000000000`) se limpiaron al terminar — no quedó nada de esta verificación en la base de dev.
- **No se probó la pestaña "Promociones" de `/admin/contenido` ya autenticada como Manu** (mismo motivo que en la Fase 1: no había credenciales de admin disponibles en esta sesión) — el CRUD se probó indirectamente insertando filas por `service_role` para la verificación pública, pero no el formulario/tabla en sí desde el navegador logueado.

## Pendiente / próximos pasos

1. Probar la pestaña "Promociones" en `/admin/contenido` ya autenticado: crear, editar, activar/desactivar (confirmar que activar una desactiva la anterior), fechas de vigencia, eliminar.
2. Decidir con Manu si quiere ajustar `PROMO_DISMISS_COOKIE_DAYS` (7 días por defecto) o el copy de los botones.
3. Backlog del PRD original: `site_settings` (bio/misión-visión/footer), cupón automático de cumpleaños vía `loyalty_rewards`, filtro de categoría preseleccionado en `/reservar`.
4. Cuando todo esté validado en dev: mergear `preview` a `main` y replicar `0006`+`0007` (y el contenido migrado) en el Supabase de producción cuando se cree.
