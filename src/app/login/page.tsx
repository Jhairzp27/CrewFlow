"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  cardClass,
  errorBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/formStyles";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className={`w-full max-w-sm ${cardClass}`}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
            CF
          </div>
          <h1 className="text-2xl font-semibold text-foreground">CrewFlow</h1>
          <p className="mt-1 text-sm text-muted">
            Gestión de horarios U2 / U3
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              placeholder="nombre@crewflow.com"
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {state.error && <p className={errorBoxClass}>{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className={`w-full ${primaryButtonClass}`}
          >
            {pending ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </main>
  );
}
