import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions";
import { TimeOffRequestForm } from "./RequestForm";
import { cancelTimeOffRequest } from "./actions";
import { DAY_LABELS, isoDayOfWeek, mondayOf, todayDateOnly, weekDates } from "@/lib/dates";

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

const AREA_LABEL: Record<string, string> = {
  servicio: "Servicio",
  cocina: "Cocina",
};

type ShiftRow = {
  id: string;
  area: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  branch: { code: string; name: string } | null;
};

export default async function EmployeeSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const monday = mondayOf(todayDateOnly());
  const dates = weekDates(monday);

  const { data: requests } = await supabase
    .from("time_off_requests")
    .select(
      "id, request_type, status, start_date, end_date, start_time, end_time"
    )
    .eq("employee_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const { data: shiftsData } = await supabase
    .from("shifts")
    .select("id, area, shift_date, start_time, end_time, branch:branches (code, name)")
    .eq("employee_id", user?.id ?? "")
    .gte("shift_date", dates[0])
    .lte("shift_date", dates[6])
    .order("start_time", { ascending: true });
  const shifts = (shiftsData ?? []) as unknown as ShiftRow[];

  const shiftsByDate = new Map<string, ShiftRow[]>();
  for (const s of shifts) {
    const list = shiftsByDate.get(s.shift_date) ?? [];
    list.push(s);
    shiftsByDate.set(s.shift_date, list);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Mi Horario</h1>
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

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Mi turno de esta semana ({dates[0]} → {dates[6]})
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {dates.map((date) => {
                const dayShifts = shiftsByDate.get(date) ?? [];
                return (
                  <li
                    key={date}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {DAY_LABELS[isoDayOfWeek(date)]}
                      </span>{" "}
                      <span className="text-gray-400">{date}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {dayShifts.length > 0 ? (
                        dayShifts.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                          >
                            {s.branch?.name ?? "—"} ·{" "}
                            {AREA_LABEL[s.area] ?? s.area} ·{" "}
                            {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">
                          Sin turno asignado
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Solicitar permiso o vacaciones
          </h2>
          <TimeOffRequestForm />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Mis solicitudes
          </h2>
          {requests && requests.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
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
                        {TYPE_LABEL[r.request_type] ?? r.request_type}
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
                      <td className="px-4 py-2 text-right">
                        {r.status === "pendiente" && (
                          <form action={cancelTimeOffRequest.bind(null, r.id)}>
                            <button
                              type="submit"
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              Cancelar
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aún no tienes solicitudes registradas.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
