# Handoff — Fase 1.5 (identidad de cliente + funciones de admin)

Continuación de [docs/HANDOFF-agendamiento.md](HANDOFF-agendamiento.md) (Fase 1). Pega este archivo (o pide que lo lean, junto con el de Fase 1) al iniciar una conversación nueva sobre este tema.

## Qué es esto

Tras usar el sistema de agendamiento de la Fase 1 en producción de prueba, surgieron 5 huecos/mejoras que se implementaron en esta sesión. El plan técnico completo quedó guardado en `/Users/mateojaramillo/.claude/plans/nifty-foraging-thunder.md`.

**Estado actual: código completo, `tsc --noEmit` sin errores nuevos, páginas verificadas cargando en `pnpm dev`.** Falta: correr la migración SQL en Supabase Studio (dev) y probar los flujos de escritura contra datos reales — sin la migración, cualquier intento de reservar o guardar cambios de cliente falla porque las columnas nuevas no existen todavía en la base de datos.

## Los 5 problemas y su solución

### 1. Suplantación de identidad vía teléfono

**Problema**: el formulario público hacía `upsert` de `clients` por `phone`, así que reservar dos veces con el mismo teléfono y un nombre distinto le cambiaba el nombre a un cliente ya existente — sin verificación alguna.

**Solución**: el nombre de un cliente (`clients.name`) ya nunca se sobreescribe desde `/reservar`. Cada solicitud guarda aparte el nombre tal como se escribió, en la nueva columna `appointments.requested_name`. Si no coincide con el nombre registrado, la Bandeja y la ficha del cliente muestran un aviso `⚠ Escribió: "..."` para que Manu decida. El nombre canónico del cliente ahora solo se edita desde el panel (punto 5).

- `app/reservar/actions.ts` — reemplaza el `upsert` por lookup + insert condicional.
- `components/admin/solicitud-card.tsx`, `app/admin/(dashboard)/clientes/[id]/page.tsx` — aviso de nombre distinto.

### 2. Horarios semanales editables

**Problema**: la plantilla de disponibilidad (`availability`) solo se podía editar a mano en Supabase Studio.

**Solución**: nueva página `/admin/horarios` — grid de 7 días (domingo a sábado) donde se agregan/eliminan franjas horarias. Los bloqueos puntuales (ej. "este domingo específico no trabajo") se siguen manejando con "Bloquear horario" en la Agenda, ya existente — no se duplicó esa función.

- `app/admin/(dashboard)/horarios/page.tsx`, `components/admin/availability-editor.tsx`.
- Acciones nuevas en `actions.ts`: `createAvailabilityWindow`, `deleteAvailabilityWindow`.

### 3. Reserva manual desde el panel

**Problema**: clientes que contactan a Manu directamente no quedaban registrados en el sistema.

**Solución**: nueva página `/admin/reservar` — busca un cliente existente (por nombre/teléfono) o crea uno nuevo, elige servicio y **fecha/hora libre** (no restringida a la plantilla de "Horarios", decisión tomada con el usuario: la protección real contra choques la da el constraint de la base de datos, no la UI). La cita se crea directo en `CONFIRMADA`, sin pasar por `SOLICITADA`/anticipo, porque Manu ya coordinó con la persona.

- `app/admin/(dashboard)/reservar/page.tsx`, `components/admin/admin-booking-form.tsx`.
- Acciones nuevas: `searchClients`, `createManualAppointment`.
- Reutiliza el mismo criterio anti-suplantación del punto 1 (si el teléfono ya existe, no se sobreescribe el nombre).

### 4. Reagendar una cita existente

**Problema**: si Manu coordinaba un cambio de horario con un cliente, no había forma de moverlo — solo cancelar y perder trazabilidad.

**Solución**: botón "Reagendar" (diálogo con fecha/hora libre) agregado en la Agenda y en la Bandeja. Conserva el estado de la cita; el trigger `set_appointment_range` ya existente recalcula `end_time`/`appt_range`.

- `components/admin/reschedule-dialog.tsx`, wireado en `agenda-week-view.tsx` y `solicitud-card.tsx`.
- Acción nueva: `rescheduleAppointment`.

### 5. Editar datos del cliente + cumpleaños

**Problema**: el panel solo permitía editar notas del cliente; no había forma de capturar correo ni cumpleaños (para promociones).

**Solución**: la ficha de cliente (`/admin/clientes/[id]`) ahora tiene un formulario completo (nombre, teléfono, correo, cumpleaños, notas) que reemplaza al antiguo formulario de solo-notas. La tabla de clientes muestra columna de cumpleaños con insignia 🎂 si cae dentro de los próximos 30 días.

