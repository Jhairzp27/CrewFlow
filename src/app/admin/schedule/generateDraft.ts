"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { longestConsecutiveStreak } from "@/lib/streak";
import { hoursBetween } from "@/lib/hours";
import { isoDayOfWeek, weekDates } from "@/lib/dates";

// =====================================================================
// Genera un borrador de horario para la semana: llena los huecos de
// cobertura de SERVICIO (los que tienen hora de ingreso definida en
// service_entry_schedules) según las reglas de negocio confirmadas con
// el administrador del negocio:
//   - un empleado con sucursal fija (profiles.default_branch_id) solo se
//     asigna a esa sucursal; uno sin sucursal fija es elegible para ambas.
//   - la apertura del día (el ingreso más temprano de cada sucursal) se
//     reparte al azar, pero pesado hacia quien menos ha abierto en el
//     historial — "aleatorio equiparando entre todos".
//   - el resto de los huecos se llenan por menor desgaste (racha de días
//     consecutivos más corta, luego menos horas acumuladas esa semana).
//   - respeta los días libres garantizados por semana (business_rules
//     "dias_libres_por_semana"); si no queda otra opción, igual asigna
//     pero lo reporta en el resumen — nunca en silencio.
//
// COCINA no se auto-asigna en esta versión: kitchen_staffing_requirements
// solo define un mínimo de personal por día, sin franja horaria, así que
// no hay una hora de inicio/fin que inventar sin arriesgar datos falsos.
// Esos huecos se siguen mostrando en "Sin asignar" para asignación manual.
//
// El resultado son turnos reales (iguales a los creados a mano) — el
// admin los aprueba o ajusta con los mismos controles de editar/eliminar
// del planificador, tal como se pidió.
// =====================================================================

const DEFAULT_CLOSING_TIME = "22:00";
const DEFAULT_REST_DAYS_PER_WEEK = 2;

type Branch = { id: string; code: string };
type Employee = {
  id: string;
  full_name: string | null;
  area: "servicio" | "cocina" | null;
  default_branch_id: string | null;
};
type ServiceRule = {
  branch_id: string;
  day_of_week: number;
  entry_time: string;
  staff_count: number;
};
type ExistingShift = {
  id: string;
  employee_id: string;
  branch_id: string;
  area: string;
  shift_date: string;
  start_time: string;
  end_time: string;
};
type Absence = { employee_id: string; start_date: string; end_date: string };

export type GenerateDraftState = {
  error: string | null;
  summary: {
    shiftsCreated: number;
    kitchenGapsRemaining: number;
    unfilledSlots: { date: string; branchCode: string; entryTime: string; missing: number }[];
    restRuleOverrides: string[];
    branchFilterApplied: string | null;
  } | null;
};

