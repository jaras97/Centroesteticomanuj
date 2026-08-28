# PRD — CMS de contenido del sitio + promociones (Centro Estético Manuj)

## Contexto

El sitio público (`app/page.tsx`) es hoy 100% estático: carrusel, servicios, galería, "sobre nosotros", misión/visión y footer tienen todo su texto e imágenes quemados en cada componente, con imágenes servidas desde Cloudinary. Cualquier cambio de copy o de fotos requiere un deploy.

En paralelo ya existe un sistema de agendamiento maduro sobre Supabase (Postgres + Auth + RLS), con un panel `/admin` funcional (bandeja, agenda, horarios, servicios, finanzas, clientes) y un patrón establecido de Server Actions + tabla/diálogo CRUD (`services-table.tsx` + `service-form-dialog.tsx`, `expenses-table.tsx` + `expense-form-dialog.tsx`, etc.).

Manu quiere poder, sin depender de un desarrollador:
1. Cambiar las imágenes y textos del carrusel de inicio.
2. Cambiar imágenes/texto de la sección de servicios y de la galería.
3. Que las imágenes vivan en Supabase Storage (no Cloudinary), centralizado con el resto de su información.
4. Publicar un modal de promociones al entrar al sitio, a veces solo informativo, a veces pidiendo fecha de nacimiento.

## Principio rector

Extender lo que ya existe, no crear un sistema paralelo. El panel admin, el patrón CRUD, Supabase y hasta la columna `clients.birthday` ya están — este trabajo es más "conectar cables" que "construir un CMS desde cero".

## Decisión 1 — "Categorías" de marketing (1) → "servicios" agendables (N), no una fusión 1:1

Validado con el negocio: en marketing una card como "Limpieza facial" representa **varias** variantes agendables distintas (ej. 5 tipos de limpieza facial con duración/precio propios en `/reservar`). Es una relación 1-a-N, no 1-a-1 — la Decisión 1 original (fusionar todo en la tabla `services`) era incorrecta: habría producido una card de marketing por cada fila de agenda (5 cards de "limpieza facial" en la home).

El patrón correcto, el mismo que usan sitios de reservas profesionales (Fresha, Booksy, Treatwell): separar **categoría/servicio destacado** (lo que se navega y se vende en la home) de **ítem agendable** (lo que tiene duración/precio/buffer en el calendario), con la primera agrupando a la segunda.

**Decisión**: tabla nueva `service_categories` para el contenido de marketing (imagen, copy largo, features, orden, activo/inactivo), y `services.category_id` — columna nueva, opcional — que enlaza cada servicio agendable a su categoría. Las 5 variantes de "limpieza facial" en `/admin/servicios` comparten `category_id`; la card pública de "Limpieza facial" se administra aparte, una sola vez, en `/admin/contenido`.

- El CTA de cada card pública ("Reservar Ahora") lleva a `/reservar` en general — no a un servicio específico, porque la categoría representa varios. Mejora opcional a futuro (no bloqueante para Fase 1): pasar la categoría como query param (`/reservar?categoria=<id>`) para que el wizard de reserva preseleccione ese filtro.
- `services.category_id` es nullable: un servicio sin categoría asignada simplemente no aparece agrupado en ninguna card pública, pero sigue funcionando normal en `/reservar` — no rompe nada de lo existente ni obliga a categorizar retroactivamente todo de una vez.
- `/admin/servicios` gana un selector "Categoría (marketing)" en `ServiceFormDialog`, poblado desde `service_categories`. `/admin/contenido` gestiona las categorías en sí (imagen, texto, features, orden) con el molde CRUD estándar.

## Decisión 2 — Alcance del "resto de cosas parametrizables"

"Todo" es un alcance infinito. Como PO, propongo cortar el MVP en lo que Manu va a querer cambiar seguido (fotos, promos de temporada) y dejar para después lo que casi no cambia:

