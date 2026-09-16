# Handoff — Finanzas reconstruida + navegación del panel

Log narrativo de la sesión. Como el resto de los `HANDOFF-*.md`, esto es historia: si algo acá contradice a `docs/REFERENCIA-CMS-Y-ADMIN.md`, **manda la referencia**.

## Qué se pidió

Manu no tenía forma de **sacar plata del negocio** sin registrarla como gasto. El módulo de Finanzas anterior (Fase 2, `docs/HANDOFF-fase-2-contabilidad-fidelizacion.md`) era literalmente `ingresos − gastos`: un retiro personal entraba como gasto, bajaba la utilidad y ensuciaba el desglose por categoría. El negocio parecía ganar menos de lo que ganaba, y no había ningún número que dijera cuánta plata existe de verdad.

En paralelo, el panel había llegado a 9 módulos en una barra horizontal (`components/admin/admin-nav.tsx`) que ya no daba el ancho, ni en escritorio ni en celular.

Se atacaron los dos: Finanzas se reconstruyó **de cero sobre un modelo nuevo** (migración `0016`) y la navegación se rehízo completa. Después corrieron dos pasadas de QA que arreglaron 8 bugs de lógica y 19 de UI/accesibilidad.

**Estado: código completo en la rama `preview`. `npx tsc --noEmit` en verde y `pnpm build` compilando. La migración `0016` NO está corrida en ningún proyecto de Supabase — ni dev ni producción.** Nada de esto se probó contra una base real; ver "Verificación" y "Checklist" más abajo.

---

## La postura contable (esto es lo que no hay que re-litigar)

Es la decisión central de la sesión y está escrita tres veces a propósito: en el encabezado de `supabase/migrations/0016_finanzas.sql`, en el de `lib/finance/queries.ts` y acá.

### Tres números distintos, no uno

| Número | Qué es | Entran RETIRO/APORTE |
|---|---|---|
| **Utilidad del negocio** (`netProfit`) | ingresos operativos − gastos operativos, del mes | **No** |
| **Caja disponible** (`getCashPosition().totalCash`) | acumulado histórico: saldos iniciales + todo lo que entró − todo lo que salió | **Sí** |
| **Retirado en el mes** (`withdrawals`) | Σ de los movimientos `RETIRO` del mes | (es eso mismo) |

**Un retiro no es un gasto: es utilidad ya ganada que cambia de bolsillo.** Sacar plata no hace que el negocio haya ganado menos. Por eso `RETIRO`/`APORTE` mueven la caja y no tocan el P&L, y por eso el gráfico diario (`getDailyCashFlow`) los excluye: si entraran, un retiro se vería como un día de gastos gigante, que es exactamente la confusión que este módulo vino a eliminar.

### Dónde vive cada peso (y por qué no hay doble conteo)

- **El ingreso por servicio vive solo en `appointments`.** Se reconoce en la fecha de la cita (`start_time`, hora Bogotá) por `charged_amount`, sobre citas `COMPLETADA`. No se reescribió el histórico y no se copió a ningún lado.
- **`financial_movements` guarda todo lo demás**: gastos, ingresos que no salen de una cita, retiros y aportes.
- Ninguna consulta mezcla las dos fuentes para el mismo concepto, así que no hay doble conteo. `getMonthlyTotals` suma `appointments` para `serviceRevenue` y `financial_movements` para el resto; `getCashPosition` suma las dos, pero cada una aporta conceptos distintos.

### Los anticipos no se suman como ingreso

`appointments.deposit_received_amount` **no** entra a los ingresos ni se prorratea. El anticipo es un adelanto del mismo `charged_amount` que se registrará al cerrar la cita: sumarlo aparte contaría el mismo peso dos veces, primero al recibirlo y otra vez dentro del cobro final.

Pero tampoco puede quedar invisible —es plata que ya entró—, así que se expone como KPI propio: **"Anticipos retenidos"** (`getHeldDeposits`), sobre las citas en `SOLICITADA`/`ESPERANDO_ANTICIPO`/`CONFIRMADA`. Al pasar a `COMPLETADA` el anticipo se absorbe en el cobro; al pasar a `CANCELADA`/`NO_ASISTIO`/`EXPIRADA` deja de ser un pasivo vivo (qué se hace con esa plata es una decisión comercial, no contable).

### La tabla `expenses` quedó MUERTA

La migración `0016` copia todas sus filas a `financial_movements` con `kind='GASTO'` y `legacy_expense_id` (unique → el backfill es idempotente). La tabla **se conserva intacta** por la regla aditiva del proyecto (los dos proyectos de Supabase tienen datos reales), pero **nadie la lee ni le escribe**.

**No volver a insertar ahí: esas filas no aparecerían en Finanzas.** Las Server Actions `createExpense`/`updateExpense`/`deleteExpense` se **eliminaron** junto con su UI (`expenses-table.tsx`, `expense-form-dialog.tsx`) — un export de un archivo `'use server'` es un endpoint público, y no tiene sentido mantener tres que nadie llama. `Expense` sigue en `lib/supabase/types.ts` marcado `@deprecated`.

