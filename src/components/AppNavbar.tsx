"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/dashboard", label: "Inicio" },
  { href: "/admin/schedule", label: "Planificador" },
  { href: "/admin/schedule/import", label: "Importar Excel" },
  { href: "/admin/analytics", label: "Analítica" },
];

const EMPLOYEE_LINKS: NavLink[] = [
  { href: "/employee/schedule", label: "Mi horario" },
];

export function AppNavbar({ role }: { role: "admin" | "employee" }) {
  const pathname = usePathname();
  const links = role === "admin" ? ADMIN_LINKS : EMPLOYEE_LINKS;

  // Coincidencia más específica primero (p. ej. "/admin/schedule/import" no
  // debe también marcar activo a "/admin/schedule") — antes ambos se
  // resaltaban a la vez porque se comparaba con startsWith sin priorizar.
  const activeHref = [...links]
    .sort((a, b) => b.href.length - a.href.length)
    .find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))?.href;

  return (
    <nav
      aria-label="Navegación principal"
      className="border-b border-border bg-surface"
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-8">
        {links.map((link) => {
          const isActive = link.href === activeHref;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