**Sí, en este PRD (Fase 1):** carrusel de inicio, servicios (imagen/texto/features), galería.
**Sí, en este PRD (Fase 2):** modal de promociones.
**Backlog, no en este PRD:** bio de la fundadora, misión/visión, datos de contacto/redes del footer. Son textos que cambian quizás una vez al año — se resuelven después con una tabla `site_settings` de una sola fila (patrón clave-valor) y un formulario simple, mismo molde. No vale la pena bloquear la entrega de lo que sí pidió por esto.

## Decisión 3 — Supabase Storage

- Bucket público `site-media`, con carpetas `hero/`, `services/`, `gallery/`, `promos/`.
- RLS de `storage.objects`: lectura pública (`select` para `anon`/`authenticated`), escritura solo `authenticated` (mismo principio que `admin_full_access` en el resto de tablas).
- Subida desde el admin: componente reutilizable `components/admin/image-upload.tsx` (input de archivo + preview + botón quitar) que sube vía Server Action con el cliente autenticado, y guarda la URL pública resultante en la fila correspondiente.
- `next.config.mjs`: agregar el hostname de Storage del proyecto Supabase a `images.remotePatterns` (Cloudinary se puede retirar una vez migrado el contenido existente).
- **Migración del contenido actual**: no basta con que las subidas *futuras* usen Supabase — Manu pidió centralizar lo que ya existe. Se hace un script puntual (Node, corrido una sola vez) que descarga las imágenes actuales de Cloudinary, las sube a `site-media`, y genera el `insert` de seed para las tablas nuevas con esas URLs — así el cutover no deja el sitio con las cards vacías el primer día.
- **Compresión de imágenes**: confirmado con el negocio que no hace falta — el volumen de imágenes es bajo (carrusel + categorías + galería, no un catálogo grande). Se sube el archivo tal cual sale del picker, sin paso de compresión client-side. Si en el futuro el peso de las fotos se vuelve un problema real, es un cambio acotado al componente `image-upload.tsx`, no al modelo de datos.

## Decisión 4 — Modal de promociones: reusar `clients`, no crear una lista paralela

Cuando el modal pide fecha de nacimiento, el dato tiene que terminar en el mismo lugar donde Manu ya opera su marketing de cumpleaños (`clients.birthday`, widget de próximos cumpleaños). Crear una tabla `promo_leads` aparte generaría una segunda lista que ella tendría que cruzar manualmente con su CRM — exactamente el problema de "información no centralizada" que quiere resolver.

**Decisión**: el formulario del modal pide nombre + teléfono (+ fecha de nacimiento, si la promo lo requiere) y hace `upsert` sobre `clients` por teléfono, **con las mismas reglas de no-sobreescritura** que ya usa `app/reservar/actions.ts` (el teléfono es la llave; si el cliente ya existe no se le cambia el nombre ni se le pisa un cumpleaños ya guardado). No se crea ninguna cita — es puro registro de contacto. Esto además significa que un visitante que llena el modal y luego reserva por WhatsApp o por `/reservar` ya queda con su cumpleaños cargado de antemano.

Anti-abuso: mismo patrón que el formulario de reserva — honeypot + `lib/booking/rate-limit.ts` (ya existe, se reutiliza tal cual) — vía Server Action con `createServiceClient()`, nunca insert directo con la anon key.

**Sin cupón automático por ahora — confirmado.** El modal solo captura el dato (nombre + teléfono + cumpleaños); no genera ningún descuento por sí mismo. El flujo real es: el cliente agenda normal por `/reservar`, y Manu aplica el precio con descuento manualmente al confirmar/completar la cita (mismo campo `charged_amount` editable que ya usa hoy para cualquier ajuste de precio — no requiere cambios). Se deja la puerta abierta a automatizarlo después: la tabla `loyalty_rewards` ya existente (Fase 2 de fidelización) es el lugar natural para un futuro tipo de cupón "por cumpleaños/promo" — extensión de `lib/booking/loyalty.ts`, no de este alcance.

### Modelo del modal

