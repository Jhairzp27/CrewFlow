"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/dashboard", label: "Inicio" },
  { href: "/admin/schedule", label: "Planificador" },
  { href: "/admin/schedule/import", label: "Importar Excel" },
];

const EMPLOYEE_LINKS: NavLink[] = [
  { href: "/employee/schedule", label: "Mi horario" },
];

export function AppNavbar({ role }: { role: "admin" | "employee" }) {
  const pathname = usePathname();
  const links = role === "admin" ? ADMIN_LINKS : EMPLOYEE_LINKS;

  return (
    <nav
      aria-label="Navegación principal"
      className="border-b border-border bg-surface"
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-8">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/admin/dashboard" && pathname.startsWith(link.href));
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
