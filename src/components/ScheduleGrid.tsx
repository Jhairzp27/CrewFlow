import { Fragment } from "react";
import { DAY_LABELS_SHORT, isoDayOfWeek } from "@/lib/dates";
import { ShiftCard, type ShiftCardVariant } from "./schedule/ShiftCard";

export type GridShift = {
  id: string;
  branchCode: string;
  startTime: string;
  endTime: string;
  area?: "servicio" | "cocina" | null;
  suggested?: boolean;
};

export type GridEmployee = {
  id: string;
  name: string;
  area: "servicio" | "cocina" | null;
  defaultBranchId?: string | null;
};

const AREA_LABEL: Record<string, string> = {
  servicio: "Servicio",
  cocina: "Cocina",
  sin_area: "Sin área asignada",
};

/**
 * Grilla semanal estilo hoja de cálculo: filas de empleados agrupadas por
 * área (Servicio / Cocina, como en el Excel original del cliente), columnas
 * por día. La columna del día actual se resalta. Puramente presentacional —
 * quien la use decide qué va dentro de cada celda (solo texto, turno + acciones
 * de admin, botón "+ turno", o el popover de asignación) vía las funciones de
 * render, y puede convertir cada celda en zona de drop para el sidebar de
 * empleados con onCellDragOver/onCellDrop.
 */
export function ScheduleGrid({
  dates,
  employees,
  shiftsByEmployeeDate,
  dayOffByEmployeeDate,
  todayDate,
  ownEmployeeId,
  shiftVariant,
  dayShiftCounts,
  renderShiftActions,
  emptyCellContent,
  renderCellExtra,
  onCellDragOver,
  onCellDrop,
  dropTargetDate,
  onShiftClick,
  selectedShiftId,
}: {
  dates: string[];
  employees: GridEmployee[];
  shiftsByEmployeeDate: Map<string, GridShift[]>;
  dayOffByEmployeeDate?: Map<string, "aprobada" | "pendiente">;
  todayDate?: string;
  ownEmployeeId?: string;
  shiftVariant?: (shift: GridShift, employeeId: string) => ShiftCardVariant;
  dayShiftCounts?: Map<string, number>;
  renderShiftActions?: (shift: GridShift, employeeId: string, date: string) => React.ReactNode;
  emptyCellContent?: (employeeId: string, date: string) => React.ReactNode;
  renderCellExtra?: (employeeId: string, date: string) => React.ReactNode;
  onCellDragOver?: (date: string, e: React.DragEvent) => void;
  onCellDrop?: (date: string, e: React.DragEvent) => void;
  dropTargetDate?: string | null;
  onShiftClick?: (shift: GridShift, employeeId: string, date: string) => void;
  selectedShiftId?: string | null;
}) {
  const groups: { area: string; employees: GridEmployee[] }[] = (
    ["servicio", "cocina", "sin_area"] as const
  )
    .map((area) => ({
      area,
      employees: employees.filter((e) => (area === "sin_area" ? !e.area : e.area === area)),
    }))
    .filter((g) => g.employees.length > 0);

  if (employees.length === 0) {
    return <p className="text-sm text-muted">No hay empleados para mostrar.</p>;
  }

  const gridTemplateColumns = `160px repeat(${dates.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns }}>
        {/* Cabecera de días */}
        <div className="sticky left-0 z-10 border-b border-r border-border bg-surface-hover px-3 py-2 text-sm font-medium text-foreground">
          Empleado
        </div>
        {dates.map((date) => {
          const isToday = date === todayDate;
          return (
            <div
              key={date}
              className={`border-b border-r border-border px-2 py-1.5 last:border-r-0 ${
                isToday ? "bg-info shadow-[inset_0_2px_0_var(--color-info-foreground)]" : "bg-surface-hover"
              }`}
            >
              <p
                className={`text-xs font-semibold leading-tight ${
                  isToday ? "text-info-foreground" : "text-foreground"
                }`}
              >
                {DAY_LABELS_SHORT[isoDayOfWeek(date)]}{" "}
                <span className={isToday ? "font-normal" : "font-normal text-muted"}>
                  {date.slice(8, 10)}
                </span>
                {isToday && " · Hoy"}
              </p>
              {dayShiftCounts && (
                <p
                  className={`text-[10px] leading-tight ${
                    isToday ? "text-info-foreground" : "text-faint"
                  }`}
                >
                  {dayShiftCounts.get(date) ?? 0} turnos
                </p>
              )}
            </div>
          );
        })}

        {groups.map((group) => (
          <Fragment key={group.area}>
            <div
              className="sticky left-0 z-10 border-b border-r border-border bg-surface-hover px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted"
              style={{ gridColumn: "1 / -1" }}
            >
              {AREA_LABEL[group.area]}
            </div>
            {group.employees.map((emp) => (
              <Fragment key={emp.id}>
                <div className="sticky left-0 z-10 flex items-center border-b border-r border-border bg-surface px-3 py-2 text-sm font-medium text-foreground">
                  {emp.name}
                </div>
                {dates.map((date) => {
                  const isToday = date === todayDate;
                  const isDropTarget = dropTargetDate === date;
                  const cellShifts = shiftsByEmployeeDate.get(`${emp.id}_${date}`) ?? [];
                  const dayOff = dayOffByEmployeeDate?.get(`${emp.id}_${date}`);
                  return (
                    <div
                      key={date}
                      onDragOver={onCellDragOver ? (e) => onCellDragOver(date, e) : undefined}
                      onDrop={onCellDrop ? (e) => onCellDrop(date, e) : undefined}
                      className={`relative min-h-[56px] border-b border-r border-border p-1.5 last:border-r-0 ${
                        isToday ? "bg-info/40" : ""
                      } ${isDropTarget ? "bg-info ring-2 ring-inset ring-info-foreground" : ""}`}
                    >
                      <div className="flex flex-col gap-1">
                        {dayOff ? (
                          <ShiftCard
                            title="Día libre"
                            meta={dayOff === "aprobada" ? "aprobado · no editable" : "pendiente de aprobación"}
                            variant="dayoff"
                          />
                        ) : cellShifts.length > 0 ? (
                          cellShifts.map((s) => (
                            <ShiftCard
                              key={s.id}
                              title={`${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}`}
                              meta={`${s.area ? AREA_LABEL[s.area] : ""}${
                                s.area ? " · " : ""
                              }${s.branchCode}`}
                              area={s.area}
                              branchCode={s.branchCode}
                              variant={
                                s.suggested
                                  ? "suggested"
                                  : shiftVariant
                                  ? shiftVariant(s, emp.id)
                                  : emp.id === ownEmployeeId
                                  ? "own"
                                  : "assigned"
                              }
                              selected={selectedShiftId === s.id}
                              onClick={onShiftClick ? () => onShiftClick(s, emp.id, date) : undefined}
                              actions={renderShiftActions?.(s, emp.id, date)}
                            />
                          ))
                        ) : (
                          emptyCellContent?.(emp.id, date) ?? (
                            <span className="px-0.5 py-1 text-xs text-faint">Libre</span>
                          )
                        )}
                        {renderCellExtra?.(emp.id, date)}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
