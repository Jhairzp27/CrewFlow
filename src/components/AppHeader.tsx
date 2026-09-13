import { signOut } from "@/app/actions";
import { ThemeToggle } from "./ThemeToggle";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  employee: "Empleado",
};

export function AppHeader({
  email,
  role,
}: {
  email: string | null | undefined;
  role: "admin" | "employee";
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
            CF
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">
              CrewFlow
            </p>
            <p className="text-xs leading-tight text-muted">
              Gestión de horarios U2 / U3
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight text-foreground">{email}</p>
            <p className="text-xs leading-tight text-muted">
              {ROLE_LABEL[role] ?? role}
            </p>
          </div>
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
