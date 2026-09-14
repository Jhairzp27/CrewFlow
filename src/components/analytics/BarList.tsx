export type BarListRow = { id: string; label: string; value: number };

/**
 * Ranking horizontal de una sola serie (magnitud) — sin leyenda porque el
 * título de la sección ya dice qué mide. Cada fila ya lleva su valor
 * directo (no hace falta pasar el mouse para leerlo), pero la fila y la
 * barra reaccionan al hover para que se sienta interactivo, con el valor
 * exacto también disponible como tooltip sobre la barra.
 */
export function BarList({
  rows,
  formatValue = (v) => String(v),
  emptyLabel = "Sin datos todavía.",
}: {
  rows: BarListRow[];
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.id} className="group rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-surface-hover">
          <p className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-foreground">{row.label}</span>
            <span className="flex-none text-muted group-hover:text-foreground">{formatValue(row.value)}</span>
          </p>
          <div className="relative h-2 rounded-full bg-surface-hover">
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100"
              style={{ left: `${Math.min(85, Math.max(0, (row.value / max) * 100))}%` }}
            >
              {row.label}: {formatValue(row.value)}
            </div>
            <div
              className="h-2 rounded-full bg-accent transition-[filter] duration-100 group-hover:brightness-110"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