Tabla `promotions`:
- `title`, `body` (texto plano/multilínea, sin editor rico — no se pidió y agrega complejidad)
- `image_url` (opcional)
- `cta_label` / `cta_href` (opcional — puede apuntar a `/reservar`, a WhatsApp, o no tener botón)
- `requires_birthday boolean` — si es `true`, el modal muestra el mini-formulario (nombre + teléfono + fecha) antes de dejar ver/cerrar el contenido; si es `false`, el modal es puramente informativo con un botón "Entendido"
- `active boolean`
- `starts_at` / `ends_at` (opcionales) — para promos con fecha de vencimiento (ej. "Black Friday") que se apagan solas sin que Manu tenga que volver a entrar a desactivarlas
- Restricción: **una sola promo activa a la vez** (evita apilar modales). Se implementa igual que `appointments_one_active_per_client` en `0001`: índice único parcial `where active`.

### UX de reaparición

El modal se monta solo en `app/page.tsx` (no en `/admin`, no en `/reservar` — no tiene sentido interrumpir a alguien que ya está en el flujo de reserva).

Confirmado: se sigue el patrón estándar de sitios profesionales con popups de promoción (Shopify apps tipo Privy/OptinMonster, y similares) — no `sessionStorage` (que se pierde con solo cerrar la pestaña), sino una **cookie de primera parte** que persiste entre sesiones. Al cerrar el modal (o al enviar el formulario si pedía cumpleaños), se setea una cookie `promo_dismissed=<id>` con expiración de **7 días** (constante configurable en `lib/promotions/config.ts`, mismo patrón que las constantes de `lib/booking/config.ts`). Mientras la cookie esté vigente, el modal no vuelve a aparecer — pasados los 7 días, si la promo sigue activa, se vuelve a mostrar. Si Manu publica una promo distinta (id nuevo), aparece de inmediato sin importar la cookie anterior, porque la cookie está atada al `id` de esa promo puntual.

Es una cookie funcional de primera parte (no de tracking/publicidad como las de GA), así que no requiere el mismo tratamiento de consentimiento que una cookie analítica — coherente con que el sitio ya usa GA hoy sin banner de consentimiento propio.

## Modelo de datos — migración `0006_cms_contenido.sql`

Aditiva, sin `drop`, siguiendo la convención ya establecida desde `0002` (el proyecto de dev tiene datos reales).

```sql
-- Carrusel de inicio
create table public.hero_slides (
  id             uuid primary key default gen_random_uuid(),
  image_url      text not null,
  title          text not null,
  subtitle       text,
  description    text not null,
  cta_label      text not null default 'Reservar cita',
  cta_href       text not null default '/reservar',
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Categorías de marketing (1 categoría agrupa N servicios agendables)
create table public.service_categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text not null,        -- copy largo de la card pública
  image_url      text not null,
  features       jsonb not null default '[]',
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.services
  add column if not exists category_id uuid references public.service_categories(id) on delete set null;

-- Galería
create table public.gallery_images (
  id             uuid primary key default gen_random_uuid(),
  image_url      text not null,
  alt_text       text not null,
  category       text not null,
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Promociones (Fase 2)
create table public.promotions (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  body              text not null,
  image_url         text,
  cta_label         text,
  cta_href          text,
  requires_birthday boolean not null default false,
  active            boolean not null default false,
  starts_at         timestamptz,
  ends_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index promotions_one_active on public.promotions ((true)) where active;

-- RLS: lectura pública de contenido activo, escritura solo admin.
-- Deliberadamente distinto del resto de tablas (que no dan select a anon):
-- esto es contenido de marketing de solo lectura, sin lógica sensible que
-- proteger, a diferencia de clients/appointments.
alter table public.hero_slides enable row level security;
alter table public.service_categories enable row level security;
alter table public.gallery_images enable row level security;
alter table public.promotions enable row level security;

create policy "public_read_active" on public.hero_slides for select to anon, authenticated using (active = true);
create policy "admin_full_access" on public.hero_slides for all to authenticated using (true) with check (true);

create policy "public_read_active" on public.service_categories for select to anon, authenticated using (active = true);
create policy "admin_full_access" on public.service_categories for all to authenticated using (true) with check (true);

create policy "public_read_active" on public.gallery_images for select to anon, authenticated using (active = true);
create policy "admin_full_access" on public.gallery_images for all to authenticated using (true) with check (true);

create policy "public_read_active" on public.promotions for select to anon, authenticated
  using (active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));
create policy "admin_full_access" on public.promotions for all to authenticated using (true) with check (true);

create trigger set_updated_at before update on public.hero_slides
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.service_categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();
```

