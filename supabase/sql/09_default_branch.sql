-- =====================================================================
-- CrewFlow — Sucursal base por empleado
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 02_business_rules_schema.sql (profiles, branches)
-- =====================================================================

alter table public.profiles
  add column if not exists default_branch_id uuid references public.branches (id);

comment on column public.profiles.default_branch_id is
  'Sucursal fija del empleado (hay quienes hacen base fija en un local). NULL = empleado rotativo, elegible para cualquier sucursal al generar el borrador de horario. Se edita directamente en esta tabla, igual que area/role/weekly_contracted_hours.';

-- Hora de cierre por defecto para el último bloque de turno de servicio que
-- genera el borrador automático (rango de cierre confirmado: 21:30-22:00).
-- Editable aquí mismo si cambia.
insert into public.business_rules (key, value, description) values
  ('hora_cierre_default', '"22:00"',
    'Hora de fin usada para el último turno de servicio del día al generar el borrador automático de horario.')
on conflict (key) do nothing;
