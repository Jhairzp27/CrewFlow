"use client";

import { useActionState, useEffect, useState } from "react";
import { createShift, updateShift, type ShiftFormState } from "./actions";
import { hoursBetween } from "@/lib/hours";
import { DAY_LABELS, isoDayOfWeek } from "@/lib/dates";
import { inputClass, labelClass } from "@/components/formStyles";

const initialState: ShiftFormState = { error: null, success: false };

type Branch = { id: string; code: string; name: string };

/**
 * Formulario de turno en popover, anclado a la celda donde se hizo clic o
 * soltó el empleado arrastrado. Reusa exactamente la validación y las
 * Server Actions del formulario original (createShift/updateShift) — solo
 * cambia dónde y cómo se presenta.
 */
export function ShiftPopoverForm({
  employeeId,
  employeeName,
  date,
  currentWeek,
  branches,
  shiftId,
  defaultArea,
  defaultBranchId,
  defaultStartTime,
  defaultEndTime,
  otherHoursThisWeek,
  hoursContracted,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  currentWeek: string;
  branches: Branch[];
  shiftId?: string;
  defaultArea?: "servicio" | "cocina" | null;
  defaultBranchId?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  otherHoursThisWeek: number;
  hoursContracted: number;
  onClose: () => void;
}) {
  const action = shiftId ? updateShift.bind(null, shiftId) : createShift;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? "");
  const [area, setArea] = useState<"servicio" | "cocina">(defaultArea ?? "servicio");
  const [startTime, setStartTime] = useState(defaultStartTime ?? "");
  const [endTime, setEndTime] = useState(defaultEndTime ?? "");

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const newShiftHours =
    startTime && endTime && endTime > startTime ? hoursBetween(startTime, endTime) : 0;
  const projectedHours = otherHoursThisWeek + newShiftHours;
  const overContract = newShiftHours > 0 && projectedHours > hoursContracted;

  return (
    <div
      role="dialog"
      aria-label={shiftId ? "Editar turno" : "Nuevo turno"}
      className="absolute left-0 top-full z-20 mt-1 w-[266px] rounded-lg border border-border bg-surface p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">
            {shiftId ? "Editar turno" : "Nuevo turno"}
          </p>
          <p className="mt-0.5 text-xs leading-tight text-muted">
            {employeeName} · {DAY_LABELS[isoDayOfWeek(date)].toLowerCase()} {date.slice(8, 10)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-faint hover:text-foreground"
        >
          ×
        </button>
      </div>

      <form action={formAction} className="space-y-2.5">
        <input type="hidden" name="week" value={currentWeek} />
        <input type="hidden" name="employee_id" value={employeeId} />
        <input type="hidden" name="shift_date" value={date} />
        <input type="hidden" name="branch_id" value={branchId} />
        <input type="hidden" name="area" value={area} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="start_time" className={`${labelClass} mb-0.5 text-xs`}>
              Inicio
            </label>
            <input
              id="start_time"
              name="start_time"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`${inputClass} py-1.5 text-xs`}
            />
          </div>
          <div>
            <label htmlFor="end_time" className={`${labelClass} mb-0.5 text-xs`}>
              Fin
            </label>
            <input
              id="end_time"
              name="end_time"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={`${inputClass} py-1.5 text-xs`}
            />
          </div>
        </div>

        <div>
          <p className={`${labelClass} mb-1 text-xs`}>Sucursal</p>
          <div className="flex gap-1.5">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={branchId === b.id}
                onClick={() => setBranchId(b.id)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                  branchId === b.id
                    ? "border-info-foreground bg-info text-info-foreground"
                    : "border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {b.code}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={`${labelClass} mb-1 text-xs`}>Área</p>
          <div className="flex gap-1.5">
            {(["servicio", "cocina"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={area === a}
                onClick={() => setArea(a)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  area === a
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {overContract && (
          <p className="flex gap-1.5 rounded-md bg-warning px-2 py-1.5 text-[11px] leading-snug text-warning-foreground">
            <span>!</span>
            <span>
              Con este turno {employeeName.split(" ")[0]} llega a {Math.round(projectedHours * 10) / 10} h
              (contrato {hoursContracted} h). Puedes guardarlo igual.
            </span>
          </p>
        )}

        {state.error && (
          <p className="rounded-md bg-danger px-2 py-1.5 text-[11px] text-danger-foreground">
            {state.error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar turno"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-hover"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