Storage (desde Supabase Studio o SQL):
```sql
insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true)
  on conflict (id) do nothing;

create policy "public_read_site_media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'site-media');
create policy "admin_write_site_media" on storage.objects for all to authenticated
  using (bucket_id = 'site-media') with check (bucket_id = 'site-media');
```

## Renderizado público

`app/page.tsx` deja de ser puramente estático. Se agrega `export const revalidate = 60` (ISR) para no pegarle a Supabase en cada visita, combinado con `revalidatePath('/')` en cada Server Action de guardado del admin (mismo patrón que ya usa `app/admin/(dashboard)/actions.ts` en el resto del panel) — así Manu ve su cambio reflejado al instante, y de todos modos hay una red de seguridad de 60s si algo se escapa.

## Panel admin

- `HeroCarousel`, `ServicesSection`, `GallerySection` pasan de tener sus arrays locales a recibir `slides`/`categories`/`images` como props, leídos server-side en `app/page.tsx`.
- Nueva sección `/admin/contenido` con pestañas (reutilizando `components/ui/tabs.tsx`, ya instalado): "Carrusel", "Servicios (categorías)", "Galería", "Promociones". Cada una con el mismo molde tabla + diálogo ya usado en `servicios`/`gastos`.
- `/admin/servicios` (la tabla de agenda, sin tocar su función actual) gana un campo "Categoría (marketing)" en `ServiceFormDialog` — un `<Select>` poblado desde `service_categories`, opcional.
- Reordenar: botones ↑/↓ que intercambian `display_order` con el vecino — suficiente para listas de 5-15 ítems, evita meter una librería de drag-and-drop para esto.
- `AdminNav` gana el link "Contenido".

## Fases

**Fase 1 — CMS de contenido:** migración `0006` (sin promociones), bucket + RLS + `image-upload.tsx`, script de migración de imágenes Cloudinary → Storage con seed de datos actuales, `/admin/contenido` (Carrusel + Servicios/categorías + Galería), campo de categoría en `/admin/servicios`, componentes públicos leyendo de Supabase con ISR.

**Fase 2 — Promociones:** tabla `promotions`, pestaña "Promociones" en `/admin/contenido`, `PromoModal` público (cookie de 7 días) + Server Action de captura (honeypot + rate limit + upsert en `clients`).

**Backlog:** `site_settings` para bio/misión-visión/footer; cupón automático de cumpleaños vía `loyalty_rewards`; filtro de categoría preseleccionado en `/reservar` desde el CTA de una card.

## Decisiones tomadas (confirmadas con Manu)

1. **Modelo de servicios**: categoría de marketing (1) → servicios agendables (N), no fusión 1:1 — reflejado en Decisión 1.
2. **Reaparición del modal**: cookie de primera parte por 7 días, atada al `id` de la promo activa (no `sessionStorage`) — mismo patrón que popups de promoción de sitios profesionales.
3. **Cupón de cumpleaños**: sin automatización por ahora. El cliente agenda normal, Manu aplica el descuento manualmente al confirmar/completar la cita con el campo `charged_amount` ya existente. Queda abierta la extensión futura vía `loyalty_rewards`.
4. **Compresión de imágenes**: no se implementa — volumen bajo, no lo justifica.

## Siguiente paso

Con este PRD validado, la Fase 1 es implementable en una sesión: migración + Storage + admin de Carrusel/Galería/Servicios + cambio de los 3 componentes públicos a leer de Supabase, siguiendo el mismo patrón (tabla + diálogo + Server Action + `revalidatePath`) que ya usa el resto del panel.
