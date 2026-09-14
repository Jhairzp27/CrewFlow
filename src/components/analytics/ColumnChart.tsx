export type ColumnChartBar = { label: string; value: number; highlight?: boolean };

/**
 * Gráfico de columnas simple (una sola serie) para distribuciones — picos
 * horarios, días más concurridos. Barras finas, extremo superior
 * redondeado, etiqueta de valor solo en la barra más alta (para no
 * saturar), eje recesivo. `highlight` resalta una barra puntual (ej. el
 * día de hoy) sin necesitar leyenda: es la única con otro tono.
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
    <div className="flex h-40 items-end gap-1.5 border-b border-border pb-0">
      {bars.map((bar, i) => {
        const heightPct = Math.max(2, (bar.value / max) * 100);
        const isMax = bar.value === max && max > 0;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            {isMax && <span className="text-[10px] font-medium text-foreground">{formatValue(bar.value)}</span>}
            <div
              className={`w-full rounded-t-sm ${bar.highlight ? "bg-info-foreground" : "bg-accent"}`}
              style={{ height: `${heightPct}%`, opacity: bar.value === 0 ? 0.15 : 1 }}
              title={`${bar.label}: ${formatValue(bar.value)}`}
            />
            <span className="truncate text-[10px] text-faint">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}
