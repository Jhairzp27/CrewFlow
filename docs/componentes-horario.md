# Inventario de componentes — rediseño de horarios

Implementación del rediseño acordado en `CrewFlow horario rediseño` (Claude
Design). Todos los componentes usan exclusivamente los tokens de color de
`src/app/globals.css` (sin hex nuevos) y funcionan en claro/oscuro vía `.dark`.

## Componentes

### `ShiftCard` — `src/components/schedule/ShiftCard.tsx`
Tarjeta de turno compacta: hora arriba, punto de área + sucursal abajo.

**Props:** `title`, `meta`, `area` (`servicio | cocina | null`), `branchCode`,
`variant`, `selected`, `actions`, `onClick`, `draggable`.

**Variantes (`ShiftCardVariant`):**
| Variante | Uso | Estilo |
| --- | --- | --- |
| `assigned` | Turno de otro empleado (grilla admin) | `bg-surface-hover`, borde izq. = sucursal |
| `own` | Turno propio (vista empleado) | `bg-info` / `text-info-foreground` |
| `unassigned` | Hueco de cobertura sin cubrir | borde punteado `warning` |
| `dayoff` | Día libre aprobado/pendiente | `bg-warning`, no interactivo |
| `conflict` | Solapamiento (reservado para uso futuro) | `bg-danger` |

**Estados:** normal, hover (`hover:bg-border`), seleccionado (`ring-2
ring-info-foreground` + `actions` visibles: Editar/Eliminar), sin interacción
(`dayoff`, sin `onClick`).

### `FilterChip` — `src/components/schedule/FilterChip.tsx`
Chip de filtro tipo pastilla. **Props:** `label`, `count`, `dotClassName`,
`selected`, `disabled`, `onClick`. Estados: normal, hover, seleccionado
(`bg-accent`), deshabilitado.

### `BranchSwitch` — `src/components/schedule/BranchSwitch.tsx`
Selector segmentado U2 / U3 / Ambas. **Props:** `branches`, `value`,
`onChange`. El punto de color de cada botón usa `--branch-u2-foreground` /
`--branch-u3-foreground`; "Ambas" usa el tono de acento cuando está activo.

### `WeekNav` — `src/components/schedule/WeekNav.tsx`
Navegación de semana (← rango de fechas · N.º de semana →, + "Hoy").
Implementado con `next/link` (navegación real vía `?week=`, sin JS de
cliente) para que el admin y el empleado compartan el mismo componente.

### `SummaryCounter` — `src/components/schedule/SummaryCounter.tsx`
Chip de resumen (icono + número + etiqueta). **Props:** `icon`, `value`,
`label`, `tone` (`success | warning | info | danger`). Usado en la fila de
resumen semanal del planificador: turnos cubiertos, sin asignar, días libres
aprobados, alertas de desgaste.

### `EmployeeSidebar` / `EmployeeSidebarRow` — `src/components/schedule/EmployeeSidebar.tsx`
Sidebar del planificador admin: buscador, agrupación por área (Servicio /
Cocina), y por cada empleado — iniciales, nombre, barra de horas vs. horas
contratadas (`weekly_contracted_hours`), turnos de la semana o racha si está
en riesgo.

**Props por fila:** `id`, `name`, `initials`, `area`, `hoursWorked`,
`hoursContracted`, `shiftsCount`, `streakDays`, `atRisk`, `dayOffLabel`.

**Estados:** normal, hover (`hover:bg-surface-hover`), seleccionado (filtra
la grilla — borde izq. `info-foreground`, fondo `bg-info`), riesgo de
desgaste (borde izq. `danger-foreground`, texto y avatar en tono danger),
arrastrando (`draggable`, `opacity-60` en el origen mientras se arrastra
hacia una celda).

### `GridCell` (celda vacía / zona de drop) — dentro de `ScheduleGrid.tsx` y `SchedulePlanner.tsx`
Estados: Libre (texto tenue), "+ turno" (borde punteado, hover en tono
info), Soltar aquí (cuando se arrastra un empleado sobre la columna del día:
`bg-info` + `ring-2 ring-info-foreground`).

### `ScheduleGrid` — `src/components/ScheduleGrid.tsx`
Grilla semanal (Empleados × días) reutilizada por el planificador admin y el
resumen del dashboard. CSS grid (no `<table>`) para poder anclar popovers y
manejar drag-and-drop por celda. Agrupa filas por área, resalta la columna
de "Hoy" con `--info` / `--info-foreground`, y expone render props
(`renderShiftActions`, `emptyCellContent`, `renderCellExtra`,
`onCellDragOver`/`onCellDrop`) para que cada pantalla decida qué interacción
habilitar sin duplicar el layout.

### `ReadOnlyWeek` — `src/components/schedule/ReadOnlyWeek.tsx`
Semana de solo lectura para el rol empleado. **Es un componente propio, no
la grilla de admin con props desactivados** — así el servidor nunca serializa
datos de otros empleados hacia esta pantalla (el server component
`employee/schedule/page.tsx` solo consulta los turnos del usuario en
sesión). Sin `+`, sin ✎/×, sin popover, sin sidebar. En móvil colapsa a tabs
de día (L M M J V S D) para evitar scroll horizontal.

### `ShiftPopoverForm` — `src/app/admin/schedule/ShiftPopoverForm.tsx`
Formulario de turno en popover, anclado a la celda donde se hizo clic o se
soltó un empleado arrastrado. Reutiliza tal cual las Server Actions
`createShift` / `updateShift` de `actions.ts` — la validación, el mensaje de
error y el chequeo de conflicto con permisos aprobados no cambiaron, solo
dónde y cómo se presenta el formulario. Muestra un aviso (no bloqueante) si
el turno hace que el empleado supere sus horas contratadas esa semana.