function weightedRandomPick<T>(pool: T[], weightOf: (item: T) => number): T {
  const weights = pool.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export async function generateScheduleDraft(
  _prevState: GenerateDraftState,
  formData: FormData
): Promise<GenerateDraftState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión.", summary: null };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (adminProfile?.role !== "admin") {
    return { error: "Solo un administrador puede generar el borrador.", summary: null };
  }

  const monday = formData.get("week") as string;
  if (!monday) return { error: "Semana inválida.", summary: null };
  const dates = weekDates(monday);
  const weekStart = dates[0];
  const weekEnd = dates[6];
  const branchFilterCode = formData.get("branch_filter") as string | null;

  const [
    { data: branchesData },
    { data: employeesData },
    { data: serviceRulesData },
    { data: kitchenRulesData },
    { data: weekShiftsData },
    { data: allShiftDatesData },
    { data: allServiceShiftsData },
    { data: absencesData },
    { data: restDaysRule },
    { data: closingTimeRule },
  ] = await Promise.all([
    supabase.from("branches").select("id, code"),
    supabase
      .from("profiles")
      .select("id, full_name, area, default_branch_id")
      .eq("role", "employee"),
    supabase
      .from("service_entry_schedules")
      .select("branch_id, day_of_week, entry_time, staff_count"),
    supabase.from("kitchen_staffing_requirements").select("branch_id, day_of_week, min_staff"),
    supabase
      .from("shifts")
      .select("id, employee_id, branch_id, area, shift_date, start_time, end_time")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
    supabase.from("shifts").select("employee_id, shift_date"),
    supabase.from("shifts").select("employee_id, branch_id, shift_date, start_time").eq("area", "servicio"),
    supabase
      .from("time_off_requests")
      .select("employee_id, start_date, end_date")
      .eq("status", "aprobada")
      .in("request_type", ["dia_libre", "vacaciones"])
      .lte("start_date", weekEnd)
      .gte("end_date", weekStart),
    supabase.from("business_rules").select("value").eq("key", "dias_libres_por_semana").maybeSingle(),
    supabase.from("business_rules").select("value").eq("key", "hora_cierre_default").maybeSingle(),
  ]);

  const branches = (branchesData ?? []) as Branch[];
  const employees = (employeesData ?? []) as Employee[];
  const serviceRules = (serviceRulesData ?? []) as ServiceRule[];
  const kitchenRules = (kitchenRulesData ?? []) as { branch_id: string; day_of_week: number; min_staff: number }[];
  const weekShifts = (weekShiftsData ?? []) as ExistingShift[];
  const absences = (absencesData ?? []) as Absence[];
  const restDaysPerWeek = (restDaysRule?.value as number | undefined) ?? DEFAULT_REST_DAYS_PER_WEEK;
  const closingTime = (closingTimeRule?.value as string | undefined) ?? DEFAULT_CLOSING_TIME;
  const maxWorkDaysPerWeek = 7 - restDaysPerWeek;

  const branchById = new Map(branches.map((b) => [b.id, b]));

  // Si el admin tenía un filtro de sucursal activo en el planificador, el
  // borrador solo llena huecos de esa sucursal — no tiene sentido generar
  // turnos para U3 mientras se está mirando solo U2.
  const targetBranches =
    branchFilterCode && branchFilterCode !== "todas"
      ? branches.filter((b) => b.code === branchFilterCode)
      : branches;

  // Reglas de servicio agrupadas por sucursal+día, ordenadas por hora — la
  // primera de cada grupo es la "apertura".
  const rulesByBranchDay = new Map<string, ServiceRule[]>();
  for (const r of serviceRules) {
    const key = `${r.branch_id}_${r.day_of_week}`;
    const list = rulesByBranchDay.get(key) ?? [];
    list.push(r);
    rulesByBranchDay.set(key, list);
  }
  for (const list of rulesByBranchDay.values()) list.sort((a, b) => a.entry_time.localeCompare(b.entry_time));

  function hasApprovedAbsence(employeeId: string, date: string): boolean {
    return absences.some((a) => a.employee_id === employeeId && a.start_date <= date && a.end_date >= date);
  }

  // Turnos ya asignados esta semana: por slot exacto (para saber cuánto
  // falta) y por empleado+día (para no asignarle dos turnos el mismo día).
  const assignedCountBySlot = new Map<string, number>();
  const assignedEmployeesByDate = new Map<string, Set<string>>();
  const weekShiftCountByEmployee = new Map<string, number>();
  const weekHoursByEmployee = new Map<string, number>();
  for (const s of weekShifts) {
    const slotKey = `${s.branch_id}_${s.shift_date}_${s.start_time}`;
    assignedCountBySlot.set(slotKey, (assignedCountBySlot.get(slotKey) ?? 0) + 1);
    const set = assignedEmployeesByDate.get(s.shift_date) ?? new Set<string>();
    set.add(s.employee_id);
    assignedEmployeesByDate.set(s.shift_date, set);
    weekShiftCountByEmployee.set(s.employee_id, (weekShiftCountByEmployee.get(s.employee_id) ?? 0) + 1);
    weekHoursByEmployee.set(
      s.employee_id,
      (weekHoursByEmployee.get(s.employee_id) ?? 0) + hoursBetween(s.start_time, s.end_time)
    );
  }

  // Historial completo de fechas trabajadas por empleado, para calcular
  // racha (desgaste) — se va actualizando en memoria a medida que el
  // algoritmo asigna turnos nuevos, para repartir parejo dentro de la
  // misma corrida.
  const shiftDatesByEmployee = new Map<string, string[]>();
  for (const s of allShiftDatesData ?? []) {
    const list = shiftDatesByEmployee.get(s.employee_id) ?? [];
    list.push(s.shift_date);
    shiftDatesByEmployee.set(s.employee_id, list);
  }
  function streakLength(employeeId: string): number {
    return longestConsecutiveStreak(shiftDatesByEmployee.get(employeeId) ?? [])?.length ?? 0;
  }

  // Cuántas veces ha abierto cada empleado en el historial (su turno
  // coincidía con la hora de ingreso más temprana de esa sucursal ese
  // día de la semana) — para repartir las aperturas parejo.
  const opensCountByEmployee = new Map<string, number>();
  for (const s of allServiceShiftsData ?? []) {
    const dow = isoDayOfWeek(s.shift_date);
    const openingTime = rulesByBranchDay.get(`${s.branch_id}_${dow}`)?.[0]?.entry_time;
    if (openingTime && s.start_time === openingTime) {
      opensCountByEmployee.set(s.employee_id, (opensCountByEmployee.get(s.employee_id) ?? 0) + 1);
    }
  }

  const rowsToInsert: {
    employee_id: string;
    branch_id: string;
    area: "servicio";
    shift_date: string;
    start_time: string;
    end_time: string;
    suggested: true;
  }[] = [];
  const unfilledSlots: { date: string; branchCode: string; entryTime: string; missing: number }[] = [];
  const restRuleOverrides: string[] = [];

  for (const date of dates) {
    const dow = isoDayOfWeek(date);
    for (const branch of targetBranches) {
      const rules = rulesByBranchDay.get(`${branch.id}_${dow}`) ?? [];
      const openingTime = rules[0]?.entry_time;

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const slotKey = `${branch.id}_${date}_${rule.entry_time}`;
        const already = assignedCountBySlot.get(slotKey) ?? 0;
        const missing = rule.staff_count - already;
        if (missing <= 0) continue;

        const endTime = rules[i + 1]?.entry_time ?? closingTime;
        const isOpening = rule.entry_time === openingTime;
        const assignedToday = assignedEmployeesByDate.get(date) ?? new Set<string>();

        for (let k = 0; k < missing; k++) {
          const candidates = employees.filter(
            (e) =>
              e.area === "servicio" &&
              (e.default_branch_id === null || e.default_branch_id === branch.id) &&
              !hasApprovedAbsence(e.id, date) &&
              !assignedToday.has(e.id)
          );

          if (candidates.length === 0) {
            unfilledSlots.push({
              date,
              branchCode: branch.code,
              entryTime: rule.entry_time,
              missing: missing - k,
            });
            break;
          }

          const withinRestBudget = candidates.filter(
            (e) => (weekShiftCountByEmployee.get(e.id) ?? 0) < maxWorkDaysPerWeek
          );
          const pool = withinRestBudget.length > 0 ? withinRestBudget : candidates;

          const chosen = isOpening
            ? weightedRandomPick(pool, (e) => 1 / ((opensCountByEmployee.get(e.id) ?? 0) + 1))
            : [...pool].sort((a, b) => {
                const streakDiff = streakLength(a.id) - streakLength(b.id);
                if (streakDiff !== 0) return streakDiff;
                const hoursDiff = (weekHoursByEmployee.get(a.id) ?? 0) - (weekHoursByEmployee.get(b.id) ?? 0);
                if (hoursDiff !== 0) return hoursDiff;
                return a.id.localeCompare(b.id);
              })[0];

          if (pool === candidates && withinRestBudget.length === 0) {
            restRuleOverrides.push(
              `${chosen.full_name ?? "Empleado"}: superó sus ${restDaysPerWeek} días libres garantizados esta semana (no había otro candidato disponible el ${date}).`
            );
          }

          rowsToInsert.push({
            employee_id: chosen.id,
            branch_id: branch.id,
            area: "servicio",
            shift_date: date,
            start_time: rule.entry_time,
            end_time: endTime,
            suggested: true,
          });

          assignedToday.add(chosen.id);
          assignedEmployeesByDate.set(date, assignedToday);
          weekShiftCountByEmployee.set(chosen.id, (weekShiftCountByEmployee.get(chosen.id) ?? 0) + 1);
          weekHoursByEmployee.set(
            chosen.id,
            (weekHoursByEmployee.get(chosen.id) ?? 0) + hoursBetween(rule.entry_time, endTime)
          );
          const dateList = shiftDatesByEmployee.get(chosen.id) ?? [];
          dateList.push(date);
          shiftDatesByEmployee.set(chosen.id, dateList);
          if (isOpening) {
            opensCountByEmployee.set(chosen.id, (opensCountByEmployee.get(chosen.id) ?? 0) + 1);
          }
        }
      }
    }
  }

  // Huecos de cocina: se reportan pero no se auto-asignan (ver nota arriba).
  const targetBranchIds = new Set(targetBranches.map((b) => b.id));
  let kitchenGapsRemaining = 0;
  for (const rule of kitchenRules) {
    if (!targetBranchIds.has(rule.branch_id)) continue;
    const dow = rule.day_of_week;
    const date = dates.find((d) => isoDayOfWeek(d) === dow);
    if (!date) continue;
    const assigned = weekShifts.filter(
      (s) => s.branch_id === rule.branch_id && s.shift_date === date && s.area === "cocina"
    ).length;
    kitchenGapsRemaining += Math.max(0, rule.min_staff - assigned);
  }

  // Salvaguarda: nunca debería haber dos filas para el mismo empleado+fecha
  // gracias a assignedToday, pero un upsert con la misma llave repetida en
  // el mismo lote falla en Postgres ("no puede afectar la misma fila dos
  // veces") — se deduplica por si acaso antes de guardar.
  const dedupedRows = Array.from(
    new Map(rowsToInsert.map((r) => [`${r.employee_id}_${r.shift_date}_${r.start_time}`, r])).values()
  );

  if (dedupedRows.length > 0) {
    const { error: insertError } = await supabase
      .from("shifts")
      .upsert(dedupedRows, { onConflict: "employee_id,shift_date,start_time" });
    if (insertError) {
      console.error("generateScheduleDraft insert error:", insertError);
      return {
        error: `No se pudo guardar el borrador generado (${insertError.code ?? "?"}): ${insertError.message}`,
        summary: null,
      };
    }
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/dashboard");

  return {
    error: null,
    summary: {
      shiftsCreated: dedupedRows.length,
      kitchenGapsRemaining,
      unfilledSlots,
      restRuleOverrides,
      branchFilterApplied: branchFilterCode && branchFilterCode !== "todas" ? branchFilterCode : null,
    },
  };
}
