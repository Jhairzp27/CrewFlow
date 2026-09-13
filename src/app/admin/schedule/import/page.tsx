import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ImportForm } from "./ImportForm";
import { infoBoxClass } from "@/components/formStyles";

export default async function ImportSchedulePage() {
  const supabase = await createClient();

  const { data: branchesData } = await supabase
    .from("branches")
    .select("id, code, name")
    .order("code");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">
          Importar horario desde Excel
        </h1>
        <Link
          href="/admin/schedule"
          className="text-sm text-muted hover:text-foreground hover:underline"
        >
          ← Planificador de turnos
        </Link>
      </div>

      <div className={infoBoxClass}>
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
          <li>
            El archivo no necesita indicar sucursal — se asigna en el
            siguiente paso, por empleado y por día.
          </li>
        </ul>
      </div>

      <ImportForm branches={branchesData ?? []} />
    </div>
  );
}
