"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  parseScheduleFile,
  confirmScheduleImport,
  type ParseState,
  type ConfirmState,
  type ConfirmedEntry,
} from "./actions";
import { DAY_LABELS, isoDayOfWeek } from "@/lib/dates";
import {
  cardClass,
  errorBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/formStyles";
import { TimePicker } from "@/components/TimePicker";

const parseInitial: ParseState = { error: null, preview: null };
const confirmInitial: ConfirmState = { error: null, summary: null };

type Branch = { id: string; code: string; name: string };

const STEPS = ["Subir archivo", "Revisar y asignar sucursal", "Confirmado"] as const;

/** Indicador de en qué paso del asistente de importación está el admin. */
function ImportStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const isCurrent = step === current;
        const isDone = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
                isCurrent
                  ? "bg-accent text-accent-foreground"
                  : isDone
                  ? "bg-success text-success-foreground"
                  : "bg-surface-hover text-muted"
              }`}
            >
              {isDone ? "✓" : step}
            </span>
            <span className={isCurrent ? "font-semibold text-foreground" : "text-muted"}>{label}</span>
            {step < 3 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export function ImportForm({ branches }: { branches: Branch[] }) {
  const [parseState, parseAction, parsePending] = useActionState(
    parseScheduleFile,
    parseInitial
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmScheduleImport,
    confirmInitial
  );
  const [branchByKey, setBranchByKey] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = parseState.preview;

  function assignFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.files = files;
    setSelectedFile(files[0]);
  }

  function formatFileSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Precarga la sucursal de cada turno con la última sucursal conocida del
  // empleado (si tiene historial) — así el admin solo ajusta excepciones en
  // vez de elegir sucursal turno por turno. Solo la primera vez que llega un
  // preview nuevo, para no pisar los ajustes que ya haya hecho el admin.
  useEffect(() => {
    if (!preview) return;
    setBranchByKey((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const seeded: Record<string, string> = {};
      for (const e of preview.entries) {
        const branchId = preview.lastBranchByEmployeeName[e.employeeName.trim().toUpperCase()];
        if (branchId) seeded[e.key] = branchId;
      }
      return seeded;
    });
  }, [preview]);

  const groups = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, typeof preview.entries>();
    for (const e of preview.entries) {
      const list = map.get(e.employeeName) ?? [];
      list.push(e);
      map.set(e.employeeName, list);
    }
    return Array.from(map.entries()).map(([name, entries]) => ({
      name,
      isNew: !preview.knownEmployeeNames.includes(name.toUpperCase()),
      entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [preview]);

  function applyToEmployee(name: string, branchId: string) {
    setBranchByKey((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.name === name) {
          for (const e of g.entries) next[e.key] = branchId;
        }
      }
      return next;
    });
  }

  function applyToAll(branchId: string) {
    if (!preview) return;
    setBranchByKey((prev) => {
      const next = { ...prev };
      for (const e of preview.entries) next[e.key] = branchId;
      return next;
    });
  }

  const allAssigned = preview
    ? preview.entries.every((e) => branchByKey[e.key])
    : false;

  const confirmedEntriesJson = useMemo(() => {
    if (!preview) return "";
    const entries: ConfirmedEntry[] = preview.entries.map((e) => ({
      ...e,
      branchId: branchByKey[e.key] ?? "",
    }));
    return JSON.stringify(entries);
  }, [preview, branchByKey]);

  // ------------------------------------------------------------------
  // Fase 3: resumen final
  // ------------------------------------------------------------------
  if (confirmState.summary) {
    const { summary } = confirmState;
    return (
      <div className="space-y-4">
        <ImportStepper current={3} />
      <div className={`space-y-4 ${cardClass} border-success`}>
        <h3 className="text-sm font-semibold text-success-foreground">
          Importación completada
        </h3>
        <p className="text-sm text-foreground">
          {summary.shiftsCreated} turno(s) creados o actualizados.
        </p>

        {summary.employeesCreated.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Empleados nuevos creados — comparte estas credenciales una sola
              vez, no quedan guardadas en ningún otro lugar:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-hover text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Correo</th>
                    <th className="px-3 py-2 font-medium">Contraseña temporal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.employeesCreated.map((e) => (
                    <tr key={e.email}>
                      <td className="px-3 py-2 text-foreground">{e.fullName}</td>
                      <td className="px-3 py-2 text-muted">{e.email}</td>
                      <td className="px-3 py-2 font-mono text-foreground">
                        {e.tempPassword}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {summary.shiftsSkipped.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">
              Celdas no importadas como turno:
            </p>
            <ul className="list-inside list-disc text-sm text-muted">
              {summary.shiftsSkipped.map((s) => (
                <li key={s.reason}>
                  {s.reason}: {s.count}
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.warnings.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-warning-foreground">
              Avisos:
            </p>
            <ul className="list-inside list-disc text-sm text-warning-foreground">
              {summary.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <a href="/admin/schedule/import" className={secondaryButtonClass}>
          Importar otro archivo
        </a>
      </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Fase 2: revisión — asignar sucursal por empleado/turno
  // ------------------------------------------------------------------
  if (preview) {
    return (
      <div className="space-y-6">
        <ImportStepper current={2} />
        <div className={`space-y-3 ${cardClass}`}>
          <p className="text-sm text-foreground">
            Detecté <strong>{preview.entries.length}</strong> turno(s) para{" "}
            <strong>{groups.length}</strong> empleado(s). Tu archivo no
            distingue sucursal, así que asígnala abajo antes de confirmar —
            un empleado puede rotar de sucursal durante la semana, así que
            puedes ajustarla también por día. Para quien ya tiene turnos
            anteriores, precargamos su última sucursal conocida (marcada como
            &quot;detectado&quot;) — revísala y ajusta solo las excepciones.
          </p>

          <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-hover p-3">
            <span className="text-sm text-muted">Asignar a todos:</span>
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => applyToAll(b.id)}
                className={secondaryButtonClass}
              >
                {b.name}
              </button>
            ))}
          </div>

          {preview.warnings.length > 0 && (
            <details className="text-sm text-warning-foreground">
              <summary className="cursor-pointer font-medium">
                {preview.warnings.length} aviso(s) del archivo
              </summary>
              <ul className="mt-1 list-inside list-disc">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.name} className={cardClass}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{group.name}</p>
                  {group.isNew && (
                    <span className="rounded-full bg-info px-2 py-0.5 text-xs font-medium text-info-foreground">
                      Cuenta nueva
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">
                    Sucursal para toda la semana:
                  </span>
                  <select
                    className={`${inputClass} w-auto`}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) applyToEmployee(group.name, e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      Elegir...
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Día</th>
                      <th className="py-1 pr-3 font-medium">Área</th>
                      <th className="py-1 pr-3 font-medium">Horario</th>
                      <th className="py-1 pr-3 font-medium">Sucursal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.entries.map((entry) => (
                      <tr key={entry.key}>
                        <td className="py-1.5 pr-3 text-foreground">
                          {DAY_LABELS[isoDayOfWeek(entry.date)]}{" "}
                          <span className="text-muted">{entry.date}</span>
                        </td>
                        <td className="py-1.5 pr-3 capitalize text-muted">
                          {entry.area}
                        </td>
                        <td className="py-1.5 pr-3 text-muted">
                          {entry.startTime}-{entry.endTime}
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <select
                              className={`${inputClass} w-auto`}
                              value={branchByKey[entry.key] ?? ""}
                              onChange={(e) =>
                                setBranchByKey((prev) => ({
                                  ...prev,
                                  [entry.key]: e.target.value,
                                }))
                              }
                            >
                              <option value="" disabled>
                                Sin asignar
                              </option>
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code}
                                </option>
                              ))}
                            </select>
                            {preview.lastBranchByEmployeeName[
                              entry.employeeName.trim().toUpperCase()
                            ] === branchByKey[entry.key] && (
                              <span className="text-[10px] text-faint">detectado</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <form action={confirmAction} className={`space-y-3 ${cardClass}`}>
          <input type="hidden" name="entries" value={confirmedEntriesJson} />
          {!allAssigned && (
            <p className="text-sm text-warning-foreground">
              Faltan turnos sin sucursal asignada — asígnalos arriba antes de
              confirmar.
            </p>
          )}
          {confirmState.error && (
            <p className={errorBoxClass}>{confirmState.error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!allAssigned || confirmPending}
              className={primaryButtonClass}
            >
              {confirmPending
                ? "Importando..."
                : `Confirmar e importar ${preview.entries.length} turno(s)`}
            </button>
            <a href="/admin/schedule/import" className={secondaryButtonClass}>
              Cancelar
            </a>
          </div>
        </form>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Fase 1: subir archivo
  // ------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <ImportStepper current={1} />
      <form action={parseAction} className={`space-y-4 ${cardClass}`}>
        <div>
          <label htmlFor="file" className={labelClass}>
            Archivo de horario (.xlsx)
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              assignFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDraggingFile
                ? "border-accent bg-accent/10"
                : selectedFile
                ? "border-success-foreground bg-success/40"
                : "border-border bg-background hover:border-accent hover:bg-surface-hover"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-9 w-9 ${selectedFile ? "text-success-foreground" : "text-faint"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {selectedFile ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3.75 3.75 0 0 1 4.133 3.855A4.502 4.502 0 0 1 18 19.5H6.75Z"
                />
              )}
            </svg>
            {selectedFile ? (
              <>
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted">
                  {formatFileSize(selectedFile.size)} — haz clic para cambiar el archivo
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Arrastra tu archivo aquí
                </p>
                <p className="text-xs text-muted">o haz clic para buscarlo en tu computadora</p>
                <p className="text-xs text-faint">Solo archivos .xlsx</p>
              </>
            )}
            <input
              ref={fileInputRef}
              id="file"
              name="file"
              type="file"
              accept=".xlsx"
              required
              className="sr-only"
              onChange={(e) => assignFiles(e.target.files)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="closing_time" className={labelClass}>
            Hora real de cierre
          </label>
          <TimePicker id="closing_time" name="closing_time" defaultValue="22:00" className="max-w-[160px]" />
          <p className="mt-1 text-xs text-muted">
            Se usa para los turnos que dicen &quot;a Cierre&quot;.
          </p>
        </div>

        {parseState.error && <p className={errorBoxClass}>{parseState.error}</p>}

        <button type="submit" disabled={parsePending} className={primaryButtonClass}>
          {parsePending ? "Leyendo archivo..." : "Continuar"}
        </button>
      </form>
    </div>
  );
}
