function isNextDay(a: string, b: string): boolean {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return db - da === 24 * 60 * 60 * 1000;
}

export type Streak = { length: number; start: string; end: string };

/**
 * Racha más larga de días calendario consecutivos con al menos un turno,
 * a partir de una lista (no necesariamente ordenada ni única) de fechas
 * "YYYY-MM-DD". Útil para detectar desgaste laboral en la planificación de
 * turnos, sin depender de la fecha "de hoy" (los turnos pueden ser futuros).
 */
export function longestConsecutiveStreak(dates: string[]): Streak | null {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length === 0) return null;

  let bestStart = unique[0];
  let bestEnd = unique[0];
  let bestLen = 1;

  let curStart = unique[0];
  let curLen = 1;

  for (let i = 1; i < unique.length; i++) {
    if (isNextDay(unique[i - 1], unique[i])) {
      curLen += 1;
    } else {
      curStart = unique[i];
      curLen = 1;
    }
    if (curLen > bestLen) {
      bestLen = curLen;
      bestStart = curStart;
      bestEnd = unique[i];
    }
  }

  return { length: bestLen, start: bestStart, end: bestEnd };
}
