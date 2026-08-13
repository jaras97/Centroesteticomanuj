# Handoff — Fase 2.1 (anticipos, agenda con vista de mes, horizonte de reserva, analítica de servicios)

Continuación de [docs/HANDOFF-fase-2-contabilidad-fidelizacion.md](HANDOFF-fase-2-contabilidad-fidelizacion.md). Pega este archivo (junto con el de Fase 2) al iniciar una conversación nueva sobre este tema.

## Qué es esto

Manu pidió 4 mejoras sobre el sistema de agendamiento/contabilidad ya existente:

1. Poder registrar un anticipo/abono al confirmar una cita (no solo para clientes nuevos con anticipo obligatorio).
2. Vista de mes en la Agenda administrativa, además de semana/día.
3. Que el calendario público (`/reservar`) muestre disponibilidad hasta 4 meses adelante, y aclarar cómo se manejan las excepciones semanales de horario.
4. Analítica de servicios más efectuados/valores, no solo del mes actual.

En el camino apareció y se corrigió un **bug real de navegación de calendario** que afectaba los 4 selectores de fecha del sitio (`/reservar`, "Bloquear horario", "Reagendar", "Nueva cita" del admin).

**Estado actual: código completo en la rama `preview`, `tsc --noEmit` y `pnpm build` sin errores nuevos** (el único error reportado sigue siendo el preexistente y no relacionado de `hero-carousel.tsx`). El calendario público se verificó de punta a punta con Playwright headless contra el Supabase de **dev real** (ver sección de verificación). **No se ha corrido la migración `0005` en Supabase todavía** — sin eso, registrar un anticipo falla porque la columna no existe aún.

## Los 4 problemas y su solución

### 1. Anticipos/abonos al confirmar

**Problema**: el sistema solo tenía anticipo obligatorio para clientes nuevos (`ESPERANDO_ANTICIPO`, ver Fase 1/PRD), sin monto — `markDepositReceived` marcaba un booleano, no guardaba cuánto. No había forma de anotar un abono de un cliente recurrente, ni verlo en la Agenda.

**Solución**: columna nueva `appointments.deposit_received_amount` (opcional, distinta de `services.deposit_amount` que es el anticipo *requerido* configurado por servicio, y de `charged_amount` que es el valor *total* cobrado al completar la cita — este último **no cambia de significado**, sigue siendo el total, para no romper la contabilidad de `/admin/finanzas`).

Se puede registrar en los **3 puntos donde una cita queda `CONFIRMADA`**:
- `ConfirmDialog` (Bandeja): campo opcional, solo visible cuando la cita **no** requiere el anticipo obligatorio de cliente nuevo (si lo requiere, el dinero todavía no se ha recibido en ese paso).
- `DepositReceivedButton` (antes un botón ciego): ahora es un diálogo con el monto, prellenado con `services.deposit_amount`.
- `AdminBookingForm` ("Nueva cita"): campo opcional, ya que esas citas se crean directo en `CONFIRMADA`.

Se refleja en:
- **Agenda**: ícono 💰 en el título del evento si la cita confirmada tiene anticipo; el diálogo de detalle muestra el monto exacto.
- **Completar cita**: si hubo anticipo, se muestra "saldo pendiente hoy" calculado en vivo (`chargedAmount - depositReceivedAmount`), sin alterar qué se guarda en `charged_amount`.
- **Ficha de cliente**: el anticipo aparece en cada cita del historial.

**Pregunta abierta, sin resolver a propósito**: si una cita con anticipo termina en `CANCELADA`/`NO_ASISTIO`, ese dinero no se refleja en `/admin/finanzas` en ningún lado (ni como ingreso ni como nota) — solo queda visible en el historial de la ficha del cliente. Se decidió con el usuario **no tocar esto todavía**: depende de una política de negocio de Manu (¿se lo queda como penalidad, lo devuelve, o lo traslada a la próxima cita?) que aún no está definida. Cuando la haya, es un cambio acotado en `completeAppointment`/`rejectAppointment`/`markNoShow`.

- `supabase/migrations/0005_anticipo_recibido.sql` (nueva, sin correr).
- `lib/supabase/types.ts` — `Appointment.deposit_received_amount`.
- `app/admin/(dashboard)/actions.ts` — `confirmAppointment`, `markDepositReceived`, `createManualAppointment` aceptan `depositReceivedAmount` opcional.
- `components/admin/confirm-dialog.tsx`, `deposit-received-button.tsx`, `admin-booking-form.tsx`, `solicitud-card.tsx` (pasa el `deposit_amount` del servicio como default).
- `components/admin/agenda-calendar.tsx`, `agenda-event-dialog.tsx`, `complete-appointment-dialog.tsx`.
- `app/admin/(dashboard)/clientes/[id]/page.tsx`.

