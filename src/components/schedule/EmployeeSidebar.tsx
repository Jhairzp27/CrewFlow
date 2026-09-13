"use client";

import { useMemo, useState } from "react";
import { formatHoursFraction } from "@/lib/hours";

export type SidebarEmployee = {
  id: string;
  name: string;
  initials: string;
  area: "servicio" | "cocina" | null;
  hoursWorked: number;
  hoursContracted: number;
  shiftsCount: number;
  streakDays: number | null;
  atRisk: boolean;
  dayOffLabel?: string | null;
};

const AREA_LABEL: Record<string, string> = {
  servicio: "Servicio",
  cocina: "Cocina",
  sin_area: "Sin área",
};

function barColorClass(worked: number, contracted: number): string {
  if (worked > contracted) return "bg-danger-foreground";
  if (worked >= contracted) return "bg-success-foreground";
  return "bg-faint";
}

/**
 * Sidebar de empleados: buscar, agrupar por área, arrastrar hacia una celda
 * de la grilla para asignar turno, clic para filtrar la grilla a sus turnos.
 */
export function EmployeeSidebar({
  employees,
  selectedId,
  onSelect,
  onDragStartEmployee,
  draggingId,
}: {
  employees: SidebarEmployee[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDragStartEmployee: (id: string) => void;
  draggingId: string | null;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const filtered = query.trim()
      ? employees.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
      : employees;

    return (["servicio", "cocina", "sin_area"] as const)
      .map((area) => ({
        area,
        employees: filtered.filter((e) => (area === "sin_area" ? !e.area : e.area === area)),
      }))
      .filter((g) => g.employees.length > 0);
  }, [employees, query]);

  return (
    <aside className="min-h-[520px] border-border bg-surface sm:border-r">
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5">
          <span className="text-faint" aria-hidden="true">
            ⌕
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empleado…"
            aria-label="Buscar empleado"
            className="w-full bg-transparent text-xs text-foreground placeholder:text-faint focus:outline-none"
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-faint">
          Arrastra un empleado a una celda para asignarle turno.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.area}>
          <p className="flex justify-between px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <span>{AREA_LABEL[group.area]}</span>
            <span className="text-faint">{group.employees.length}</span>
          </p>
          {group.employees.map((emp) => {
            const isSelected = selectedId === emp.id;
            const isDragging = draggingId === emp.id;
            return (
              <button
                key={emp.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", emp.id);
                  e.dataTransfer.effectAllowed = "copy";
                  onDragStartEmployee(emp.id);
                }}
                onClick={() => onSelect(isSelected ? null : emp.id)}
                className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover ${
                  isSelected
                    ? "border-l-info-foreground bg-info"
                    : emp.atRisk
                    ? "border-l-danger-foreground"
                    : "border-l-transparent"
                } ${isDragging ? "opacity-60" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
                    isSelected
                      ? "bg-surface text-info-foreground"
                      : emp.atRisk
                      ? "bg-danger text-danger-foreground"
                      : "bg-surface-hover text-muted"
                  }`}
                >
                  {emp.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`flex items-baseline gap-1.5 truncate text-xs font-semibold ${
                      isSelected ? "text-info-foreground" : "text-foreground"
                    }`}
                  >
                    <span className="truncate">{emp.name}</span>
                    {emp.dayOffLabel && (
                      <span className="whitespace-nowrap text-[11px] font-normal text-warning-foreground">
                        ◷ {emp.dayOffLabel}
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-0.5 block text-[11px] ${
                      isSelected
                        ? "text-info-foreground"
                        : emp.atRisk
                        ? "text-danger-foreground"
                        : "text-muted"
                    }`}
                  >
                    {formatHoursFraction(emp.hoursWorked, emp.hoursContracted)}
                    {emp.atRisk && emp.streakDays ? ` · racha ${emp.streakDays} días` : ` · ${emp.shiftsCount} turnos`}
                  </span>
                  <span className="mt-1 block h-[3px] rounded-full bg-border">
                    <span
                      className={`block h-[3px] rounded-full ${barColorClass(emp.hoursWorked, emp.hoursContracted)}`}
                      style={{
                        width: `${Math.min(100, (emp.hoursWorked / emp.hoursContracted) * 100)}%`,
                      }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}

      <div className="mt-1.5 border-t border-border p-3">
        <p className="text-[11px] leading-relaxed text-faint">
          Clic en un empleado = filtra la grilla a sus turnos. Clic de nuevo = quita el filtro.
        </p>
      </div>
    </aside>
  );
}