- `components/admin/client-edit-form.tsx` (reemplaza a `client-notes-form.tsx`, eliminado).
- Acción nueva: `updateClient`.
- `lib/booking/birthdays.ts` — helper `daysUntilNextBirthday`/`isBirthdaySoon`, usado en la tabla de clientes y en el resumen de la Bandeja.

## Mejora visual (alcance acotado)

- Franja de resumen arriba de la Bandeja (`app/admin/(dashboard)/page.tsx`): solicitudes pendientes, citas de hoy, cumpleaños esta semana.
- Nav admin (`admin-nav.tsx`): 2 links nuevos (Horarios, Nueva cita) con estilo de "pill" para el link activo, scroll horizontal en móvil.
- Todo reutiliza primitivos ya existentes (`Card`, `Badge`, `Dialog`, `Table`) — sin dependencias nuevas, salvo un primitivo de UI: `components/ui/select.tsx` (Radix Select, que ya estaba en `package.json` sin usarse, igual que pasó con `calendar.tsx`/`popover.tsx` en la Fase 1).

## Migración de base de datos — PENDIENTE DE CORRER

`supabase/migrations/0002_client_identity_and_admin_features.sql` — **aditiva** (a diferencia de `0001`, no borra tablas; el proyecto de dev ya tiene datos reales). Agrega:

- `clients.birthday` (date, nullable).
- `appointments.requested_name` (text, not null, con backfill best-effort usando el nombre actual del cliente para las filas existentes).

**Hay que correrla en el SQL Editor de Supabase Studio (proyecto de dev) antes de probar cualquiera de estos flujos** — sin ella, reservar desde `/reservar` o `/admin/reservar`, o guardar cambios de cliente, falla porque las columnas no existen aún.

## Archivos nuevos

```
supabase/migrations/0002_client_identity_and_admin_features.sql

lib/booking/birthdays.ts

app/admin/(dashboard)/horarios/page.tsx
app/admin/(dashboard)/reservar/page.tsx

components/admin/availability-editor.tsx
components/admin/admin-booking-form.tsx
components/admin/reschedule-dialog.tsx
components/admin/client-edit-form.tsx   # reemplaza a client-notes-form.tsx (eliminado)

components/ui/select.tsx
```

## Archivos modificados

- `lib/supabase/types.ts` — `Client.birthday`, `Appointment.requested_name`.
- `app/reservar/actions.ts` — lookup de cliente por teléfono sin sobreescribir nombre; guarda `requested_name`.
- `app/admin/(dashboard)/actions.ts` — 6 acciones nuevas: `createAvailabilityWindow`, `deleteAvailabilityWindow`, `searchClients`, `createManualAppointment`, `rescheduleAppointment`, `updateClient`.
- `app/admin/(dashboard)/page.tsx` — franja de resumen (Bandeja).
- `app/admin/(dashboard)/clientes/page.tsx`, `components/admin/clients-table.tsx` — columna e insignia de cumpleaños.
- `app/admin/(dashboard)/clientes/[id]/page.tsx` — usa `ClientEditForm`; aviso de nombre distinto en el historial.
- `components/admin/solicitud-card.tsx` — aviso de nombre distinto; botón Reagendar.
- `components/admin/agenda-week-view.tsx` — botón Reagendar.
- `components/admin/admin-nav.tsx` — links "Nueva cita"/"Horarios", estilo pill.

## Estado de entornos

- **Dev**: código listo, migración `0002` **sin correr todavía**.
- **Producción**: sigue sin crear (ver Fase 1) — no aplica hasta que Fase 1.5 esté validada en dev.

## Verificación hecha en esta sesión

- `tsc --noEmit`: sin errores nuevos (el único error reportado es el preexistente y no relacionado de `hero-carousel.tsx`, ya documentado en la Fase 1).
- `pnpm dev`: todas las rutas nuevas compilan y cargan sin errores de runtime (`/admin/*` redirige a login sin sesión, como corresponde; `/reservar` y `/admin/login` responden 200). No se probaron los flujos de escritura reales porque la migración `0002` no se ha corrido.

## Pendiente / próximos pasos

1. Correr `0002_client_identity_and_admin_features.sql` en Supabase Studio (dev).
2. Probar a fondo cada flujo nuevo (ver sección "Verificación" del plan): nombre distinto en Bandeja, editar horarios y verlo reflejado en `/reservar`, crear cita manual y verificar choque de horario, reagendar, editar cliente con teléfono duplicado.
3. Cuando esté validado, incluir estos mismos cambios de schema al momento de crear el proyecto Supabase de **producción** (Fase 1, pendiente #4).
