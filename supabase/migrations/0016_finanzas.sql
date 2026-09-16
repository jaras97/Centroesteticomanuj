-- Módulo de Finanzas — libro de movimientos, cuentas, categorías y recurrentes
-- (Centro Estético Manuj)
-- Pegar y correr completo en el SQL Editor de Supabase Studio.
-- Aditiva (como 0002-0015): no borra tablas, columnas ni datos existentes.
--
-- CORRER EN CADA PROYECTO (dev Y producción). Son bases distintas.
--
-- ============================================================
-- QUÉ RESUELVE
-- ============================================================
-- Hasta ahora Finanzas era `ingresos − gastos` y nada más. Manuela no tenía
-- forma de **retirar plata como utilidad** sin registrarla como gasto, lo que
-- corrompía la utilidad y el desglose por categoría. Un retiro NO es un gasto:
-- es utilidad ya ganada que cambia de bolsillo.
--
-- Esta migración separa tres números que antes eran uno solo:
--
--   1. Utilidad del negocio (P&L) = ingresos operativos − gastos operativos.
--      Los RETIRO y APORTE **no** entran.
--   2. Caja disponible = acumulado histórico real. Los RETIRO y APORTE **sí**.
--   3. Retirado en el mes = cuánto sacó Manu (suma de RETIRO del mes).
--
-- Para eso crea cuatro tablas:
--   financial_accounts  → dónde vive la plata (Efectivo, Nequi, banco…).
--   expense_categories  → categorías de gasto gestionadas (antes texto libre).
--   financial_movements → EL LIBRO: todo lo que no es ingreso por cita.
--   recurring_expenses  → plantillas de gasto fijo mensual.
--
-- ============================================================
-- POSTURA CONTABLE (decidida, la implementa lib/finance/queries.ts)
-- ============================================================
-- · El ingreso por servicio se sigue reconociendo en la fecha de la cita
--   (`appointments.start_time`, hora Bogotá) por `charged_amount`, sobre citas
--   COMPLETADA. Esta migración NO reescribe ese histórico.
-- · Los anticipos (`appointments.deposit_received_amount`) NO se suman como
--   ingreso ni se prorratean: eso duplicaría el mismo peso (primero como
--   anticipo, después dentro del `charged_amount` de la cita cerrada). Se
--   exponen como un KPI informativo aparte, "Anticipos retenidos", sobre las
--   citas que todavía no están COMPLETADA/CANCELADA/NO_ASISTIO/EXPIRADA.
-- · Los movimientos sin `account_id` igual cuentan en la caja global, pero no
--   en el saldo por cuenta — la UI lo advierte como "Sin asignar".

-- ============================================================
-- 1. financial_accounts — dónde vive la plata
-- ============================================================
-- `opening_balance` es el saldo con el que arranca la cuenta el día que se
-- crea: sin él, la caja disponible arrancaría en cero e ignoraría la plata que
-- ya existía antes de usar el sistema.
--
-- El unique en `name` no es cosmético: es lo que hace idempotente el seed de
-- abajo (`on conflict (name) do nothing`) y lo que permite el backfill de
-- `appointments.account_id` por coincidencia de nombre con `payment_method`.
create table if not exists public.financial_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null default 'OTRO'
                    check (kind in ('EFECTIVO', 'DIGITAL', 'BANCO', 'OTRO')),
  opening_balance int not null default 0,
  display_order   int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint financial_accounts_name_unique unique (name)
);

-- Por si la tabla ya existía de una corrida anterior sin la constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_accounts_name_unique'
      and conrelid = 'public.financial_accounts'::regclass
  ) then
    alter table public.financial_accounts
      add constraint financial_accounts_name_unique unique (name);
  end if;
end $$;

alter table public.financial_accounts enable row level security;

-- Datos financieros: SOLO acceso autenticado. A diferencia de las tablas de
-- contenido (hero_slides, gallery_images…), acá NO hay política de lectura
-- pública para `anon`, ni la debe haber nunca.
drop policy if exists "admin_full_access" on public.financial_accounts;
create policy "admin_full_access" on public.financial_accounts
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.financial_accounts;
create trigger set_updated_at before update on public.financial_accounts
  for each row execute function public.set_updated_at();

