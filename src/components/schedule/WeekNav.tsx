import Link from "next/link";

/** Navegación de semana: ← / rango de fechas + N.º de semana / →, más "Hoy". */
export function WeekNav({
  label,
  sublabel,
  prevHref,
  nextHref,
  todayHref,
}: {
  label: string;
  sublabel: string;
  prevHref: string;
  nextHref: string;
  todayHref?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={prevHref}
        aria-label="Semana anterior"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-sm text-foreground hover:bg-surface-hover"
      >
        ←
      </Link>
      <div className="min-w-[170px] text-center">
        <p className="text-sm font-semibold leading-tight text-foreground">{label}</p>
        <p className="text-xs leading-tight text-muted">{sublabel}</p>
      </div>
      <Link
        href={nextHref}
        aria-label="Semana siguiente"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-sm text-foreground hover:bg-surface-hover"
      >
        →
      </Link>
      {todayHref && (
        <Link
          href={todayHref}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover"
        >
          Hoy
        </Link>
      )}
    </div>
  );
}