### Los gastos fijos no se registran solos

`recurring_expenses` son **plantillas**, no automatización. No hay cron que las materialice, a propósito: un gasto fijo puede cambiar de monto o no pagarse ese mes, y un movimiento inventado descuadraría utilidad y caja **en silencio**, que es peor que no tener el dato.

La UI las ofrece: `getPendingRecurringExpenses(month)` devuelve las plantillas activas sin movimiento en ese mes, `PendingRecurringNotice` las muestra como aviso en la pestaña Movimientos y `registerRecurringExpense(templateId, month)` las materializa con un clic.

Dos reglas finas que ya están implementadas y conviene no "arreglar":
- **Un mes futuro nunca tiene pendientes** (`if (month > currentMonth()) return []`): navegar a noviembre en septiembre no debe ofrecer registrar el arriendo de noviembre.
- **Dentro del mes en curso se ofrecen todas**, aunque su `day_of_month` no haya llegado. Un fijo se puede pagar antes, y esconderlo obligaría a registrarlo a mano — sin quedar vinculado a la plantilla, volvería a aparecer como pendiente y se pagaría dos veces.

---

## El modelo nuevo — migración `0016_finanzas.sql`

Cuatro tablas + una columna. Todas con RLS `admin_full_access` (`for all to authenticated`) y **sin** política de lectura pública: son datos financieros, no contenido de marketing. Nunca agregarles `public_read_active`.

| Tabla | Para qué | Decisiones |
|---|---|---|
| `financial_accounts` | Dónde vive la plata (Efectivo, Nequi, Transferencia/Banco — sembradas) | `opening_balance` para que la caja no arranque en cero ignorando la plata previa. `unique (name)`: hace idempotente el seed y habilita el backfill por nombre. Se desactivan, no se borran |
| `expense_categories` | Categorías gestionadas (reemplazan el texto libre de `expenses.category`) | `nature` FIJO/VARIABLE, para leer cuánto del mes ya estaba comprometido sin pedirle a Manu que lo clasifique cada vez. `name` unique |
| `financial_movements` | **El libro**: todo lo que no es ingreso por cita | Una tabla con discriminador `kind` y no una por concepto: son la misma forma y el mismo listado; separarlas obligaría a un UNION en cada consulta de caja |
| `recurring_expenses` | Plantillas de gasto fijo | `day_of_month` 1-28 para que la plantilla exista en todos los meses, febrero incluido |
| `appointments.account_id` | A qué cuenta entró el ingreso de la cita | FK nueva, `on delete set null`, con backfill por coincidencia de nombre contra `payment_method` |

Detalles del schema que tienen motivo:

- **`financial_movements.movement_date` es `date`, no `timestamptz`.** Un gasto no tiene hora relevante, y así se compara como string `'YYYY-MM-DD'` sin conversión de zona (igual que hacía `expenses.expense_date`).
- **`account_id` es `on delete restrict`** en `financial_movements`: borrar una cuenta con movimientos dejaría la caja descuadrada sin que nada lo explique.
- **`category_id` no lleva `check` de que solo exista en `kind='GASTO'`** — las Server Actions lo limpian, pero forzarlo en la base bloquearía correcciones.
- **`legacy_expense_id` unique** es la idempotencia del backfill.
- **§6a usa `distinct on (lower(trim(category)))`**: `expenses.category` es texto libre, así que "Cursos" y "cursos" son dos filas para un `distinct` normal, y como el unique de `expense_categories.name` **sí** distingue mayúsculas entrarían como dos categorías — justo la fragmentación que la migración viene a arreglar.
- **§6b usa `left join lateral … limit 1`** y no un `left join` directo: si una base ya traía dos categorías que difieren solo en mayúsculas, un join case-insensitive calzaría con las dos y multiplicaría las filas del insert.
- **El backfill de `appointments.account_id` es deliberadamente conservador**: solo calza `efectivo`/`nequi`/`transferencia` exactos. Lo que no calce queda en `null` y la UI lo muestra como "Sin asignar" usando `payment_method` de etiqueta de respaldo.
- **`payment_method` se conserva y se sigue escribiendo** con el nombre de la cuenta elegida. Es lo que muestra el historial de citas ya existente; dejar de escribirlo vaciaría esa columna en las citas nuevas. `account_id` es el dato agregable, `payment_method` la etiqueta legible.

---

## La capa de consultas — `lib/finance/`

Toda la agregación de Finanzas estaba antes suelta dentro de `app/admin/(dashboard)/finanzas/page.tsx`. Ahora **`lib/finance/queries.ts` es el contrato con la UI**: la página no vuelve a hacer cuentas a mano.

