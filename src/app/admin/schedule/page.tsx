import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions";
import { deleteShift } from "./actions";
import { ShiftForm, type EditingShift } from "./ShiftForm";
import {
  DAY_LABELS,
  addDays,
  isoDayOfWeek,
  mondayOf,
  todayDateOnly,
  weekDates,
} from "@/lib/dates";

const AREA_LABEL: Record<string, string> = {
  servicio: "Servicio",
  cocina: "Cocina",
};

type Branch = { id: string; code: string; name: string };
type Employee = { id: string; full_name: string | null; email: string | null };
type Shift = {
  id: string;
  employee_id: string;
  branch_id: string;
  area: string;
  shift_date: string;
  start_time: string;
  end_time: string;
};
type KitchenRule = { branch_id: string; day_of_week: number; min_staff: number };
type ServiceRule = {
  branch_id: string;
  day_of_week: number;
  entry_time: string;
  staff_count: number;
  note: string | null;
};

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; edit?: string }>;
}) {
  const { week, edit } = await searchParams;
  const monday = mondayOf(week ?? todayDateOnly());
  const dates = weekDates(monday);
  const weekStart = dates[0];
  const weekEnd = dates[6];
  const prevWeek = addDays(monday, -7);
  const nextWeek = addDays(monday, 7);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: branchesData, error: branchesError },
    { data: employeesData, error: employeesError },
    { data: shiftsData, error: shiftsError },
    { data: kitchenRulesData, error: kitchenRulesError },
    { data: serviceRulesData, error: serviceRulesError },
  ] = await Promise.all([
    supabase.from("branches").select("id, code, name").order("code"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "employee")
      .order("full_name", { ascending: true }),
    supabase
      .from("shifts")
      .select("id, employee_id, branch_id, area, shift_date, start_time, end_time")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
    supabase
      .from("kitchen_staffing_requirements")
      .select("branch_id, day_of_week, min_staff"),
    supabase
      .from("service_entry_schedules")
      .select("branch_id, day_of_week, entry_time, staff_count, note"),
  ]);

  for (const [label, error] of [
    ["branches", branchesError],
    ["employees", employeesError],
    ["shifts", shiftsError],
    ["kitchenRules", kitchenRulesError],
    ["serviceRules", serviceRulesError],
  ] as const) {
    if (error) console.error(`AdminSchedulePage ${label} error:`, error);
  }

  const branches = (branchesData ?? []) as Branch[];
  const employees = (employeesData ?? []) as Employee[];
  const shifts = (shiftsData ?? []) as Shift[];
  const kitchenRules = (kitchenRulesData ?? []) as KitchenRule[];
  const serviceRules = (serviceRulesData ?? []) as ServiceRule[];

  const branchById = new Map(branches.map((b) => [b.id, b]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const shiftsByEmployeeDate = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${s.employee_id}_${s.shift_date}`;
    const list = shiftsByEmployeeDate.get(key) ?? [];
    list.push(s);
    shiftsByEmployeeDate.set(key, list);
  }

  const editingShift: EditingShift | null = edit
    ? shifts.find((s) => s.id === edit) ?? null
    : null;
  const cancelEditHref = `/admin/schedule?week=${monday}`;

  // Cobertura mínima de cocina: sucursal x día de la semana.
  const kitchenRuleMap = new Map(
    kitchenRules.map((r) => [`${r.branch_id}_${r.day_of_week}`, r.min_staff])
  );
  const kitchenCoverage = branches.map((branch) => ({
    branch,
    days: dates.map((date) => {
      const dow = isoDayOfWeek(date);
      const required = kitchenRuleMap.get(`${branch.id}_${dow}`) ?? null;
      const assigned = shifts.filter(
        (s) => s.branch_id === branch.id && s.shift_date === date && s.area === "cocina"
      ).length;
      return { date, required, assigned };
    }),
  }));

  // Cobertura de servicio: cada horario de ingreso definido para ese día.
  const serviceCoverage = dates.flatMap((date) => {
    const dow = isoDayOfWeek(date);
    return serviceRules
      .filter((r) => r.day_of_week === dow)
      .map((r) => {
        const assigned = shifts.filter(
          (s) =>
            s.branch_id === r.branch_id &&
            s.shift_date === date &&
            s.area === "servicio" &&
            s.start_time === r.entry_time
        ).length;
        return {
          date,
          branch: branchById.get(r.branch_id),
          entryTime: r.entry_time,
          required: r.staff_count,
          assigned,
          note: r.note,
        };
      });
  });

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Planificador de turnos
            </h1>
            <Link
              href="/admin/dashboard"
              className="text-sm text-gray-500 hover:underline"
            >
              ← Panel del administrador
            </Link>
            <Link
              href="/admin/schedule/import"
              className="text-sm text-gray-500 hover:underline"
            >
              Importar desde Excel →
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
        {/* Navegación de semana                                          */}
        {/* ------------------------------------------------------------ */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <Link
            href={`/admin/schedule?week=${prevWeek}`}
            className="text-sm font-medium text-gray-700 hover:underline"
          >
            ← Semana anterior
          </Link>
          <span className="text-sm font-semibold text-gray-900">
            {weekStart} → {weekEnd}
          </span>
          <Link
            href={`/admin/schedule?week=${nextWeek}`}
            className="text-sm font-medium text-gray-700 hover:underline"
          >
            Semana siguiente →
          </Link>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* Cobertura mínima de cocina                                    */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Cobertura mínima de cocina
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Sucursal</th>
                  {dates.map((date) => (
                    <th key={date} className="px-4 py-2 font-medium">
                      {DAY_LABELS[isoDayOfWeek(date)]}
                      <div className="font-normal text-gray-400">{date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kitchenCoverage.map(({ branch, days }) => (
                  <tr key={branch.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {branch.name}
                    </td>
                    {days.map(({ date, required, assigned }) => {
                      const short = required !== null && assigned < required;
                      return (
                        <td key={date} className="px-4 py-2">
                          {required === null ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                short
                                  ? "bg-red-50 text-red-700"
                                  : "bg-green-50 text-green-700"
                              }`}
                            >
                              {assigned}/{required}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Cobertura de servicio (horarios de ingreso)                   */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Cobertura de servicio (horarios de ingreso)
          </h2>
          {serviceCoverage.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Sucursal</th>
                    <th className="px-4 py-2 font-medium">Ingreso</th>
                    <th className="px-4 py-2 font-medium">Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {serviceCoverage.map((row, i) => {
                    const short = row.assigned < row.required;
                    return (
                      <tr key={i}>
                        <td className="px-4 py-2 text-gray-500">
                          {DAY_LABELS[isoDayOfWeek(row.date)]} {row.date}
                        </td>
                        <td className="px-4 py-2 text-gray-900">
                          {row.branch?.name ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {row.entryTime.slice(0, 5)}
                          {row.note ? ` (${row.note})` : ""}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              short
                                ? "bg-red-50 text-red-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {row.assigned}/{row.required}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No hay horarios de ingreso configurados para esta semana.
            </p>
          )}
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Asignar turno                                                 */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            {editingShift ? "Editar turno" : "Asignar turno"}
          </h2>
          <ShiftForm
            key={editingShift?.id ?? "create"}
            employees={employees}
            branches={branches}
            defaultDate={monday}
            currentWeek={monday}
            editingShift={editingShift}
            cancelHref={cancelEditHref}
          />
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Turnos de la semana (empleado x día)                          */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Turnos de la semana
          </h2>
          {employees.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Empleado</th>
                    {dates.map((date) => (
                      <th key={date} className="px-4 py-2 font-medium">
                        {DAY_LABELS[isoDayOfWeek(date)]}
                        <div className="font-normal text-gray-400">{date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {emp.full_name ?? emp.email}
                      </td>
                      {dates.map((date) => {
                        const cellShifts =
                          shiftsByEmployeeDate.get(`${emp.id}_${date}`) ?? [];
                        return (
                          <td key={date} className="px-4 py-2 align-top">
                            <div className="flex flex-col gap-1">
                              {cellShifts.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
                                >
                                  <span>
                                    {branchById.get(s.branch_id)?.code ?? "?"} ·{" "}
                                    {AREA_LABEL[s.area] ?? s.area} ·{" "}
                                    {s.start_time.slice(0, 5)}-
                                    {s.end_time.slice(0, 5)}
                                  </span>
                                  <Link
                                    href={`/admin/schedule?week=${monday}&edit=${s.id}`}
                                    className="text-gray-400 hover:text-blue-600"
                                    aria-label="Editar turno"
                                  >
                                    ✎
                                  </Link>
                                  <form action={deleteShift.bind(null, s.id)}>
                                    <button
                                      type="submit"
                                      className="text-gray-400 hover:text-red-600"
                                      aria-label="Eliminar turno"
                                    >
                                      ×
                                    </button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No hay empleados registrados todavía.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
