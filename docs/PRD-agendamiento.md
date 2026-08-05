# PRD — Sistema de agendamiento Manu Jaramillo

## Contexto
Sitio informativo Next.js 15 (one-page). Citas hoy por WhatsApp. Se quiere: base de datos de clientes, reserva desde la web con calendario, confirmación manual por parte de Manu, y duraciones variables por servicio.

## Principio rector
La web **no confirma citas, recibe solicitudes**. Manu sigue siendo quien confirma (por anticipo o por conocer al cliente). Esto simplifica todo: no hay pagos online ni lógica de confirmación automática en el MVP.

## Modelo de estados de una cita
```
SOLICITADA → CONFIRMADA → COMPLETADA
     ↓            ↓
  EXPIRADA    CANCELADA / NO_ASISTIO
```
- **SOLICITADA**: cliente eligió servicio + fecha/hora. Bloquea el slot temporalmente (soft-hold).
- **EXPIRADA**: si Manu no confirma en 24h (configurable), el slot se libera automáticamente. Evita saturación de citas fantasma.
- **CONFIRMADA**: Manu la aprueba desde su panel (contactó al cliente / recibió anticipo). El slot queda bloqueado definitivamente.
- **COMPLETADA / NO_ASISTIO**: cierre manual; alimenta el historial y métricas de frecuencia.

## Anti-saturación (validaciones)
1. Máximo **1 solicitud activa por teléfono** (el teléfono es la llave del cliente).
2. **Expiración automática** de solicitudes no confirmadas (24h).
3. Reservas solo con mínimo X horas de antelación y máximo Y semanas a futuro (configurable, ej. 12h / 4 semanas).
4. Honeypot + rate limit básico en el endpoint (evita bots sin fricción para usuarios).
5. No se requiere cuenta de cliente: nombre + teléfono (+ nota opcional). Cero fricción, y el teléfono deduplica.

## Duraciones variables
- Catálogo de **servicios** con duración por defecto y buffer entre citas (ej. limpieza facial 90 min + 15 buffer).
- El calendario público calcula disponibilidad según duración del servicio elegido.
- Al confirmar, **Manu puede ajustar la duración** de esa cita puntual (override), y el calendario bloquea el rango real.

## Base de datos (Postgres — Supabase)
- `services`: nombre, descripción, duración_min, buffer_min, precio (opcional), activo.
- `clients`: nombre, teléfono (unique), email opcional, notas. Se crea/actualiza automáticamente al solicitar cita.
- `appointments`: client_id, service_id, inicio, fin (calculado, editable), estado, notas, timestamps.
- `availability`: horario semanal de trabajo (día, hora inicio/fin) + `blocked_slots` para bloqueos puntuales (vacaciones, personales).

## Panel admin (/admin — solo Manu)
- Login único con Supabase Auth (email/password). Sin roles complejos.
- **Bandeja de solicitudes**: confirmar (ajustando duración si aplica), rechazar, botón WhatsApp directo (`wa.me/<tel>?text=...` con mensaje pre-armado).
- **Agenda** semanal con citas confirmadas y pendientes, y bloqueo de horarios.
- **Clientes**: lista con historial de citas, frecuencia, última visita, notas.

## Stack recomendado
- Mantener Next.js 15 + shadcn/ui (ya instalado).
- **Supabase** (free tier): Postgres + Auth admin. Server Actions / Route Handlers para mutaciones.
- Expiración de solicitudes: cron de Vercel o `pg_cron` de Supabase.
- Deploy: Vercel.
- WhatsApp: deep links en MVP. API de WhatsApp Business queda para fase 2 (requiere aprobación de Meta y costo).

## Fases
**Fase 1 (MVP):** catálogo de servicios en DB, calendario de disponibilidad, formulario de solicitud con soft-hold + expiración, panel admin (bandeja, agenda, bloqueos, clientes), deep links de WhatsApp.

**Fase 2:** recordatorios automáticos, anticipos online (Wompi/Nequi), reagendamiento por el cliente vía link, métricas (frecuencia, no-shows, servicios top).

**No construir:** cuentas/login de clientes, pagos online en MVP, multi-profesional, app móvil.

## Decisiones tomadas
1. **Anticipos**: requeridos solo para clientes nuevos; clientes recurrentes se confirman por contacto directo.
2. **Horario**: fijo semanal (tabla `availability` simple + bloqueos puntuales). Sin UI compleja de disponibilidad.
3. **Zona horaria**: única, `America/Bogota`. Todas las fechas se manejan en esta zona.

## Flujo de anticipos (clientes nuevos)
**MVP — manual:**
- El panel marca cada solicitud como cliente **nuevo** (sin citas completadas) o **recurrente**.
- Si es nuevo: botón WhatsApp con mensaje pre-armado que incluye datos de pago (Nequi/transferencia) y valor del anticipo (campo `deposit_amount` en `services`, opcional).
- Estado intermedio `ESPERANDO_ANTICIPO` con expiración propia (24h). Manu marca "anticipo recibido" → CONFIRMADA.

**Fase 2 — automático:**
- Integrar **Wompi** (Nequi, PSE, tarjetas). Al aprobar un cliente nuevo se genera link de pago; el webhook de Wompi pasa la cita a CONFIRMADA automáticamente.

Estados actualizados:
```
SOLICITADA → ESPERANDO_ANTICIPO (solo nuevos) → CONFIRMADA → COMPLETADA
     ↓               ↓                              ↓
  EXPIRADA        EXPIRADA                   CANCELADA / NO_ASISTIO
```
