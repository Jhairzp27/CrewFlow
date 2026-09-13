/** Horas (con decimales) entre dos "HH:MM[:SS]", asumiendo que end > start. */
export function hoursBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

/** "36 / 40 h", redondeando a un decimal solo cuando hace falta. */
export function formatHoursFraction(worked: number, contracted: number): string {
  const round = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10);
  return `${round(worked)} / ${round(contracted)} h`;
}
