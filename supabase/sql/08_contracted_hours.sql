-- =====================================================================
-- CrewFlow — Sprint 7: Horas contratadas por empleado
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 02_business_rules_schema.sql (profiles)
-- =====================================================================

alter table public.profiles
  add column if not exists weekly_contracted_hours integer not null default 40
    check (weekly_contracted_hours > 0);

comment on column public.profiles.weekly_contracted_hours is
  'Horas semanales de contrato del empleado, usadas para la barra de progreso del planificador y las alertas de exceso de horas.';
