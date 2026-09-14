"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ScheduleGrid, type GridEmployee, type GridShift } from "@/components/ScheduleGrid";
import { EmployeeSidebar, type SidebarEmployee } from "@/components/schedule/EmployeeSidebar";
import { BranchSwitch, type BranchFilter } from "@/components/schedule/BranchSwitch";
import { FilterChip } from "@/components/schedule/FilterChip";
import { WeekNav } from "@/components/schedule/WeekNav";
import { SummaryCounter } from "@/components/schedule/SummaryCounter";
import { Badge } from "@/components/Badge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteShift, approveSuggestedShift } from "./actions";
import { generateScheduleDraft, type GenerateDraftState } from "./generateDraft";
import { ShiftPopoverForm } from "./ShiftPopoverForm";
import { hoursBetween } from "@/lib/hours";
import { DAY_LABELS, DAY_LABELS_MIN, isoDayOfWeek } from "@/lib/dates";

const generateDraftInitial: GenerateDraftState = { error: null, summary: null };

type Branch = { id: string; code: string; name: string };
type CoveragePopoverTarget = { employeeId: string; date: string; shiftId?: string };
type KitchenCoverageRow = {
  branchName: string;
  branchCode: string;
  days: { date: string; required: number | null; assigned: number }[];
};
type ServiceCoverageRow = {
  date: string;
  branchName: string;
  entryTime: string;
  required: number;
  assigned: number;
  note: string | null;
};

const AREA_FILTERS = [
  { value: "todas" as const, label: "Todos los turnos" },
  { value: "servicio" as const, label: "Servicio", dot: "bg-info-foreground" },
  { value: "cocina" as const, label: "Cocina", dot: "bg-warning-foreground" },
];

