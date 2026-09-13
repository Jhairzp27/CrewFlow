"use server";

import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseScheduleWorkbook, parseShiftRange } from "./parse";

// =====================================================================
// Fase 1: subir el archivo y parsearlo (sin escribir nada en la base de
// datos todavía). El archivo del cliente no distingue U2/U3 — los
// empleados rotan entre sucursales dentro de la misma semana — así que
// en vez de asumir una sola sucursal por archivo, se le pide al admin
// que la indique por cada turno detectado en la fase de revisión.
// =====================================================================

export type PreviewEntry = {
  key: string; // `${employeeName}__${date}__${rawValue}` — estable entre fases
  employeeName: string;
  area: "servicio" | "cocina";
  date: string;
  startTime: string;
  endTime: string;
};

export type ParseState = {
  error: string | null;
  preview: {
    entries: PreviewEntry[];
    closingTime: string;
    skippedSummary: { reason: string; count: number }[];
    warnings: string[];
    knownEmployeeNames: string[]; // ya existen en profiles, no se crearán cuentas nuevas
  } | null;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Debes iniciar sesión." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { ok: false as const, error: "Solo un administrador puede importar horarios." };
  }
  return { ok: true as const, supabase, userId: user.id };
}

export async function parseScheduleFile(
  _prevState: ParseState,
  formData: FormData
): Promise<ParseState> {
  const admin = await requireAdmin();
  if (!admin.ok) return { error: admin.error, preview: null };

  const closingTime = formData.get("closing_time") as string;
  const file = formData.get("file") as File | null;

  if (!closingTime || !file || file.size === 0) {
    return { error: "Completa la hora de cierre y el archivo.", preview: null };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "El archivo supera el límite de 5 MB.", preview: null };
  }
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    return { error: "Solo se aceptan archivos .xlsx.", preview: null };
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch (err) {
    console.error("parseScheduleFile load error:", err);
    return { error: "No se pudo leer el archivo. ¿Es un .xlsx válido?", preview: null };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "El archivo no tiene hojas.", preview: null };

  const { entries, skipped, warnings } = parseScheduleWorkbook(sheet);
  if (entries.length === 0) {
    return {
      error: "No se encontraron turnos para importar en el archivo.",
      preview: null,
    };
  }

  const previewEntries: PreviewEntry[] = [];
  for (const entry of entries) {
    const range = parseShiftRange(entry.rawValue, closingTime);
    if (!range.ok) {
      warnings.push(`${entry.employeeName} (${entry.date}): ${range.error}`);
      continue;
    }
    previewEntries.push({
      key: `${entry.employeeName}__${entry.date}__${entry.rawValue}`,
      employeeName: entry.employeeName,
      area: entry.area,
      date: entry.date,
      startTime: range.startTime,
      endTime: range.endTime,
    });
  }

  if (previewEntries.length === 0) {
    return {
      error: "Ningún turno se pudo interpretar correctamente. Revisa los avisos.",
      preview: null,
    };
  }

  const { data: existingProfiles } = await admin.supabase
    .from("profiles")
    .select("full_name")
    .eq("role", "employee");
  const knownNames = new Set(
    (existingProfiles ?? [])
      .map((p) => p.full_name?.trim().toUpperCase())
      .filter((n): n is string => Boolean(n))
  );

  const skipReasons: { reason: string; count: number }[] = [];
  const libreCount = skipped.filter((s) => s.reason === "libre").length;
  const vacacionesCount = skipped.filter((s) => s.reason === "vacaciones").length;
  if (libreCount > 0) skipReasons.push({ reason: "Día libre", count: libreCount });
  if (vacacionesCount > 0)
    skipReasons.push({ reason: "Vacaciones", count: vacacionesCount });

  return {
    error: null,
    preview: {
      entries: previewEntries,
      closingTime,
      skippedSummary: skipReasons,
      warnings,
      knownEmployeeNames: Array.from(knownNames),
    },
  };
}

// =====================================================================
// Fase 2: el admin ya asignó una sucursal a cada turno (o a cada
// empleado, aplicado en bloque en la UI) — ahora sí se crean las cuentas
// de empleados que falten y se guardan los turnos.
// =====================================================================

export type ConfirmedEntry = PreviewEntry & { branchId: string };

export type NewEmployee = {
  fullName: string;
  email: string;
  tempPassword: string;
};

export type ImportSummary = {
  employeesCreated: NewEmployee[];
  shiftsCreated: number;
  shiftsSkipped: { reason: string; count: number }[];
  warnings: string[];
};

