-- =====================================================================
-- CrewFlow — Sprint 6: Umbral de Desgaste Laboral
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 02_business_rules_schema.sql (business_rules)
-- =====================================================================

insert into public.business_rules (key, value, description) values
  ('umbral_dias_consecutivos', '5',
    'Días consecutivos trabajados a partir de los cuales se genera una alerta de desgaste laboral (con 2 días libres/semana, 6+ días seguidos rompe la política).')
on conflict (key) do update
  set value = excluded.value,
      description = excluded.description;