insert into public.financial_accounts (name, kind, display_order)
values
  ('Efectivo',               'EFECTIVO', 0),
  ('Nequi',                  'DIGITAL',  1),
  ('Transferencia / Banco',  'BANCO',    2)
on conflict (name) do nothing;

-- ============================================================
-- 2. expense_categories — categorías gestionadas
-- ============================================================
-- Reemplazan el texto libre de `expenses.category`: con texto libre, "Insumos"
-- e "insumos " son dos categorías distintas y el desglose por categoría miente.
--
-- `nature` distingue gasto FIJO (arriendo, servicios públicos: se repiten mes
-- a mes) de VARIABLE (insumos, marketing puntual). Es lo que permite mostrar
-- el punto de equilibrio sin pedirle a Manu que lo clasifique cada vez.
create table if not exists public.expense_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  nature        text not null default 'VARIABLE' check (nature in ('FIJO', 'VARIABLE')),
  display_order int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.expense_categories enable row level security;

drop policy if exists "admin_full_access" on public.expense_categories;
create policy "admin_full_access" on public.expense_categories
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.expense_categories;
create trigger set_updated_at before update on public.expense_categories
  for each row execute function public.set_updated_at();

insert into public.expense_categories (name, nature, display_order)
values
  ('Insumos',            'VARIABLE', 0),
  ('Arriendo',           'FIJO',     1),
  ('Servicios públicos', 'FIJO',     2),
  ('Marketing',          'VARIABLE', 3),
  ('Otro',               'VARIABLE', 4)
on conflict (name) do nothing;

-- ============================================================
-- 3. recurring_expenses — plantillas de gasto fijo mensual
-- ============================================================
-- No genera movimientos sola (no hay cron para esto, a propósito: un gasto
-- fijo puede cambiar de monto o no pagarse). La UI lista las plantillas que
-- todavía no tienen movimiento en el mes y Manu las registra con un clic.
--
-- `day_of_month` va de 1 a 28 para que la plantilla exista en todos los meses,
-- febrero incluido — así no hay que decidir qué hacer con un "31" en un mes de 30.
create table if not exists public.recurring_expenses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category_id  uuid references public.expense_categories(id) on delete set null,
  account_id   uuid references public.financial_accounts(id) on delete set null,
  amount       int not null check (amount > 0),
  day_of_month int not null check (day_of_month between 1 and 28),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.recurring_expenses enable row level security;