### `SchedulePlanner` — `src/app/admin/schedule/SchedulePlanner.tsx`
Orquesta sidebar + grilla + filtros + resumen + cobertura colapsada +
agenda móvil. Estado de cliente: sucursal activa, filtro de área, empleado
seleccionado (filtra la grilla), vista (Empleados × días / Días × horas),
turno seleccionado (muestra Editar/Eliminar), popover abierto,
arrastre en curso.

## Cómo cumple las 10 heurísticas de Nielsen

1. **Visibilidad del estado del sistema** — chips de resumen semanal,
   conteo de turnos por día en la cabecera, columna de "Hoy" resaltada.
2. **Coincidencia con el lenguaje del usuario** — "Libre", "Día libre",
   "Sin asignar", sucursal U2/U3 en vez de UUIDs o fechas ISO sueltas.
3. **Control y libertad del usuario** — "Cancelar" en el popover, semana
   navegable con "Hoy", edición y eliminación reversibles vía confirmación.
4. **Consistencia y estándares** — un solo `ShiftCard` y un solo `Badge`
   para admin, empleado y dashboard; mismos tokens de color en toda la app.
5. **Prevención de errores** — aviso de exceso de horas antes de guardar
   (no bloqueante), celdas de día libre no editables, `ConfirmButton` con
   `window.confirm` antes de eliminar un turno.
6. **Reconocer antes que recordar** — leyenda "borde = sucursal · punto =
   área" visible, iniciales + horas en el sidebar, área y sucursal en cada
   tarjeta.
7. **Flexibilidad y eficiencia de uso** — arrastrar para asignar o clic
   para abrir el popover; conmutador Empleados×días / Días×horas; filtros
   por área.
8. **Diseño estético y minimalista** — densidad de hoja de cálculo (filas
   ~56px) sin repetir fechas ISO; la cobertura detallada queda colapsada al
   pie (`<details>`).
9. **Ayuda a reconocer y recuperarse de errores** — los mensajes de error
   de `createShift`/`updateShift` explican la causa (ej. "el empleado tiene
   un día libre aprobado ese día"), no un "error" genérico.
10. **Ayuda y documentación** — textos de ayuda en contexto ("Arrastra un
    empleado a una celda para asignarle turno", regla de 10 días junto al
    botón de solicitar).

## Decisiones de alcance frente al mockup

- **Horas contratadas:** se agregó `profiles.weekly_contracted_hours`
  (migración `supabase/sql/08_contracted_hours.sql`, default 40) porque el
  mockup depende de ese dato y no existía. No se construyó una pantalla de
  administración de empleados nueva (no existía antes tampoco); el valor se
  edita directamente en Supabase, igual que `area` y `role` hoy.
- **"Turnos sin asignar":** no existe en el modelo de datos un turno "vacante"
  (la tabla `shifts` exige `employee_id`). El conteo mostrado es real:
  la suma de huecos de cobertura mínima de cocina y de horarios de ingreso
  de servicio (`kitchen_staffing_requirements` / `service_entry_schedules`
  vs. turnos ya asignados) — no se inventaron tarjetas de turno "fantasma"
  con horarios que no están respaldados por esas reglas.
- **Vista "Días × horas":** el propio hilo de diseño no llegó a dibujarla en
  detalle (queda como sugerencia de "próxima iteración" en el `.dc.html`).
  Se implementó como una agenda de solo lectura por día (turnos ordenados
  por hora), sin drag-and-drop ni popover, para no inventar una línea de
  tiempo que el diseño no especificó.
- **Aviso de "excepción" por exceso de horas:** es un mensaje informativo
  calculado en el cliente al momento de guardar; no se persiste un flag de
  "excepción" en la base de datos porque el negocio no lo pidió más allá del
  aviso mismo.

## Generar borrador de horario (`src/app/admin/schedule/generateDraft.ts`)

Botón "Generar borrador" en el planificador. Reglas de negocio confirmadas
con el administrador del negocio:

- **Sucursal:** un empleado con `profiles.default_branch_id` fijo solo se
  asigna a esa sucursal; sin ese valor (`NULL`) es rotativo y elegible para
  ambas. Se edita directamente en Supabase, igual que `area`/`role`/
  `weekly_contracted_hours` — no existe todavía una pantalla de
  administración de empleados.
- **Aperturas** (el ingreso más temprano de cada sucursal/día): se reparten
  al azar, con probabilidad inversamente proporcional a cuántas veces ha
  abierto cada quien en el historial — "aleatorio equiparando entre todos".
- **El resto de los huecos:** se llenan por menor desgaste (racha de días
  consecutivos más corta y luego menos horas acumuladas esa semana) —
  "elegir según desgaste".
- **Días libres garantizados** (`business_rules.dias_libres_por_semana`):
  se evita asignar un turno más allá de `7 - días_libres` a quien ya los
  agotó, salvo que no quede ningún otro candidato — en ese caso sí se
  asigna, pero se avisa explícitamente en el resumen, nunca en silencio.

**Decisión de alcance:** solo genera turnos de **Servicio**.
`kitchen_staffing_requirements` (Cocina) define un mínimo de personal por
día pero no una franja horaria, así que no hay una hora de inicio/fin real
que asignar sin inventar un dato que el negocio no dio. Esos huecos se
siguen contando y se muestran en el resumen para asignación manual. El
horario de fin del último bloque de servicio usa `business_rules
.hora_cierre_default` ("22:00", dentro del rango de cierre confirmado:
21:30–22:00).

El resultado son turnos reales, iguales a los creados a mano — el admin los
aprueba o ajusta con los mismos controles de editar/eliminar que ya
existían, no se agregó un estado de "borrador" separado en la base de
datos.