- **`month.ts`** — helpers de `'YYYY-MM'` puros, sin Supabase (los usan Server Components y componentes cliente). Todo se calcula con getters **UTC** sobre `Date.UTC(...)`: el proceso de Vercel corre en UTC y los getters locales darían otro mes. El mes actual sale de `todayInBogota()`.
- **Las dos escalas de tiempo** son el error sutil de este módulo y por eso hay dos helpers: `monthRange()` devuelve `'YYYY-MM-DD'` para `financial_movements` (un `date` simple) y `monthUtcRange()` devuelve instantes UTC para `appointments.start_time` (un `timestamptz`, convertido desde hora de pared de Bogotá con `bogotaWallTimeToUtc`). Comparar un `timestamptz` contra `'YYYY-MM-01'` mete las 5 primeras horas del día 1 en el mes anterior.
- **`types.ts`** re-exporta las filas de tabla desde `lib/supabase/types.ts` (la convención del proyecto: un solo archivo con el modelo de datos) y define los tipos **agregados**, que es lo que nace acá.

Funciones exportadas: `listFinancialAccounts`, `listExpenseCategories`, `listRecurringExpenses`, `getMonthlyFinancialSummary`, `getPreviousMonthComparison`, `getCashPosition`, `getHeldDeposits`, `getRevenueByService`, `getExpensesByCategory`, `getIncomeByAccount`, `getDailyCashFlow`, `listMovements`, `getMonthlyMovementsForCsv`, `getPendingRecurringExpenses`.

Cosas que ya se resolvieron acá y no hay que re-descubrir:

- **Nuevos vs. recurrentes se pregunta al revés**: se piden las citas *anteriores* al mes de los clientes del mes, no el historial completo ordenado. Dos razones: (1) el corte lo hace Postgres sobre `timestamptz` en vez de JavaScript sobre strings — `startIso` sale de `toISOString()` (`…T05:00:00.000Z`) y `start_time` llega de PostgREST como `…T05:00:00+00:00`, y el orden lexicográfico entre `'.'` y `'+'` da al revés, así que una primera cita a las 00:00 del día 1 contaba como recurrente; (2) trae muchísimas menos filas.
- **El `opening_balance` de una cuenta desactivada sigue contando** en la caja total, dentro de `unassignedBalance`. Si no, desactivar una cuenta con $500.000 bajaría la caja en $500.000 sin explicación. Invariante que siempre se cumple: `totalCash === Σ byAccount.balance + unassignedBalance`.
- **`getIncomeByAccount` usa `|| 'Sin asignar'` y no `??`**: un `payment_method` de cadena vacía no es `null`, y con `??` se colaba como una fila sin nombre.
- **`listMovements` reintenta con la última página real** si la pedida quedó más allá del final (p. ej. se borró el último movimiento estando en la última página), en vez de devolver una tabla vacía.
- **El CSV incluye también los ingresos por servicio** (una fila por cita completada), no solo el libro: un export que solo trajera `financial_movements` no cuadraría con ningún KPI de la pantalla, porque el grueso del ingreso vive en `appointments`.

---

## Server Actions nuevas

Todas en el bloque de Finanzas de `app/admin/(dashboard)/actions.ts`, con el patrón de siempre (`requireUser()`, `{ ok }`), revalidando `/admin/finanzas`:

`createFinancialMovement`, `updateFinancialMovement`, `deleteFinancialMovement`, `createFinancialAccount`, `updateFinancialAccount`, `setFinancialAccountActive`, `reorderFinancialAccounts`, `createExpenseCategory`, `updateExpenseCategory`, `setExpenseCategoryActive`, `reorderExpenseCategories`, `createRecurringExpense`, `updateRecurringExpense`, `setRecurringExpenseActive`, `deleteRecurringExpense`, `registerRecurringExpense`.

Notas de diseño:

- **Cuentas y categorías no tienen borrado duro**; los gastos recurrentes **sí**. Una plantilla es una conveniencia, no un dato contable, y sus movimientos sobreviven (`recurring_template_id` es `on delete set null`), así que borrarla no altera ninguna cifra.
- **`normalizeAmount`** redondea a entero: los montos son pesos colombianos, no hay centavos.
- **`isValidDateStr`** valida con getters UTC sobre `Date.UTC` (atrapa cosas como `'2026-02-31'`).
- **`buildMovementRow` descarta `category_id` en silencio** si el `kind` no es `GASTO`: una categoría de gasto en un retiro no significa nada y ensuciaría el desglose.
- **`registerRecurringExpense` chequea duplicados en consulta, no con un índice único**: el mismo fijo podría legítimamente pagarse dos veces en un mes por un ajuste. Alcanza para un panel de un solo usuario.
- **`completeAppointment` y `updateAppointmentCharge`** ahora reciben `accountId` y pasan por `resolveChargeAccount`, que escribe `account_id` **y** `payment_method` (el nombre de la cuenta). Si no se manda `accountId`, conservan el `payment_method` que ya estaba: corregir el monto de una cita vieja cuyo método era "Daviplata" no debe borrar ese texto.

---

## La página `/admin/finanzas` — 4 pestañas

Todo el estado vive en la URL (`?month=&tab=&tipo=&categoria=&cuenta=&page=`), como el resto del panel. Los filtros de id se validan contra un regex de UUID antes de viajar a PostgREST.