### 2. Agenda con vista de mes

**Problema**: la Agenda (FullCalendar, ver Fase 1.6) solo tenía Semana/Día. Con citas agendadas con meses de anticipación, Manu no tenía manera fácil de ver el panorama de un mes completo.

**Solución**: se instaló `@fullcalendar/daygrid@6.1.21` (misma versión fijada que el resto de paquetes de FullCalendar, ver Fase 1.6) y se agregó un tercer toggle "Mes". Para que el cambio de vista sea instantáneo (sin ida y vuelta al servidor), `app/admin/(dashboard)/agenda/page.tsx` ahora **siempre trae el rango completo de la grilla del mes** que contiene la fecha enfocada (superset de cualquier semana/día visible dentro de ese mes) — solo cruzar de mes con las flechas dispara un nuevo fetch. De paso se corrigió un bug menor: en vista Día, el encabezado seguía mostrando "Semana del ..." en vez de la fecha del día enfocado.

**Ajuste post-entrega**: al probarlo, con muchos días con varias citas la vista Mes se saturaba visualmente, y el popover nativo de FullCalendar (al hacer clic en "+N más") se sobreponía al resto de la pantalla. Se reemplazó ese comportamiento: un clic en cualquier parte de un día (o en "+N más") en vista Mes navega directo a la vista Día de esa fecha (`dateClick`/`moreLinkClick` → función `goToDay`, que cambia la vista, mueve el calendario internamente para feedback visual instantáneo, y navega la URL para mantener todo sincronizado — mismo patrón que ya usan las flechas, evita reintroducir el bug de desincronización ya arreglado en la Fase 1.6-fixes).

- `components/admin/agenda-calendar.tsx`, `agenda-calendar.css`.
- `app/admin/(dashboard)/agenda/page.tsx`.
- `package.json`/`pnpm-lock.yaml` — `@fullcalendar/daygrid`.

### 3. Horizonte de reserva pública (4 meses) + horarios semanales

**Problema**: `/reservar` solo mostraba 4 semanas de disponibilidad (`BOOKING_HORIZON_WEEKS`), y no estaba claro cómo Manu podía ajustar su horario para una semana puntual sin afectar todas las semanas futuras.

**Solución**:
- `BOOKING_HORIZON_WEEKS` pasó de 4 a 18 (`lib/booking/config.ts`) — cambio de una línea, `getAvailableSlots` ya iteraba día por día sin asumir el tamaño del horizonte.
- Se decidió con el usuario que la necesidad real de Manu es **solo quitar** disponibilidad puntual (no agregar franjas extra fuera de su plantilla habitual), y ese mecanismo **ya existía**: "Bloquear horario" en la Agenda (`blocked_slots`, desde Fase 1). El hueco era de claridad, no técnico — se reforzó el texto de `/admin/horarios` para dejar explícito que esa plantilla es global (afecta *todas* las semanas futuras) y que las excepciones de una semana puntual se hacen con "Bloquear horario", no editando la plantilla.

**Bug real encontrado y arreglado** (no estaba en el pedido original, apareció al verificar este punto con Playwright): el componente compartido `components/ui/calendar.tsx` (react-day-picker v9, usado por los 4 selectores de fecha del sitio: `/reservar`, "Bloquear horario", "Reagendar", "Nueva cita") tenía un bug de CSS que hacía que las flechas de mes anterior/siguiente:
1. Se renderizaran en las esquinas superiores de toda la página en vez de al lado del texto del mes (`position: absolute` sin `position: relative` en el contenedor padre correcto — el `nav` es hijo de `months`, no de `month`).
2. Aunque se encontraran, el clic no funcionaba: el texto del mes (`month_caption`, ancho completo) se pintaba encima y capturaba el clic.

Se corrigió con 2 clases CSS (`months` gana `relative`, `nav` gana `z-10`). Verificado con Playwright headless contra el Supabase de dev real: navegación de agosto 2026 → enero 2027 funcionando, conteo de días habilitados coherente con el horizonte de 18 semanas (ago: 24, sep/oct/nov: 35, dic: 18, ene: 0), y los horarios de un día futuro cargan correctamente al seleccionarlo.

