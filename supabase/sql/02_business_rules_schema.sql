-- =====================================================================
-- CrewFlow — Sprint 2: Esquema de Roles, Parametrización y RLS
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- =====================================================================

-- ---------- Extensiones ----------
create extension if not exists pgcrypto;

-- ---------- Tipos ----------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role' and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('admin', 'employee');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'staff_area' and n.nspname = 'public'
  ) then
    create type public.staff_area as enum ('servicio', 'cocina');
  end if;
end $$;

-- ---------- Función utilitaria: mantener updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 1. PERFILES (roles de usuario)
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'employee',
  area public.staff_area,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea automáticamente el perfil (rol "employee" por defecto) al registrarse un usuario.
-- El Administrador ajusta luego el rol real (admin/employee) y el área (servicio/cocina).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 2. TABLAS DE PARAMETRIZACIÓN DEL NEGOCIO
-- =====================================================================

-- 2.1 Sucursales
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- 2.2 Capacidad mínima de Cocina por sucursal y día
-- day_of_week sigue ISO-8601: 1 = lunes ... 7 = domingo
create table if not exists public.kitchen_staffing_requirements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  min_staff integer not null check (min_staff >= 0),
  created_at timestamptz not null default now(),
  unique (branch_id, day_of_week)
);

create index if not exists idx_kitchen_staffing_branch
  on public.kitchen_staffing_requirements (branch_id);

-- 2.3 Horarios de ingreso de Servicio por sucursal y día
create table if not exists public.service_entry_schedules (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  entry_time time not null,
  staff_count integer not null check (staff_count > 0),
  note text,
  created_at timestamptz not null default now(),
  unique (branch_id, day_of_week, entry_time)
);

create index if not exists idx_service_entry_branch
  on public.service_entry_schedules (branch_id);

-- 2.4 Reglas globales de negocio (clave / valor)
create table if not exists public.business_rules (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_business_rules_updated_at on public.business_rules;
create trigger set_business_rules_updated_at
  before update on public.business_rules
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 3. FUNCIÓN DE APOYO PARA RLS
-- SECURITY DEFINER evita la recursión infinita al consultar "profiles"
-- desde una policy que protege a la propia tabla "profiles".
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================

-- ---------- profiles ----------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ---------- branches ----------
alter table public.branches enable row level security;

drop policy if exists "branches_select_authenticated" on public.branches;
create policy "branches_select_authenticated"
  on public.branches for select
  to authenticated
  using (true);

drop policy if exists "branches_admin_write" on public.branches;
create policy "branches_admin_write"
  on public.branches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- kitchen_staffing_requirements ----------
alter table public.kitchen_staffing_requirements enable row level security;

drop policy if exists "kitchen_staffing_select_authenticated" on public.kitchen_staffing_requirements;
create policy "kitchen_staffing_select_authenticated"
  on public.kitchen_staffing_requirements for select
  to authenticated
  using (true);

drop policy if exists "kitchen_staffing_admin_write" on public.kitchen_staffing_requirements;
create policy "kitchen_staffing_admin_write"
  on public.kitchen_staffing_requirements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- service_entry_schedules ----------
alter table public.service_entry_schedules enable row level security;

drop policy if exists "service_entry_select_authenticated" on public.service_entry_schedules;
create policy "service_entry_select_authenticated"
  on public.service_entry_schedules for select
  to authenticated
  using (true);

drop policy if exists "service_entry_admin_write" on public.service_entry_schedules;
create policy "service_entry_admin_write"
  on public.service_entry_schedules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- business_rules ----------
alter table public.business_rules enable row level security;

drop policy if exists "business_rules_select_authenticated" on public.business_rules;
create policy "business_rules_select_authenticated"
  on public.business_rules for select
  to authenticated
  using (true);

drop policy if exists "business_rules_admin_write" on public.business_rules;
create policy "business_rules_admin_write"
  on public.business_rules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 5. DATOS SEMILLA
-- =====================================================================

-- 5.1 Sucursales
insert into public.branches (code, name) values
  ('U2', 'Sucursal U2'),
  ('U3', 'Sucursal U3')
on conflict (code) do nothing;

-- 5.2 Capacidad mínima de Cocina
-- U2: 2 (lunes-jueves) / 3 (viernes-domingo)
-- U3: 1 (lunes-jueves) / 2 (viernes-domingo)
insert into public.kitchen_staffing_requirements (branch_id, day_of_week, min_staff)
select b.id, d.day_of_week, d.min_staff
from public.branches b
join (
  values
    ('U2', 1, 2), ('U2', 2, 2), ('U2', 3, 2), ('U2', 4, 2),
    ('U2', 5, 3), ('U2', 6, 3), ('U2', 7, 3),
    ('U3', 1, 1), ('U3', 2, 1), ('U3', 3, 1), ('U3', 4, 1),
    ('U3', 5, 2), ('U3', 6, 2), ('U3', 7, 2)
) as d (branch_code, day_of_week, min_staff) on d.branch_code = b.code
on conflict (branch_id, day_of_week) do update
  set min_staff = excluded.min_staff;

-- 5.3 Horarios de ingreso de Servicio
-- U2 lunes-jueves: 1 persona a las 11:00 y 2 personas a las 12:00.
--   Martes: ingreso adicional a las 10:30 para inventario.
-- U3: 2 personas a las 12:00 (regla general).
--   Sábado: ingresos escalonados a las 11:00 y 16:00.
insert into public.service_entry_schedules (branch_id, day_of_week, entry_time, staff_count, note)
select b.id, d.day_of_week, d.entry_time::time, d.staff_count, d.note
from public.branches b
join (
  values
    ('U2', 1, '11:00', 1, null),
    ('U2', 1, '12:00', 2, null),
    ('U2', 2, '10:30', 1, 'Inventario'),
    ('U2', 2, '11:00', 1, null),
    ('U2', 2, '12:00', 2, null),
    ('U2', 3, '11:00', 1, null),
    ('U2', 3, '12:00', 2, null),
    ('U2', 4, '11:00', 1, null),
    ('U2', 4, '12:00', 2, null),
    ('U3', 1, '12:00', 2, null),
    ('U3', 2, '12:00', 2, null),
    ('U3', 3, '12:00', 2, null),
    ('U3', 4, '12:00', 2, null),
    ('U3', 5, '12:00', 2, null),
    ('U3', 7, '12:00', 2, null),
    ('U3', 6, '11:00', 1, 'Ingreso escalonado'),
    ('U3', 6, '16:00', 1, 'Ingreso escalonado')
) as d (branch_code, day_of_week, entry_time, staff_count, note) on d.branch_code = b.code
on conflict (branch_id, day_of_week, entry_time) do update
  set staff_count = excluded.staff_count,
      note = excluded.note;

-- 5.4 Reglas globales
insert into public.business_rules (key, value, description) values
  ('dias_libres_por_semana', '2',
    'Días libres garantizados por semana, asignables exclusivamente de lunes a jueves.'),
  ('dias_antelacion_permiso_regular', '10',
    'Días mínimos de anticipación exigidos para una solicitud regular de día libre.'),
  ('dias_bloqueados_dia_libre', '[5, 6, 7]',
    'Días de la semana (ISO: 1=lunes..7=domingo) en que se bloquea toda solicitud de día libre regular (viernes a domingo).'),
  ('motivos_excepcion_antelacion', '["emergencia_medica", "fuerza_mayor"]',
    'Categorías que permiten a un Administrador eludir la regla de anticipación de 10 días.')
on conflict (key) do update
  set value = excluded.value,
      description = excluded.description;