export function SchedulePlanner({
  dates,
  todayDate,
  weekLabel,
  weekSublabel,
  prevHref,
  nextHref,
  todayHref,
  currentWeek,
  branches,
  employees,
  shiftsRecord,
  dayOffRecord,
  dayShiftCountsRecord,
  contractedHoursByEmployee,
  sidebarEmployees,
  summary,
  kitchenCoverage,
  serviceCoverage,
}: {
  dates: string[];
  todayDate: string;
  weekLabel: string;
  weekSublabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  currentWeek: string;
  branches: Branch[];
  employees: GridEmployee[];
  shiftsRecord: Record<string, GridShift[]>;
  dayOffRecord: Record<string, "aprobada" | "pendiente">;
  dayShiftCountsRecord: Record<string, number>;
  contractedHoursByEmployee: Record<string, number>;
  sidebarEmployees: SidebarEmployee[];
  summary: { covered: number; total: number; unassigned: number; approvedDaysOff: number; burnoutAlerts: number };
  kitchenCoverage: KitchenCoverageRow[];
  serviceCoverage: ServiceCoverageRow[];
}) {
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("todas");
  const [areaFilter, setAreaFilter] = useState<"todas" | "servicio" | "cocina">("todas");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"empleados" | "dias">("empleados");
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [popover, setPopover] = useState<CoveragePopoverTarget | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [draftState, draftAction, draftPending] = useActionState(
    generateScheduleDraft,
    generateDraftInitial
  );

  const shiftsByEmployeeDate = useMemo(() => new Map(Object.entries(shiftsRecord)), [shiftsRecord]);
  const dayOffByEmployeeDate = useMemo(() => new Map(Object.entries(dayOffRecord)), [dayOffRecord]);
  const dayShiftCounts = useMemo(() => new Map(Object.entries(dayShiftCountsRecord)), [dayShiftCountsRecord]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  function weekHoursForEmployee(employeeId: string, excludeShiftId?: string): number {
    let total = 0;
    for (const date of dates) {
      const shifts = shiftsRecord[`${employeeId}_${date}`] ?? [];
      for (const s of shifts) {
        if (s.id === excludeShiftId) continue;
        total += hoursBetween(s.startTime, s.endTime);
      }
    }
    return total;
  }

  const visibleEmployees = employees.filter((e) => {
    if (selectedEmployeeId && e.id !== selectedEmployeeId) return false;
    if (areaFilter !== "todas" && e.area !== areaFilter) return false;
    return true;
  });

  // El filtro de sucursal se aplica a nivel de turno: solo mostramos, para cada
  // empleado, los turnos de la sucursal elegida (branchFilter="todas" = sin filtrar).
  const filteredShiftsByEmployeeDate = useMemo(() => {
    if (branchFilter === "todas") return shiftsByEmployeeDate;
    const filtered = new Map<string, GridShift[]>();
    for (const [key, shifts] of shiftsByEmployeeDate) {
      filtered.set(
        key,
        shifts.filter((s) => s.branchCode === branchFilter)
      );
    }
    return filtered;
  }, [shiftsByEmployeeDate, branchFilter]);

  function closePopover() {
    setPopover(null);
  }

  /** Sucursal del turno más reciente de esta semana para este empleado —
   *  para prellenar (sin bloquear) la sucursal de un rotativo sin turnos
   *  previos ese día, en vez de dejarla en blanco. */
  function preferredBranchIdFor(employeeId: string): string | undefined {
    for (const date of dates) {
      const shifts = shiftsRecord[`${employeeId}_${date}`] ?? [];
      if (shifts.length > 0) {
        return branches.find((b) => b.code === shifts[0].branchCode)?.id;
      }
    }
    return undefined;
  }

  function renderPopoverFor(employeeId: string, date: string) {
    if (!popover || popover.employeeId !== employeeId || popover.date !== date) return null;
    const shift = popover.shiftId
      ? (shiftsRecord[`${employeeId}_${date}`] ?? []).find((s) => s.id === popover.shiftId)
      : null;
    const branch = branches.find((b) => b.code === shift?.branchCode);
    const employee = employeeById.get(employeeId);
    const isNewShift = !popover.shiftId;
    const lockedBranchId = isNewShift ? employee?.defaultBranchId ?? undefined : undefined;
    const dateIndex = dates.indexOf(date);
    return (
      <ShiftPopoverForm
        employeeId={employeeId}
        employeeName={employee?.name ?? "Empleado"}
        employeeArea={employee?.area ?? null}
        date={date}
        currentWeek={currentWeek}
        branches={branches}
        shiftId={popover.shiftId}
        lockedBranchId={lockedBranchId}
        defaultBranchId={branch?.id ?? (isNewShift ? preferredBranchIdFor(employeeId) : undefined)}
        defaultStartTime={shift?.startTime.slice(0, 5)}
        defaultEndTime={shift?.endTime.slice(0, 5)}
        otherHoursThisWeek={weekHoursForEmployee(employeeId, shift?.id)}
        hoursContracted={contractedHoursByEmployee[employeeId] ?? 40}
        align={dateIndex >= dates.length - 2 ? "right" : "left"}
        onClose={closePopover}
      />
    );
  }

  function handleCellDrop(date: string, e: React.DragEvent) {
    e.preventDefault();
    setDropTargetDate(null);
    const employeeId = e.dataTransfer.getData("text/plain");
    if (!employeeId) return;
    setPopover({ employeeId, date });
    setSelectedShiftId(null);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Barra superior: sucursal, semana, vista */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <BranchSwitch branches={branches} value={branchFilter} onChange={setBranchFilter} />
        <WeekNav label={weekLabel} sublabel={weekSublabel} prevHref={prevHref} nextHref={nextHref} todayHref={todayHref} />
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Vista de grilla" className="flex gap-0.5 rounded-lg border border-border bg-background p-0.5">
            <button
              type="button"
              aria-pressed={viewMode === "empleados"}
              onClick={() => setViewMode("empleados")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "empleados" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              Empleados × días
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "dias"}
              onClick={() => setViewMode("dias")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "dias" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              Días × horas
            </button>
          </div>
          <form action={draftAction}>
            <input type="hidden" name="week" value={currentWeek} />
            <input type="hidden" name="branch_filter" value={branchFilter} />
            <button
              type="submit"
              disabled={draftPending}
              title="Asistente que propone turnos de servicio para cubrir los huecos — tú decides si aprobarlos"
              className="flex items-center gap-1.5 rounded-md border border-info-foreground bg-info px-3 py-1.5 text-sm font-medium text-info-foreground shadow-sm transition-colors hover:bg-info/70 disabled:opacity-60"
            >
              <span aria-hidden="true">✨</span>
              {draftPending ? "Generando…" : "Generar borrador"}
            </button>
          </form>
          <Link
            href="/admin/schedule/import"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            Importar Excel
          </Link>
        </div>
      </div>

      {draftState.error && (
        <p className="border-b border-border bg-danger px-4 py-2.5 text-sm text-danger-foreground">
          {draftState.error}
        </p>
      )}
      {draftState.summary && (
        <div className="m-3 space-y-1.5 rounded-lg border-2 border-dashed border-info-foreground bg-info/30 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            ✨ {draftState.summary.shiftsCreated} turno(s) sugeridos
            {draftState.summary.branchFilterApplied ? ` para ${draftState.summary.branchFilterApplied}` : ""}{" "}
            — se ven con borde punteado y la etiqueta "IA" en la grilla. Apruébalos, edítalos o
            elimínalos, no quedan confirmados hasta que decidas.
          </p>
          {draftState.summary.kitchenGapsRemaining > 0 && (
            <p className="text-xs text-muted">
              Quedan {draftState.summary.kitchenGapsRemaining} hueco(s) de cocina sin cubrir — cocina
              no se asigna automáticamente todavía, hazlo a mano.
            </p>
          )}
          {draftState.summary.unfilledSlots.length > 0 && (
            <details className="text-xs text-warning-foreground">
              <summary className="cursor-pointer font-medium">
                {draftState.summary.unfilledSlots.length} hueco(s) de servicio sin candidato disponible
              </summary>
              <ul className="mt-1 list-inside list-disc">
                {draftState.summary.unfilledSlots.map((s, i) => (
                  <li key={i}>
                    {s.branchCode} · {s.date} {s.entryTime.slice(0, 5)} — faltan {s.missing}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {draftState.summary.restRuleOverrides.length > 0 && (
            <details className="text-xs text-warning-foreground">
              <summary className="cursor-pointer font-medium">
                {draftState.summary.restRuleOverrides.length} aviso(s) de días libres
              </summary>
              <ul className="mt-1 list-inside list-disc">
                {draftState.summary.restRuleOverrides.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Resumen de la semana */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <SummaryCounter icon="✓" value={`${summary.covered}/${summary.total}`} label="turnos cubiertos" tone="success" />
        <SummaryCounter icon="!" value={summary.unassigned} label="turnos sin asignar" tone="warning" />
        <SummaryCounter icon="◷" value={summary.approvedDaysOff} label="días libres aprobados" tone="info" />
        <SummaryCounter icon="▲" value={summary.burnoutAlerts} label="alertas de desgaste" tone={summary.burnoutAlerts > 0 ? "danger" : "success"} />
      </div>

      {/* Chips de filtro */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-3">
        {AREA_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            count={
              f.value === "todas"
                ? summary.total
                : employees.filter((e) => e.area === f.value).length
            }
            dotClassName={f.dot}
            selected={areaFilter === f.value}
            onClick={() => setAreaFilter(f.value)}
          />
        ))}
        <FilterChip label="Sin asignar" count={summary.unassigned} selected={coverageOpen} onClick={() => setCoverageOpen((v) => !v)} />
        <span className="ml-auto flex items-center gap-3 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-sm bg-branch-u2-foreground" />
            U2
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-sm bg-branch-u3-foreground" />
            U3
          </span>
          <span>borde = sucursal · punto = área</span>
        </span>
      </div>

      {/* Móvil: agenda día a día, sin scroll horizontal */}
      <MobileAgenda
        dates={dates}
        todayDate={todayDate}
        employees={visibleEmployees}
        shiftsRecord={shiftsRecord}
        dayOffRecord={dayOffRecord}
        popoverTarget={popover}
        renderPopoverFor={renderPopoverFor}
        onOpenCreate={(employeeId, date) => {
          setSelectedShiftId(null);
          setPopover({ employeeId, date });
        }}
        onOpenEdit={(employeeId, date, shiftId) => setPopover({ employeeId, date, shiftId })}
      />

      {/* Escritorio: sidebar + grilla */}
      <div className="hidden sm:grid sm:grid-cols-[236px_minmax(0,1fr)]">
        <EmployeeSidebar
          employees={sidebarEmployees}
          selectedId={selectedEmployeeId}
          onSelect={setSelectedEmployeeId}
          onDragStartEmployee={setDraggingId}
          draggingId={draggingId}
        />

        <div className="min-w-0">
          {viewMode === "empleados" ? (
            <ScheduleGrid
              dates={dates}
              employees={visibleEmployees}
              shiftsByEmployeeDate={filteredShiftsByEmployeeDate}
              dayOffByEmployeeDate={dayOffByEmployeeDate}
              todayDate={todayDate}
              dayShiftCounts={dayShiftCounts}
              dropTargetDate={dropTargetDate}
              onCellDragOver={(date, e) => {
                if (draggingId) {
                  e.preventDefault();
                  setDropTargetDate(date);
                }
              }}
              onCellDrop={handleCellDrop}
              selectedShiftId={selectedShiftId}
              onShiftClick={(shift) => {
                setPopover(null);
                setSelectedShiftId((id) => (id === shift.id ? null : shift.id));
              }}
              renderShiftActions={(shift, employeeId, date) =>
                selectedShiftId === shift.id ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {shift.suggested && (
                      <form action={approveSuggestedShift.bind(null, shift.id)}>
                        <button
                          type="submit"
                          className="rounded-md border border-success-foreground bg-success px-2 py-1 text-[11px] font-semibold text-success-foreground hover:opacity-80"
                        >
                          ✓ Aprobar
                        </button>
                      </form>
                    )}
                    <button
                      type="button"
                      onClick={() => setPopover({ employeeId, date, shiftId: shift.id })}
                      className="rounded-md border border-info-foreground bg-info px-2 py-1 text-[11px] font-semibold text-info-foreground hover:opacity-80"
                    >
                      ✎ Editar
                    </button>
                    <form action={deleteShift.bind(null, shift.id)}>
                      <ConfirmButton
                        confirmMessage="¿Eliminar este turno? Esta acción no se puede deshacer."
                        className="rounded-md border border-danger-foreground bg-danger px-2 py-1 text-[11px] font-semibold text-danger-foreground hover:opacity-80"
                      >
                        × Eliminar
                      </ConfirmButton>
                    </form>
                  </div>
                ) : null
              }
              emptyCellContent={(employeeId, date) => (
                <button
                  type="button"
                  aria-label={`Asignar turno el ${DAY_LABELS[isoDayOfWeek(date)].toLowerCase()} ${date.slice(8, 10)}`}
                  onClick={() => {
                    setSelectedShiftId(null);
                    setPopover({ employeeId, date });
                  }}
                  className="flex h-11 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-faint transition-colors hover:border-info-foreground hover:bg-info hover:text-info-foreground"
                >
                  +
                </button>
              )}
              renderCellExtra={(employeeId, date) => renderPopoverFor(employeeId, date)}
            />
          ) : (
            <DaysByHoursView
              dates={dates}
              todayDate={todayDate}
              employees={visibleEmployees}
              shiftsByEmployeeDate={filteredShiftsByEmployeeDate}
            />
          )}

          <details
            open={coverageOpen}
            onToggle={(e) => setCoverageOpen((e.target as HTMLDetailsElement).open)}
            className="border-t border-border"
          >
            <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-hover">
              Cobertura mínima de cocina y servicio
            </summary>
            <div className="space-y-6 p-4 pt-0">
              <CoverageTable dates={dates} kitchenCoverage={kitchenCoverage} />
              <ServiceCoverageTable serviceCoverage={serviceCoverage} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function CoverageTable({
  dates,
  kitchenCoverage,
}: {
  dates: string[];
  kitchenCoverage: KitchenCoverageRow[];
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Cobertura mínima de cocina
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-muted">
            <tr>
              <th className="px-3 py-1.5 font-medium">Sucursal</th>
              {dates.map((date) => (
                <th key={date} className="px-3 py-1.5 font-medium">
                  {DAY_LABELS[isoDayOfWeek(date)]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {kitchenCoverage.map((row) => (
              <tr key={row.branchCode}>
                <td className="px-3 py-1.5 font-medium text-foreground">{row.branchName}</td>
                {row.days.map(({ date, required, assigned }) => (
                  <td key={date} className="px-3 py-1.5">
                    {required === null ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <Badge variant={assigned < required ? "danger" : "success"}>
                        {assigned}/{required}
                      </Badge>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ServiceCoverageTable({ serviceCoverage }: { serviceCoverage: ServiceCoverageRow[] }) {
  if (serviceCoverage.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Cobertura de servicio (horarios de ingreso)
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-muted">
            <tr>
              <th className="px-3 py-1.5 font-medium">Fecha</th>
              <th className="px-3 py-1.5 font-medium">Sucursal</th>
              <th className="px-3 py-1.5 font-medium">Ingreso</th>
              <th className="px-3 py-1.5 font-medium">Cobertura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {serviceCoverage.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5 text-muted">
                  {DAY_LABELS[isoDayOfWeek(row.date)]} {row.date}
                </td>
                <td className="px-3 py-1.5 text-foreground">{row.branchName}</td>
                <td className="px-3 py-1.5 text-muted">
                  {row.entryTime.slice(0, 5)}
                  {row.note ? ` (${row.note})` : ""}
                </td>
                <td className="px-3 py-1.5">
                  <Badge variant={row.assigned < row.required ? "danger" : "success"}>
                    {row.assigned}/{row.required}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Vista alterna, de solo lectura: cada día de la semana con sus turnos ordenados por hora. */
function DaysByHoursView({
  dates,
  todayDate,
  employees,
  shiftsByEmployeeDate,
}: {
  dates: string[];
  todayDate: string;
  employees: GridEmployee[];
  shiftsByEmployeeDate: Map<string, GridShift[]>;
}) {
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return (
    <div className="divide-y divide-border">
      {dates.map((date) => {
        const rows = employees
          .flatMap((emp) =>
            (shiftsByEmployeeDate.get(`${emp.id}_${date}`) ?? []).map((s) => ({ emp, shift: s }))
          )
          .sort((a, b) => a.shift.startTime.localeCompare(b.shift.startTime));
        const isToday = date === todayDate;
        return (
          <div key={date} className={`p-3 ${isToday ? "bg-info/30" : ""}`}>
            <p className={`mb-2 text-xs font-semibold ${isToday ? "text-info-foreground" : "text-muted"}`}>
              {DAY_LABELS[isoDayOfWeek(date)]} {date.slice(8, 10)}
              {isToday && " · Hoy"} <span className="font-normal text-faint">({rows.length} turnos)</span>
            </p>
            {rows.length === 0 ? (
              <p className="text-xs text-faint">Sin turnos.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rows.map(({ emp, shift }) => (
                  <div
                    key={shift.id}
                    className="rounded-md border border-l-[3px] border-border bg-surface px-2.5 py-1.5 text-xs"
                    style={{
                      borderLeftColor:
                        shift.branchCode === "U2"
                          ? "var(--color-branch-u2-foreground)"
                          : "var(--color-branch-u3-foreground)",
                    }}
                  >
                    <span className="font-semibold text-foreground">
                      {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
                    </span>
                    <span className="ml-1.5 text-muted">
                      {employeeById.get(emp.id)?.name} · {shift.branchCode}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const MOBILE_AREA_LABEL: Record<string, string> = {
  servicio: "Servicio",
  cocina: "Cocina",
  sin_area: "Sin área asignada",
};

/**
 * Agenda de admin para móvil: tabs de día + lista agrupada por área, cada
 * turno con acción de editar/eliminar y un botón para agregar turno cuando
 * el empleado no tiene uno ese día — sin la grilla de 7 columnas, que
 * obligaría a hacer scroll horizontal en pantallas chicas.
 */
function MobileAgenda({
  dates,
  todayDate,
  employees,
  shiftsRecord,
  dayOffRecord,
  popoverTarget,
  renderPopoverFor,
  onOpenCreate,
  onOpenEdit,
}: {
  dates: string[];
  todayDate: string;
  employees: GridEmployee[];
  shiftsRecord: Record<string, GridShift[]>;
  dayOffRecord: Record<string, "aprobada" | "pendiente">;
  popoverTarget: CoveragePopoverTarget | null;
  renderPopoverFor: (employeeId: string, date: string) => React.ReactNode;
  onOpenCreate: (employeeId: string, date: string) => void;
  onOpenEdit: (employeeId: string, date: string, shiftId: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(
    dates.includes(todayDate) ? todayDate : dates[0]
  );

  const groups = (["servicio", "cocina", "sin_area"] as const)
    .map((area) => ({
      area,
      employees: employees.filter((e) => (area === "sin_area" ? !e.area : e.area === area)),
    }))
    .filter((g) => g.employees.length > 0);

  return (
    <div className="sm:hidden">
      <div className="grid grid-cols-7 gap-1.5 p-3">
        {dates.map((date) => {
          const isToday = date === todayDate;
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedDate(date)}
              className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-[11px] transition-colors ${
                isSelected
                  ? "border-accent bg-accent text-accent-foreground"
                  : isToday
                  ? "border-info-foreground bg-surface text-foreground"
                  : "border-border bg-surface text-foreground"
              }`}
            >
              {DAY_LABELS_MIN[isoDayOfWeek(date)]}
              <span className="font-bold">{date.slice(8, 10)}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4 px-3 pb-3">
        {groups.map((group) => (
          <div key={group.area}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {MOBILE_AREA_LABEL[group.area]}
            </p>
            <div className="space-y-2">
              {group.employees.map((emp) => {
                const key = `${emp.id}_${selectedDate}`;
                const shifts = shiftsRecord[key] ?? [];
                const dayOff = dayOffRecord[key];
                const isPopoverOpen =
                  popoverTarget?.employeeId === emp.id && popoverTarget.date === selectedDate;
                return (
                  <div key={emp.id} className="relative">
                    {dayOff ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-l-[3px] border-l-warning-foreground bg-warning px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-warning-foreground">
                            {emp.name}
                          </p>
                          <p className="text-xs text-warning-foreground">
                            Día libre · {dayOff === "aprobada" ? "aprobado" : "pendiente"}
                          </p>
                        </div>
                      </div>
                    ) : shifts.length > 0 ? (
                      shifts.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-l-[3px] border-border border-l-branch-u2-foreground bg-surface px-3 py-2.5"
                          style={{
                            borderLeftColor:
                              s.branchCode === "U3"
                                ? "var(--color-branch-u3-foreground)"
                                : undefined,
                          }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                              <span className="truncate">{emp.name}</span> · {s.branchCode}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Editar turno"
                            onClick={() => onOpenEdit(emp.id, selectedDate, s.id)}
                            className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-border text-muted"
                          >
                            ···
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-warning-foreground bg-warning px-3 py-2.5">
                        <p className="text-sm font-semibold text-warning-foreground">{emp.name}</p>
                        <button
                          type="button"
                          onClick={() => onOpenCreate(emp.id, selectedDate)}
                          className="flex h-9 items-center justify-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground"
                        >
                          Asignar
                        </button>
                      </div>
                    )}
                    {isPopoverOpen && renderPopoverFor(emp.id, selectedDate)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
