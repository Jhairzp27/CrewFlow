export type BranchFilter = "todas" | string;

const BRANCH_DOT_CLASS: Record<string, string> = {
  U2: "bg-branch-u2-foreground",
  U3: "bg-branch-u3-foreground",
};

/** Selector de sucursal U2 / U3 / Ambas — filtra la grilla del planificador. */
export function BranchSwitch({
  branches,
  value,
  onChange,
}: {
  branches: { id: string; code: string }[];
  value: BranchFilter;
  onChange: (value: BranchFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Sucursal"
      className="flex gap-0.5 rounded-lg border border-border bg-background p-0.5"
    >
      {branches.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-pressed={value === b.code}
          onClick={() => onChange(b.code)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            value === b.code
              ? "bg-accent text-accent-foreground"
              : "text-muted hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${BRANCH_DOT_CLASS[b.code] ?? "bg-current"}`} />
          {b.code}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={value === "todas"}
        onClick={() => onChange("todas")}
        className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
          value === "todas"
            ? "bg-accent text-accent-foreground"
            : "text-muted hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        Ambas
      </button>
    </div>
  );
}
