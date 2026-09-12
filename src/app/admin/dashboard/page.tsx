import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions";
import { reviewTimeOffRequest, addPerformanceNote } from "./actions";
import { longestConsecutiveStreak } from "@/lib/streak";

const DEFAULT_CONSECUTIVE_DAYS_THRESHOLD = 5;

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pendiente: "bg-yellow-50 text-yellow-700",
  aprobada: "bg-green-50 text-green-700",
  rechazada: "bg-red-50 text-red-700",
};

const TYPE_LABEL: Record<string, string> = {
  vacaciones: "Vacaciones",
  dia_libre: "Día libre",
  permiso_horas: "Permiso por horas",
};

const EXCEPTION_LABEL: Record<string, string> = {
  emergencia_medica: "Emergencia médica",
  fuerza_mayor: "Fuerza mayor",
};

type EmployeeRef = { full_name: string | null; email: string | null } | null;

type RequestRow = {
  id: string;
  request_type: string;
  status: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  exception_reason: string | null;
  reason: string | null;
  created_at: string;
  employee: EmployeeRef;
};

type NoteRow = {
  id: string;
  note: string;
  created_at: string;
  employee: EmployeeRef;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: requestsData } = await supabase
    .from("time_off_requests")
    .select(
      `id, request_type, status, start_date, end_date, start_time, end_time,
       exception_reason, reason, created_at,
       employee:profiles!time_off_requests_employee_id_fkey (full_name, email)`
    )
    .order("created_at", { ascending: false });
  const requests = (requestsData ?? []) as unknown as RequestRow[];

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, email, area")
    .eq("role", "employee")
    .order("full_name", { ascending: true });

  const [{ data: shiftsData }, { data: thresholdRule }] = await Promise.all([
    supabase.from("shifts").select("employee_id, shift_date"),
    supabase
      .from("business_rules")
      .select("value")
      .eq("key", "umbral_dias_consecutivos")
      .maybeSingle(),
  ]);

  const consecutiveDaysThreshold =
    (thresholdRule?.value as number | undefined) ??
    DEFAULT_CONSECUTIVE_DAYS_THRESHOLD;

  const shiftDatesByEmployee = new Map<string, string[]>();
  for (const s of shiftsData ?? []) {
    const list = shiftDatesByEmployee.get(s.employee_id) ?? [];
    list.push(s.shift_date);
    shiftDatesByEmployee.set(s.employee_id, list);
  }

  const burnoutRows = (employees ?? []).map((e) => ({
    employee: e,
    streak: longestConsecutiveStreak(shiftDatesByEmployee.get(e.id) ?? []),
  }));

  const { data: notesData } = await supabase
    .from("performance_notes")
    .select(
      `id, note, created_at,
       employee:profiles!performance_notes_employee_id_fkey (full_name, email)`
    )
    .order("created_at", { ascending: false })
    .limit(20);
  const notes = (notesData ?? []) as unknown as NoteRow[];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Panel del Administrador
            </h1>
            <Link
              href="/admin/schedule"
              className="text-sm text-gray-500 hover:underline"
            >
              Planificador de turnos →
            </Link>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <p className="text-sm text-gray-500">
          Sesión iniciada como {user?.email}.
        </p>

        {/* ------------------------------------------------------------ */}
        {/* Solicitudes de permisos y vacaciones                          */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Solicitudes de permisos y vacaciones
          </h2>
          {requests && requests.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Empleado</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Fechas</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-gray-900">
                        {r.employee?.full_name ?? r.employee?.email ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {TYPE_LABEL[r.request_type] ?? r.request_type}
                        {r.exception_reason && (
                          <span className="ml-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {EXCEPTION_LABEL[r.exception_reason] ??
                              r.exception_reason}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {r.start_date === r.end_date
                          ? r.start_date
                          : `${r.start_date} → ${r.end_date}`}
                        {r.start_time && r.end_time
                          ? ` (${r.start_time.slice(0, 5)}-${r.end_time.slice(
                              0,
                              5
                            )})`
                          : ""}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_BADGE_CLASS[r.status] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {r.status === "pendiente" && (
                          <div className="flex justify-end gap-2">
                            <form
                              action={reviewTimeOffRequest.bind(
                                null,
                                r.id,
                                "aprobada"
                              )}
                            >
                              <button
                                type="submit"
                                className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                              >
                                Aprobar
                              </button>
                            </form>
                            <form
                              action={reviewTimeOffRequest.bind(
                                null,
                                r.id,
                                "rechazada"
                              )}
                            >
                              <button
                                type="submit"
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                              >
                                Rechazar
                              </button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No hay solicitudes registradas todavía.
            </p>
          )}
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Desgaste laboral — estructura inicial                        */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-gray-900">
            Desgaste laboral
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Racha más larga de días consecutivos con turno asignado, según los
            turnos actualmente en el planificador. Umbral de alerta:{" "}
            {consecutiveDaysThreshold} días o más.
          </p>

          {burnoutRows.length > 0 ? (
            <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Empleado</th>
                    <th className="px-4 py-2 font-medium">Racha</th>
                    <th className="px-4 py-2 font-medium">Periodo</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {burnoutRows.map(({ employee, streak }) => {
                    const length = streak?.length ?? 0;
                    const isBurnoutRisk = length >= consecutiveDaysThreshold;
                    return (
                      <tr key={employee.id}>
                        <td className="px-4 py-2 text-gray-900">
                          {employee.full_name ?? employee.email}
                        </td>
                        <td className="px-4 py-2 text-gray-900">
                          {length} {length === 1 ? "día" : "días"}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {streak ? `${streak.start} → ${streak.end}` : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              isBurnoutRisk
                                ? "bg-red-50 text-red-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {isBurnoutRisk ? "Riesgo de desgaste" : "Normal"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-6 text-sm text-gray-500">
              No hay empleados registrados todavía.
            </p>
          )}

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Anotaciones de desempeño
          </h3>
          <form
            action={addPerformanceNote}
            className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4"
          >
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
                defaultValue=""
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="" disabled>
                  Selecciona un empleado
                </option>
                {employees?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name ?? e.email} {e.area ? `(${e.area})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="note"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Anotación
              </label>
              <textarea
                id="note"
                name="note"
                rows={2}
                required
                placeholder="Ej. Tercera tardanza esta semana en U2."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Guardar anotación
            </button>
          </form>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Anotaciones recientes
          </h3>
          {notes && notes.length > 0 ? (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
                >
                  <p className="text-gray-900">{n.note}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {n.employee?.full_name ?? n.employee?.email ?? "—"} ·{" "}
                    {new Date(n.created_at).toLocaleDateString("es-ES")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Aún no hay anotaciones.</p>
          )}
        </section>
      </div>
    </main>
  );
}
