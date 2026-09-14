"use client";

import { useState } from "react";
import { DAY_LABELS, DAY_LABELS_MIN, DAY_LABELS_SHORT, isoDayOfWeek } from "@/lib/dates";
import { ShiftCard } from "./ShiftCard";
import type { GridShift } from "../ScheduleGrid";

const AREA_LABEL: Record<string, string> = { servicio: "Servicio", cocina: "Cocina" };

function DayCell({
  shifts,
  dayOff,
}: {
  shifts: GridShift[];
  dayOff?: "aprobada" | "pendiente";
}) {
  if (dayOff) {
    return (
      <ShiftCard
        title="Día libre"
        meta={dayOff === "aprobada" ? "aprobado" : "pendiente de aprobación"}
        variant="dayoff"
      />
    );
  }
  if (shifts.length === 0) {
    return <p className="px-1 py-2 text-center text-xs text-faint">Libre</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {shifts.map((s) => (
        <ShiftCard
          key={s.id}
          title={`${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}`}
          meta={`${s.area ? AREA_LABEL[s.area] : ""}${s.area ? " · " : ""}${s.branchCode}`}
          area={s.area}
          branchCode={s.branchCode}
          variant="own"
        />
      ))}
    </div>
  );
}

/**
 * Semana de solo lectura del empleado: una sola fila (la suya), sin
 * affordances de edición. Es un componente propio y no la grilla de admin
 * con props desactivados — así ningún dato de otros empleados se serializa
 * hacia esta pantalla. En móvil colapsa a tabs de día para evitar scroll
 * horizontal.
 */
export function ReadOnlyWeek({
  dates,
  todayDate,
  shiftsByDate,
  dayOffByDate,
}: {
  dates: string[];
  todayDate: string;
  shiftsByDate: Record<string, GridShift[]>;
  dayOffByDate: Record<string, "aprobada" | "pendiente">;
}) {
  const [selectedDate, setSelectedDate] = useState(
    dates.includes(todayDate) ? todayDate : dates[0]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Desktop: semana completa */}
      <div className="hidden sm:grid sm:grid-cols-7">
        {dates.map((date) => {
          const isToday = date === todayDate;
          return (
            <div
              key={date}
              className={`border-b border-r border-border p-2 last:border-r-0 ${
                isToday ? "bg-info shadow-[inset_0_2px_0_var(--color-info-foreground)]" : "bg-surface-hover"
              }`}
            >
              <p className={`text-xs font-semibold ${isToday ? "text-info-foreground" : "text-foreground"}`}>
                {DAY_LABELS_SHORT[isoDayOfWeek(date)]}{" "}
                <span className="font-normal text-muted">{date.slice(8, 10)}</span>
                {isToday && " · Hoy"}
              </p>
            </div>
          );
        })}
        {dates.map((date) => (
          <div key={date} className="border-r border-border p-2 last:border-r-0" style={{ minHeight: 74 }}>
            <DayCell shifts={shiftsByDate[date] ?? []} dayOff={dayOffByDate[date]} />
          </div>
        ))}
      </div>

      {/* Móvil: tabs de día, sin scroll horizontal */}
      <div className="sm:hidden">
        <div className="grid grid-cols-7 gap-1.5 p-2.5">
          {dates.map((date) => {
            const isToday = date === todayDate;
            const isSelected = date === selectedDate;
            return (
              <button
                key={date}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedDate(date)}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-lg border text-[11px] transition-colors ${
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : isToday
                    ? "border-info-foreground bg-surface text-foreground"
                    : "border-border bg-surface text-foreground"
                }`}
              >
                {DAY_LABELS_MIN[isoDayOfWeek(date)]}
                <span className="font-bold">{date.slice(8, 10)}</span>
              </button>
            );
          })}
        </div>
        <p className="px-3 pb-2 text-xs text-muted">
          {DAY_LABELS[isoDayOfWeek(selectedDate)]} {selectedDate.slice(8, 10)}
          {selectedDate === todayDate ? " · hoy" : ""}
        </p>
        <div className="space-y-2 px-3 pb-3">
          {(() => {
            const shifts = shiftsByDate[selectedDate] ?? [];
            const dayOff = dayOffByDate[selectedDate];
            if (dayOff) return <DayCell shifts={[]} dayOff={dayOff} />;
            if (shifts.length === 0)
              return (
                <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-faint">
                  No tienes turnos este día.
                </div>
              );
            return shifts.map((s) => (
              <ShiftCard
                key={s.id}
                title={`${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}`}
                meta={`${s.area ? AREA_LABEL[s.area] : ""}${s.area ? " · " : ""}Sucursal ${s.branchCode}`}
                area={s.area}
                branchCode={s.branchCode}
                variant="own"
              />
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
