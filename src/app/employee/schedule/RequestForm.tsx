"use client";

import { useActionState, useState } from "react";
import { createTimeOffRequest, type TimeOffRequestState } from "./actions";

const initialState: TimeOffRequestState = {
  error: null,
  success: false,
  requestType: null,
};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100 disabled:text-gray-400";

export function TimeOffRequestForm() {
  const [state, formAction, pending] = useActionState(
    createTimeOffRequest,
    initialState
  );
  // Next.js remonta este componente en cada envío (useState local se pierde),
  // así que el valor inicial se recupera de `state.requestType`, que sí viaja
  // intacto a través del ciclo de vida del Server Action.
  const [requestType, setRequestType] = useState<
    "dia_libre" | "vacaciones" | "permiso_horas"
  >(state.requestType ?? "dia_libre");

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="request_type"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Tipo de solicitud
        </label>
        <select
          id="request_type"
          name="request_type"
          value={requestType}
          onChange={(e) =>
            setRequestType(e.target.value as typeof requestType)
          }
          className={inputClass}
        >
          <option value="dia_libre">Día libre</option>
          <option value="vacaciones">Vacaciones</option>
          <option value="permiso_horas">Permiso por horas (votación)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="start_date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Fecha de inicio
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="end_date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Fecha de fin
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            disabled={requestType === "permiso_horas"}
            className={inputClass}
          />
        </div>
      </div>

      {requestType === "permiso_horas" && (
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
              className={inputClass}
            />
          </div>
        </div>
      )}

      {requestType === "dia_libre" && (
        <div>
          <label
            htmlFor="exception_reason"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            ¿Es una excepción? (opcional)
          </label>
          <select
            id="exception_reason"
            name="exception_reason"
            defaultValue=""
            className={inputClass}
          >
            <option value="">No aplica (rige la regla de 10 días)</option>
            <option value="emergencia_medica">Emergencia médica</option>
            <option value="fuerza_mayor">Fuerza mayor</option>
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor="reason"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Comentario (opcional)
        </label>
        <textarea id="reason" name="reason" rows={2} className={inputClass} />
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Solicitud enviada. Quedó en estado pendiente de aprobación.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
