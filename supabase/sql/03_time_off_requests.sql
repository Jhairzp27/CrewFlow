-- =====================================================================
-- CrewFlow — Sprint 3: Solicitudes de Permisos y Vacaciones
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 02_business_rules_schema.sql (profiles, is_admin(), set_updated_at())
-- =====================================================================

-- ---------- Tipos ----------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'time_off_request_type' and n.nspname = 'public'
  ) then
    create type public.time_off_request_type as enum ('vacaciones', 'dia_libre', 'permiso_horas');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'time_off_status' and n.nspname = 'public'
  ) then
    create type public.time_off_status as enum ('pendiente', 'aprobada', 'rechazada');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'time_off_exception_reason' and n.nspname = 'public'
  ) then
    create type public.time_off_exception_reason as enum ('emergencia_medica', 'fuerza_mayor');
  end if;
end $$;

-- =====================================================================
-- 1. TABLA time_off_requests
-- =====================================================================
create table if not exists public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  request_type public.time_off_request_type not null,
  status public.time_off_status not null default 'pendiente',
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  exception_reason public.time_off_exception_reason,
  reason text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_off_dates_valid
    check (end_date >= start_date),
  constraint time_off_hours_required_for_permiso
    check (request_type <> 'permiso_horas' or (start_time is not null and end_time is not null)),
  constraint time_off_hours_order_valid
    check (start_time is null or end_time is null or end_time > start_time),
  constraint time_off_exception_only_for_dia_libre
    check (exception_reason is null or request_type = 'dia_libre')
);

create index if not exists idx_time_off_employee on public.time_off_requests (employee_id);
create index if not exists idx_time_off_status on public.time_off_requests (status);

drop trigger if exists set_time_off_requests_updated_at on public.time_off_requests;
create trigger set_time_off_requests_updated_at
  before update on public.time_off_requests
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================================
alter table public.time_off_requests enable row level security;

-- Empleados ven sus propias solicitudes; admins ven todas.
drop policy if exists "time_off_select_own_or_admin" on public.time_off_requests;
create policy "time_off_select_own_or_admin"
  on public.time_off_requests for select
  to authenticated
  using (employee_id = auth.uid() or public.is_admin());

-- Un empleado solo puede crear solicitudes propias, en estado "pendiente"
-- y sin auto-asignarse una revisión (evita que salte la aprobación vía API directa).
drop policy if exists "time_off_employee_insert" on public.time_off_requests;
create policy "time_off_employee_insert"
  on public.time_off_requests for insert
  to authenticated
  with check (
    employee_id = auth.uid()
    and status = 'pendiente'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Solo los admins aprueban/rechazan/editan solicitudes.
drop policy if exists "time_off_admin_update" on public.time_off_requests;
create policy "time_off_admin_update"
  on public.time_off_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "time_off_admin_delete" on public.time_off_requests;
create policy "time_off_admin_delete"
  on public.time_off_requests for delete
  to authenticated
  using (public.is_admin());
