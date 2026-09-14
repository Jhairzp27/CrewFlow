"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type ShiftFormState = {
  error: string | null;
  success: boolean;
};

const AREAS = ["servicio", "cocina"] as const;
type Area = (typeof AREAS)[number];

type ParsedShiftInput =
  | {
      ok: true;
      employeeId: string;
      branchId: string;
      area: Area;
      shiftDate: string;
      startTime: string;
      endTime: string;
    }
  | { ok: false; error: string };

function parseShiftFormData(formData: FormData): ParsedShiftInput {
  const employeeId = formData.get("employee_id") as string;
  const branchId = formData.get("branch_id") as string;
  const area = formData.get("area") as string;
  const shiftDate = formData.get("shift_date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;

  if (!employeeId || !branchId || !shiftDate || !startTime || !endTime) {
    return { ok: false, error: "Completa todos los campos." };
  }

  if (!AREAS.includes(area as Area)) {
    return { ok: false, error: "Área inválida." };
  }

  if (endTime <= startTime) {
    return { ok: false, error: "La hora de fin debe ser posterior a la de inicio." };
  }

  return {
    ok: true,
    employeeId,
    branchId,
    area: area as Area,
    shiftDate,
    startTime,
    endTime,
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Cruce con permisos aprobados: no se puede asignar (ni reasignar) un turno
// el mismo día de una vacación o día libre ya aprobado. (El permiso por horas
// no bloquea: es una ausencia parcial, no un día completo fuera). Compartido
// por createShift y updateShift para que ambos apliquen la misma regla.
async function findApprovedAbsenceConflict(
  supabase: SupabaseServerClient,
  employeeId: string,
  shiftDate: string
): Promise<string | null> {
  const { data: conflicts, error } = await supabase
    .from("time_off_requests")
    .select("request_type")
    .eq("employee_id", employeeId)
    .eq("status", "aprobada")
    .in("request_type", ["dia_libre", "vacaciones"])
    .lte("start_date", shiftDate)
    .gte("end_date", shiftDate);

  if (error) {
    console.error("shift conflict check error:", error);
    return "No se pudo validar los permisos del empleado. Intenta de nuevo.";
  }

  if (conflicts && conflicts.length > 0) {
    const kind =
      conflicts[0].request_type === "vacaciones"
        ? "vacaciones aprobadas"
        : "un día libre aprobado";
    return `No se puede asignar el turno: el empleado tiene ${kind} ese día.`;
  }

  return null;
}

export async function createShift(
  _prevState: ShiftFormState,
  formData: FormData
): Promise<ShiftFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión.", success: false };
  }

  const parsed = parseShiftFormData(formData);
  if (!parsed.ok) {
    return { error: parsed.error, success: false };
  }

  const conflictError = await findApprovedAbsenceConflict(
    supabase,
    parsed.employeeId,
    parsed.shiftDate
  );
  if (conflictError) {
    return { error: conflictError, success: false };
  }

  const { error: insertError } = await supabase.from("shifts").insert({
    employee_id: parsed.employeeId,
    branch_id: parsed.branchId,
    area: parsed.area,
    shift_date: parsed.shiftDate,
    start_time: parsed.startTime,
    end_time: parsed.endTime,
  });

  if (insertError) {
    console.error("createShift insert error:", insertError);
    if (insertError.code === "23505") {
      return {
        error: "Ese empleado ya tiene un turno registrado con esa fecha y hora de inicio.",
        success: false,
      };
    }
    return {
      error: "No se pudo crear el turno. Intenta de nuevo.",
      success: false,
    };
  }

  revalidatePath("/admin/schedule");
  return { error: null, success: true };
}

export async function updateShift(
  shiftId: string,
  _prevState: ShiftFormState,
  formData: FormData
): Promise<ShiftFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión.", success: false };
  }

  const parsed = parseShiftFormData(formData);
  if (!parsed.ok) {
    return { error: parsed.error, success: false };
  }

  const conflictError = await findApprovedAbsenceConflict(
    supabase,
    parsed.employeeId,
    parsed.shiftDate
  );
  if (conflictError) {
    return { error: conflictError, success: false };
  }

  const { error: updateError } = await supabase
    .from("shifts")
    .update({
      employee_id: parsed.employeeId,
      branch_id: parsed.branchId,
      area: parsed.area,
      shift_date: parsed.shiftDate,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      // Editar un turno sugerido por "Generar borrador" equivale a
      // revisarlo y aprobarlo — deja de marcarse como sugerencia.
      suggested: false,
    })
    .eq("id", shiftId);

  if (updateError) {
    console.error("updateShift error:", updateError);
    if (updateError.code === "23505") {
      return {
        error: "Ese empleado ya tiene un turno registrado con esa fecha y hora de inicio.",
        success: false,
      };
    }
    return {
      error: "No se pudo actualizar el turno. Intenta de nuevo.",
      success: false,
    };
  }

  revalidatePath("/admin/schedule");

  const week = formData.get("week") as string;
  redirect(week ? `/admin/schedule?week=${week}` : "/admin/schedule");
}

/** Aprueba un turno sugerido por "Generar borrador" sin cambiar nada más. */
export async function approveSuggestedShift(shiftId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("shifts")
    .update({ suggested: false })
    .eq("id", shiftId);

  if (error) {
    console.error("approveSuggestedShift error:", error);
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/dashboard");
}

export async function deleteShift(shiftId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);

  if (error) {
    console.error("deleteShift error:", error);
  }

  revalidatePath("/admin/schedule");
}
