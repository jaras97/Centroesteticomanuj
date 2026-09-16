-- 0013 — Búsqueda y paginación de clientes (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- ADITIVA: no borra tablas ni datos. Lo único que se recrea es una vista
-- (objeto derivado, sin datos propios), para que el script sea re-ejecutable.
--
-- Motivo: /admin/clientes traía TODOS los clientes y TODAS las citas
-- COMPLETADA y agregaba en JavaScript con un Map. Eso no escala. A partir
-- de aquí la agregación (número de visitas / última visita) la hace
-- Postgres, y la página pagina con .range() + count exacto.

-- ============================================================
-- Extensión para búsqueda por subcadena (ilike '%texto%')
-- ============================================================
-- Sin esto, un ilike con comodín a la izquierda no puede usar un índice
-- btree y degenera en seq scan sobre toda la tabla de clientes.
create extension if not exists pg_trgm;

-- Supabase suele instalar las extensiones en el esquema `extensions`, no en
-- `public`. Si ese esquema no está en el search_path, `gin_trgm_ops` (de más
-- abajo) no se resuelve y el script muere con "operator class does not exist".
-- Esta línea cubre los dos casos; si el esquema no existe, se ignora sin error.
set search_path = public, extensions;

create index if not exists clients_name_trgm_idx
  on public.clients using gin (name gin_trgm_ops);

create index if not exists clients_phone_trgm_idx
  on public.clients using gin (phone gin_trgm_ops);

-- Orden alfabético (el orden por defecto de la tabla de clientes).
create index if not exists clients_name_idx
  on public.clients (name);

-- Índice parcial que sostiene el lateral de estadísticas de más abajo:
-- solo las citas COMPLETADA, ya ordenadas por cliente y fecha.
create index if not exists appointments_completed_client_idx
  on public.appointments (client_id, start_time desc)
  where status = 'COMPLETADA';

-- ============================================================
-- Vista clients_with_stats
-- ============================================================
-- OJO con la RLS: una vista normal en Postgres se ejecuta con los permisos
-- de su DUEÑO (postgres), lo que saltaría la RLS de clients/appointments y
-- dejaría la vista leyendo como superusuario. `security_invoker = true`
-- (Postgres 15+, que es lo que corre Supabase) hace que la vista se evalúe
-- con el rol que consulta, así que siguen aplicando las policies
-- `admin_full_access` de clients y appointments.
drop view if exists public.clients_with_stats;

create view public.clients_with_stats
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.phone,
  c.email,
  c.notes,
  c.birthday,
  c.created_at,
  c.updated_at,
  coalesce(s.visit_count, 0)::int as visit_count,
  s.last_visit
from public.clients c
left join lateral (
  select
    count(*)::int        as visit_count,
    max(a.start_time)    as last_visit
  from public.appointments a
  where a.client_id = c.id
    and a.status = 'COMPLETADA'
) s on true;

comment on view public.clients_with_stats is
  'Clientes + número de citas COMPLETADA y fecha de la última, agregado en Postgres. '
  'security_invoker: hereda la RLS de clients/appointments.';

-- Solo el admin autenticado. `anon` NO recibe permiso: la lista de clientes
-- nunca se expone al público (a diferencia de las tablas de contenido del CMS).
grant select on public.clients_with_stats to authenticated;
