"use client";

import { useActionState, useMemo, useState } from "react";
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

const parseInitial: ParseState = { error: null, preview: null };
const confirmInitial: ConfirmState = { error: null, summary: null };

type Branch = { id: string; code: string; name: string };

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

  const preview = parseState.preview;

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
    );
  }

  // ------------------------------------------------------------------
  // Fase 2: revisión — asignar sucursal por empleado/turno
  // ------------------------------------------------------------------
  if (preview) {
    return (
      <div className="space-y-6">
        <div className={`space-y-3 ${cardClass}`}>
          <p className="text-sm text-foreground">
            Detecté <strong>{preview.entries.length}</strong> turno(s) para{" "}
            <strong>{groups.length}</strong> empleado(s). Tu archivo no
            distingue sucursal, así que asígnala abajo antes de confirmar —
            un empleado puede rotar de sucursal durante la semana, así que
            puedes ajustarla también por día.
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
    <form action={parseAction} className={`space-y-4 ${cardClass}`}>
      <div>
        <label htmlFor="closing_time" className={labelClass}>
          Hora real de cierre
        </label>
        <input
          id="closing_time"
          name="closing_time"
          type="time"
          required
          defaultValue="22:00"
          className={`${inputClass} max-w-xs`}
        />
        <p className="mt-1 text-xs text-muted">
          Se usa para los turnos que dicen &quot;a Cierre&quot;.
        </p>
      </div>

      <div>
        <label htmlFor="file" className={labelClass}>
          Archivo de horario (.xlsx)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx"
          required
          className={inputClass}
        />
      </div>

      {parseState.error && <p className={errorBoxClass}>{parseState.error}</p>}

      <button type="submit" disabled={parsePending} className={primaryButtonClass}>
        {parsePending ? "Leyendo archivo..." : "Continuar"}
      </button>
    </form>
  );
}
