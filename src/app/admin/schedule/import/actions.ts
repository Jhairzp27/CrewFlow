"use server";

import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseScheduleWorkbook, parseShiftRange } from "./parse";

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

export type ImportState = {
  error: string | null;
  summary: ImportSummary | null;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url"); // 12 chars, sin ambigüedad
}

export async function importScheduleFromExcel(
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Debes iniciar sesión.", summary: null };
  }

  // Confirma que quien llama es admin antes de usar el cliente con Service
  // Role (que se salta RLS por completo) — nunca confíes en esto solo por
  // el lado del cliente.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: "Solo un administrador puede importar horarios.", summary: null };
  }

  const branchId = formData.get("branch_id") as string;
  const closingTime = formData.get("closing_time") as string;
  const file = formData.get("file") as File | null;

  if (!branchId || !closingTime || !file || file.size === 0) {
    return { error: "Completa la sucursal, la hora de cierre y el archivo.", summary: null };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "El archivo supera el límite de 5 MB.", summary: null };
  }

  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    return { error: "Solo se aceptan archivos .xlsx.", summary: null };
  }

  const arrayBuffer = await file.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch (err) {
    console.error("importScheduleFromExcel load error:", err);
    return { error: "No se pudo leer el archivo. ¿Es un .xlsx válido?", summary: null };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { error: "El archivo no tiene hojas.", summary: null };
  }

  const { entries, skipped, warnings } = parseScheduleWorkbook(sheet);

  if (entries.length === 0) {
    return {
      error: "No se encontraron turnos para importar en el archivo.",
      summary: null,
    };
  }

  // ---- Resolver empleados por nombre (case-insensitive) ----
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
    const admin = createAdminClient();
    const usedEmails = new Set(
      (existingProfiles ?? []).map((p) => p.full_name).filter(Boolean)
    );

    for (const upperName of namesToCreate) {
      // Nombre "bonito": una sola palabra en mayúscula por término.
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
        await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: displayName },
        });

      if (createError || !created.user) {
        console.error("importScheduleFromExcel createUser error:", createError);
        warnings.push(
          `No se pudo crear la cuenta para "${displayName}": ${createError?.message ?? "error desconocido"}.`
        );
        continue;
      }

      // Upsert defensivo: no depender únicamente del timing del trigger
      // handle_new_user para que el perfil quede disponible de inmediato.
      const { error: upsertError } = await admin.from("profiles").upsert({
        id: created.user.id,
        full_name: displayName,
        email,
        role: "employee",
      });
      if (upsertError) {
        console.error("importScheduleFromExcel profile upsert error:", upsertError);
      }

      employeeIdByName.set(upperName, created.user.id);
      employeesCreated.push({ fullName: displayName, email, tempPassword });
    }
  }

  // ---- Cruce con permisos aprobados (mismas reglas que crear/editar turno) ----
  const relevantEmployeeIds = Array.from(
    new Set(entries.map((e) => employeeIdByName.get(e.employeeName.trim().toUpperCase())).filter(Boolean))
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

  // ---- Construir e insertar los turnos ----
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

  for (const reason of ["libre", "vacaciones"] as const) {
    const count = skipped.filter((s) => s.reason === reason).length;
    if (count > 0) skipReasons.set(reason === "libre" ? "Día libre" : "Vacaciones", count);
  }

  for (const entry of entries) {
    const employeeId = employeeIdByName.get(entry.employeeName.trim().toUpperCase());
    if (!employeeId) {
      bump("Empleado sin cuenta (omitido)");
      continue;
    }

    const range = parseShiftRange(entry.rawValue, closingTime);
    if (!range.ok) {
      warnings.push(`${entry.employeeName} (${entry.date}): ${range.error}`);
      bump("No se pudo interpretar el horario");
      continue;
    }

    if (hasApprovedAbsence(employeeId, entry.date)) {
      bump("Conflicto con permiso aprobado");
      continue;
    }

    rowsToInsert.push({
      employee_id: employeeId,
      branch_id: branchId,
      area: entry.area,
      shift_date: entry.date,
      start_time: range.startTime,
      end_time: range.endTime,
    });
  }

  let shiftsCreated = 0;
  if (rowsToInsert.length > 0) {
    const { data: upserted, error: upsertShiftsError } = await supabase
      .from("shifts")
      .upsert(rowsToInsert, {
        onConflict: "employee_id,shift_date,start_time",
      })
      .select("id");

    if (upsertShiftsError) {
      console.error("importScheduleFromExcel shifts upsert error:", upsertShiftsError);
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
