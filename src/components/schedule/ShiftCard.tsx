export type ShiftCardVariant = "assigned" | "own" | "unassigned" | "dayoff" | "conflict" | "suggested";

const AREA_DOT_CLASS: Record<string, string> = {
  servicio: "bg-info-foreground",
  cocina: "bg-warning-foreground",
};

const BRANCH_BORDER_CLASS: Record<string, string> = {
  U2: "border-l-branch-u2-foreground",
  U3: "border-l-branch-u3-foreground",
};

const VARIANT_CLASS: Record<ShiftCardVariant, string> = {
  assigned: "bg-surface-hover text-foreground hover:bg-border",
  own: "bg-info text-info-foreground",
  unassigned:
    "border border-dashed border-warning-foreground bg-warning text-warning-foreground",
  conflict: "border-l-[3px] border-l-danger-foreground bg-danger text-danger-foreground",
  dayoff: "border-l-[3px] border-l-warning-foreground bg-warning text-warning-foreground",
  suggested: "border-2 border-dashed border-info-foreground bg-info/60 text-info-foreground",
};

/**
 * Tarjeta de turno compacta: hora arriba, punto de área + texto abajo.
 * El borde izquierdo indica sucursal (U2/U3); el punto de color indica área
 * (Servicio/Cocina). Un solo componente para admin, empleado y dashboard —
 * las variantes cubren dueño (propio/otro), sin asignar, día libre y conflicto.
 */
export function ShiftCard({
  title,
  meta,
  area,
  branchCode,
  variant = "assigned",
  selected = false,
  actions,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  className = "",
}: {
  title: string;
  meta?: string;
  area?: "servicio" | "cocina" | null;
  branchCode?: string | null;
  variant?: ShiftCardVariant;
  selected?: boolean;
  actions?: React.ReactNode;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  className?: string;
}) {
  const showBranchBorder = variant === "assigned" || variant === "own";
  const branchBorderClass = showBranchBorder
    ? `border-l-[3px] ${branchCode ? BRANCH_BORDER_CLASS[branchCode] ?? "border-l-border" : "border-l-border"}`
    : "";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-md px-2 py-1.5 text-left transition-colors ${branchBorderClass} ${VARIANT_CLASS[variant]} ${
        onClick ? "cursor-pointer" : ""
      } ${selected ? "ring-2 ring-info-foreground" : ""} ${className}`}
    >
      <p className="flex items-center gap-1 text-[13px] font-semibold leading-tight">
        {variant === "suggested" && (
          <span className="rounded bg-info-foreground px-1 py-px text-[9px] font-bold uppercase tracking-wide text-info">
            ✨ IA
          </span>
        )}
        {title}
      </p>
      {meta && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-none opacity-90">
          {area && (
            <span
              className={`h-1.5 w-1.5 flex-none rounded-full ${AREA_DOT_CLASS[area] ?? "bg-current"}`}
            />
          )}
          <span className="truncate">{meta}</span>
        </p>
      )}
      {actions}
    </div>
  );
}
