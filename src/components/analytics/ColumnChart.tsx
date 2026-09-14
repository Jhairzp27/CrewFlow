export type ColumnChartBar = { label: string; value: number; highlight?: boolean };

/**
 * Gráfico de columnas simple (una sola serie) para distribuciones — picos
 * horarios, días más concurridos. Barras finas, extremo superior
 * redondeado, eje recesivo. `highlight` resalta una barra puntual (ej. el
 * día de hoy) sin necesitar leyenda: es la única con otro tono. Cada barra
 * muestra su valor exacto al pasar el mouse (tooltip), y la más alta lo
 * deja visible siempre para un vistazo rápido sin interacción.
 */
export function ColumnChart({
  bars,
  formatValue = (v) => String(v),
  emptyLabel = "Sin datos todavía.",
}: {
  bars: ColumnChartBar[];
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const hasData = bars.some((b) => b.value > 0);

  if (!hasData) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex h-40 gap-1.5 border-b border-border">
      {bars.map((bar, i) => {
        const heightPct = Math.max(2, (bar.value / max) * 100);
        const isMax = bar.value === max && max > 0;
        return (
          <div key={i} className="group relative flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100"
            >
              {bar.label}: {formatValue(bar.value)}
            </div>
            <span className="h-3.5 text-[10px] font-medium text-foreground">
              {isMax ? formatValue(bar.value) : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full cursor-default rounded-t-sm transition-[filter] duration-100 group-hover:brightness-110 ${
                  bar.highlight ? "bg-info-foreground" : "bg-accent"
                }`}
                style={{ height: `${heightPct}%`, opacity: bar.value === 0 ? 0.15 : 1 }}
              />
            </div>
            <span className="truncate text-[10px] text-faint">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}
