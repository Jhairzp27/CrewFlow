import type ExcelJS from "exceljs";

export type ParsedShiftEntry = {
  employeeName: string;
  area: "servicio" | "cocina";
  date: string; // YYYY-MM-DD
  rawValue: string;
};

export type SkippedCell = {
  employeeName: string;
  date: string;
  reason: "libre" | "vacaciones";
};

export type ParseResult = {
  entries: ParsedShiftEntry[];
  skipped: SkippedCell[];
  warnings: string[];
  sawFechas: boolean;
};

const AREA_MAP: Record<string, "servicio" | "cocina"> = {
  SERVICIO: "servicio",
  COCINA: "cocina",
};

const DAY_COLUMNS = [3, 4, 5, 6, 7, 8, 9]; // columnas C..I = 7 días

function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (
    typeof value === "object" &&
    value !== null &&
    "richText" in (value as unknown as Record<string, unknown>)
  ) {
    const richText = (value as { richText: { text: string }[] }).richText;
    return richText.map((r) => r.text).join("").trim() || null;
  }
  if (value instanceof Date) return null; // las fechas se leen aparte
  return String(value).trim() || null;
}

function cellDate(value: ExcelJS.CellValue): Date | null {
  return value instanceof Date ? value : null;
}

function toDateOnly(d: Date): string {
  // ExcelJS entrega las celdas de fecha ancladas a medianoche UTC; hay que
  // leerlas con los getters UTC (no los locales) o el día se corre hacia
  // atrás en cualquier huso horario detrás de UTC (ej. America/Guayaquil).
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * Parsea una hoja con el formato real de horario semanal del cliente:
 * una fila "FECHAS" con las 7 fechas de la semana, seguida de bloques
 * "SERVICIO" / "COCINA" con una fila por empleado y una celda por día
 * ("Libre", "VACACIONES", o un rango como "11:00 a Cierre"). Puede haber
 * varias semanas apiladas en la misma hoja, cada una con su propia fila
 * "FECHAS".
 */
export function parseScheduleWorkbook(sheet: ExcelJS.Worksheet): ParseResult {
  const entries: ParsedShiftEntry[] = [];
  const skipped: SkippedCell[] = [];
  const warnings: string[] = [];

  let weekDates: string[] | null = null;
  let currentArea: "servicio" | "cocina" | null = null;
  let sawFechas = false;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = row.values as ExcelJS.CellValue[]; // índice 1 = columna A
    const label = cellText(cells[2]); // columna B

    if (!label) return;

    const upperLabel = label.toUpperCase();

    if (upperLabel === "FECHAS") {
      sawFechas = true;
      const dates: string[] = [];
      for (const col of DAY_COLUMNS) {
        const d = cellDate(cells[col]);
        if (d) dates.push(toDateOnly(d));
      }
      if (dates.length === 7) {
        weekDates = dates;
      } else {
        warnings.push(
          `Fila "FECHAS" en la fila ${row.number} no tiene 7 fechas válidas (encontré ${dates.length}); se ignora ese bloque.`
        );
        weekDates = null;
      }
      currentArea = null;
      return;
    }

    if (upperLabel in AREA_MAP) {
      currentArea = AREA_MAP[upperLabel];
      return;
    }

    if (!currentArea || !weekDates) return;

    const employeeName = label;
    for (let i = 0; i < DAY_COLUMNS.length; i++) {
      const raw = cellText(cells[DAY_COLUMNS[i]]);
      const date = weekDates[i];
      if (!raw) continue;

      const upperRaw = raw.toUpperCase();
      if (upperRaw === "LIBRE") {
        skipped.push({ employeeName, date, reason: "libre" });
        continue;
      }
      if (upperRaw.startsWith("VACACION")) {
        skipped.push({ employeeName, date, reason: "vacaciones" });
        continue;
      }

      entries.push({ employeeName, area: currentArea, date, rawValue: raw });
    }
  });

  return { entries, skipped, warnings, sawFechas };
}

const TIME_RE = /^(\d{1,2})[.:](\d{2})$/;

function normalizeTime(raw: string): string | null {
  const m = raw.trim().match(TIME_RE);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${m[2]}`;
}

export type ShiftRangeResult =
  | { ok: true; startTime: string; endTime: string }
  | { ok: false; error: string };

/** Convierte "11:00 a Cierre" / "10:30 a 18:30" / "12.00 a Cierre" en horas concretas. */
export function parseShiftRange(
  rawValue: string,
  closingTime: string
): ShiftRangeResult {
  const parts = rawValue.split(/\s+a\s+/i);
  if (parts.length !== 2) {
    return { ok: false, error: `Formato no reconocido: "${rawValue}"` };
  }

  const [rawStart, rawEnd] = parts;

  const startTime = normalizeTime(rawStart);
  if (!startTime) {
    return { ok: false, error: `Hora de inicio inválida: "${rawValue}"` };
  }

  const endTime = /^cierre$/i.test(rawEnd.trim())
    ? closingTime
    : normalizeTime(rawEnd);
  if (!endTime) {
    return { ok: false, error: `Hora de fin inválida: "${rawValue}"` };
  }

  if (endTime <= startTime) {
    return {
      ok: false,
      error: `La hora de fin (${endTime}) no es posterior al inicio (${startTime}) en "${rawValue}"`,
    };
  }

  return { ok: true, startTime, endTime };
}
