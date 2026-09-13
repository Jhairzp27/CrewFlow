import { createClient } from "@/utils/supabase/server";
import { TimeOffRequestForm } from "./RequestForm";
import { cancelTimeOffRequest } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Badge } from "@/components/Badge";
import { ScheduleGrid, type GridEmployee, type GridShift } from "@/components/ScheduleGrid";
import { mondayOf, todayDateOnly, weekDates } from "@/lib/dates";

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

type ShiftRow = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  branch: { code: string } | null;
};

export default async function EmployeeSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const monday = mondayOf(todayDateOnly());
  const dates = weekDates(monday);

  const [{ data: profile }, { data: requests }, { data: shiftsData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, area")
        .eq("id", user?.id ?? "")
        .single(),
      supabase
        .from("time_off_requests")
        .select(
          "id, request_type, status, start_date, end_date, start_time, end_time"
        )
        .eq("employee_id", user?.id ?? "")
        .order("created_at", { ascending: false }),
      supabase
        .from("shifts")
        .select("id, shift_date, start_time, end_time, branch:branches (code)")
        .eq("employee_id", user?.id ?? "")
        .gte("shift_date", dates[0])
        .lte("shift_date", dates[6])
        .order("start_time", { ascending: true }),
    ]);

  const shifts = (shiftsData ?? []) as unknown as ShiftRow[];

  const shiftsByEmployeeDate = new Map<string, GridShift[]>();
  for (const s of shifts) {
    const key = `${user?.id}_${s.shift_date}`;
    const list = shiftsByEmployeeDate.get(key) ?? [];
    list.push({
      id: s.id,
      branchCode: s.branch?.code ?? "?",
      startTime: s.start_time,
      endTime: s.end_time,
    });
    shiftsByEmployeeDate.set(key, list);
  }

  const gridEmployees: GridEmployee[] = profile?.area
    ? [
        {
          id: user?.id ?? "",
          name: profile.full_name ?? user?.email ?? "Yo",
          area: profile.area as "servicio" | "cocina",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mi horario</h1>
        <p className="text-sm text-muted">
          Sesión iniciada como {user?.email}.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Mi turno de esta semana ({dates[0]} → {dates[6]})
        </h2>
        {gridEmployees.length > 0 ? (
          <ScheduleGrid
            dates={dates}
            employees={gridEmployees}
            shiftsByEmployeeDate={shiftsByEmployeeDate}
          />
        ) : (
          <p className="text-sm text-muted">
            Tu perfil todavía no tiene un área asignada (Servicio/Cocina) —
            pídele al administrador que la configure.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Solicitar permiso o vacaciones
        </h2>
        <TimeOffRequestForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Mis solicitudes
        </h2>
        {requests && requests.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
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
                      {TYPE_LABEL[r.request_type] ?? r.request_type}
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
                    <td className="px-4 py-2 text-right">
                      {r.status === "pendiente" && (
                        <form action={cancelTimeOffRequest.bind(null, r.id)}>
                          <ConfirmButton
                            confirmMessage="¿Cancelar esta solicitud?"
                            className="text-xs font-medium text-danger-foreground hover:underline"
                          >
                            Cancelar
                          </ConfirmButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Aún no tienes solicitudes registradas.
          </p>
        )}
      </section>
    </div>
  );
}
