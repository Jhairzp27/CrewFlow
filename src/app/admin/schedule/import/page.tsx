import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions";
import { ImportForm } from "./ImportForm";

export default async function ImportSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: branchesData } = await supabase
    .from("branches")
    .select("id, code, name")
    .order("code");

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Importar horario desde Excel
            </h1>
            <Link
              href="/admin/schedule"
              className="text-sm text-gray-500 hover:underline"
            >
              ← Planificador de turnos
            </Link>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <p className="text-sm text-gray-500">
          Sesión iniciada como {user?.email}.
        </p>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium">Formato esperado del archivo:</p>
          <ul className="mt-1 list-inside list-disc">
            <li>
              Una fila con la etiqueta <strong>FECHAS</strong> y las 7 fechas
              de la semana (lunes a domingo).
            </li>
            <li>
              Bloques <strong>SERVICIO</strong> y <strong>COCINA</strong>, con
              una fila por empleado y una celda por día.
            </li>
            <li>
              Cada celda: <strong>Libre</strong>, <strong>VACACIONES</strong>,
              o un rango como <strong>11:00 a Cierre</strong> /{" "}
              <strong>10:30 a 18:30</strong>.
            </li>
            <li>Puedes incluir varias semanas apiladas en la misma hoja.</li>
          </ul>
        </div>

        <ImportForm branches={branchesData ?? []} />
      </div>
    </main>
  );
}
