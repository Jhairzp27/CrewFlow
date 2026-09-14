-- =====================================================================
-- CrewFlow — Tutorial del administrador
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 02_business_rules_schema.sql (profiles)
-- =====================================================================

alter table public.profiles
  add column if not exists onboarding_dismissed boolean not null default false;

comment on column public.profiles.onboarding_dismissed is
  'true cuando el admin cerró el tutorial de forma permanente ("Entendido, no volver a mostrar"). El botón flotante "❓ Tutorial" lo vuelve a abrir cuando quiera.';
