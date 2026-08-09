# Handoff — Fase 2 (contabilidad de citas + fidelización de clientes)

Continuación de las HANDOFF de Fase 1/1.5/1.6 (agendamiento). Pega este archivo (junto con el plan técnico si hace falta más detalle) al iniciar una conversación nueva sobre este tema.

## Qué es esto

Manu pidió dos funcionalidades nuevas sobre el sistema de agendamiento ya existente:

1. **Contabilidad**: registrar el valor realmente cobrado en cada cita (puede diferir del precio de lista del servicio), llevar gastos del centro, y un dashboard con métricas diarias/mensuales.
2. **Fidelización**: contar citas completadas por cliente en una ventana móvil de tiempo y, al llegar a un umbral, otorgar automáticamente un cupón de descuento para su próxima cita.

El plan técnico completo (con las justificaciones de diseño) quedó guardado en `/Users/mateojaramillo/.claude/plans/mighty-cuddling-moth.md`.

**Estado actual: código completo en la rama `preview`, `tsc --noEmit` y `pnpm build` sin errores nuevos** (el único error reportado sigue siendo el preexistente y no relacionado de `hero-carousel.tsx`, ya documentado desde la Fase 1). **No se ha corrido ninguna migración en Supabase todavía** — sin eso, cualquier intento de completar una cita con monto o registrar un gasto falla porque las columnas/tablas no existen aún. Tampoco se hizo verificación visual en navegador en esta sesión.

## Decisiones de arquitectura (no volver a discutir salvo que algo no funcione)

1. **Rama de trabajo `preview`** (no `main`) — así lo pidió el usuario explícitamente para esta fase.
2. **Parámetros de fidelización como constantes en código** (`lib/booking/config.ts`), no un panel de configuración — decisión explícita del usuario, mismo patrón que `LEAD_TIME_HOURS`.
3. **Valores por defecto de fidelización**: 5 citas `COMPLETADA` dentro de una ventana móvil de 6 meses (182 días) → cupón de 20% de descuento. Confirmados por el usuario (no eran solo ejemplos del PRD original).
4. **Ventana móvil, no calendario fijo**: el progreso se cuenta desde la última recompensa del cliente (o desde siempre si nunca ganó una), no desde el 1 de enero — evita el salto artificial de "se resetea el 1 de enero". Ver algoritmo en `lib/booking/loyalty.ts`.
5. **Sin contador redundante**: no se agregó `clients.completed_count` ni similar. El progreso de fidelización se calcula en consulta (contando `appointments` con `status='COMPLETADA'`), igual que ya hacía `confirmAppointment` para detectar "cliente nuevo".
6. **Un cliente puede acumular más de un cupón `DISPONIBLE` sin canjear** — no hay expiración de cupones en este alcance (no se pidió; se puede agregar después con una columna `expires_at` si se vuelve un problema real).
7. **El monto cobrado se captura solo al completar la cita** (`completeAppointment`, antes `markCompleted`), prellenado con `services.price` pero editable — no se tocó el modelo de estados de citas ni el flujo público `/reservar`.
8. **`expenses` sí permite borrado duro** (a diferencia de `services`, que pidió explícitamente "sin borrado duro") — nada referencia una fila de `expenses`, así que no hay riesgo de romper integridad.
9. **Sin dependencias nuevas en `package.json`** — se activaron `recharts`, `@radix-ui/react-tabs` y `@radix-ui/react-progress`, que ya estaban instalados desde el scaffold de v0.dev pero sin usar (mismo patrón que FullCalendar/Select/Calendar en fases anteriores).

## Los 2 problemas y su solución

### 1. Contabilidad

**Modelo de datos** — `supabase/migrations/0003_contabilidad.sql` (aditiva, sin correr todavía):
- `appointments.charged_amount` (int, nullable) y `appointments.payment_method` (text, nullable, sin `check` — la UI restringe las opciones vía `<Select>`).
- Tabla `expenses` (fecha, categoría, descripción, monto) con RLS igual al resto de tablas.

**Captura del monto**: `markCompleted(id)` se renombró a `completeAppointment(id, { chargedAmount, paymentMethod?, appliedRewardId? })` en `app/admin/(dashboard)/actions.ts`. El único call site (`components/admin/agenda-event-dialog.tsx`, botón "Completada" en la Agenda) se reemplazó por `components/admin/complete-appointment-dialog.tsx` — diálogo con monto prellenado (`services.price`), selector de método de pago, y si el cliente tiene un cupón de fidelización disponible, checkbox para aplicarlo con recálculo en vivo.

**Dashboard `/admin/finanzas`** (nuevo link en el nav): dos pestañas con el primitivo nuevo `components/ui/tabs.tsx`.
- **Resumen**: selector de mes por query param `?month=YYYY-MM` (mismo patrón de navegación que la Agenda con `?date=`). Métricas: ingresos de hoy, ingresos/gastos/utilidad del mes, ticket promedio, tasa de no-show/cancelación, clientes nuevos vs. recurrentes, ingresos por servicio, y gráfico de barras de ingresos por día (`components/admin/revenue-chart.tsx`, `recharts`, color `brand-teal`). Toda la agregación se hace en TS a partir de consultas simples a Supabase (mismo enfoque que `lib/booking/availability.ts` — el volumen de un negocio unipersonal no justifica SQL de agregación).
- **Gastos**: `components/admin/expenses-table.tsx` + `expense-form-dialog.tsx`, mismo molde que `services-table.tsx`/`service-form-dialog.tsx`.

