# Handoff — Sistema de agendamiento (Fase 1)

Documento de continuidad para retomar este trabajo en un chat nuevo sin perder contexto. Pega este archivo (o pide que lo lean) al iniciar la conversación.

## Qué es esto

Se implementó la **Fase 1** del PRD en [docs/PRD-agendamiento.md](PRD-agendamiento.md): mover el sitio de "citas por WhatsApp" a un flujo de **solicitud de cita** con calendario público + panel admin de confirmación manual. El plan técnico completo (con todas las justificaciones de diseño) quedó guardado en `/Users/mateojaramillo/.claude/plans/polished-juggling-dijkstra.md`.

**Estado actual: implementación de código completa y funcionando en el proyecto Supabase de dev** (el usuario confirmó "funciono" tras probar `/reservar` end-to-end). Falta: pulir detalles menores, probar el panel admin a fondo, y crear el proyecto Supabase de **producción** cuando todo esté validado.

## Decisiones de arquitectura (no volver a discutir salvo que algo no funcione)

1. **Sin cuentas de cliente.** El teléfono es la llave de dedupe (`clients.phone` unique). Solo hay un usuario autenticado en todo el sistema: Manu, en `/admin`.
2. **La web no confirma, solicita.** Insert siempre crea `status='SOLICITADA'`; Manu confirma/rechaza manualmente desde la Bandeja.
3. **RLS mínimo**: las 5 tablas tienen RLS habilitado con una sola política `for all to authenticated using (true)`. El **flujo público nunca usa la anon key contra las tablas** — todo pasa por Server Actions con un cliente `service_role` (bypassa RLS), con validación de app (zod, honeypot, rate limit, dedup). El admin usa el cliente con sesión (`lib/supabase/server.ts`), protegido tanto por RLS como por el `middleware.ts`.
4. **Doble reserva y solicitudes duplicadas se previenen a nivel de DB**, no solo en la app:
   - `EXCLUDE USING gist (appt_range WITH &&) WHERE status IN (...)` en `appointments` — imposible reservar un horario ya ocupado, ni siquiera en condición de carrera.
   - Índice único parcial `(client_id) WHERE status IN ('SOLICITADA','ESPERANDO_ANTICIPO')` — máximo 1 solicitud activa por cliente.
   - El Server Action atrapa los códigos Postgres `23505`/`23P01` y devuelve mensajes amigables.
5. **Expiración de solicitudes vía `pg_cron`** (no Vercel Cron — el plan Hobby limita a 1x/día, muy impreciso para una ventana de 24h). Corre cada 10 min dentro de Postgres. Además, `lib/booking/availability.ts` trata cualquier solicitud con `expires_at < now()` como ya libre aunque el cron no haya corrido todavía (red de seguridad).
6. **Zona horaria fija `America/Bogota` (`-05:00`, sin DST)**, manejada con aritmética manual en `lib/booking/timezone.ts` — no se agregó Luxon/date-fns-tz porque el offset es constante todo el año.
7. **`end_time`/`appt_range` NO son columnas `GENERATED`** — se intentó así originalmente y falló (`timestamptz + interval` es `STABLE`, no `IMMUTABLE`, en Postgres). Se calculan con un trigger `BEFORE INSERT/UPDATE OF start_time, duration_min, buffer_min` (`public.set_appointment_range()`). Si algún día tocas el schema de `appointments`, recuerda esto.
8. **Sin dependencias de calendario/tz nuevas**: se aprovecharon `react-day-picker` v9.8.0 y `date-fns`/`react-hook-form`/`zod` que ya estaban en `package.json` sin usar (leftover del scaffold v0.dev). Solo se agregaron `@supabase/supabase-js`, `@supabase/ssr` y `server-only` (este último, no estaba en el plan original — se agregó para que el build falle si `lib/supabase/service.ts`, que tiene la `service_role` key, se importa por error desde un componente `'use client'`).
9. **Dos entornos = dos proyectos Supabase separados** (no una DB compartida con branching). Ahora mismo solo existe el de **dev**. El de producción se crea después, corriendo el mismo SQL, y solo cambia qué credenciales se ponen en qué scope de Vercel (Development/Preview vs Production) — cero cambios de código.
10. **CTAs "Reservar" reconectados**: los 5 botones que abrían WhatsApp directo ahora apuntan a `/reservar`. WhatsApp queda como canal secundario en el footer y como botón de contacto directo en la Bandeja del admin (mensaje pre-armado).

## Estructura de archivos creados

