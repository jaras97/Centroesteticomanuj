# Handoff — Fase 1.6 (cumpleaños, agenda con FullCalendar, CRUD de servicios, pulido visual)

Continuación de [docs/HANDOFF-fase-1.5.md](HANDOFF-fase-1.5.md) (Fase 1.5). Pega este archivo (o pide que lo lean, junto con el de Fase 1.5) al iniciar una conversación nueva sobre este tema.

## Qué es esto

Tras probar el sistema de agendamiento de la Fase 1.5 con Manu y su hermana, surgieron 4 mejoras al panel admin que se implementaron en esta sesión. El plan técnico completo quedó guardado en `/Users/mateojaramillo/.claude/plans/federated-tumbling-mist.md`.

**Estado actual: código completo y verificado de punta a punta.** `tsc --noEmit` sin errores nuevos, `pnpm build` compila las 11 rutas sin errores, y se hizo una verificación visual completa contra el Supabase de dev real (login con credenciales reales vía Playwright headless): Bandeja, Servicios y Agenda probadas con screenshots y sin errores de consola, incluyendo interacciones (clic en cita → diálogo con reagendar, toggle Semana/Día, editar servicio, bloquear horario). **No se requirió ninguna migración de base de datos nueva** — todas las columnas usadas ya existían desde `0001`/`0002`.

## Los 4 problemas y su solución

### 1. Cumpleaños próximos en Bandeja

**Problema**: solo existía un contador de "cumpleaños esta semana"; no había forma de ver *quién* cumple y *cuándo*, ordenado por proximidad.

**Solución**: tarjeta lateral "Próximos cumpleaños" junto a la lista de solicitudes en la Bandeja (grid `lg:grid-cols-[2fr_1fr]`), mostrando siempre los 6 cumpleaños más próximos, ordenados por días restantes, cada uno con nombre (enlaza a la ficha del cliente), fecha en formato "15 de marzo" e insignia relativa ("¡Hoy! 🎉" / "Mañana" / "En N días").

- `lib/booking/birthdays.ts` — nuevos helpers `formatBirthdayDate`, `birthdayRelativeLabel`.
- `components/admin/upcoming-birthdays.tsx` (nuevo).
- `app/admin/(dashboard)/page.tsx` — query de clientes ampliada (`id, name, birthday`), cálculo y orden en JS, layout de 2 columnas.

### 2. Agenda visual con FullCalendar

**Problema**: la Agenda era una grilla CSS simple (columnas apilando "chips" sin eje de horas) — se desbordaba y se veía poco profesional con varias citas el mismo día.

**Solución**: reemplazo completo por **FullCalendar** (vista semana/día tipo Google Calendar), decisión tomada con el usuario tras mostrarle el trade-off frente a construir una grilla a medida. Incluye: eje de horas, citas coloreadas por estado, indicador de "ahora", control de densidad/zoom de 3 pasos (botones +/-, ajusta alto de fila y ancho de columna a la vez), toggle Semana/Día. Clic en una cita abre un diálogo con las mismas acciones de antes (Reagendar, Completada, No asistió); clic en un bloqueo permite eliminarlo — se reemplazaron los botones embebidos en cada chip pequeño porque no escalaban visualmente.

- Paquetes instalados, **con versión fijada a propósito**: `@fullcalendar/core@6.1.21`, `@fullcalendar/react@6.1.21`, `@fullcalendar/timegrid@6.1.21`, `@fullcalendar/interaction@6.1.21`. La última versión publicada de `core`/`react` es la `7.0.2`, pero `timegrid`/`interaction` todavía no tienen release estable en la línea 7 (solo release candidates) y exigen `@fullcalendar/core: ~6.1.21` — instalar sin fijar versión rompería la combinación.
- `components/admin/agenda-calendar.tsx` (nuevo, reemplaza a `agenda-week-view.tsx`, **eliminado**).
- `components/admin/agenda-event-dialog.tsx` (nuevo) — diálogo de detalle de cita/bloqueo.
- `components/admin/agenda-calendar.css` (nuevo) — overrides de variables CSS de FullCalendar para que combine con la marca (teal/ink), más las reglas de densidad.
- `app/admin/(dashboard)/agenda/page.tsx` — mismo fetch server-side de siempre (una semana vía `?week=`), solo cambia el componente cliente que renderiza los datos.
- **Nota técnica de timezone**: se reutiliza el truco ya usado en toda la app (`toBogotaWallClock` disfraza la hora de Bogotá de "UTC"). FullCalendar recibe `timeZone='UTC'` con timestamps ya desplazados; la hora real en UTC vive en `extendedProps` para las acciones de servidor (reagendar necesita el instante real).

### 3. CRUD de servicios

**Problema**: la tabla `services` solo se podía editar desde Supabase Studio.

**Solución**: nueva sección `/admin/servicios` (agregada al nav) para crear, editar y activar/desactivar servicios (sin borrado duro — así se pidió explícitamente). Se conecta a la misma tabla que ya leen `/reservar` y `/admin/reservar` (filtrando `active=true`), así que un servicio desactivado desaparece de ambos flujos de reserva de inmediato.

