import { createClient } from "@/utils/supabase/server";
import { SchedulePlanner } from "./SchedulePlanner";
import type { GridEmployee, GridShift } from "@/components/ScheduleGrid";
import type { SidebarEmployee } from "@/components/schedule/EmployeeSidebar";
import { longestConsecutiveStreak } from "@/lib/streak";
import {
  addDays,
  isoDayOfWeek,
  isoWeekNumber,
  formatWeekRangeLabel,
  mondayOf,
  todayDateOnly,
  weekDates,
  DAY_LABELS_SHORT,
} from "@/lib/dates";
import { hoursBetween } from "@/lib/hours";

const DEFAULT_CONSECUTIVE_DAYS_THRESHOLD = 5;

type Branch = { id: string; code: string; name: string };
type Employee = {
  id: string;
  full_name: string | null;
  email: string | null;
  area: string | null;
  weekly_contracted_hours: number | null;
  default_branch_id: string | null;
};
type Shift = {
  id: string;
  employee_id: string;
  branch_id: string;
  area: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  suggested: boolean;
};
type KitchenRule = { branch_id: string; day_of_week: number; min_staff: number };
type ServiceRule = {
  branch_id: string;
  day_of_week: number;
  entry_time: string;
  staff_count: number;
  note: string | null;
};
type TimeOffRow = {
  employee_id: string;
  request_type: string;
  status: string;
  start_date: string;
  end_date: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const monday = mondayOf(week ?? todayDateOnly());
  const dates = weekDates(monday);
  const weekStart = dates[0];
  const weekEnd = dates[6];
  const prevWeek = addDays(monday, -7);
  const nextWeek = addDays(monday, 7);
  const today = todayDateOnly();

  const supabase = await createClient();

  const [
    { data: branchesData, error: branchesError },
    { data: employeesData, error: employeesError },
    { data: shiftsData, error: shiftsError },
    { data: allShiftDatesData, error: allShiftDatesError },
    { data: kitchenRulesData, error: kitchenRulesError },
    { data: serviceRulesData, error: serviceRulesError },
    { data: timeOffData, error: timeOffError },
    { data: thresholdRule, error: thresholdError },
  ] = await Promise.all([
    supabase.from("branches").select("id, code, name").order("code"),
    supabase
      .from("profiles")
      .select("id, full_name, email, area, weekly_contracted_hours, default_branch_id")
      .eq("role", "employee")
      .order("full_name", { ascending: true }),
    supabase
      .from("shifts")
      .select("id, employee_id, branch_id, area, shift_date, start_time, end_time, suggested")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
    supabase.from("shifts").select("employee_id, shift_date"),
    supabase.from("kitchen_staffing_requirements").select("branch_id, day_of_week, min_staff"),
    supabase
      .from("service_entry_schedules")
      .select("branch_id, day_of_week, entry_time, staff_count, note"),
    supabase
      .from("time_off_requests")
      .select("employee_id, request_type, status, start_date, end_date")
      .in("request_type", ["dia_libre", "vacaciones"])
      .in("status", ["aprobada", "pendiente"])
      .lte("start_date", weekEnd)
      .gte("end_date", weekStart),
    supabase
      .from("business_rules")
      .select("value")
      .eq("key", "umbral_dias_consecutivos")
      .maybeSingle(),
  ]);

  for (const [label, error] of [
    ["branches", branchesError],
    ["employees", employeesError],
    ["shifts", shiftsError],
    ["allShiftDates", allShiftDatesError],
    ["kitchenRules", kitchenRulesError],
    ["serviceRules", serviceRulesError],
    ["timeOff", timeOffError],
    ["threshold", thresholdError],
  ] as const) {
    if (error) console.error(`AdminSchedulePage ${label} error:`, error);
  }

  const branches = (branchesData ?? []) as Branch[];
  const employees = (employeesData ?? []) as Employee[];
  const shifts = (shiftsData ?? []) as Shift[];
  const kitchenRules = (kitchenRulesData ?? []) as KitchenRule[];
  const serviceRules = (serviceRulesData ?? []) as ServiceRule[];
  const timeOffRows = (timeOffData ?? []) as TimeOffRow[];
  const consecutiveDaysThreshold =
    (thresholdRule?.value as number | undefined) ?? DEFAULT_CONSECUTIVE_DAYS_THRESHOLD;

  const branchById = new Map(branches.map((b) => [b.id, b]));

  // ------------------------------------------------------------------
  // Cobertura mínima de cocina y de servicio (para el resumen y el detalle
  // colapsado al pie de la grilla).
  // ------------------------------------------------------------------
  const kitchenRuleMap = new Map(
    kitchenRules.map((r) => [`${r.branch_id}_${r.day_of_week}`, r.min_staff])
  );
  const kitchenCoverage = branches.map((branch) => ({
    branchCode: branch.code,
    branchName: branch.name,
    days: dates.map((date) => {
      const dow = isoDayOfWeek(date);
      const required = kitchenRuleMap.get(`${branch.id}_${dow}`) ?? null;
      const assigned = shifts.filter(
        (s) => s.branch_id === branch.id && s.shift_date === date && s.area === "cocina"
      ).length;
      return { date, required, assigned };
    }),
  }));

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
          branchName: branchById.get(r.branch_id)?.name ?? "—",
          entryTime: r.entry_time,
          required: r.staff_count,
          assigned,
          note: r.note,
        };
      });
  });

  const unassignedCount =
    kitchenCoverage.reduce(
      (sum, row) =>
        sum + row.days.reduce((s, d) => s + Math.max(0, (d.required ?? 0) - d.assigned), 0),
      0
    ) +
    serviceCoverage.reduce((sum, row) => sum + Math.max(0, row.required - row.assigned), 0);

  // ------------------------------------------------------------------
  // Días libres / vacaciones dentro de la semana -> una entrada por día
  // cubierto, para bloquear esas celdas en la grilla.
  // ------------------------------------------------------------------
  const dayOffByEmployeeDate = new Map<string, "aprobada" | "pendiente">();
  for (const row of timeOffRows) {
    for (const date of dates) {
      if (date >= row.start_date && date <= row.end_date) {
        const key = `${row.employee_id}_${date}`;
        // Aprobada gana sobre pendiente si hubiera ambas (no debería pasar).
        if (row.status === "aprobada" || !dayOffByEmployeeDate.has(key)) {
          dayOffByEmployeeDate.set(key, row.status as "aprobada" | "pendiente");
        }
      }
    }
  }
  const approvedDaysOff = Array.from(dayOffByEmployeeDate.values()).filter(
    (s) => s === "aprobada"
  ).length;

  // ------------------------------------------------------------------
  // Rachas de días consecutivos trabajados, con todo el historial de turnos
  // (no solo la semana visible) — igual que en el dashboard.
  // ------------------------------------------------------------------
  const shiftDatesByEmployee = new Map<string, string[]>();
  for (const s of allShiftDatesData ?? []) {
    const list = shiftDatesByEmployee.get(s.employee_id) ?? [];
    list.push(s.shift_date);
    shiftDatesByEmployee.set(s.employee_id, list);
  }
  const streakByEmployee = new Map(
    employees.map((e) => [e.id, longestConsecutiveStreak(shiftDatesByEmployee.get(e.id) ?? [])])
  );
  const burnoutAlerts = Array.from(streakByEmployee.values()).filter(
    (s) => (s?.length ?? 0) >= consecutiveDaysThreshold
  ).length;

  // ------------------------------------------------------------------
  // Turnos de la semana, indexados por empleado+fecha, y conteo por día.
  // ------------------------------------------------------------------
  const shiftsRecord: Record<string, GridShift[]> = {};
  const dayShiftCountsRecord: Record<string, number> = {};
  for (const s of shifts) {
    const key = `${s.employee_id}_${s.shift_date}`;
    const list = shiftsRecord[key] ?? [];
    list.push({
      id: s.id,
      branchCode: branchById.get(s.branch_id)?.code ?? "?",
      startTime: s.start_time,
      endTime: s.end_time,
      area: s.area as "servicio" | "cocina",
      suggested: s.suggested,
    });
    shiftsRecord[key] = list;
    dayShiftCountsRecord[s.shift_date] = (dayShiftCountsRecord[s.shift_date] ?? 0) + 1;
  }

  const gridEmployees: GridEmployee[] = employees.map((e) => ({
    id: e.id,
    name: e.full_name ?? e.email ?? "—",
    area: e.area as "servicio" | "cocina" | null,
    defaultBranchId: e.default_branch_id,
  }));

  const contractedHoursByEmployee: Record<string, number> = {};
  for (const e of employees) {
    contractedHoursByEmployee[e.id] = e.weekly_contracted_hours ?? 40;
  }

  const sidebarEmployees: SidebarEmployee[] = employees.map((e) => {
    let hoursWorked = 0;
    let shiftsCount = 0;
    for (const date of dates) {
      const dayShifts = shiftsRecord[`${e.id}_${date}`] ?? [];
      shiftsCount += dayShifts.length;
      for (const s of dayShifts) hoursWorked += hoursBetween(s.startTime, s.endTime);
    }
    const streak = streakByEmployee.get(e.id) ?? null;
    const atRisk = (streak?.length ?? 0) >= consecutiveDaysThreshold;
    const upcomingDayOff = dates.find(
      (d) => dayOffByEmployeeDate.get(`${e.id}_${d}`) === "aprobada"
    );
    return {
      id: e.id,
      name: e.full_name ?? e.email ?? "—",
      initials: initialsFromName(e.full_name ?? e.email ?? "?"),
      area: e.area as "servicio" | "cocina" | null,
      hoursWorked,
      hoursContracted: e.weekly_contracted_hours ?? 40,
      shiftsCount,
      streakDays: streak?.length ?? null,
      atRisk,
      dayOffLabel: upcomingDayOff
        ? `libre ${DAY_LABELS_SHORT[isoDayOfWeek(upcomingDayOff)].toLowerCase()}`
        : null,
    };
  });

  const dayOffRecord: Record<string, "aprobada" | "pendiente"> = Object.fromEntries(
    dayOffByEmployeeDate
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Planificador de turnos</h1>

      <SchedulePlanner
        dates={dates}
        todayDate={today}
        weekLabel={formatWeekRangeLabel(dates)}
        weekSublabel={`Semana ${isoWeekNumber(monday)} · ${monday.slice(0, 4)}`}
        prevHref={`/admin/schedule?week=${prevWeek}`}
        nextHref={`/admin/schedule?week=${nextWeek}`}
        todayHref={`/admin/schedule?week=${mondayOf(today)}`}
        currentWeek={monday}
        branches={branches}
        employees={gridEmployees}
        shiftsRecord={shiftsRecord}
        dayOffRecord={dayOffRecord}
        dayShiftCountsRecord={dayShiftCountsRecord}
        contractedHoursByEmployee={contractedHoursByEmployee}
        sidebarEmployees={sidebarEmployees}
        summary={{
          covered: shifts.length,
          total: shifts.length + unassignedCount,
          unassigned: unassignedCount,
          approvedDaysOff,
          burnoutAlerts,
        }}
        kitchenCoverage={kitchenCoverage}
        serviceCoverage={serviceCoverage}
      />
    </div>
  );
}
