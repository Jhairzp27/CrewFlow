/** Chip de filtro tipo pastilla, con conteo y punto de color opcionales. */
export function FilterChip({
  label,
  count,
  dotClassName,
  selected = false,
  disabled = false,
  onClick,
}: {
  label: string;
  count?: number;
  dotClassName?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {dotClassName && <span className={`h-1.5 w-1.5 rounded-full ${dotClassName}`} />}
      {label}
      {count !== undefined && <span className="opacity-70">{count}</span>}
    </button>
  );
}
