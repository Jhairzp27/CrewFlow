import Link from "next/link";

export function StatCard({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-danger-foreground"
      : tone === "warning"
      ? "text-warning-foreground"
      : "text-foreground";

  const content = (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
