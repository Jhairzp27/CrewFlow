export const DAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO day-of-week for a "YYYY-MM-DD" string: 1 = lunes ... 7 = domingo. */
export function isoDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/** Monday ("YYYY-MM-DD") of the week containing the given date string. */
export function mondayOf(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const jsDay = date.getUTCDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  date.setUTCDate(date.getUTCDate() + diff);
  return toDateOnly(date);
}

/** The 7 dates (Mon..Sun), as "YYYY-MM-DD", for the week starting on `mondayStr`. */
export function weekDates(mondayStr: string): string[] {
  const [year, month, day] = mondayStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return toDateOnly(d);
  });
}

export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

export function todayDateOnly(): string {
  return toDateOnly(new Date());
}
