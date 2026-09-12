"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type TimeOffRequestState = {
  error: string | null;
  success: boolean;
  // Next.js remonta este formulario tras cada envío del Server Action (pierde
  // el useState local), así que el tipo elegido viaja aquí para que el select
  // pueda re-inicializarse con el último valor en vez de volver a "dia_libre".
  requestType: RequestType | null;
};

const REQUEST_TYPES = ["vacaciones", "dia_libre", "permiso_horas"] as const;
const EXCEPTION_REASONS = ["emergencia_medica", "fuerza_mayor"] as const;

type RequestType = (typeof REQUEST_TYPES)[number];
type ExceptionReason = (typeof EXCEPTION_REASONS)[number];

const DEFAULT_MIN_ADVANCE_DAYS = 10;
const DEFAULT_BLOCKED_DAYS = [5, 6, 7]; // ISO: viernes, sábado, domingo

function isoDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  return jsDay === 0 ? 7 : jsDay;
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function createTimeOffRequest(
  _prevState: TimeOffRequestState,
  formData: FormData
): Promise<TimeOffRequestState> {
  const requestTypeRaw = formData.get("request_type") as RequestType;
  const requestType = REQUEST_TYPES.includes(requestTypeRaw)
    ? requestTypeRaw
    : null;

  // Este formulario se remonta tras cada envío (useState local no sobrevive),
  // así que devolvemos el tipo elegido en todo `return` para que el select
  // pueda re-inicializarse con él en vez de volver siempre a "dia_libre".
  const fail = (error: string): TimeOffRequestState => ({
    error,
    success: false,
    requestType,
  });

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("Debes iniciar sesión.");
  }

  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || startDate;
  const startTime = (formData.get("start_time") as string) || null;
  const endTime = (formData.get("end_time") as string) || null;
  const exceptionReasonRaw = formData.get("exception_reason") as string;
  const exceptionReason = EXCEPTION_REASONS.includes(
    exceptionReasonRaw as ExceptionReason
  )
    ? (exceptionReasonRaw as ExceptionReason)
    : null;
  const reason = (formData.get("reason") as string) || null;

  if (!requestType) {
    return fail("Tipo de solicitud inválido.");
  }

  if (!startDate) {
    return fail("La fecha de inicio es obligatoria.");
  }

  if (endDate < startDate) {
    return fail("La fecha de fin no puede ser anterior a la fecha de inicio.");
  }

  if (requestType === "permiso_horas") {
    if (!startTime || !endTime) {
      return fail("El permiso por horas requiere hora de inicio y de fin.");
    }
    if (startDate !== endDate) {
      return fail("El permiso por horas debe solicitarse dentro de un solo día.");
    }
    if (endTime <= startTime) {
      return fail("La hora de fin debe ser posterior a la hora de inicio.");
    }
  }

  // Reglas de antelación y de fin de semana (RN-2 y RN-4 del documento de negocio).
  // Aplican a "dia_libre" siempre, y a "vacaciones" solo la antelación de 10 días.
  if (requestType === "dia_libre" || requestType === "vacaciones") {
    const { data: rules } = await supabase
      .from("business_rules")
      .select("key, value")
      .in("key", ["dias_antelacion_permiso_regular", "dias_bloqueados_dia_libre"]);

    const rulesMap = new Map(rules?.map((r) => [r.key, r.value]) ?? []);

    // Una excepción real (emergencia médica / fuerza mayor) elude tanto el
    // bloqueo de fin de semana como la antelación de 10 días. Solo aplica a
    // "dia_libre": la solicitud queda "pendiente" para que el Administrador
    // la valide o la rechace.
    const isExempt = requestType === "dia_libre" && exceptionReason !== null;

    if (!isExempt) {
      if (requestType === "dia_libre") {
        const blockedDays =
          (rulesMap.get("dias_bloqueados_dia_libre") as number[] | undefined) ??
          DEFAULT_BLOCKED_DAYS;

        const hitsBlockedDay = datesBetween(startDate, endDate).some((d) =>
          blockedDays.includes(isoDayOfWeek(d))
        );

        if (hitsBlockedDay) {
          return fail(
            "No se permiten solicitudes de día libre regular de viernes a domingo."
          );
        }
      }

      const minAdvanceDays =
        (rulesMap.get("dias_antelacion_permiso_regular") as
          | number
          | undefined) ?? DEFAULT_MIN_ADVANCE_DAYS;

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const requestStart = new Date(`${startDate}T00:00:00Z`);
      const diffDays = Math.floor(
        (requestStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < minAdvanceDays) {
        const suffix =
          requestType === "dia_libre"
            ? " Si es una emergencia médica o fuerza mayor, indícalo en el formulario."
            : "";
        return fail(
          `Esta solicitud requiere al menos ${minAdvanceDays} días de anticipación.${suffix}`
        );
      }
    }
  }

  const { error: insertError } = await supabase.from("time_off_requests").insert({
    employee_id: user.id,
    request_type: requestType,
    start_date: startDate,
    end_date: endDate,
    start_time: requestType === "permiso_horas" ? startTime : null,
    end_time: requestType === "permiso_horas" ? endTime : null,
    exception_reason: requestType === "dia_libre" ? exceptionReason : null,
    reason,
  });

  if (insertError) {
    return fail("No se pudo registrar la solicitud. Intenta de nuevo.");
  }

  revalidatePath("/employee/schedule");
  return { error: null, success: true, requestType };
}

export async function cancelTimeOffRequest(requestId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // La política RLS "time_off_employee_delete_pending" ya restringe esto a
  // solicitudes propias y en estado "pendiente"; los filtros de aquí son
  // defensivos y hacen explícita la regla en el código de la aplicación.
  const { error } = await supabase
    .from("time_off_requests")
    .delete()
    .eq("id", requestId)
    .eq("employee_id", user.id)
    .eq("status", "pendiente");

  if (error) {
    console.error("cancelTimeOffRequest error:", error);
  }

  revalidatePath("/employee/schedule");
}
