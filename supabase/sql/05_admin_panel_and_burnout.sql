-- =====================================================================
-- CrewFlow — Sprint 4: Panel de Administrador y Desgaste Laboral
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 02_business_rules_schema.sql, 03_time_off_requests.sql
-- =====================================================================

-- =====================================================================
-- 1. profiles.email — permite al panel de admin identificar al
--    solicitante sin necesitar la Service Role Key (auth.admin API).
-- =====================================================================
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- =====================================================================
-- 2. TABLA performance_notes (Módulo de Desgaste Laboral)
--    Anotaciones confidenciales de desempeño ligadas al expediente del
--    trabajador. Solo accesibles por administradores.
-- =====================================================================
create table if not exists public.performance_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  admin_id uuid not null references public.profiles (id),
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_performance_notes_employee
  on public.performance_notes (employee_id);

alter table public.performance_notes enable row level security;

-- Sin policy de select/insert para empleados: por defecto RLS deniega todo
-- acceso que no tenga una policy explícita, así que solo los admins entran.
drop policy if exists "performance_notes_admin_all" on public.performance_notes;
create policy "performance_notes_admin_all"
  on public.performance_notes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
