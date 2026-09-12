-- =====================================================================
-- CrewFlow — Sprint 5: Turnos y Rotación (Shifts)
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 02_business_rules_schema.sql (profiles, branches, staff_area,
--           is_admin(), set_updated_at())
-- =====================================================================

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  area public.staff_area not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_time_order_valid check (end_time > start_time),
  unique (employee_id, shift_date, start_time)
);

create index if not exists idx_shifts_employee_date
  on public.shifts (employee_id, shift_date);

create index if not exists idx_shifts_branch_date
  on public.shifts (branch_id, shift_date);

drop trigger if exists set_shifts_updated_at on public.shifts;
create trigger set_shifts_updated_at
  before update on public.shifts
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.shifts enable row level security;

-- Empleados leen únicamente sus propios turnos.
drop policy if exists "shifts_select_own_or_admin" on public.shifts;
create policy "shifts_select_own_or_admin"
  on public.shifts for select
  to authenticated
  using (employee_id = auth.uid() or public.is_admin());

-- Administradores: control total (crear, editar, eliminar turnos de cualquiera).
drop policy if exists "shifts_admin_all" on public.shifts;
create policy "shifts_admin_all"
  on public.shifts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
