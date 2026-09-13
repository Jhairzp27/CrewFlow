# CrewFlow — Checklist de despliegue a producción

Este entorno actual de Supabase se mantiene como **Staging/Demo** (datos de
prueba y usuarios ficticios intactos, para que el stakeholder del negocio
pueda interactuar con el sistema). Antes de dar acceso a empleados reales,
sigue esta lista.

## 1. Vercel (hosting)

- [ ] Crear un repositorio en GitHub y subir el proyecto (`git remote add origin ...` + `git push -u origin main`) — actualmente el repo es solo local.
- [ ] En [vercel.com/new](https://vercel.com/new), importar el repositorio (Vercel detecta Next.js automáticamente, sin configuración extra de build).
- [ ] En **Project Settings → Environment Variables**, agregar:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API Keys → "service_role" en Supabase — **secreta**, la usa la importación de horarios desde Excel para crear cuentas de empleados; nunca debe llevar el prefijo `NEXT_PUBLIC_`)
  (los mismos valores de tu `.env.local`; usa `.env.local.example` como referencia del formato).
- [ ] Desplegar y verificar el flujo completo (login, panel admin, panel empleado) en la URL `*.vercel.app` que genera Vercel.
- [ ] (Opcional) Conectar un dominio propio en **Project Settings → Domains**.

## 2. Decisión clave: ¿Staging y Producción comparten el mismo Supabase?

**Recomendado: no.** Crea un **segundo proyecto de Supabase** para producción,
separado del que se usa para probar. Así los datos reales de los
empleados nunca se mezclan con las cuentas de prueba (`admin@crewflow.test`,
`empleado@crewflow.test`, `intento@crewflow.test`).

Si creas el proyecto de producción:
- [ ] Ejecutar en orden los scripts `supabase/sql/02` a `07` en el SQL Editor del proyecto nuevo.
- [ ] Configurar variables de entorno **distintas** en Vercel para el ambiente de Production (apuntando al proyecto de producción) vs. Preview/Development (apuntando al de staging), usando los *Environment* de Vercel.
- [ ] Crear las cuentas reales de administrador y promoverlas a `admin` con el mismo patrón SQL que usamos en staging.

## 3. Seguridad en Supabase antes de invitar empleados reales

- [ ] **Correo real para Auth**: configura un proveedor SMTP propio (Authentication → Settings → SMTP) para que la confirmación de cuenta y el reseteo de contraseña lleguen a los empleados; no dependas de "Auto Confirm User" del dashboard (eso es solo para pruebas).
- [ ] **Protección de contraseñas filtradas**: activa la verificación contra HaveIBeenPwned en Authentication → Settings (gratis, un toggle).
- [ ] **Revisión de RLS**: corre el linter de Supabase (Database → Advisors) para confirmar que ninguna tabla quedó sin RLS habilitada y que no hay policies de más.
- [ ] **Nunca expongas la Service Role Key** en variables `NEXT_PUBLIC_*` ni en el cliente — hoy la usa exclusivamente `src/app/admin/schedule/import/actions.ts` (importación de Excel), server-side, protegido por una verificación explícita de rol admin antes de usarla.
- [ ] **Sin auto-registro público**: confirma que sigue sin existir una ruta `/signup` — el alta de personal debe seguir siendo manual por parte del administrador (coincide con el proceso de negocio del cliente).
- [ ] **Backups**: verifica que el plan de Supabase de producción tenga backups diarios o Point-in-Time Recovery activado.
- [ ] **Site URL**: en Authentication → URL Configuration, actualiza el "Site URL" al dominio real de producción (afecta los links que genera Supabase Auth).

## 4. Importación de horarios reales desde Excel

Admin → Planificador de turnos → **Importar desde Excel** (`/admin/schedule/import`)
lee el formato semanal del cliente (fila `FECHAS` + bloques `SERVICIO`/`COCINA`) y:
- Crea automáticamente una cuenta por cada empleado nuevo (email sintético
  `nombre.apellido@crewflow.local` + contraseña temporal, mostrada **una sola
  vez** en pantalla al terminar la importación — cópiala de inmediato, no
  queda guardada en ningún otro lugar).
- Empareja empleados por nombre exacto (sin distinguir mayúsculas). Si el
  mismo empleado aparece escrito distinto entre semanas (ej. "PEDRO" vs.
  "PEDRO RAMIREZ"), se crean como dos personas — revisa la lista de
  "empleados nuevos" tras cada importación y corrige/fusiona en Supabase si
  hace falta.
- No tiene columna de sucursal en el archivo de origen (los empleados
  rotan entre U2 y U3 dentro de la misma semana) — por eso hay un paso de
  revisión donde se asigna la sucursal por empleado y por día antes de
  confirmar, con un botón para aplicarla en bloque cuando toda la semana
  fue en la misma sucursal.
- Ya usa la misma validación de conflictos que crear/editar un turno manual
  (bloquea si el empleado tiene vacaciones/día libre aprobado ese día).

**Antes del primer día real de empleados reales:**
- [ ] Cambiar o eliminar las contraseñas de las cuentas de prueba si en algún momento se compartieron en texto plano (ej. `intento1234`, compartida en el chat de esta sesión).
- [ ] Definir el `umbral_dias_consecutivos` y demás valores de `business_rules` con el stakeholder del negocio (hoy están en los valores que definimos nosotros: 2 días libres/semana, 10 días de antelación, umbral de desgaste en 5).
- [ ] Para cada empleado creado vía importación: asignarle su `area` real si no quedó clara, y — cuando quieras que inicie sesión de verdad — actualizar su email a uno real y hacer que cambie la contraseña temporal (una vez haya SMTP configurado, puede ser por "Olvidé mi contraseña").
- [ ] El archivo de horario real (`docs/private/`) nunca se sube al repositorio — está en `.gitignore` a propósito porque contiene nombres reales de personal. Bórralo de tu disco cuando ya no lo necesites como referencia.
