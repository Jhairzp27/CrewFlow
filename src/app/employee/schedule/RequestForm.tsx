"use client";

import { useActionState, useState } from "react";
import { createTimeOffRequest, type TimeOffRequestState } from "./actions";
import {
  cardClass,
  errorBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  successBoxClass,
} from "@/components/formStyles";

const initialState: TimeOffRequestState = {
  error: null,
  success: false,
  requestType: null,
};

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
    <form action={formAction} className={`space-y-4 ${cardClass}`}>
      <div>
        <label htmlFor="request_type" className={labelClass}>
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
          <label htmlFor="start_date" className={labelClass}>
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
          <label htmlFor="end_date" className={labelClass}>
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
            <label htmlFor="start_time" className={labelClass}>
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
            <label htmlFor="end_time" className={labelClass}>
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
          <label htmlFor="exception_reason" className={labelClass}>
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
        <label htmlFor="reason" className={labelClass}>
          Comentario (opcional)
        </label>
        <textarea id="reason" name="reason" rows={2} className={inputClass} />
      </div>

      {state.error && <p className={errorBoxClass}>{state.error}</p>}
      {state.success && (
        <p className={successBoxClass}>
          Solicitud enviada. Quedó en estado pendiente de aprobación.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`w-full ${primaryButtonClass}`}
      >
        {pending ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
