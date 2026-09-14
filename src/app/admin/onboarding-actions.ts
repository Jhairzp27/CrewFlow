"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/** El admin marcó "Entendido, no volver a mostrar" en el tutorial. */
export async function dismissOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_dismissed: true })
    .eq("id", user.id);

  if (error) {
    console.error("dismissOnboarding error:", error);
  }

  revalidatePath("/admin");
}