| Pestaña | Qué tiene |
|---|---|
| **Resumen** (default) | Tres bloques separados a propósito: *Resultado del mes* (ingresos, gastos operativos, utilidad, margen, con delta vs. mes anterior), *Caja* (caja disponible, retirado, aportes, anticipos retenidos), *Operación* (hoy, ticket promedio, no-show, nuevos/recurrentes). Más el gráfico diario, los desgloses por servicio y por categoría, "De dónde entró la plata" y el botón de exportar CSV |
| **Movimientos** | El libro paginado (20/página) + filtros por tipo/categoría/cuenta + el aviso de gastos fijos pendientes + alta/edición/borrado |
| **Gastos fijos** | Las plantillas recurrentes |
| **Cuentas** | Cuentas con su saldo (y la caja total) + categorías de gasto. Las dos listas son arrastrables |

Que "Resultado del mes" y "Caja" sean dos secciones visualmente separadas, cada una con su bajada, **es parte de la solución**, no decoración: el problema original era que Manu leía un solo número y no sabía si era lo ganado o lo que tiene.

`FinanceStatCard` tiene `higherIsBetter` porque el color del delta no puede salir del signo (que suban los ingresos es verde; que suban los gastos, rojo), y escribe "sin base" cuando el mes anterior fue cero en vez de inventar un ∞.

`InfoTooltip` es controlado por `onClick` y no por hover: Finanzas se usa mucho desde el celular, donde el hover no existe. El `preventDefault()` del clic tampoco es decorativo — `TooltipTrigger` compone su propio `onClick` (que cierra) después del nuestro y solo lo omite si el evento quedó `defaultPrevented`; sin eso, abrir y cerrar pasaban en el mismo tick y en móvil no se abría nunca.

El CSV se arma a mano (sin librería): separador `;`, BOM UTF-8 (sin él Excel en español destroza tildes y ñ), monto crudo sin separador de miles para que se lea como número, y `csvText()` que escapa comillas/saltos de línea **y** neutraliza el arranque con `= + - @` anteponiendo un apóstrofo, para que Excel no interprete la celda como fórmula.

---

## Navegación del panel

`components/admin/admin-nav.tsx` (barra horizontal) **se borró**. En su lugar:

- **`admin-nav-links.ts`** — fuente única del menú. Los 9 módulos agrupados por *para qué se usan*, no por cuándo se construyeron: **Operación** (Bandeja, Agenda, Nueva cita, Horarios), **Negocio** (Finanzas, Clientes, Servicios), **Sitio** (Contenido, Notificaciones). También exporta `isAdminLinkActive` (`/admin` matchea exacto porque es prefijo de todo lo demás; el resto por prefijo, para que `/admin/clientes/[id]` deje su módulo marcado) y `adminSectionTitle`.
- **`admin-sidebar.tsx`** — sidebar colapsable, solo `lg:` para arriba. Colapsado, cada item queda reducido a su ícono, con tooltip.
- **`admin-mobile-nav.tsx`** — barra inferior fija por debajo de `lg:`, con los 4 módulos del día a día (Bandeja, Agenda, Nueva cita, Finanzas) + "Más", que abre una hoja con el resto agrupado igual. La hoja usa el primitivo de Radix, así que el trap de foco, el Escape y el bloqueo de scroll vienen de fábrica.
- **`admin-mobile-header.tsx`** — barra compacta arriba: marca + nombre de la sección actual.

### Por qué el chrome es `fixed` y no `sticky`

Los tres elementos de navegación son `position: fixed`, y la columna de contenido reserva su espacio con padding. **No es un capricho**: la columna lleva `overflow-x-hidden` (resguardo para que un widget más ancho que la pantalla no arrastre toda la página a scroll horizontal en móvil), y `overflow-x-hidden` convierte a ese contenedor en contenedor de scroll, lo que **rompe cualquier `position: sticky` adentro**. Es exactamente el tipo de decisión que alguien deshace por no saber el porqué; está comentada en el layout y en los tres componentes.

### Por qué el colapsado no vive en estado de React

El estado colapsado se persiste en `localStorage` (`manuj-admin-sidebar`) y lo aplica un **`<script>` inline que corre antes del primer pintado** (`admin-sidebar-script.tsx`), seteando `data-admin-sidebar` en el `<html>`. El ancho sale de la variable CSS `--admin-sidebar-w` (`app/globals.css`), y lo que se oculta al colapsar también se resuelve por CSS.

El motivo: el HTML del servidor no puede saber qué hay en `localStorage`. Si el ancho dependiera del estado de React, un panel guardado como colapsado se pintaría ancho y **saltaría al hidratar**. Con el atributo, el HTML de servidor y el de cliente son idénticos (cero mismatch) y el ancho ya está bien desde el primer frame. Es el mismo truco de `next-themes`.

Va como `<script>` literal y no con `next/script`: `next/script`, incluso con `beforeInteractive`, no garantiza correr antes de que el navegador pinte este subárbol; un `<script>` en el stream del HTML sí, porque bloquea el parser donde está. Todo dentro de `try/catch` — `localStorage` lanza en modo privado con cookies bloqueadas.