- `app/admin/(dashboard)/servicios/page.tsx` (nuevo).
- `components/admin/services-table.tsx` (nuevo) — tabla con Estado (Activo/Inactivo) y acciones Editar/Desactivar.
- `components/admin/service-form-dialog.tsx` (nuevo) — un solo diálogo reutilizado para crear y editar.
- `lib/format.ts` (nuevo) — `formatCOP` centralizado; también se usa ahora desde `solicitud-card.tsx` (antes tenía su propio `Intl.NumberFormat` inline).
- Acciones nuevas en `actions.ts`: `createService`, `updateService`, `setServiceActive`.
- `components/admin/admin-nav.tsx` — link "Servicios" nuevo.

### 4. Pulido visual (alcance moderado, no rediseño)

- `components/ui/card.tsx` — sombra al hacer hover.
- `components/ui/table.tsx` — encabezado `sticky`, hover de fila más visible (antes casi invisible).
- `components/admin/empty-state.tsx` (nuevo) — estados vacíos con ícono en vez de solo texto; adoptado en Bandeja, tabla de clientes y tabla de servicios.
- `components/admin/admin-nav.tsx` — cada link del nav ahora tiene un ícono (`lucide-react`).
- Cada `<h1>` de página admin (Bandeja, Agenda, Horarios, Nueva cita, Servicios, Clientes) prefijado con el mismo ícono que su link de nav, para continuidad visual.
- `SummaryCard` de la Bandeja — ícono por métrica (Inbox, CalendarCheck, Cake).

## Archivos nuevos

```
lib/format.ts

components/admin/empty-state.tsx
components/admin/upcoming-birthdays.tsx
components/admin/services-table.tsx
components/admin/service-form-dialog.tsx
components/admin/agenda-calendar.tsx        # reemplaza a agenda-week-view.tsx (eliminado)
components/admin/agenda-event-dialog.tsx
components/admin/agenda-calendar.css

app/admin/(dashboard)/servicios/page.tsx
```

## Archivos modificados

- `lib/booking/birthdays.ts` — `formatBirthdayDate`, `birthdayRelativeLabel`.
- `app/admin/(dashboard)/actions.ts` — `createService`, `updateService`, `setServiceActive`.
- `app/admin/(dashboard)/page.tsx` — widget de cumpleaños, íconos en heading/SummaryCard, layout de 2 columnas.
- `app/admin/(dashboard)/agenda/page.tsx` — usa `AgendaCalendar` en vez de `AgendaWeekView`; ícono en heading.
- `app/admin/(dashboard)/{horarios,reservar,clientes}/page.tsx` — ícono en heading.
- `components/admin/admin-nav.tsx` — link "Servicios", íconos por link.
- `components/admin/clients-table.tsx` — usa `EmptyState`.
- `components/admin/solicitud-card.tsx` — usa `formatCOP` de `lib/format.ts` en vez de `Intl.NumberFormat` inline.
- `components/ui/card.tsx`, `components/ui/table.tsx` — pulido visual (ver punto 4).
- `package.json` / `pnpm-lock.yaml` — 4 paquetes nuevos de FullCalendar (ver punto 2).

## Estado de entornos

- **Dev**: código completo y verificado contra Supabase de dev real — todo funcionando (ver "Verificación" abajo). No se necesitó ninguna migración nueva.
- **Producción**: sigue sin crear (ver Fase 1) — no aplica hasta que se decida lanzar. Cuando se cree, no hay cambios de schema pendientes de esta fase (a diferencia de la Fase 1.5, que sí dejó una migración pendiente).

## Verificación hecha en esta sesión

- `tsc --noEmit`: sin errores nuevos (el único error reportado sigue siendo el preexistente y no relacionado de `hero-carousel.tsx`, ya documentado desde la Fase 1).
- `pnpm build`: compila las 11 rutas sin errores (confirma que FullCalendar y todos los componentes nuevos resuelven bien a nivel de bundling).
- `pnpm dev` + login real (Playwright headless, con las credenciales del admin) contra el Supabase de dev:
  - **Bandeja**: widget de cumpleaños muestra datos reales, ordenados y con las insignias correctas.
  - **Servicios**: tabla con los 6 servicios reales; diálogo de edición precarga los datos correctamente.
  - **Agenda**: calendario renderiza con datos reales; clic en una cita abre el diálogo de detalle con reagendar; toggle Semana/Día funciona; "Bloquear horario" sigue funcionando igual que antes.
  - Sin errores de consola/JS en ningún flujo probado.

## Pendiente / próximos pasos

1. Uso real por Manu y su hermana — ajustar detalles visuales si algo no convence en el día a día (colores de estado en el calendario, nivel de densidad por defecto, etc.).
2. Si en el futuro se quiere un control de zoom más fino que los 3 pasos actuales, considerar agregar un `Slider` real (`@radix-ui/react-slider` ya está en `package.json` pero sin usar) — se dejó fuera a propósito en esta fase para no sobre-construir.
3. Cuando se cree el proyecto Supabase de producción (Fase 1, pendiente #4), replicar el schema tal cual está en dev — no hay migraciones nuevas de esta fase que aplicar aparte de las ya conocidas (`0001`, `0002`).
