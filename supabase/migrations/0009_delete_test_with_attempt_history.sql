-- Admin-confirmed test deletion also removes its student attempts and results.
-- The application requires typing the test title before it invokes this RPC
-- when any attempts exist; this function remains admin-only and atomic.
create or replace function public.delete_test(p_test_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.tests t where t.id = p_test_id) then
    raise exception 'Test topilmadi';
  end if;

  -- attempt_answers are removed by their FK cascade when each attempt is deleted.
  delete from public.attempts a where a.test_id = p_test_id;
  delete from public.tests t where t.id = p_test_id;
end;
$$;

revoke all on function public.delete_test(uuid) from public;
grant execute on function public.delete_test(uuid) to authenticated;
