"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createShift, updateShift, type ShiftFormState } from "./actions";

const initialState: ShiftFormState = { error: null, success: false };

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

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
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="week" value={currentWeek} />

      {editingShift && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
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
          <label
            htmlFor="employee_id"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
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
          <label
            htmlFor="branch_id"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
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
          <label
            htmlFor="area"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
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
          <label
            htmlFor="shift_date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
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
          <label
            htmlFor="start_time"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
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
          <label
            htmlFor="end_time"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
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

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Turno asignado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Guardando..."
          : editingShift
          ? "Actualizar turno"
          : "Asignar turno"}
      </button>
    </form>
  );
}
