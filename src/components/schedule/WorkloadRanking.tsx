export type WorkloadRow = {
  id: string;
  name: string;
  hoursWorked: number;
  hoursContracted: number;
};

/**
 * Ranking de horas trabajadas esta semana, de mayor a menor — para que el
 * admin detecte de un vistazo quién está cerca (o por encima) de su
 * contrato, sin tener que sumar turnos a mano. Serie única (horas), así que
 * no necesita leyenda: el nombre y el valor van directo en cada fila.
 */
export function WorkloadRanking({
  rows,
  limit = 6,
}: {
  rows: WorkloadRow[];
  limit?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.hoursWorked - a.hoursWorked);
  const visible = sorted.slice(0, limit);
  const restCount = sorted.length - visible.length;
  const scaleMax = Math.max(1, ...rows.map((r) => Math.max(r.hoursWorked, r.hoursContracted)));
  const hasAnyHours = sorted.some((r) => r.hoursWorked > 0);

  if (!hasAnyHours) {
    return (
      <p className="text-sm text-muted">
        Todavía no hay turnos cargados esta semana — el ranking aparece en
        cuanto se asignen o importen turnos.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {visible.map((row) => {
        const over = row.hoursWorked > row.hoursContracted;
        const barWidth = Math.min(100, (row.hoursWorked / scaleMax) * 100);
        const tickPosition = Math.min(100, (row.hoursContracted / scaleMax) * 100);
        return (
          <div key={row.id}>
            <p className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{row.name}</span>
              <span className={`flex-none ${over ? "text-danger-foreground" : "text-muted"}`}>
                {Math.round(row.hoursWorked * 10) / 10} / {row.hoursContracted} h
              </span>
            </p>
            <div className="relative h-2 rounded-full bg-surface-hover">
              <div
                className={`h-2 rounded-full ${over ? "bg-danger-foreground" : "bg-accent"}`}
                style={{ width: `${barWidth}%` }}
              />
              <div
                className="absolute top-0 h-2 w-px bg-foreground/40"
                style={{ left: `${tickPosition}%` }}
                title={`Contrato: ${row.hoursContracted} h`}
              />
            </div>
          </div>
        );
      })}
      {restCount > 0 && (
        <p className="pt-1 text-[11px] text-faint">
          +{restCount} empleado(s) más con menos horas esta semana.
        </p>
      )}
    </div>
  );
}
