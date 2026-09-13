"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createShift, updateShift, type ShiftFormState } from "./actions";
import {
  cardClass,
  errorBoxClass,
  infoBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  successBoxClass,
} from "@/components/formStyles";

const initialState: ShiftFormState = { error: null, success: false };

type Employee = { id: string; full_name: string | null; email: string | null };
type Branch = { id: string; code: string; name: string };
export type EditingShift = {
  id: string;
  employee_id: string;
  branch_id: string;
  area: string;
  shift_date: string;
  start_time: string;
  end_time: string;
};

export function ShiftForm({
  employees,
  branches,
  defaultDate,
  currentWeek,
  editingShift,
  cancelHref,
}: {
  employees: Employee[];
  branches: Branch[];
  defaultDate: string;
  currentWeek: string;
  editingShift?: EditingShift | null;
  cancelHref?: string;
}) {
  const action = editingShift
    ? updateShift.bind(null, editingShift.id)
    : createShift;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={`space-y-4 ${cardClass}`}>
      <input type="hidden" name="week" value={currentWeek} />

      {editingShift && (
        <p className={infoBoxClass}>
          Editando turno existente.{" "}
          {cancelHref && (
            <Link href={cancelHref} className="font-medium underline">
              Cancelar edición
            </Link>
          )}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="employee_id" className={labelClass}>
            Empleado
          </label>
          <select
            id="employee_id"
            name="employee_id"
            required
            defaultValue={editingShift?.employee_id ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona un empleado
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name ?? e.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="branch_id" className={labelClass}>
            Sucursal
          </label>
          <select
            id="branch_id"
            name="branch_id"
            required
            defaultValue={editingShift?.branch_id ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona una sucursal
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="area" className={labelClass}>
            Área
          </label>
          <select
            id="area"
            name="area"
            required
            defaultValue={editingShift?.area ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona un área
            </option>
            <option value="servicio">Servicio</option>
            <option value="cocina">Cocina</option>
          </select>
        </div>

        <div>
          <label htmlFor="shift_date" className={labelClass}>
            Fecha
          </label>
          <input
            id="shift_date"
            name="shift_date"
            type="date"
            required
            defaultValue={editingShift?.shift_date ?? defaultDate}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_time" className={labelClass}>
            Hora de inicio
          </label>
          <input
            id="start_time"
            name="start_time"
            type="time"
            required
            defaultValue={editingShift?.start_time.slice(0, 5) ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="end_time" className={labelClass}>
            Hora de fin
          </label>
          <input
            id="end_time"
            name="end_time"
            type="time"
            required
            defaultValue={editingShift?.end_time.slice(0, 5) ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      {state.error && <p className={errorBoxClass}>{state.error}</p>}
      {state.success && (
        <p className={successBoxClass}>Turno asignado correctamente.</p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending
          ? "Guardando..."
          : editingShift
          ? "Actualizar turno"
          : "Asignar turno"}
      </button>
    </form>
  );
}
