import { createClient } from "@/utils/supabase/server";
import { hoursBetween } from "@/lib/hours";
import { DAY_LABELS_SHORT, isoDayOfWeek, todayDateOnly } from "@/lib/dates";
import { BarList, type BarListRow } from "@/components/analytics/BarList";
import { ColumnChart, type ColumnChartBar } from "@/components/analytics/ColumnChart";

type Employee = { id: string; full_name: string | null; email: string | null };
type Shift = { employee_id: string; shift_date: string; start_time: string; end_time: string };
type Absence = { employee_id: string; start_date: string; end_date: string };

const HOUR_RANGE = { start: 6, end: 23 }; // ventana horaria del negocio para "picos horarios"

function countDaysInRange(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.round((endMs - startMs) / 86400000) + 1;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [{ data: employeesData }, { data: shiftsData }, { data: absencesData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("role", "employee"),
    supabase.from("shifts").select("employee_id, shift_date, start_time, end_time"),
    supabase
      .from("time_off_requests")
      .select("employee_id, start_date, end_date")
      .eq("status", "aprobada")
      .in("request_type", ["dia_libre", "vacaciones"]),
  ]);

  const employees = (employeesData ?? []) as Employee[];
  const shifts = (shiftsData ?? []) as Shift[];
  const absences = (absencesData ?? []) as Absence[];
  const nameById = new Map(employees.map((e) => [e.id, e.full_name ?? e.email ?? "—"]));

  const earliestShiftDate = shifts.reduce<string | null>(
    (min, s) => (min === null || s.shift_date < min ? s.shift_date : min),
    null
  );

  // ---- Ranking: horas trabajadas (todo el historial cargado) ----
  const hoursByEmployee = new Map<string, number>();
  for (const s of shifts) {
    hoursByEmployee.set(s.employee_id, (hoursByEmployee.get(s.employee_id) ?? 0) + hoursBetween(s.start_time, s.end_time));
  }
  const hoursRanking: BarListRow[] = Array.from(hoursByEmployee.entries())
    .map(([id, value]) => ({ id, label: nameById.get(id) ?? "—", value }))
    .sort((a, b) => b.value - a.value);

  // ---- Ranking: días libres tomados (aprobados) ----
  const daysOffByEmployee = new Map<string, number>();
  for (const a of absences) {
    daysOffByEmployee.set(
      a.employee_id,
      (daysOffByEmployee.get(a.employee_id) ?? 0) + countDaysInRange(a.start_date, a.end_date)
    );
  }
  const daysOffRanking: BarListRow[] = employees
    .map((e) => ({ id: e.id, label: e.full_name ?? e.email ?? "—", value: daysOffByEmployee.get(e.id) ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  // ---- Picos horarios: turnos que inician en cada hora del día ----
  const countByHour = new Map<number, number>();
  for (const s of shifts) {
    const hour = Number(s.start_time.slice(0, 2));
    countByHour.set(hour, (countByHour.get(hour) ?? 0) + 1);
  }
  const hourBars: ColumnChartBar[] = [];
  for (let h = HOUR_RANGE.start; h <= HOUR_RANGE.end; h++) {
    hourBars.push({ label: `${h}h`, value: countByHour.get(h) ?? 0 });
  }

  // ---- Días más concurridos de la semana (Lunes..Domingo, todo el historial) ----
  const countByDow = new Map<number, number>();
  for (const s of shifts) {
    const dow = isoDayOfWeek(s.shift_date);
    countByDow.set(dow, (countByDow.get(dow) ?? 0) + 1);
  }
  const todayDow = isoDayOfWeek(todayDateOnly());
  const dowBars: ColumnChartBar[] = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({
    label: DAY_LABELS_SHORT[dow],
    value: countByDow.get(dow) ?? 0,
    highlight: dow === todayDow,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analítica</h1>
        <p className="text-sm text-muted">
          {earliestShiftDate
            ? `Con datos desde ${earliestShiftDate} hasta hoy — se acumula a medida que se cargan más semanas.`
            : "Todavía no hay turnos cargados — importa un Excel o asigna turnos para empezar a ver patrones."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Quién trabaja más</h2>
          <p className="mb-3 text-xs text-muted">Horas totales trabajadas, todo el historial cargado.</p>
          <BarList rows={hoursRanking} formatValue={(v) => `${Math.round(v * 10) / 10} h`} />
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Quién tiene más días libres</h2>
          <p className="mb-3 text-xs text-muted">Días libres y vacaciones aprobados, todo el historial.</p>
          <BarList
            rows={daysOffRanking}
            formatValue={(v) => `${v} ${v === 1 ? "día" : "días"}`}
            emptyLabel="Nadie tiene días libres aprobados todavía."
          />
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Picos horarios</h2>
          <p className="mb-3 text-xs text-muted">Turnos según su hora de inicio (ventana {HOUR_RANGE.start}:00–{HOUR_RANGE.end}:00).</p>
          <ColumnChart bars={hourBars} />
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Días más concurridos</h2>
          <p className="mb-3 text-xs text-muted">Total de turnos por día de la semana, todo el historial.</p>
          <ColumnChart bars={dowBars} />
        </section>
      </div>
    </div>
  );
}
