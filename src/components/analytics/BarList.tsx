export type BarListRow = { id: string; label: string; value: number };

/**
 * Ranking horizontal de una sola serie (magnitud) — sin leyenda porque el
 * título de la sección ya dice qué mide; cada fila lleva su etiqueta y
 * valor directo, sin necesidad de pasar el mouse para leerlo.
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
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.id}>
          <p className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-foreground">{row.label}</span>
            <span className="flex-none text-muted">{formatValue(row.value)}</span>
          </p>
          <div className="h-2 rounded-full bg-surface-hover">
            <div
              className="h-2 rounded-full bg-accent"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