drop policy if exists "admin_full_access" on public.recurring_expenses;
create policy "admin_full_access" on public.recurring_expenses
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.recurring_expenses;
create trigger set_updated_at before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4. financial_movements — EL LIBRO
-- ============================================================
-- Todo lo que NO es ingreso por cita vive acá, en una sola tabla con un
-- discriminador `kind`, en vez de una tabla por concepto. Son la misma forma
-- (fecha, monto, cuenta, descripción) y el mismo listado en la UI; separarlas
-- obligaría a hacer UNION en cada consulta de caja.
--
--   INGRESO_OTRO → venta de producto, alquiler de silla, cualquier ingreso
--                  operativo que no salga de una cita. SUMA a la utilidad.
--   GASTO        → gasto operativo. RESTA de la utilidad.
--   RETIRO       → Manu saca plata del negocio. NO toca la utilidad, solo caja.
--   APORTE       → Manu mete plata al negocio. NO toca la utilidad, solo caja.
--
-- `movement_date` es un `date` simple, no un timestamptz: un gasto no tiene
-- hora relevante y así se compara como string 'YYYY-MM-DD' sin conversión de
-- zona horaria (igual que hacía `expenses.expense_date`).
--
-- `account_id` es `on delete restrict` a propósito: borrar una cuenta que ya
-- tiene movimientos dejaría la caja descuadrada en silencio. Las cuentas se
-- desactivan (`active = false`), no se borran.
create table if not exists public.financial_movements (
  id                    uuid primary key default gen_random_uuid(),
  movement_date         date not null default current_date,
  kind                  text not null
                          check (kind in ('INGRESO_OTRO', 'GASTO', 'RETIRO', 'APORTE')),
  amount                int not null check (amount > 0),
  account_id            uuid references public.financial_accounts(id) on delete restrict,
  -- Solo tiene sentido en kind='GASTO'; las Server Actions lo limpian en los
  -- demás casos. No se fuerza con un check para no bloquear correcciones.
  category_id           uuid references public.expense_categories(id) on delete set null,
  description           text,
  recurring_template_id uuid references public.recurring_expenses(id) on delete set null,
  -- Idempotencia del backfill desde `expenses`: si la migración se corre dos
  -- veces, la segunda no duplica los gastos históricos.
  legacy_expense_id     uuid unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists financial_movements_date_idx
  on public.financial_movements (movement_date);
create index if not exists financial_movements_kind_date_idx
  on public.financial_movements (kind, movement_date);
create index if not exists financial_movements_account_idx
  on public.financial_movements (account_id);
-- Para `getPendingRecurringExpenses`: "¿esta plantilla ya se registró este mes?"
create index if not exists financial_movements_recurring_idx
  on public.financial_movements (recurring_template_id, movement_date);

alter table public.financial_movements enable row level security;

drop policy if exists "admin_full_access" on public.financial_movements;
create policy "admin_full_access" on public.financial_movements
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.financial_movements;
create trigger set_updated_at before update on public.financial_movements
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. appointments.account_id — a qué cuenta entró el ingreso del servicio
-- ============================================================
-- `payment_method` (texto libre desde 0003) se capturaba y no se agregaba en
-- ningún lado. Con esta FK, el ingreso por cita también suma al saldo de una
-- cuenta y la UI puede responder "¿de dónde entró la plata?".
--
-- `payment_method` se CONSERVA y se sigue escribiendo con el nombre de la
-- cuenta elegida: es lo que muestra el historial de citas ya existente, y
-- reescribirlo rompería filas históricas cuyo método ya no exista como cuenta.
alter table public.appointments
  add column if not exists account_id uuid
  references public.financial_accounts(id) on delete set null;

create index if not exists appointments_account_idx
  on public.appointments (account_id);

-- Backfill por coincidencia de nombre, solo donde todavía no hay cuenta.
-- Deliberadamente conservador: lo que no calce queda en null y la UI lo
-- muestra como "Sin asignar" usando `payment_method` como etiqueta de respaldo.
update public.appointments a
set account_id = f.id
from public.financial_accounts f
where a.account_id is null
  and a.payment_method is not null
  and (
    (lower(trim(a.payment_method)) = 'efectivo'      and f.name = 'Efectivo') or
    (lower(trim(a.payment_method)) = 'nequi'         and f.name = 'Nequi')    or
    (lower(trim(a.payment_method)) = 'transferencia' and f.name = 'Transferencia / Banco')
  );

-- ============================================================
-- 6. Backfill de `expenses` → `financial_movements`
-- ============================================================
-- IMPORTANTE: después de esta migración, la tabla `public.expenses` queda
-- MUERTA. Se conserva intacta (regla aditiva del proyecto: ambos proyectos
-- tienen datos reales y nada se borra), pero **ya nadie la lee ni le escribe**.
-- Todo gasto nuevo entra a `financial_movements` con kind='GASTO'.
-- No agregar filas a `expenses` a mano: no aparecerán en Finanzas.

-- 6a. Crear las categorías que existan como texto libre en `expenses` y que no
--     estén ya en `expense_categories` (case-insensitive contra las sembradas).
--
--     El `distinct on (lower(...))` NO es cosmético: `expenses.category` es
--     texto libre, así que "Cursos" y "cursos" son dos filas distintas para un
--     `distinct` normal. Como el unique de `expense_categories.name` (y por
--     tanto el `on conflict (name)`) SÍ distingue mayúsculas, ese par entraría
--     como dos categorías separadas — justo la fragmentación que esta
--     migración viene a arreglar. Se queda una sola variante por nombre
--     normalizado; el `order by` la hace determinista entre corridas.
insert into public.expense_categories (name, nature, display_order)
select v.name, 'VARIABLE', 100
from (
  select distinct on (lower(trim(e.category))) trim(e.category) as name
  from public.expenses e
  where trim(coalesce(e.category, '')) <> ''
  order by lower(trim(e.category)), trim(e.category)
) v
where not exists (
  select 1 from public.expense_categories c
  where lower(c.name) = lower(v.name)
)
on conflict (name) do nothing;

-- 6b. Cada gasto histórico pasa a ser un movimiento kind='GASTO'.
--     `account_id` queda en null: `expenses` nunca supo de qué cuenta salió
--     la plata, e inventarlo descuadraría el saldo por cuenta. Cuenta en la
--     caja global como "Sin asignar", que es la verdad disponible.
--
--     El join a la categoría va por `lateral ... limit 1` y no por un
--     `left join` directo: si una base ya traía dos categorías que solo
--     difieren en mayúsculas (creadas antes de arreglar 6a, o a mano desde el
--     panel), el join case-insensitive calzaría con las dos y multiplicaría
--     las filas de este insert. Con `limit 1` cada gasto produce exactamente
--     una fila, y el `order by` elige siempre la misma categoría.
insert into public.financial_movements
  (movement_date, kind, amount, category_id, description, legacy_expense_id)
select
  e.expense_date,
  'GASTO',
  e.amount,
  c.id,
  e.description,
  e.id
from public.expenses e
left join lateral (
  select ec.id
  from public.expense_categories ec
  where lower(ec.name) = lower(trim(e.category))
  order by ec.created_at, ec.id
  limit 1
) c on true
on conflict (legacy_expense_id) do nothing;

-- ============================================================
-- 7. Funciones de agregación — por qué existen
-- ============================================================
-- PostgREST corta todo `select` en `max_rows` (1000 por defecto en Supabase).
-- Las consultas históricas de Finanzas (caja disponible, ingresos por servicio
-- de todos los tiempos, clientes nuevos vs. recurrentes) traían las filas
-- crudas y las sumaban en TypeScript — patrón heredado del modelo anterior,
-- razonable con pocos datos. El problema es cómo falla: pasado el corte no da
-- error, simplemente **deja de sumar**. La caja disponible quedaría
-- subestimada en silencio, que es la peor forma de fallar para un número de
-- plata.
--
-- Estas tres funciones mueven la agregación a Postgres. Lo que viaja por el
-- cable pasa a ser una fila por cuenta / por servicio / un par de conteos, muy
-- por debajo de cualquier `max_rows`, sin importar cuánto crezca el histórico.
--
-- Son SECURITY INVOKER (el default, explícito acá por claridad): heredan la
-- RLS de quien las llama, igual que la vista `clients_with_stats` de 0013. NO
-- son `security definer`: eso las ejecutaría como su dueño y saltaría la RLS
-- de `appointments`/`financial_movements`. Además se le revoca el EXECUTE a
-- `public`/`anon` — son datos financieros.
--
-- OJO - REGLA DUPLICADA CON TYPESCRIPT. Los signos de
-- `financial_movements.kind` que usa 7a son una COPIA de MOVEMENT_KIND_SIGN de
-- lib/finance/types.ts: INGRESO_OTRO y APORTE suman, GASTO y RETIRO restan.
-- Postgres no puede importar un `Record` de TypeScript, así que las dos copias
-- se mantienen a mano: si se cambia un signo o se agrega un `kind` nuevo hay
-- que tocar LOS DOS LADOS y correr la migración en los DOS proyectos de
-- Supabase (dev y producción). Una sola de las dos actualizada = la caja
-- disponible y la utilidad dejan de cuadrar, en silencio.

-- ------------------------------------------------------------
-- 7a. Flujo de caja acumulado, agrupado por cuenta.
--     Devuelve una fila por `account_id` (incluida una con NULL para lo que
--     no tiene cuenta asignada). El `opening_balance` NO se suma acá: lo
--     agrega TypeScript, que ya distingue cuentas activas de inactivas.
-- ------------------------------------------------------------
drop function if exists public.finance_cash_flow_by_account();
create function public.finance_cash_flow_by_account()
returns table (account_id uuid, net_flow bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.account_id, sum(t.amount)::bigint
  from (
    -- Ingreso por servicio: vive solo en `appointments`, nunca se duplica
    -- en `financial_movements`.
    select a.account_id, coalesce(a.charged_amount, 0)::bigint as amount
    from public.appointments a
    where a.status = 'COMPLETADA'
    union all
    -- COPIA de MOVEMENT_KIND_SIGN (lib/finance/types.ts). Si cambia allá,
    -- cambia acá: ver la advertencia del encabezado de la sección 7.
    select m.account_id,
           (case
              when m.kind in ('INGRESO_OTRO', 'APORTE') then m.amount
              else -m.amount
            end)::bigint
    from public.financial_movements m
  ) t
  group by t.account_id;
$$;

revoke all on function public.finance_cash_flow_by_account() from public, anon;
grant execute on function public.finance_cash_flow_by_account() to authenticated;

-- ------------------------------------------------------------
-- 7b. Ingresos por servicio. `p_start`/`p_end` en NULL = histórico completo.
--     Una fila por servicio (el catálogo son decenas de filas, no miles).
-- ------------------------------------------------------------
drop function if exists public.finance_revenue_by_service(timestamptz, timestamptz);
create function public.finance_revenue_by_service(
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns table (
  service_id        uuid,
  service_name      text,
  total             bigint,
  appointment_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.service_id,
    s.name,
    sum(coalesce(a.charged_amount, 0))::bigint,
    count(*)::bigint
  from public.appointments a
  left join public.services s on s.id = a.service_id
  where a.status = 'COMPLETADA'
    and (p_start is null or a.start_time >= p_start)
    and (p_end   is null or a.start_time <  p_end)
  group by a.service_id, s.name;
$$;

revoke all on function public.finance_revenue_by_service(timestamptz, timestamptz) from public, anon;
grant execute on function public.finance_revenue_by_service(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- 7c. Clientes nuevos vs. recurrentes del período.
--     "Nueva" = su primera cita COMPLETADA cae dentro del período. El
--     `not exists` se apoya en el índice parcial `appointments_completed_client_idx`
--     de 0013 (client_id, start_time desc) where status = 'COMPLETADA'.
--     Antes esto traía el historial entero de las clientas del mes y lo
--     cruzaba en JS: 30 clientas de 50 visitas ya pasaban las 1000 filas.
-- ------------------------------------------------------------
drop function if exists public.finance_client_mix(timestamptz, timestamptz);
create function public.finance_client_mix(p_start timestamptz, p_end timestamptz)
returns table (new_clients bigint, returning_clients bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with month_clients as (
    select distinct a.client_id
    from public.appointments a
    where a.status = 'COMPLETADA'
      and a.start_time >= p_start
      and a.start_time <  p_end
  ),
  -- El EXISTS se resuelve acá, en la lista de selección, y no dentro de un
  -- FILTER: así el agregado de abajo solo mira una columna booleana simple.
  flagged as (
    select
      exists (
        select 1
        from public.appointments prev
        where prev.client_id = mc.client_id
          and prev.status = 'COMPLETADA'
          and prev.start_time < p_start
      ) as is_returning
    from month_clients mc
  )
  select
    (count(*) filter (where not f.is_returning))::bigint,
    (count(*) filter (where f.is_returning))::bigint
  from flagged f;
$$;

revoke all on function public.finance_client_mix(timestamptz, timestamptz) from public, anon;
grant execute on function public.finance_client_mix(timestamptz, timestamptz) to authenticated;
