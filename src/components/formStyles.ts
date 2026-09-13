// Clases de Tailwind compartidas por todos los formularios de la app, para
// que inputs, botones y mensajes se vean y se sientan igual en cualquier
// pantalla (heurística de consistencia) y respeten el modo oscuro.

export const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-surface-hover disabled:text-faint";

export const labelClass = "mb-1 block text-sm font-medium text-foreground";

export const cardClass =
  "rounded-xl border border-border bg-surface p-6 shadow-sm";

export const primaryButtonClass =
  "rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover";

export const errorBoxClass =
  "rounded-md bg-danger px-3 py-2 text-sm text-danger-foreground";

export const successBoxClass =
  "rounded-md bg-success px-3 py-2 text-sm text-success-foreground";

export const infoBoxClass = "rounded-md bg-info px-3 py-2 text-sm text-info-foreground";