El estado de React del sidebar **no pinta nada**: solo decide si hace falta tooltip y qué dice el `aria-label` del botón, cosas que únicamente importan después de hidratar. Se sincroniza desde el DOM (`readSidebarState()`), no desde `localStorage`, porque el script inline ya resolvió cuál es el valor bueno.

También se agregó un enlace "Saltar al contenido" en el layout: con el sidebar hay ~13 paradas de teclado antes del contenido en cada página.

---

## Archivos

### Nuevos

```
supabase/migrations/0016_finanzas.sql

lib/finance/types.ts
lib/finance/month.ts
lib/finance/queries.ts
lib/admin/sidebar-preference.ts

components/ui/sheet.tsx                      # Radix dialog reposicionado; sin dependencias nuevas
components/ui/tooltip.tsx

components/admin/admin-nav-links.ts          # fuente única del menú
components/admin/admin-sidebar.tsx
components/admin/admin-sidebar-script.tsx
components/admin/admin-mobile-nav.tsx
components/admin/admin-mobile-header.tsx

components/admin/finance-stat-card.tsx
components/admin/daily-cash-flow-chart.tsx   # reemplaza revenue-chart.tsx
components/admin/category-breakdown-card.tsx
components/admin/income-by-account-card.tsx
components/admin/movements-table.tsx
components/admin/movement-form-dialog.tsx
components/admin/movements-filters.tsx
components/admin/export-movements-button.tsx
components/admin/pending-recurring-notice.tsx
components/admin/recurring-expenses-table.tsx
components/admin/recurring-expense-form-dialog.tsx
components/admin/financial-accounts-table.tsx
components/admin/financial-account-form-dialog.tsx
components/admin/expense-categories-table.tsx
components/admin/expense-category-form-dialog.tsx
components/admin/charge-account-select.tsx   # reemplaza el PAYMENT_METHODS hardcodeado
components/admin/confirm-action-dialog.tsx   # "¿seguro?" reusable (≠ confirm-dialog.tsx)
components/admin/info-tooltip.tsx
```

**No se agregó ninguna dependencia a `package.json`.** `@radix-ui/react-dialog` y `@radix-ui/react-tooltip` ya estaban instalados desde el scaffold de v0.dev — mismo patrón que en fases anteriores.

### Borrados

```
components/admin/admin-nav.tsx               # → sidebar + barra inferior
components/admin/expenses-table.tsx          # → movements-table.tsx
components/admin/expense-form-dialog.tsx     # → movement-form-dialog.tsx
components/admin/revenue-chart.tsx           # → daily-cash-flow-chart.tsx
```

### Modificados (los que importan)

- `app/admin/(dashboard)/actions.ts` — bloque de Finanzas nuevo (~15 acciones), `resolveChargeAccount`, `completeAppointment`/`updateAppointmentCharge` con `accountId`; se eliminaron `createExpense`/`updateExpense`/`deleteExpense`.
- `app/admin/(dashboard)/finanzas/page.tsx` — reescrita: 4 pestañas, toda la agregación delegada a `lib/finance/queries.ts`.
- `app/admin/(dashboard)/finanzas/loading.tsx` — esqueleto que calca la forma real (pestañas 2×2 en móvil, para que no salte).
- `app/admin/(dashboard)/layout.tsx` — sidebar + header móvil + barra inferior + skip link + paddings que reservan el chrome `fixed`.
- `app/globals.css` — bloque `--admin-sidebar-w` y las reglas `html[data-admin-sidebar='collapsed']`.
- `lib/supabase/types.ts` — `FinancialAccount`, `ExpenseCategory`, `FinancialMovement`, `RecurringExpense` + sus uniones; `Appointment.account_id`; `Expense` marcado `@deprecated`.
- `app/admin/(dashboard)/agenda/page.tsx`, `components/admin/agenda-calendar.tsx`, `agenda-event-dialog.tsx`, `complete-appointment-dialog.tsx`, `edit-charge-dialog.tsx` — las cuentas activas viajan por props desde el Server Component hasta los diálogos de cobro.
- Pulido de QA en `error.tsx`, `not-found.tsx`, `login/page.tsx`, `admin-footer.tsx`, `empty-state.tsx`, `pagination.tsx`, `service-breakdown-card.tsx`, las 4 tablas arrastrables de contenido y los primitivos `dialog.tsx`/`popover.tsx`/`select.tsx`.

---

## Riesgo latente #1 — resuelto después del QA

### La caja disponible se subestimaba en silencio pasadas ~1000 citas

**Estaba así:** `getCashPosition()`, `getRevenueByService(supabase, null)` y el reparto de
clientes nuevos vs. recurrentes traían **todo el histórico sin paginar** y lo sumaban en
TypeScript. PostgREST corta todo `select` en `max_rows` (1000 por defecto en Supabase), así que
pasadas ~1000 citas completadas la caja disponible iba a quedar **subestimada sin dar error**:
no falla, deja de sumar. Es la peor forma de fallar para un número de plata, porque nadie audita
un total que "se ve bajo".

