import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { reviewTimeOffRequest, addPerformanceNote } from "./actions";
import { longestConsecutiveStreak } from "@/lib/streak";
import { mondayOf, todayDateOnly, weekDates } from "@/lib/dates";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { ScheduleGrid, type GridEmployee, type GridShift } from "@/components/ScheduleGrid";

const DEFAULT_CONSECUTIVE_DAYS_THRESHOLD = 5;

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  pendiente: "warning",
  aprobada: "success",
  rechazada: "danger",
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

  const monday = mondayOf(todayDateOnly());
  const dates = weekDates(monday);

  const { data: requestsData } = await supabase
    .from("time_off_requests")
    .select(
      `id, request_type, status, start_date, end_date, start_time, end_time,
       exception_reason, reason, created_at,
       employee:profiles!time_off_requests_employee_id_fkey (full_name, email)`
    )
    .order("created_at", { ascending: false });
  const requests = (requestsData ?? []) as unknown as RequestRow[];
  const pendingCount = requests.filter((r) => r.status === "pendiente").length;

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, email, area")
    .eq("role", "employee")
    .order("full_name", { ascending: true });

  const [{ data: shiftsData }, { data: thresholdRule }, { data: branchesData }] =
    await Promise.all([
      supabase
        .from("shifts")
        .select("id, employee_id, branch_id, area, shift_date, start_time, end_time"),
      supabase
        .from("business_rules")
        .select("value")
        .eq("key", "umbral_dias_consecutivos")
        .maybeSingle(),
      supabase.from("branches").select("id, code"),
    ]);

  const consecutiveDaysThreshold =
    (thresholdRule?.value as number | undefined) ??
    DEFAULT_CONSECUTIVE_DAYS_THRESHOLD;

  const branchCodeById = new Map((branchesData ?? []).map((b) => [b.id, b.code]));

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
  const atRiskCount = burnoutRows.filter(
    (r) => (r.streak?.length ?? 0) >= consecutiveDaysThreshold
  ).length;

  const weekShifts = (shiftsData ?? []).filter(
    (s) => s.shift_date >= dates[0] && s.shift_date <= dates[6]
  );
  const shiftsByEmployeeDate = new Map<string, GridShift[]>();
  for (const s of weekShifts) {
    const key = `${s.employee_id}_${s.shift_date}`;
    const list = shiftsByEmployeeDate.get(key) ?? [];
    list.push({
      id: s.id,
      branchCode: branchCodeById.get(s.branch_id) ?? "?",
      startTime: s.start_time,
      endTime: s.end_time,
    });
    shiftsByEmployeeDate.set(key, list);
  }
  const gridEmployees: GridEmployee[] = (employees ?? []).map((e) => ({
      id: e.id,
      name: e.full_name ?? e.email ?? "—",
      area: e.area as "servicio" | "cocina" | null,
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
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Inicio
        </h1>
        <p className="text-sm text-muted">
          Vista general de la semana — el detalle completo y la edición de
          turnos están en el Planificador.
        </p>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Estadísticas rápidas                                          */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Solicitudes pendientes"
          value={pendingCount}
          tone={pendingCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Empleados en riesgo de desgaste"
          value={atRiskCount}
          tone={atRiskCount > 0 ? "danger" : "neutral"}
        />
        <StatCard label="Empleados activos" value={employees?.length ?? 0} />
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Horario de esta semana (vista rápida, estilo Excel)           */}
      {/* ------------------------------------------------------------ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Horario de esta semana ({dates[0]} → {dates[6]})
          </h2>
          <Link
            href="/admin/schedule"
            className="text-sm text-muted hover:text-foreground hover:underline"
          >
            Ver planificador completo →
          </Link>
        </div>
        <ScheduleGrid
          dates={dates}
          employees={gridEmployees}
          shiftsByEmployeeDate={shiftsByEmployeeDate}
        />
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Solicitudes de permisos y vacaciones                          */}
      {/* ------------------------------------------------------------ */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Solicitudes de permisos y vacaciones
        </h2>
        {requests.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Empleado</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Fechas</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-foreground">
                      {r.employee?.full_name ?? r.employee?.email ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-foreground">
                      {TYPE_LABEL[r.request_type] ?? r.request_type}
                      {r.exception_reason && (
                        <Badge variant="warning" className="ml-1">
                          {EXCEPTION_LABEL[r.exception_reason] ??
                            r.exception_reason}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted">
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
                      <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
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
                              className="rounded-md border border-success bg-success px-2 py-1 text-xs font-medium text-success-foreground hover:opacity-80"
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
                              className="rounded-md border border-danger bg-danger px-2 py-1 text-xs font-medium text-danger-foreground hover:opacity-80"
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
          <p className="text-sm text-muted">
            No hay solicitudes registradas todavía.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Desgaste laboral                                              */}
      {/* ------------------------------------------------------------ */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-foreground">
          Desgaste laboral
        </h2>
        <p className="mb-3 text-xs text-muted">
          Racha más larga de días consecutivos con turno asignado, según los
          turnos actualmente en el planificador. Umbral de alerta:{" "}
          {consecutiveDaysThreshold} días o más.
        </p>

        {burnoutRows.length > 0 ? (
          <div className="mb-6 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Empleado</th>
                  <th className="px-4 py-2 font-medium">Racha</th>
                  <th className="px-4 py-2 font-medium">Periodo</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {burnoutRows.map(({ employee, streak }) => {
                  const length = streak?.length ?? 0;
                  const isBurnoutRisk = length >= consecutiveDaysThreshold;
                  return (
                    <tr key={employee.id}>
                      <td className="px-4 py-2 text-foreground">
                        {employee.full_name ?? employee.email}
                      </td>
                      <td className="px-4 py-2 text-foreground">
                        {length} {length === 1 ? "día" : "días"}
                      </td>
                      <td className="px-4 py-2 text-muted">
                        {streak ? `${streak.start} → ${streak.end}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={isBurnoutRisk ? "danger" : "success"}>
                          {isBurnoutRisk ? "Riesgo de desgaste" : "Normal"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-6 text-sm text-muted">
            No hay empleados registrados todavía.
          </p>
        )}

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
          Anotaciones de desempeño
        </h3>
        <form
          action={addPerformanceNote}
          className="mb-6 space-y-3 rounded-xl border border-border bg-surface p-4"
        >
          <div>
            <label
              htmlFor="employee_id"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Empleado
            </label>
            <select
              id="employee_id"
              name="employee_id"
              required
              defaultValue=""
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Anotación
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
              required
              placeholder="Ej. Tercera tardanza esta semana en U2."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
          >
            Guardar anotación
          </button>
        </form>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
          Anotaciones recientes
        </h3>
        {notes && notes.length > 0 ? (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <p className="text-foreground">{n.note}</p>
                <p className="mt-1 text-xs text-faint">
                  {n.employee?.full_name ?? n.employee?.email ?? "—"} ·{" "}
                  {new Date(n.created_at).toLocaleDateString("es-ES")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aún no hay anotaciones.</p>
        )}
      </section>
    </div>
  );
}
