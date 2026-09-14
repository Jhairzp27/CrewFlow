import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { TimeOffRequestForm } from "./RequestForm";
import { cancelTimeOffRequest } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Badge } from "@/components/Badge";
import { BranchBadge } from "@/components/BranchBadge";
import { ReadOnlyWeek } from "@/components/schedule/ReadOnlyWeek";
import { WeekNav } from "@/components/schedule/WeekNav";
import type { GridShift } from "@/components/ScheduleGrid";
import { hoursBetween } from "@/lib/hours";
import {
  DAY_LABELS,
  addDays,
  formatWeekRangeLabel,
  isoDayOfWeek,
  mondayOf,
  todayDateOnly,
  weekDates,
} from "@/lib/dates";

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
  area: string | null;
  branch: { code: string } | null;
};

function nextShiftLabel(shift: ShiftRow, today: string): string {
  if (shift.shift_date === today) return `Hoy · ${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`;
  if (shift.shift_date === addDays(today, 1))
    return `Mañana · ${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`;
  return `${DAY_LABELS[isoDayOfWeek(shift.shift_date)]} ${shift.shift_date.slice(
    8,
    10
  )} · ${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`;
}

export default async function EmployeeSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = todayDateOnly();
  const monday = mondayOf(week ?? today);
  const dates = weekDates(monday);
  const prevWeek = addDays(monday, -7);
  const nextWeek = addDays(monday, 7);

  const [{ data: profile }, { data: requests }, { data: weekShiftsData }, { data: nextShiftData }, { data: timeOffData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, area, weekly_contracted_hours")
        .eq("id", user?.id ?? "")
        .single(),
      supabase
        .from("time_off_requests")
        .select("id, request_type, status, start_date, end_date, start_time, end_time")
        .eq("employee_id", user?.id ?? "")
        .order("created_at", { ascending: false }),
      supabase
        .from("shifts")
        .select("id, shift_date, start_time, end_time, area, branch:branches (code)")
        .eq("employee_id", user?.id ?? "")
        .eq("suggested", false)
        .gte("shift_date", dates[0])
        .lte("shift_date", dates[6])
        .order("start_time", { ascending: true }),
      supabase
        .from("shifts")
        .select("id, shift_date, start_time, end_time, area, branch:branches (code)")
        .eq("employee_id", user?.id ?? "")
        .eq("suggested", false)
        .gte("shift_date", today)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("time_off_requests")
        .select("request_type, status, start_date, end_date")
        .eq("employee_id", user?.id ?? "")
        .eq("status", "aprobada")
        .in("request_type", ["dia_libre", "vacaciones"])
        .lte("start_date", dates[6])
        .gte("end_date", dates[0]),
    ]);

  const weekShifts = (weekShiftsData ?? []) as unknown as ShiftRow[];
  const nextShift = nextShiftData as unknown as ShiftRow | null;

  const dayOffByDate: Record<string, "aprobada" | "pendiente"> = {};
  for (const row of timeOffData ?? []) {
    for (const date of dates) {
      if (date >= row.start_date && date <= row.end_date) dayOffByDate[date] = "aprobada";
    }
  }

  const shiftsByDate: Record<string, GridShift[]> = {};
  let hoursWorked = 0;
  for (const s of weekShifts) {
    const list = shiftsByDate[s.shift_date] ?? [];
    list.push({
      id: s.id,
      branchCode: s.branch?.code ?? "?",
      startTime: s.start_time,
      endTime: s.end_time,
      area: s.area as "servicio" | "cocina" | null,
    });
    shiftsByDate[s.shift_date] = list;
    hoursWorked += hoursBetween(s.start_time, s.end_time);
  }
  const hoursContracted = profile?.weekly_contracted_hours ?? 40;
  const daysOffThisWeek = Object.keys(dayOffByDate).length;

  const hasArea = Boolean(profile?.area);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mi horario</h1>
        <p className="text-sm text-muted">Sesión iniciada como {user?.email}.</p>
      </div>

      {!hasArea ? (
        <p className="text-sm text-muted">
          Tu perfil todavía no tiene un área asignada (Servicio/Cocina) — pídele al administrador
          que la configure.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.55fr_1fr]">
            <div className="rounded-xl border border-info-foreground bg-info p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-info-foreground">
                Tu próximo turno
              </p>
              {nextShift ? (
                <>
                  <p className="mt-1 text-2xl font-bold leading-tight text-foreground">
                    {nextShiftLabel(nextShift, today)}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-info-foreground" />
                    {nextShift.area === "cocina" ? "Cocina" : "Servicio"}
                    <span className="text-faint">·</span>
                    <BranchBadge code={nextShift.branch?.code ?? "?"} />
                  </p>
                </>
              ) : (
                <p className="mt-1 text-lg font-semibold text-foreground">
                  No tienes turnos próximos.
                </p>
              )}
            </div>
            <div className="flex flex-col justify-center rounded-xl border border-border bg-surface p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Horas de esta semana
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {Math.round(hoursWorked * 10) / 10}{" "}
                <span className="text-sm font-normal text-muted">/ {hoursContracted} h</span>
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface-hover">
                <div
                  className={`h-1.5 rounded-full ${
                    hoursWorked >= hoursContracted ? "bg-success-foreground" : "bg-info-foreground"
                  }`}
                  style={{ width: `${Math.min(100, (hoursWorked / hoursContracted) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {weekShifts.length} turnos · {daysOffThisWeek} días libres
              </p>
            </div>
          </div>

          <WeekNav
            label={formatWeekRangeLabel(dates)}
            sublabel={monday === mondayOf(today) ? "Semana actual · publicada" : "publicada"}
            prevHref={`/employee/schedule?week=${prevWeek}`}
            nextHref={`/employee/schedule?week=${nextWeek}`}
          />

          <div>
            <ReadOnlyWeek
              dates={dates}
              todayDate={today}
              shiftsByDate={shiftsByDate}
              dayOffByDate={dayOffByDate}
            />
            <p className="mt-2 text-xs text-muted">
              Solo tu horario. Los turnos los publica el administrador; si algo no cuadra,
              escríbele desde &quot;Reportar un problema&quot;.
            </p>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">¿Necesitas un día libre?</p>
          <Link
            href="#solicitar"
            className="flex min-h-[44px] w-full items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Solicitar día libre
          </Link>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Recuerda: la regla es pedirlo con 10 días de anticipación.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <p className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
            Mis solicitudes
          </p>
          {requests && requests.length > 0 ? (
            <div className="divide-y divide-border">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {TYPE_LABEL[r.request_type] ?? r.request_type} ·{" "}
                      {r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`}
                    </p>
                    <p className="text-[11px] text-muted">
                      {r.start_time && r.end_time
                        ? `${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {r.status === "pendiente" && (
                      <form action={cancelTimeOffRequest.bind(null, r.id)}>
                        <ConfirmButton
                          confirmMessage="¿Cancelar esta solicitud?"
                          className="text-[11px] font-medium text-danger-foreground hover:underline"
                        >
                          Cancelar
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">Aún no tienes solicitudes registradas.</p>
          )}
        </div>
      </div>

      <section id="solicitar">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Solicitar permiso o vacaciones
        </h2>
        <TimeOffRequestForm />
      </section>
    </div>
  );
}