No era regresión de esta sesión: el patrón venía del modelo anterior (ver
`HANDOFF-fase-2-contabilidad-fidelizacion.md`, donde se eligió a conciencia porque "el volumen de
un negocio unipersonal no lo justifica"). Lo que cambió es que ahora tiene fecha de vencimiento.

**Cómo quedó:** la sección 7 de `0016` agrega tres funciones de agregación y las tres consultas
pasaron a `supabase.rpc()`. Lo que viaja por el cable es una fila por cuenta o por servicio, muy
por debajo de cualquier `max_rows`, sin importar cuánto crezca el histórico.

| Función SQL | Reemplaza a | Devuelve |
|---|---|---|
| `finance_cash_flow_by_account()` | el doble `select` de `getCashPosition` | una fila por cuenta (+1 con `account_id` null) |
| `finance_revenue_by_service(p_start, p_end)` | `getRevenueByService`, mes e histórico | una fila por servicio |
| `finance_client_mix(p_start, p_end)` | el cruce de historial de `getMonthlyFinancialSummary` | una fila: nuevas y recurrentes |

Decisiones que **no** hay que deshacer:

- **`security invoker`, no `security definer`.** Heredan la RLS de quien las llama, igual que la
  vista `clients_with_stats` de 0013. Con `security definer` se ejecutarían como su dueño y
  saltarían la RLS de `appointments`/`financial_movements`. Además llevan `set search_path = ''`
  y todo calificado con `public.`.
- **`EXECUTE` revocado a `public`/`anon`, concedido solo a `authenticated`.** Defensa en dos
  capas: aunque la RLS ya dejaría a `anon` sin filas, la función directamente no se le puede
  llamar.
- **Lanzan `FinanceAggregateError` en vez de devolver ceros.** Un cero silencioso en un número de
  plata es peor que un error visible; el mensaje dice explícitamente que lo más probable es que
  falte correr `0016` en *ese* proyecto de Supabase.
- Los signos de `kind` dentro de `finance_cash_flow_by_account` tienen que seguir coincidiendo con
  `MOVEMENT_KIND_SIGN` de `lib/finance/types.ts` (INGRESO_OTRO y APORTE suman; GASTO y RETIRO
  restan). Son dos copias de la misma regla — ver riesgo #2, que es el mismo problema.

**Verificación (esta sí se ejecutó contra Postgres de verdad):** se levantó un clúster PostgreSQL
14 desechable en local, con stubs de las tablas que `0016` asume de migraciones anteriores, y se
corrió la migración **dos veces seguidas**. Resultados:

- Idempotencia: 5 gastos en `expenses` → 5 filas en `financial_movements` después de la segunda
  corrida, sin duplicar.
- Backfill de categorías: "Cursos" y "cursos" colapsaron en **una** categoría y los dos gastos
  quedaron atados a ella (el arreglo de QA sobre `distinct on (lower(...))` + `lateral limit 1`).
- `finance_cash_flow_by_account()`: signos correctos por cuenta, y los gastos históricos sin
  cuenta cayeron en el balde "sin asignar", como está diseñado.
- **Frontera de mes**: una cita a las 19:00 del 30 de septiembre en Bogotá (1-oct 00:00 UTC) cae
  en septiembre, no en octubre.
- **Borde de cliente nueva**: una clienta cuya primera cita COMPLETADA es exactamente el primer
  instante del mes cuenta como **nueva** — era el bug de comparación de strings ISO que detectó QA.
- Permisos: `anon` recibe `permission denied` en las tres funciones; `authenticated` obtiene los
  resultados correctos; cero políticas RLS mencionan `anon` en las 4 tablas nuevas.

Lo que sigue **sin** verificar contra Postgres es el resto de `queries.ts` (los `select` con
recursos embebidos de PostgREST), porque eso depende de PostgREST y no solo de Postgres.

---

## Riesgos detectados por QA — los cuatro, resueltos

### 1. La regla contable estaba codificada dos veces → derivada de los mapas

`MOVEMENT_KIND_IS_OPERATING` estaba exportado **sin ningún consumidor** mientras `getMonthlyTotals`
decidía por su cuenta qué entra al P&L. Ahora la agregación **deriva** `otherIncome` y
`operatingExpenses` recorriendo `MOVEMENT_KINDS` y filtrando por `MOVEMENT_KIND_IS_OPERATING` y
`MOVEMENT_KIND_SIGN`. El resultado numérico es idéntico (`otherIncome` sigue siendo el único
operativo con signo +1, o sea `INGRESO_OTRO`; `operatingExpenses`, el único con −1, `GASTO`), pero
agregar un `kind` nuevo al enum ya no puede dejar el P&L mal en silencio: el `Record<MovementKind, …>`
no compila hasta clasificarlo.

**Queda una copia que no se puede eliminar**: el `case when … in ('INGRESO_OTRO','APORTE')` dentro
de `finance_cash_flow_by_account()` (migración `0016` §7a). Postgres no puede importar un `Record`
de TypeScript. Está señalizada en los dos lados, y cada comentario nombra al otro: el docblock de
`MOVEMENT_KIND_SIGN` advierte que cambiarlo obliga a tocar la función **y correr la migración en los
dos proyectos**, y el encabezado de la sección 7 arranca con "OJO - REGLA DUPLICADA CON TYPESCRIPT"
y dice la consecuencia concreta de actualizar una sola: la caja y la utilidad dejan de cuadrar, en
silencio.

*Propuesta no implementada*: una función `finance_kind_signs()` que devuelva `(kind, sign)` y una
comprobación en `getCashPosition` que la contraste contra `MOVEMENT_KIND_SIGN` y lance
`FinanceAggregateError` si difieren. Encaja con la postura de "fallar visible antes que devolver un
número mal", pero cuesta una migración nueva y un round-trip extra.

### 2. El reordenamiento por arrastre no era operable por teclado → resuelto en las 6 listas

Toda la lógica quedó en **`lib/admin/use-keyboard-reorder.ts`** (hook) y
**`components/admin/reorder-handle.tsx`** (handle + región `aria-live` + variantes de movimiento),
consumidos por las 6 tablas: hero slides, categorías de servicio, imágenes de galería, secciones del
inicio, cuentas y categorías de gasto. Antes cada tabla repetía su propio `useState` + `useEffect` de
orden optimista.

Contrato de teclado, con el handle enfocado: **↑/↓** mueven la fila un lugar, **Inicio/Fin** la
llevan a los extremos. Detalles que importan:

- **El foco sigue a la fila.** Al reordenar, React mueve el nodo y el navegador suelta el foco; sin
  devolverlo sería imposible mover algo dos posiciones seguidas.
- **Una sola escritura.** Mantener la flecha apretada dispara una pulsación por repetición del
  teclado; si cada una persistiera, mover algo 5 lugares serían 5 `update` de la lista entera. Se
  guarda con debounce de 700 ms, y se fuerza el envío al perder el foco, al soltar el arrastre y al
  desmontar (perder un reordenamiento por navegar sería peor que una escritura de más).
- **Anuncio por `aria-live="polite"`**, uno por lista: "Limpieza facial movido a la posición 3 de 7".
- **Reversión en caso de error**: se guarda el último orden confirmado por el servidor y se restaura
  si el `reorder*` falla.
- Las filas **marcador** de `site_sections` (`kind !== 'editorial'`) llevan handle igual que las
  editoriales: no se pueden crear ni eliminar, pero sí reordenar.

De paso se corrigió un bug latente que tenían las listas: `onDragEnd={() => persistOrder(items)}`
capturaba el array del closure de render, mientras que el hook usa una `ref` con el orden vigente.

### 3. El gráfico no tenía alternativa textual → tabla `sr-only`

`daily-cash-flow-chart.tsx` pasó a `<figure>` con `<figcaption className='sr-only'>`; el SVG y la
leyenda quedaron bajo `aria-hidden` (no se anuncian dos veces), y debajo hay una `<table>` `sr-only`
con día, ingresos y gastos, más un `<tfoot>` con los totales del mes. Cero cambios visuales.

**Los días sin movimiento se omiten de la tabla.** La serie llega completa porque el gráfico la
necesita así (para que el eje X no tenga huecos), pero escuchar "Día 3, cero pesos, cero pesos"
veinte veces entierra las pocas filas que informan algo. La paridad se conserva por otra vía: el
`<caption>` dice que solo se listan los días con movimiento y que los demás quedaron en cero — así
la ausencia de una fila es información, no un dato faltante — y el `<tfoot>` da los totales
calculados sobre la serie completa.

### 4. Colores de marca duplicados como hex en la agenda → movidos a CSS

Lo que bloqueaba el arreglo era que FullCalendar recibe colores **resueltos** por prop
(`backgroundColor`), no clases, y resolverlos en un `useEffect` con `getComputedStyle` implicaba
pintar el calendario con los colores viejos y re-pintarlo: un parpadeo en **cada** carga.

La salida fue no resolver nada en JavaScript. Los eventos pasaron de `backgroundColor`/`borderColor`
a `classNames`, y cada clase, en `agenda-calendar.css`, **redefine las variables que FullCalendar ya
usa internamente** sobre el propio elemento del evento:

```css
.agenda-fc .agenda-evento-confirmada {
  --fc-event-bg-color: theme('colors.brand.teal');
}
```

Como el `theme()` de Tailwind compila eso a `hsl(var(--brand-teal))`, el `<style>` que inyecta
`app/layout.tsx` desde `site_settings` repinta la agenda solo. Sin `useEffect`, sin estado nuevo, sin
render extra: el primer pintado ya sale correcto porque lo resuelve el motor de CSS. Redefinir las
variables (en vez de escribir `background-color`) cubre de un golpe el bloque de Semana/Día y el
puntito de la vista Mes, que las heredan.

Los otros tres colores (ámbar de SOLICITADA, esmeralda de COMPLETADA, gris de los bloqueos) también
pasaron a clases, con un comentario aclarando que son **semánticos** y deliberadamente no siguen al
theming. No quedan hex de marca en el TSX.

Detalle encontrado al verificar: el `'#739DAA'` que estaba hardcodeado era **1/255 distinto** del
token real (`#749DAA`), por el redondeo a enteros de `globals.css`. O sea que la agenda venía
pintando un teal levemente distinto al del resto del panel; ahora coinciden.

**Nada de la lógica de zona horaria se tocó**: `toFakeUtcIso`, `timeZone='UTC'` y la función `now`
en escala de UTC falso siguen idénticos.

---

## Verificación hecha en esta sesión

Exactamente esto, ni más:

- `npx tsc --noEmit` → **exit 0, sin salida**.
- `pnpm build` → compila, **16/16 páginas**.
- `pnpm lint` → **no se pudo correr**. No hay `.eslintrc` en el repo y `next lint` arranca un asistente interactivo de configuración. El script sigue en `package.json` pero no sirve; el chequeo real de este proyecto es `npx tsc --noEmit` (recordar que `next.config.mjs` ignora errores de TS y ESLint durante el build, así que un `pnpm build` verde **no prueba nada de tipos**).
- **No se probó nada contra las bases reales.** La migración `0016` no está corrida ni en dev ni
  en producción, así que el QA de la aplicación fue estático: lectura de código y razonamiento.
- **La migración sí se ejecutó**, pero contra un PostgreSQL 14 desechable levantado en local con
  stubs de las tablas de migraciones anteriores (ver "Riesgo latente #1 — resuelto"). Eso valida
  sintaxis, idempotencia, el backfill y las tres funciones de agregación con sus casos borde. **No**
  valida nada que dependa de PostgREST ni de la configuración real de Supabase (default privileges,
  `max_rows`, resolución de recursos embebidos).
- **No hubo verificación visual en navegador de las páginas autenticadas.** El gate de auth no se tocó a propósito (es el único control de acceso del panel), así que el responsive se validó por análisis de código y medición aritmética de anchos, no inspeccionando el DOM.

---

## Checklist de lo que falta probar cuando se corra `0016`

Correr la migración es el primer paso de todo lo demás.

1. **Correrla en los DOS proyectos**: dev (`rtmuaeonmqadbezygfrv`) **y** producción (`rlpwmheokkrttxyfusyp`). Recordar el precedente de `0013`, que se corrió solo en dev y produjo en producción un error que parecía un bug de código.
2. **Correrla dos veces seguidas en dev.** La idempotencia y el backfill de §6a/§6b ya se
   verificaron contra un Postgres 14 local (sin duplicar filas y colapsando las categorías que
   solo diferían en capitalización), pero contra la base real y con los datos reales conviene
   repetirlo: es barato y es lo único que prueba el caso concreto de este proyecto.
3. `select count(*) from expenses` debe dar **el mismo número** que `select count(*) from financial_movements where legacy_expense_id is not null`.
4. `select lower(name), count(*) from expense_categories group by 1 having count(*) > 1` debe devolver **0 filas** (si devuelve algo, §6a duplicó categorías por mayúsculas).
5. En `/admin/finanzas?tab=cuentas`: que **"Caja disponible" == Σ saldos por cuenta + "Sin asignar"**, y que **desactivar una cuenta con saldo inicial NO cambie la caja total** (solo debe mover esa plata al balde de "sin asignar").
6. **Frontera de mes**: una cita `COMPLETADA` a las **19:00 del último día de un mes** debe caer en **ese** mes, no en el siguiente (19:00 Bogotá = 00:00 UTC del día siguiente; es el caso que rompe si alguien confunde las dos escalas de `lib/finance/month.ts`).
7. **Corregir el monto de una cita anterior a `0016`** cuyo `payment_method` no calzó con ninguna cuenta (p. ej. "Daviplata") **no debe borrar ese texto**.
8. **El CSV abierto en Excel en español**: verificar tildes y ñ (BOM), que las columnas queden separadas (`;`), y probar con una descripción que tenga **comillas y punto y coma** adentro.
9. Ya con datos reales: registrar un retiro y confirmar que **baja la caja y no la utilidad**; registrar un gasto fijo desde el aviso de pendientes y confirmar que deja de aparecer; completar una cita eligiendo cuenta y ver que suma al saldo de esa cuenta en la pestaña Cuentas.

## Pendientes más allá del checklist

- Los cinco riesgos latentes de arriba, en especial el **#1 (paginación de la caja)**, que es el único con consecuencias sobre números que Manu va a mirar.
- El límite conocido de **una cita = un servicio** sigue igual (ver `REFERENCIA-CMS-Y-ADMIN.md`): el desglose por servicio solo cuenta uno aunque el monto absorba dos.
- Merge de `preview` a `main` cuando esté validado contra la base.