export type ConfirmState = {
  error: string | null;
  summary: ImportSummary | null;
};

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function confirmScheduleImport(
  _prevState: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const admin = await requireAdmin();
  if (!admin.ok) return { error: admin.error, summary: null };

  const raw = formData.get("entries") as string;
  if (!raw) return { error: "No hay turnos para importar.", summary: null };

  let entries: ConfirmedEntry[];
  try {
    entries = JSON.parse(raw);
  } catch {
    return { error: "Datos de importación inválidos.", summary: null };
  }

  const missingBranch = entries.find((e) => !e.branchId);
  if (missingBranch) {
    return {
      error: `Falta asignar sucursal para ${missingBranch.employeeName} (${missingBranch.date}).`,
      summary: null,
    };
  }

  const warnings: string[] = [];
  const supabase = admin.supabase;

  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "employee");

  const employeeIdByName = new Map<string, string>();
  for (const p of existingProfiles ?? []) {
    if (p.full_name) employeeIdByName.set(p.full_name.trim().toUpperCase(), p.id);
  }

  const uniqueNames = Array.from(
    new Set(entries.map((e) => e.employeeName.trim().toUpperCase()))
  );
  const namesToCreate = uniqueNames.filter((n) => !employeeIdByName.has(n));

  const employeesCreated: NewEmployee[] = [];

  if (namesToCreate.length > 0) {
    const adminClient = createAdminClient();
    const usedEmails = new Set(
      (existingProfiles ?? []).map((p) => p.full_name).filter(Boolean)
    );

    for (const upperName of namesToCreate) {
      const displayName = upperName
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      let emailLocal = slugify(displayName);
      let email = `${emailLocal}@crewflow.local`;
      let suffix = 2;
      while (usedEmails.has(email)) {
        email = `${emailLocal}${suffix}@crewflow.local`;
        suffix += 1;
      }
      usedEmails.add(email);

      const tempPassword = generateTempPassword();

      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: displayName },
        });

      if (createError || !created.user) {
        console.error("confirmScheduleImport createUser error:", createError);
        warnings.push(
          `No se pudo crear la cuenta para "${displayName}": ${createError?.message ?? "error desconocido"}.`
        );
        continue;
      }

      // Área tomada del primer turno detectado para este empleado — el
      // Excel los agrupa por bloque SERVICIO/COCINA, así que suele ser
      // consistente; el admin puede corregirla luego si hace falta.
      const area = entries.find(
        (e) => e.employeeName.trim().toUpperCase() === upperName
      )?.area;

      const { error: upsertError } = await adminClient.from("profiles").upsert({
        id: created.user.id,
        full_name: displayName,
        email,
        role: "employee",
        area,
      });
      if (upsertError) {
        console.error("confirmScheduleImport profile upsert error:", upsertError);
      }

      employeeIdByName.set(upperName, created.user.id);
      employeesCreated.push({ fullName: displayName, email, tempPassword });
    }
  }

  const relevantEmployeeIds = Array.from(
    new Set(
      entries
        .map((e) => employeeIdByName.get(e.employeeName.trim().toUpperCase()))
        .filter(Boolean)
    )
  ) as string[];

  const { data: approvedAbsences } = await supabase
    .from("time_off_requests")
    .select("employee_id, start_date, end_date")
    .in("employee_id", relevantEmployeeIds)
    .eq("status", "aprobada")
    .in("request_type", ["dia_libre", "vacaciones"]);

  function hasApprovedAbsence(employeeId: string, date: string): boolean {
    return (approvedAbsences ?? []).some(
      (a) => a.employee_id === employeeId && a.start_date <= date && a.end_date >= date
    );
  }

  const rowsToInsert: {
    employee_id: string;
    branch_id: string;
    area: "servicio" | "cocina";
    shift_date: string;
    start_time: string;
    end_time: string;
  }[] = [];

  const skipReasons = new Map<string, number>();
  const bump = (reason: string) => skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);

  for (const entry of entries) {
    const employeeId = employeeIdByName.get(entry.employeeName.trim().toUpperCase());
    if (!employeeId) {
      bump("Empleado sin cuenta (omitido)");
      continue;
    }
    if (hasApprovedAbsence(employeeId, entry.date)) {
      bump("Conflicto con permiso aprobado");
      continue;
    }
    rowsToInsert.push({
      employee_id: employeeId,
      branch_id: entry.branchId,
      area: entry.area,
      shift_date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
    });
  }

  let shiftsCreated = 0;
  if (rowsToInsert.length > 0) {
    const { data: upserted, error: upsertShiftsError } = await supabase
      .from("shifts")
      .upsert(rowsToInsert, { onConflict: "employee_id,shift_date,start_time" })
      .select("id");

    if (upsertShiftsError) {
      console.error("confirmScheduleImport shifts upsert error:", upsertShiftsError);
      return {
        error: "Se procesó el archivo pero no se pudieron guardar los turnos. Intenta de nuevo.",
        summary: null,
      };
    }
    shiftsCreated = upserted?.length ?? rowsToInsert.length;
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/dashboard");

  return {
    error: null,
    summary: {
      employeesCreated,
      shiftsCreated,
      shiftsSkipped: Array.from(skipReasons, ([reason, count]) => ({ reason, count })),
      warnings,
    },
  };
}
