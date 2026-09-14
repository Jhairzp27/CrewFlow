-- =====================================================================
-- CrewFlow — Marca de turnos sugeridos por "Generar borrador"
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 06_shifts_schedule.sql (shifts)
-- =====================================================================

alter table public.shifts
  add column if not exists suggested boolean not null default false;

comment on column public.shifts.suggested is
  'true = creado por "Generar borrador" (IA) y todavía no revisado por el admin. Se limpia a false al aprobarlo o editarlo — nunca se vuelve true desde la UI manual.';
