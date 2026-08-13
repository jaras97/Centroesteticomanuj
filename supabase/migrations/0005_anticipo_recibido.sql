-- Fase 2.3 — Registro de anticipo/abono al confirmar una cita.
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva (como 0002/0003/0004): no borra tablas ni datos existentes.

-- ============================================================
-- appointments.deposit_received_amount — monto que Manu registró como
-- recibido (anticipo o pago total) al confirmar la cita, distinto de
-- appointments.charged_amount (valor final capturado al completar la
-- cita). Es opcional: no reemplaza el flujo existente ESPERANDO_ANTICIPO
-- (gate obligatorio solo para clientes nuevos, ver confirmAppointment),
-- sino que permite anotar el abono en cualquier confirmación.
-- ============================================================
alter table public.appointments
  add column if not exists deposit_received_amount int
    check (deposit_received_amount is null or deposit_received_amount >= 0);
