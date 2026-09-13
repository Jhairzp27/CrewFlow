export const DAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

export const DAY_LABELS_SHORT: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

export const DAY_LABELS_MIN: Record<number, string> = {
  1: "L",
  2: "M",
  3: "M",
  4: "J",
  5: "V",
  6: "S",
  7: "D",
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

const MONTH_LABELS: Record<number, string> = {
  1: "enero",
  2: "febrero",
  3: "marzo",
  4: "abril",
  5: "mayo",
  6: "junio",
  7: "julio",
  8: "agosto",
  9: "septiembre",
  10: "octubre",
  11: "noviembre",
  12: "diciembre",
};

const MONTH_LABELS_SHORT: Record<number, string> = {
  1: "ene",
  2: "feb",
  3: "mar",
  4: "abr",
  5: "may",
  6: "jun",
  7: "jul",
  8: "ago",
  9: "sep",
  10: "oct",
  11: "nov",
  12: "dic",
};

/** "7 – 13 de septiembre" (o "29 sep – 5 oct" si la semana cruza de mes). */
export function formatWeekRangeLabel(dates: string[]): string {
  const [startYear, startMonth, startDay] = dates[0].split("-").map(Number);
  const [, endMonth, endDay] = dates[6].split("-").map(Number);

  if (startMonth === endMonth) {
    return `${startDay} – ${endDay} de ${MONTH_LABELS[startMonth]}`;
  }
  return `${startDay} ${MONTH_LABELS_SHORT[startMonth]} – ${endDay} ${MONTH_LABELS_SHORT[endMonth]} · ${startYear}`;
}

/** Número de semana ISO-8601 (1-53) de la fecha dada. */
export function isoWeekNumber(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