```
supabase/migrations/0001_init_agendamiento.sql   # schema completo, RLS, constraints, pg_cron — idempotente

lib/supabase/
  server.ts     # cliente con sesión (cookies), usado en todo /admin — RLS "authenticated"
  browser.ts    # cliente browser (anon key), solo en el login del admin
  service.ts    # cliente service_role (bypassa RLS), solo en Server Actions públicas + availability.ts
  types.ts      # tipos TS de las 5 tablas (AppointmentStatus, Service, Client, Availability, BlockedSlot, Appointment)

lib/booking/
  config.ts         # LEAD_TIME_HOURS=12, BOOKING_HORIZON_WEEKS=4, REQUEST_EXPIRATION_HOURS=24, offset Bogotá, rate limit
  timezone.ts        # conversión wall-clock Bogotá <-> UTC, sin librería de tz
  availability.ts      # getAvailableSlots(serviceId): calcula slots libres en TS a partir de availability/blocked_slots/appointments
  schemas.ts             # zod: bookingRequestSchema (+ honeypot "website"), stepDetailsSchema
  rate-limit.ts             # rate limit en memoria por IP (best-effort, documentado como tal)

lib/whatsapp.ts   # BUSINESS_WHATSAPP_NUMBER + buildWhatsAppLink(), usado en footer y Bandeja admin

middleware.ts     # refresca sesión Supabase + protege /admin/* (redirige a /admin/login sin sesión)

app/reservar/
  layout.tsx, page.tsx, actions.ts   # getAvailability(), createBookingRequest() — Server Actions
components/reservar/
  reservar-header.tsx, booking-wizard.tsx, step-service.tsx, step-datetime.tsx, step-details.tsx, confirmation.tsx

app/admin/
  login/page.tsx
  (dashboard)/layout.tsx, page.tsx (= Bandeja), agenda/page.tsx, clientes/page.tsx, clientes/[id]/page.tsx
  (dashboard)/actions.ts   # confirmAppointment, markDepositReceived, rejectAppointment, markCompleted,
                            # markNoShow, createBlockedSlot, deleteBlockedSlot, updateClientNotes, signOut
components/admin/
  admin-nav.tsx, solicitud-card.tsx, confirm-dialog.tsx, reject-dialog.tsx, deposit-received-button.tsx,
  agenda-week-view.tsx, block-slot-dialog.tsx, clients-table.tsx, client-notes-form.tsx

components/ui/ (nuevos primitivos shadcn, sin deps nuevas)
  calendar.tsx (react-day-picker v9 real, no snippet v8), popover.tsx, label.tsx, textarea.tsx,
  form.tsx, dialog.tsx, badge.tsx, table.tsx

.env.local.example   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

## Archivos modificados

- `app/layout.tsx` — monta `<Toaster/>` de sonner.
- `components/header.tsx`, `hero-carousel.tsx`, `services-section.tsx`, `about-section.tsx` — CTA "Reservar" → `href='/reservar'` (se quitó `phone`/`message`).
- `components/footer.tsx` — el teléfono ahora es un link `wa.me` (antes texto plano) + ícono `MessageCircle`.
- `package.json` / `pnpm-lock.yaml` — `@supabase/supabase-js`, `@supabase/ssr`, `server-only`.

## Estado de entornos

- **Dev**: proyecto Supabase creado y funcionando. SQL corrido exitosamente (tras corregir el bug de columnas `GENERATED`). `.env.local` lleno y probado — el flujo `/reservar` → `appointments` en Supabase funciona.
- **Producción**: **no creada todavía**. Cuando el usuario diga que ya probó todo a fondo, hay que repetir: crear proyecto → activar `pg_cron` → correr el mismo SQL → crear usuario admin → credenciales en el scope "Production" de Vercel.
- Los datos de `services` (duración/precio/anticipo) y `availability` (horario semanal) en el SQL son **placeholders** — Manu debe ajustarlos en Supabase Studio con sus valores reales antes de ir a producción.

## Verificación de código (hecha en esta sesión)

- `tsc --noEmit`: sin errores en ningún archivo nuevo/modificado de esta feature. Hay un error de tipos preexistente y no relacionado en `components/hero-carousel.tsx` (conflicto de versiones `embla-carousel` 8.5.1 vs `embla-carousel-autoplay` 8.6.0) — ya existía antes de esta feature, `next.config.mjs` ignora errores de TS en build, no bloquea nada.
- `pnpm lint`: el repo **no tiene un `.eslintrc`/`eslint.config` configurado** (pregunta interactiva al correrlo) — gap preexistente, no introducido por esta feature.
- No se corrió `pnpm build` completo en esta sesión (el usuario ya validó el flujo funcionando vía `pnpm dev` contra el proyecto de dev real).

## Pendiente / próximos pasos sugeridos

1. Probar a fondo el panel admin completo: confirmar con override de duración, rechazar con motivo, marcar anticipo recibido, agenda semanal, bloqueo de horarios, historial de cliente.
2. Ajustar `services`/`availability` a los valores reales de Manu en Supabase Studio (dev).
3. Considerar correr `pnpm build` una vez antes de dar por cerrada la Fase 1 (por si hay algún error de build real que `tsc --noEmit` no capture, ej. imports server-only en cliente).
4. Cuando todo esté validado: crear el proyecto Supabase de **producción** (checklist arriba) y configurar variables de entorno en Vercel.
5. Fase 2 (fuera de alcance ahora, ver PRD): recordatorios automáticos, anticipos online (Wompi), reagendamiento por el cliente, métricas.

## Limitación conocida (documentada, no es un bug)

El catálogo `services` de la DB (usado por `/reservar`) está desacoplado del array hardcoded de servicios en `components/services-section.tsx` (contenido de marketing del home). Si se agrega un servicio nuevo hay que actualizarlo en los dos lugares.
