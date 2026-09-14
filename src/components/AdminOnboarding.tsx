"use client";

import { useState } from "react";
import { dismissOnboarding } from "@/app/admin/onboarding-actions";

type Step = { title: string; body: string[] };

const STEPS: Step[] = [
  {
    title: "¡Bienvenido a CrewFlow! 👋",
    body: [
      "Esta es la plataforma para armar el horario semanal de U2 y U3.",
      "Este tutorial te muestra por dónde empezar y qué hace cada parte — tarda un minuto.",
    ],
  },
  {
    title: "1. Inicio — tu punto de partida",
    body: [
      "Al entrar ves lo más importante de un vistazo: solicitudes pendientes por aprobar, quién trabaja más esta semana, quiénes están en riesgo de desgaste, y el horario general.",
      "Revísalo primero cada vez que entres.",
    ],
  },
  {
    title: "2. Planificador — arma el horario",
    body: [
      'Haz clic en el "+" de una celda, o arrastra un empleado desde la lista de la izquierda hasta el día que quieras, para asignarle un turno.',
      "Haz clic en cualquier turno ya asignado para editarlo o eliminarlo al instante.",
      "Usa los filtros de sucursal (U2/U3) y área (Servicio/Cocina) arriba para enfocarte en lo que necesitas.",
    ],
  },
  {
    title: "3. ✨ Generar borrador (IA)",
    body: [
      'El botón "Generar borrador" llena automáticamente los huecos de Servicio, siguiendo tus reglas: reparte las aperturas parejo, respeta los días libres garantizados, y evita sobrecargar a quien ya trabajó mucho.',
      'Esos turnos aparecen con borde punteado y la etiqueta "IA" — nunca quedan confirmados solos, tú decides si los apruebas, editas o eliminas.',
      "Cocina no se asigna automáticamente todavía — esos huecos siguen siendo manuales.",
    ],
  },
  {
    title: "4. Importar Excel",
    body: [
      "Si ya tienes un horario armado en Excel, súbelo aquí en vez de cargarlo turno por turno.",
      "El sistema detecta los turnos automáticamente; solo revisas la sucursal de cada uno (recuerda la última que usó cada empleado) y confirmas.",
    ],
  },
  {
    title: "5. Analítica",
    body: [
      "Aquí ves quién trabaja más, quién tiene más días libres, los horarios pico y los días más concurridos.",
      "Pasa el mouse sobre cualquier barra para ver el número exacto.",
    ],
  },
];

export function AdminOnboarding({ dismissed }: { dismissed: boolean }) {
  const [open, setOpen] = useState(!dismissed);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  function reopen() {
    setStep(0);
    setOpen(true);
  }

  async function finish() {
    setSaving(true);
    await dismissOnboarding();
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={reopen}
        aria-label="Ver el tutorial de nuevo"
        title="Ver el tutorial de nuevo"
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg shadow-lg hover:bg-surface-hover"
      >
        ❓
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{current.title}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar por ahora"
            title="Cerrar por ahora (vuelve a aparecer más tarde)"
            className="text-faint hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="space-y-2 text-sm leading-relaxed text-foreground">
          {current.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-accent" : "bg-border"}`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover disabled:opacity-40"
          >
            ← Anterior
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Entendido, no volver a mostrar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
