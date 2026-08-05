-- Fase 1.5 — Identidad de cliente + funciones de admin (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio (proyecto de dev).
-- A diferencia de 0001, este script es ADITIVO: no borra tablas ni datos
-- existentes (el proyecto de dev ya tiene clientes/citas reales de prueba).

-- ============================================================
-- clients.birthday — para promociones de cumpleaños.
-- ============================================================
alter table public.clients add column if not exists birthday date;

-- ============================================================
-- appointments.requested_name — nombre tal como se escribió en ESA
-- solicitud, distinto de clients.name (identidad canónica del cliente,
-- que ahora solo se edita desde el panel admin). Ver Fase 1.5 punto 1:
-- el formulario público ya no puede renombrar a un cliente existente
-- con solo repetir su teléfono; esta columna preserva qué nombre se usó
-- en cada solicitud para trazabilidad, coincida o no con el registrado.
-- ============================================================
alter table public.appointments add column if not exists requested_name text;

-- Backfill best-effort para filas existentes: no se guardó el nombre
-- original al momento de la solicitud, así que se usa el nombre actual
-- del cliente como aproximación (mejor que dejarlo null).
update public.appointments a
set requested_name = c.name
from public.clients c
where a.client_id = c.id and a.requested_name is null;

alter table public.appointments alter column requested_name set not null;
