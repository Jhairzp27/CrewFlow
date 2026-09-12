"use client";

import { useActionState } from "react";
import { importScheduleFromExcel, type ImportState } from "./actions";

const initialState: ImportState = { error: null, summary: null };

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

type Branch = { id: string; code: string; name: string };

export function ImportForm({ branches }: { branches: Branch[] }) {
  const [state, formAction, pending] = useActionState(
    importScheduleFromExcel,
    initialState
  );

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="branch_id"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Sucursal del archivo
            </label>
            <select
              id="branch_id"
              name="branch_id"
              required
              defaultValue=""
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
            <p className="mt-1 text-xs text-gray-500">
              El archivo no distingue sucursal — todos los turnos se
              asignarán a la que elijas aquí.
            </p>
          </div>

          <div>
            <label
              htmlFor="closing_time"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Hora real de cierre
            </label>
            <input
              id="closing_time"
              name="closing_time"
              type="time"
              required
              defaultValue="22:00"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Se usa para los turnos que dicen &quot;a Cierre&quot;.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="file"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Archivo de horario (.xlsx)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className={inputClass}
          />
        </div>

        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Importando..." : "Importar horario"}
        </button>
      </form>

      {state.summary && (
        <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-6">
          <h3 className="text-sm font-semibold text-green-800">
            Importación completada
          </h3>
          <p className="text-sm text-green-800">
            {state.summary.shiftsCreated} turno(s) creados o actualizados.
          </p>

          {state.summary.employeesCreated.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">
                Empleados nuevos creados — comparte estas credenciales una
                sola vez, no quedan guardadas en ningún otro lugar:
              </p>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Correo</th>
                      <th className="px-3 py-2 font-medium">
                        Contraseña temporal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.summary.employeesCreated.map((e) => (
                      <tr key={e.email}>
                        <td className="px-3 py-2 text-gray-900">
                          {e.fullName}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{e.email}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {e.tempPassword}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Si ves nombres muy parecidos (ej. &quot;PEDRO&quot; y
                &quot;PEDRO RAMIREZ&quot;), probablemente sea la misma
                persona escrita distinto entre semanas — revisa y ajusta
                manualmente en Supabase si hace falta.
              </p>
            </div>
          )}

          {state.summary.shiftsSkipped.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-900">
                Celdas no importadas como turno:
              </p>
              <ul className="list-inside list-disc text-sm text-gray-600">
                {state.summary.shiftsSkipped.map((s) => (
                  <li key={s.reason}>
                    {s.reason}: {s.count}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.summary.warnings.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-yellow-800">
                Avisos:
              </p>
              <ul className="list-inside list-disc text-sm text-yellow-800">
                {state.summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