- `lib/booking/config.ts` — `BOOKING_HORIZON_WEEKS`.
- `app/admin/(dashboard)/horarios/page.tsx` — aclaración de copy.
- `components/reservar/step-datetime.tsx` — copy ("próximos meses").
- `components/ui/calendar.tsx` — **fix de navegación, afecta a los 4 selectores de fecha del sitio**.

### 4. Analítica de servicios

**Problema**: `/admin/finanzas` (Fase 2) ya tenía una tarjeta "Ingresos por servicio", pero acotada al mes seleccionado, sin vista acumulada ni forma de ordenar por cantidad de veces realizado.

**Solución**: la tarjeta se extrajo a un componente cliente nuevo, `ServiceBreakdownCard`, con toggle "Este mes / Histórico" y "Por ingreso / Por veces", ambos instantáneos en cliente (sin navegación) — `finanzas/page.tsx` ahora trae también, sin condición, una consulta adicional de todas las citas `COMPLETADA` históricas (costo trivial para el volumen de un negocio unipersonal) y pasa ambos datasets al componente.

- `components/admin/service-breakdown-card.tsx` (nuevo).
- `app/admin/(dashboard)/finanzas/page.tsx`.

## Archivos nuevos

```
supabase/migrations/0005_anticipo_recibido.sql

components/admin/service-breakdown-card.tsx
```

## Archivos modificados

```
app/admin/(dashboard)/actions.ts
app/admin/(dashboard)/agenda/page.tsx
app/admin/(dashboard)/clientes/[id]/page.tsx
app/admin/(dashboard)/finanzas/page.tsx
app/admin/(dashboard)/horarios/page.tsx

components/admin/admin-booking-form.tsx
components/admin/agenda-calendar.tsx
components/admin/agenda-calendar.css
components/admin/agenda-event-dialog.tsx
components/admin/complete-appointment-dialog.tsx
components/admin/confirm-dialog.tsx
components/admin/deposit-received-button.tsx
components/admin/solicitud-card.tsx

components/reservar/step-datetime.tsx
components/ui/calendar.tsx

lib/booking/config.ts
lib/supabase/types.ts

package.json / pnpm-lock.yaml   # @fullcalendar/daygrid@6.1.21
```

## Estado de entornos

- **Dev**: código listo en `preview`. Migración `0005` **sin correr todavía**. No se confirmó en esta sesión si `0003`/`0004` (Fase 2, contabilidad/fidelización) ya se corrieron — revisar antes de probar `/admin/finanzas`, que depende de esas columnas.
- **Producción**: sigue sin crear (ver Fase 1) — no aplica hasta que esta fase esté validada en dev.

## Verificación hecha en esta sesión

- `tsc --noEmit`: sin errores nuevos (el único reportado es el preexistente y no relacionado de `hero-carousel.tsx`).
- `pnpm build`: compila las 13 rutas sin errores, varias veces a lo largo de la sesión.
- **Verificación end-to-end con Playwright headless** contra el Supabase de **dev real** (`/reservar` es público, no requiere login): selección de servicio real, navegación del calendario 5 meses adelante, conteo de días habilitados por mes coherente con el horizonte configurado, carga de horarios al seleccionar un día futuro. Esto fue lo que permitió encontrar el bug de navegación del punto 3.
- **No se hizo verificación visual del lado admin** (Agenda, Horarios, Finanzas, los 3 puntos de entrada de anticipo) porque no había credenciales de login de admin disponibles en esta sesión — pendiente que el usuario la haga en `pnpm dev`.

## Pendiente / próximos pasos

1. Correr `0005_anticipo_recibido.sql` en el SQL Editor de Supabase Studio (dev), y confirmar que `0003`/`0004` ya se corrieron.
2. Probar con `pnpm dev` y login real de admin: anticipo en los 3 puntos de entrada (confirmar, anticipo recibido, nueva cita), Agenda en las 3 vistas incluyendo el clic-a-día en Mes, copy de Horarios, toggle de Finanzas.
3. Definir con Manu la política de anticipos en citas `CANCELADA`/`NO_ASISTIO` (punto abierto del tema 1) — cuando esté definida, es un cambio acotado.
4. Cuando esté todo validado, considerar mergear `preview` a `main` (o el flujo de release que se use), y replicar `0005` en el Supabase de producción cuando se cree (sigue pendiente desde la Fase 1).
