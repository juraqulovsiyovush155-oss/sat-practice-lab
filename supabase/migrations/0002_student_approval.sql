-- Gate student access behind explicit admin approval.
alter table public.profiles
  add column if not exists email text,
  add column if not exists approved boolean not null default true;

-- Existing rows get true once; all future registrations default to pending.
alter table public.profiles
  alter column approved set default false;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role, approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',''),
    new.email,
    'student',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (p.role = 'admin' or p.approved = true)
  );
$$;

revoke all on function public.is_approved_user() from public;
grant execute on function public.is_approved_user() to authenticated;

create or replace function public.set_student_access(p_student_id uuid, p_allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.profiles
  set approved = p_allowed
  where id = p_student_id and role = 'student';

  if not found then
    raise exception 'Student not found';
  end if;
end;
$$;

revoke all on function public.set_student_access(uuid, boolean) from public;
grant execute on function public.set_student_access(uuid, boolean) to authenticated;

drop policy if exists "Students read published tests; admins read all" on public.tests;
drop policy if exists "Approved students read published tests; admins read all" on public.tests;
create policy "Approved students read published tests; admins read all"
on public.tests for select to authenticated
using (
  (published = true and (select public.is_approved_user()))
  or (select public.is_admin())
);

drop policy if exists "Students read questions of published tests; admins read all" on public.questions;
drop policy if exists "Approved students read questions of published tests; admins read all" on public.questions;
create policy "Approved students read questions of published tests; admins read all"
on public.questions for select to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_approved_user())
    and exists (
      select 1 from public.tests t
      where t.id = test_id and t.published = true
    )
  )
);

drop policy if exists "Students read own attempts; admins read all" on public.attempts;
drop policy if exists "Approved students read own attempts; admins read all" on public.attempts;
create policy "Approved students read own attempts; admins read all"
on public.attempts for select to authenticated
using (
  (select public.is_admin())
  or (
    student_id = (select auth.uid())
    and (select public.is_approved_user())
  )
);

drop policy if exists "Students read answers from own attempts; admins read all" on public.attempt_answers;
drop policy if exists "Approved students read answers from own attempts; admins read all" on public.attempt_answers;
create policy "Approved students read answers from own attempts; admins read all"
on public.attempt_answers for select to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_approved_user())
    and exists (
      select 1 from public.attempts a
      where a.id = attempt_id and a.student_id = (select auth.uid())
    )
  )
);

create or replace function public.get_test_questions(p_test_id uuid)
returns table (
  id uuid,
  section public.sat_section,
  topic text,
  prompt text,
  choices jsonb,
  "position" integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tests t
    where t.id = p_test_id
      and (
        (t.published = true and public.is_approved_user())
        or public.is_admin()
      )
  ) then
    raise exception 'Test not found or access not approved';
  end if;

  return query
  select q.id, q.section, q.topic, q.prompt, q.choices, q.position
  from public.questions q
  where q.test_id = p_test_id
  order by q.position, q.id;
end;
$$;

grant execute on function public.get_test_questions(uuid) to authenticated;

create or replace function public.require_approved_attempt_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_approved_user() then
    raise exception 'Student access is waiting for admin approval';
  end if;
  return new;
end;
$$;

drop trigger if exists require_approved_attempt_student on public.attempts;
create trigger require_approved_attempt_student
before insert on public.attempts
for each row execute function public.require_approved_attempt_student();

revoke all on function public.require_approved_attempt_student() from public;
