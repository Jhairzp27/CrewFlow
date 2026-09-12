"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function reviewTimeOffRequest(
  requestId: string,
  decision: "aprobada" | "rechazada"
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // La policy RLS "time_off_admin_update" ya exige que el usuario sea admin;
  // aquí solo construimos la actualización.
  const { error } = await supabase
    .from("time_off_requests")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    console.error("reviewTimeOffRequest error:", error);
  }

  revalidatePath("/admin/dashboard");
}

export async function addPerformanceNote(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const employeeId = formData.get("employee_id") as string;
  const note = (formData.get("note") as string)?.trim();
  if (!employeeId || !note) return;

  const { error } = await supabase.from("performance_notes").insert({
    employee_id: employeeId,
    admin_id: user.id,
    note,
  });

  if (error) {
    console.error("addPerformanceNote error:", error);
  }

  revalidatePath("/admin/dashboard");
}
