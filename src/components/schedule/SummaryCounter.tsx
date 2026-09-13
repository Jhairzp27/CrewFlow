const TONE_CLASS = {
  success: { pill: "border-border bg-surface", icon: "bg-success text-success-foreground" },
  warning: { pill: "border-border bg-surface", icon: "bg-warning text-warning-foreground" },
  info: { pill: "border-border bg-surface", icon: "bg-info text-info-foreground" },
  danger: { pill: "border-danger-foreground bg-danger", icon: "bg-danger-foreground text-danger" },
} as const;

/** Chip de resumen: icono + número + etiqueta (turnos cubiertos, sin asignar, etc). */
export function SummaryCounter({
  icon,
  value,
  label,
  tone = "success",
}: {
  icon: string;
  value: string | number;
  label: string;
  tone?: keyof typeof TONE_CLASS;
}) {
  const classes = TONE_CLASS[tone];
  const textClass = tone === "danger" ? "text-danger-foreground" : "text-foreground";
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 ${classes.pill}`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${classes.icon}`}
      >
        {icon}
      </span>
      <span className={`text-xs font-semibold ${textClass}`}>{value}</span>
      <span className={`text-xs ${tone === "danger" ? textClass : "text-muted"}`}>{label}</span>
    </div>
  );
}
