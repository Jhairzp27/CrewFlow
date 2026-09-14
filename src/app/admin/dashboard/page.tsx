import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { reviewTimeOffRequest, addPerformanceNote } from "./actions";
import { longestConsecutiveStreak } from "@/lib/streak";
import { mondayOf, todayDateOnly, weekDates } from "@/lib/dates";
import { hoursBetween } from "@/lib/hours";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { ScheduleGrid, type GridEmployee, type GridShift } from "@/components/ScheduleGrid";
import { WorkloadRanking, type WorkloadRow } from "@/components/schedule/WorkloadRanking";
import { inputClass, labelClass, primaryButtonClass } from "@/components/formStyles";

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
    .select("id, full_name, email, area, weekly_contracted_hours")
    .eq("role", "employee")
    .order("full_name", { ascending: true });

  const [{ data: shiftsData }, { data: thresholdRule }, { data: branchesData }] =
    await Promise.all([
      supabase
        .from("shifts")
        .select("id, employee_id, branch_id, area, shift_date, start_time, end_time, suggested"),
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
      area: s.area as "servicio" | "cocina" | null,
      suggested: s.suggested,
    });
    shiftsByEmployeeDate.set(key, list);
  }
  const gridEmployees: GridEmployee[] = (employees ?? []).map((e) => ({
      id: e.id,
      name: e.full_name ?? e.email ?? "—",
      area: e.area as "servicio" | "cocina" | null,
    }));

  const workloadRows: WorkloadRow[] = (employees ?? []).map((e) => {
    let hoursWorked = 0;
    for (const date of dates) {
      for (const s of shiftsByEmployeeDate.get(`${e.id}_${date}`) ?? []) {
        hoursWorked += hoursBetween(s.startTime, s.endTime);
      }
    }
    return {
      id: e.id,
      name: e.full_name ?? e.email ?? "—",
      hoursWorked,
      hoursContracted: e.weekly_contracted_hours ?? 40,
    };
  });

  const pendingRequests = requests.filter((r) => r.status === "pendiente");
  const decidedRequests = requests.filter((r) => r.status !== "pendiente");
  const atRiskRows = burnoutRows
    .filter((r) => (r.streak?.length ?? 0) >= consecutiveDaysThreshold)
    .sort((a, b) => (b.streak?.length ?? 0) - (a.streak?.length ?? 0));

  const { data: notesData } = await supabase
    .from("performance_notes")
    .select(
      `id, note, created_at,
       employee:profiles!performance_notes_employee_id_fkey (full_name, email)`
    )
    .order("created_at", { ascending: false })
    .limit(20);
  const notes = (notesData ?? []) as unknown as NoteRow[];
  const recentNotes = notes.slice(0, 3);
  const olderNotes = notes.slice(3);

  return (
    <div className="space-y-8">
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
      {/* Dos columnas: horario (principal) + panel de gestión           */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Columna izquierda: lo principal, el horario */}
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
            todayDate={todayDateOnly()}
          />
        </section>

        {/* Columna derecha: todo lo que requiere una decisión o acción del admin */}
        <div className="space-y-6">
          {/* Solicitudes pendientes -------------------------------------- */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Solicitudes pendientes {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </h2>
            {pendingRequests.length > 0 ? (
              <ul className="space-y-2.5">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-2.5">
                    <p className="text-sm font-medium text-foreground">
                      {r.employee?.full_name ?? r.employee?.email ?? "—"}
                    </p>
                    <p className="text-xs text-muted">
                      {TYPE_LABEL[r.request_type] ?? r.request_type} ·{" "}
                      {r.start_date === r.end_date
                        ? r.start_date
                        : `${r.start_date} → ${r.end_date}`}
                    </p>
                    {r.exception_reason && (
                      <Badge variant="warning" className="mt-1">
                        {EXCEPTION_LABEL[r.exception_reason] ?? r.exception_reason}
                      </Badge>
                    )}
                    <div className="mt-2 flex gap-2">
                      <form action={reviewTimeOffRequest.bind(null, r.id, "aprobada")}>
                        <button
                          type="submit"
                          className="rounded-md border border-success bg-success px-2 py-1 text-xs font-medium text-success-foreground hover:opacity-80"
                        >
                          Aprobar
                        </button>
                      </form>
                      <form action={reviewTimeOffRequest.bind(null, r.id, "rechazada")}>
                        <button
                          type="submit"
                          className="rounded-md border border-danger bg-danger px-2 py-1 text-xs font-medium text-danger-foreground hover:opacity-80"
                        >
                          Rechazar
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No hay solicitudes pendientes.</p>
            )}
            {decidedRequests.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
                  Ver historial ({decidedRequests.length})
                </summary>
                <ul className="mt-2 space-y-2">
                  {decidedRequests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-foreground">
                        {r.employee?.full_name ?? r.employee?.email ?? "—"} ·{" "}
                        {TYPE_LABEL[r.request_type] ?? r.request_type}
                      </span>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* Quién trabaja más ------------------------------------------- */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Horas trabajadas esta semana
            </h2>
            <WorkloadRanking rows={workloadRows} />
          </section>

          {/* Desgaste laboral ---------------------------------------------- */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-1 text-sm font-semibold text-foreground">
              Empleados en riesgo de desgaste
            </h2>
            <p className="mb-3 text-xs text-muted">
              {consecutiveDaysThreshold}+ días consecutivos con turno.
            </p>
            {atRiskRows.length > 0 ? (
              <ul className="space-y-2">
                {atRiskRows.map(({ employee, streak }) => (
                  <li key={employee.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-foreground">
                      {employee.full_name ?? employee.email}
                    </span>
                    <Badge variant="danger">{streak?.length} días</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nadie en riesgo esta semana.</p>
            )}
            {burnoutRows.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
                  Ver todos los empleados ({burnoutRows.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {burnoutRows.map(({ employee, streak }) => {
                    const length = streak?.length ?? 0;
                    const isBurnoutRisk = length >= consecutiveDaysThreshold;
                    return (
                      <li key={employee.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-foreground">
                          {employee.full_name ?? employee.email}
                        </span>
                        <span className={isBurnoutRisk ? "text-danger-foreground" : "text-muted"}>
                          {length} {length === 1 ? "día" : "días"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </section>

          {/* Anotaciones de desempeño --------------------------------------- */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Anotaciones de desempeño
            </h2>
            <form action={addPerformanceNote} className="space-y-2.5">
              <div>
                <label htmlFor="employee_id" className={`${labelClass} mb-1 text-xs`}>
                  Empleado
                </label>
                <select
                  id="employee_id"
                  name="employee_id"
                  required
                  defaultValue=""
                  className={`${inputClass} text-sm`}
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
                <label htmlFor="note" className={`${labelClass} mb-1 text-xs`}>
                  Anotación
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={2}
                  required
                  placeholder="Ej. Tercera tardanza esta semana en U2."
                  className={`${inputClass} text-sm`}
                />
              </div>
              <button type="submit" className={`${primaryButtonClass} w-full`}>
                Guardar anotación
              </button>
            </form>

            {recentNotes.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {recentNotes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border p-2.5 text-sm">
                    <p className="text-foreground">{n.note}</p>
                    <p className="mt-1 text-xs text-faint">
                      {n.employee?.full_name ?? n.employee?.email ?? "—"} ·{" "}
                      {new Date(n.created_at).toLocaleDateString("es-ES")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">Aún no hay anotaciones.</p>
            )}
            {olderNotes.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
                  Ver anotaciones anteriores ({olderNotes.length})
                </summary>
                <ul className="mt-2 space-y-2">
                  {olderNotes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-border p-2.5 text-sm">
                      <p className="text-foreground">{n.note}</p>
                      <p className="mt-1 text-xs text-faint">
                        {n.employee?.full_name ?? n.employee?.email ?? "—"} ·{" "}
                        {new Date(n.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