También se agregó el monto cobrado (si existe) al historial de citas en la ficha de cliente (`app/admin/(dashboard)/clientes/[id]/page.tsx`).

### 2. Fidelización

**Modelo de datos** — `supabase/migrations/0004_fidelizacion.sql` (aditiva, sin correr todavía): tabla `loyalty_rewards` (cliente, % de descuento, cuándo se ganó, en qué cita se ganó, cuándo/en qué cita se usó).

**Algoritmo** — `lib/booking/loyalty.ts`:
- `evaluateAndGrantLoyaltyReward(supabase, clientId, appointmentId)`: se llama **solo** desde `completeAppointment`, justo después de marcar una cita `COMPLETADA` (no hay cron aparte). Cuenta las citas `COMPLETADA` del cliente posteriores a su última recompensa (o desde siempre si no tiene) y dentro de los últimos `LOYALTY_WINDOW_DAYS`; si llega a `LOYALTY_THRESHOLD_APPOINTMENTS`, inserta un nuevo `loyalty_rewards`.
- `getClientLoyaltyStatus(supabase, clientId)`: progreso actual + historial de cupones, usado en la ficha de cliente.
- `getAvailableRewards(supabase, clientId)`: cupones sin usar, usado por el diálogo de completar cita.

**UI**:
- `components/admin/loyalty-card.tsx` — tarjeta "Fidelización" en la ficha de cliente (`Progress` primitivo nuevo: `components/ui/progress.tsx`), con barra de progreso y el historial de cupones (Disponible/Usado).
- Diálogo de completar cita (arriba): checkbox para aplicar un cupón disponible.
- Toast `🎉 Este cliente ganó un cupón...` cuando `completeAppointment` devuelve `loyaltyGranted: true`.

## Archivos nuevos

```
supabase/migrations/0003_contabilidad.sql
supabase/migrations/0004_fidelizacion.sql

lib/booking/loyalty.ts

components/ui/tabs.tsx
components/ui/progress.tsx

components/admin/summary-card.tsx          # extraído de app/admin/(dashboard)/page.tsx
components/admin/complete-appointment-dialog.tsx   # reemplaza el botón "Completada" inline
components/admin/expenses-table.tsx
components/admin/expense-form-dialog.tsx
components/admin/loyalty-card.tsx
components/admin/revenue-chart.tsx

app/admin/(dashboard)/finanzas/page.tsx
```

## Archivos modificados

- `lib/booking/config.ts` — `LOYALTY_THRESHOLD_APPOINTMENTS`, `LOYALTY_WINDOW_DAYS`, `LOYALTY_DISCOUNT_PERCENT`.
- `lib/booking/timezone.ts` — `formatDateStrHuman` (formatea una fecha simple 'YYYY-MM-DD', usada por la tabla de gastos).
- `lib/supabase/types.ts` — `Appointment.charged_amount`/`payment_method`, tipos nuevos `Expense` y `LoyaltyReward`.
- `app/admin/(dashboard)/actions.ts` — `completeAppointment` (reemplaza `markCompleted`), `createExpense`/`updateExpense`/`deleteExpense`, `getAvailableRewards`.
- `app/admin/(dashboard)/page.tsx` — usa `SummaryCard` extraído en vez de la copia local.
- `app/admin/(dashboard)/clientes/[id]/page.tsx` — monta `LoyaltyCard`; muestra `charged_amount` en el historial.
- `components/admin/admin-nav.tsx` — link "Finanzas".
- `components/admin/agenda-calendar.tsx` — `AgendaAppointment` ahora incluye `client_id` y `services.price` (necesarios para el diálogo de completar cita).
- `components/admin/agenda-event-dialog.tsx` — botón "Completada" → `<CompleteAppointmentDialog/>`.

## Estado de entornos

- **Dev**: código listo en `preview`, **migraciones `0003` y `0004` sin correr todavía**.
- **Producción**: sigue sin crear (ver Fase 1) — no aplica hasta que esta fase esté validada en dev.

## Verificación hecha en esta sesión

- `tsc --noEmit`: sin errores nuevos (el único reportado es el preexistente y no relacionado de `hero-carousel.tsx`).
- `pnpm build`: compila todas las rutas sin errores, incluyendo la nueva `/admin/finanzas`.
- **No se hizo verificación visual en navegador** (no se corrieron las migraciones en esta sesión, así que los flujos de escritura nuevos fallarían contra la DB real).

## Pendiente / próximos pasos

1. Correr `0003_contabilidad.sql` y `0004_fidelizacion.sql` en el SQL Editor de Supabase Studio (proyecto de dev).
2. Probar de punta a punta con `pnpm dev`: completar una cita con monto/método de pago → verificar que aparece en `/admin/finanzas` (Resumen y en el historial del cliente); crear/editar/eliminar un gasto; completar 5 citas de un cliente de prueba dentro de 6 meses y confirmar que se otorga el cupón (toast + ficha de cliente); aplicar el cupón al completar otra cita y verificar que el monto se recalcula y el cupón queda "Usado".
3. Confirmar que `/reservar` (flujo público) sigue funcionando sin cambios — no debería estar afectado, pero vale la pena verificarlo una vez.
4. Cuando esté validado, hacer merge de `preview` a `main` (o el flujo de release que uses) y replicar las mismas migraciones en el proyecto Supabase de producción cuando se cree (ver Fase 1, pendiente aún).
