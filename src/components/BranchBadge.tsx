const BRANCH_CLASS: Record<string, string> = {
  U2: "bg-branch-u2 text-branch-u2-foreground",
  U3: "bg-branch-u3 text-branch-u3-foreground",
};

/** Insignia de color fijo por sucursal — reconocible de un vistazo (U2 azul, U3 verde). */
export function BranchBadge({ code }: { code: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${
        BRANCH_CLASS[code] ?? "bg-surface-hover text-muted"
      }`}
    >
      {code}
    </span>
  );
}
