import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la Service Role Key: se salta RLS por completo.
 * SOLO se usa server-side, en Server Actions que ya verifican que quien
 * llama es un admin autenticado (ver createClient() en ./server.ts para esa
 * verificación) — nunca se expone al navegador ni se importa desde un
 * componente cliente. La key vive en SUPABASE_SERVICE_ROLE_KEY (sin prefijo
 * NEXT_PUBLIC_) para que Next.js no la incluya en ningún bundle del cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
