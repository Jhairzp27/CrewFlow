-- =====================================================================
-- CrewFlow — Sprint 3 (ajuste): Cancelación de solicitudes propias
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Requiere: 03_time_off_requests.sql
-- =====================================================================

-- Un empleado puede eliminar únicamente sus propias solicitudes,
-- y solo mientras sigan en estado "pendiente". Se combina (OR) con la
-- policy "time_off_admin_delete" ya existente, que cubre a los admins.
drop policy if exists "time_off_employee_delete_pending" on public.time_off_requests;
create policy "time_off_employee_delete_pending"
  on public.time_off_requests for delete
  to authenticated
  using (employee_id = auth.uid() and status = 'pendiente');
