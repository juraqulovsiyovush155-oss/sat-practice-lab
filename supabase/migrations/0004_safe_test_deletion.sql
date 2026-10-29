-- Admin-only deletion for tests without student attempts. Keeps student history intact.
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
  if exists (select 1 from public.attempts a where a.test_id = p_test_id) then
    raise exception 'Bu testda o‘quvchi urinishlari bor. Natijalarni saqlash uchun testni o‘chirib bo‘lmaydi.';
  end if;
  delete from public.tests where id = p_test_id;
  if not found then raise exception 'Test topilmadi'; end if;
end;
$$;

revoke all on function public.delete_test(uuid) from public;
grant execute on function public.delete_test(uuid) to authenticated;
