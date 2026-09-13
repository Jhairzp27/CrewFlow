import { Fragment } from "react";
import { DAY_LABELS, isoDayOfWeek } from "@/lib/dates";
import { BranchBadge } from "./BranchBadge";

export type GridShift = {
  id: string;
  branchCode: string;
  startTime: string;
  endTime: string;
};

export type GridEmployee = {
  id: string;
  name: string;
  area: "servicio" | "cocina" | null;
};

const AREA_LABEL: Record<string, string> = {
  servicio: "Servicio",
  cocina: "Cocina",
  sin_area: "Sin área asignada",
};

/**
 * Grilla semanal estilo hoja de cálculo: filas de empleados agrupadas por
 * área (Servicio / Cocina, como en el Excel original del cliente),
 * columnas por día. Puramente presentacional — quien la use decide qué
 * pasa dentro de cada celda (solo texto, o texto + acciones de admin).
 */
export function ScheduleGrid({
  dates,
  employees,
  shiftsByEmployeeDate,
  renderShift,
  renderCellExtra,
}: {
  dates: string[];
  employees: GridEmployee[];
  shiftsByEmployeeDate: Map<string, GridShift[]>;
  renderShift?: (shift: GridShift) => React.ReactNode;
  renderCellExtra?: (employeeId: string, date: string) => React.ReactNode;
}) {
  const groups: { area: string; employees: GridEmployee[] }[] = (
    ["servicio", "cocina", "sin_area"] as const
  )
    .map((area) => ({
      area,
      employees: employees.filter((e) =>
        area === "sin_area" ? !e.area : e.area === area
      ),
    }))
    .filter((g) => g.employees.length > 0);

  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted">No hay empleados para mostrar.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-40 border border-border bg-surface-hover px-3 py-2 font-medium text-foreground">
              Empleado
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className="border border-border bg-surface-hover px-3 py-2 font-medium text-foreground"
              >
                {DAY_LABELS[isoDayOfWeek(date)]}
                <div className="text-xs font-normal text-muted">{date}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.area}>
              <tr>
                <td className="sticky left-0 z-10 border border-border bg-surface-hover px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {AREA_LABEL[group.area]}
                </td>
                <td
                  colSpan={dates.length}
                  className="border border-border bg-surface-hover px-3 py-1"
                />
              </tr>
              {group.employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="sticky left-0 z-10 border border-border bg-surface px-3 py-2 font-medium text-foreground">
                    {emp.name}
                  </td>
                  {dates.map((date) => {
                    const cellShifts =
                      shiftsByEmployeeDate.get(`${emp.id}_${date}`) ?? [];
                    return (
                      <td
                        key={date}
                        className="border border-border px-2 py-2 align-top"
                      >
                        <div className="flex flex-col gap-1">
                          {cellShifts.length > 0 ? (
                            cellShifts.map((s) => (
                              <div
                                key={s.id}
                                className="flex flex-wrap items-center gap-1 rounded bg-surface-hover px-1.5 py-1 text-xs text-foreground"
                              >
                                <BranchBadge code={s.branchCode} />
                                <span>
                                  {s.startTime.slice(0, 5)}-
                                  {s.endTime.slice(0, 5)}
                                </span>
                                {renderShift?.(s)}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-faint">Libre</span>
                          )}
                          {renderCellExtra?.(emp.id, date)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
