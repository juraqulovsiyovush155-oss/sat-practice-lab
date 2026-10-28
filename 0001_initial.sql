-- SAT Practice Lab: initial secure schema.
-- Apply in Supabase SQL Editor. Review before using in production.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','student');
create type public.sat_section as enum ('math','reading_writing');
create type public.test_kind as enum ('topic','mock');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER helper avoids recursive profile RLS checks.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind public.test_kind not null,
  section public.sat_section,
  topic text,
  duration_seconds integer not null default 300 check (duration_seconds > 0),
  published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  section public.sat_section not null,
  topic text not null,
  prompt text not null,
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4),
  position integer not null default 0
);

-- Answer keys live in a separate table with no client grants.
create table public.question_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  answer_index smallint not null check (answer_index between 0 and 3),
  explanation text not null default ''
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  test_id uuid not null references public.tests(id),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  correct_count integer,
  question_count integer,
  estimated_score integer check (estimated_score between 400 and 1600)
);

create table public.attempt_answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  selected_index smallint check (selected_index between 0 and 3),
  is_correct boolean,
  primary key (attempt_id, question_id)
);

create index tests_published_idx on public.tests(published, created_at desc);
create index questions_test_position_idx on public.questions(test_id, position);
create index attempts_student_submitted_idx on public.attempts(student_id, submitted_at desc);

-- Explicitly revoke broad client grants before granting minimum access.
revoke all on public.profiles, public.tests, public.questions, public.question_keys, public.attempts, public.attempt_answers from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.tests to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_keys to authenticated;
grant select on public.attempts to authenticated;
grant select on public.attempt_answers to authenticated;
-- No client role gets SELECT on question_keys, INSERT/UPDATE on answer keys, or direct attempt writes.

alter table public.profiles enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

create policy "Read own profile or admin reads profiles"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

create policy "Users update own profile name only"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Students read published tests; admins read all"
on public.tests for select to authenticated
using (published = true or (select public.is_admin()));

create policy "Students read questions of published tests; admins read all"
on public.questions for select to authenticated
using (
  (select public.is_admin())
  or exists (select 1 from public.tests t where t.id = test_id and t.published = true)
);

-- No policy and no grants for question_keys: inaccessible directly to client roles.
create policy "Students read own attempts; admins read all"
on public.attempts for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_admin()));

create policy "Students read answers from own attempts; admins read all"
on public.attempt_answers for select to authenticated
using (
  (select public.is_admin())
  or exists (select 1 from public.attempts a where a.id = attempt_id and a.student_id = (select auth.uid()))
);

-- Secure RPC: returns prompts/options only, never answer key.
create function public.get_test_questions(p_test_id uuid)
returns table (
  id uuid,
  section public.sat_section,
  topic text,
  prompt text,
  choices jsonb,
  position integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tests t
    where t.id = p_test_id and (t.published = true or public.is_admin())
  ) then
    raise exception 'Test not found or not published';
  end if;

  return query
  select q.id, q.section, q.topic, q.prompt, q.choices, q.position
  from public.questions q
  where q.test_id = p_test_id
  order by q.position, q.id;
end;
$$;

grant execute on function public.get_test_questions(uuid) to authenticated;

-- Secure server-side grading. The browser submits selected choices only.
create function public.submit_test_attempt(p_test_id uuid, p_answers jsonb)
returns table (attempt_id uuid, correct_count integer, question_count integer, estimated_score integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_attempt uuid;
  v_total integer;
  v_correct integer;
  v_pct numeric;
  v_score integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Answers must be a JSON array'; end if;
  if not exists (select 1 from public.tests t where t.id = p_test_id and t.published = true) then
    raise exception 'Test not found or not published';
  end if;

  select count(*) into v_total from public.questions q where q.test_id = p_test_id;
  if v_total = 0 then raise exception 'Test has no questions'; end if;

  insert into public.attempts(student_id, test_id, started_at)
  values (v_user, p_test_id, now()) returning id into v_attempt;

  insert into public.attempt_answers(attempt_id, question_id, selected_index, is_correct)
  select v_attempt,
         q.id,
         case when (a.item ->> 'selected_index') ~ '^[0-3]$' then (a.item ->> 'selected_index')::smallint else null end,
         case
           when (a.item ->> 'selected_index') ~ '^[0-3]$'
             then ((a.item ->> 'selected_index')::smallint = k.answer_index)
           else false
         end
  from jsonb_array_elements(p_answers) a(item)
  join public.questions q on q.id = (a.item ->> 'question_id')::uuid and q.test_id = p_test_id
  join public.question_keys k on k.question_id = q.id
  on conflict (attempt_id, question_id) do update
    set selected_index = excluded.selected_index, is_correct = excluded.is_correct;

  -- Record unanswered questions too, so the denominator is the full test length.
  insert into public.attempt_answers(attempt_id, question_id, selected_index, is_correct)
  select v_attempt, q.id, null, false
  from public.questions q
  where q.test_id = p_test_id
    and not exists (
      select 1 from public.attempt_answers aa
      where aa.attempt_id = v_attempt and aa.question_id = q.id
    );

  select count(*) filter (where aa.is_correct)
  into v_correct
  from public.attempt_answers aa where aa.attempt_id = v_attempt;

  select count(*) into v_total
  from public.questions q where q.test_id = p_test_id;

  -- Coarse demo estimate only; not official College Board scoring.
  v_pct := case when v_total = 0 then 0 else v_correct::numeric / v_total end;
  v_score := least(1600, greatest(400, round(400 + v_pct * 1200)::integer));

  update public.attempts
  set submitted_at = now(), correct_count = v_correct, question_count = v_total, estimated_score = v_score
  where id = v_attempt and student_id = v_user;

  return query select v_attempt, v_correct, v_total, v_score;
end;
$$;

grant execute on function public.submit_test_attempt(uuid, jsonb) to authenticated;

-- Admin-only test creation and publishing should use RLS policies plus safe UI.
create policy "Admins create tests"
on public.tests for insert to authenticated
with check ((select public.is_admin()) and created_by = (select auth.uid()));

create policy "Admins update tests"
on public.tests for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins manage questions"
on public.questions for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins manage answer keys"
on public.question_keys for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Only admins can insert/update/delete attempts and answers directly; normal students use RPC.
create policy "Admins manage attempts"
on public.attempts for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins manage attempt answers"
on public.attempt_answers for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Set your own user as admin after registering and replacing the email below:
-- update public.profiles p set role = 'admin'
-- from auth.users u
-- where p.id = u.id and u.email = 'YOUR_ADMIN_EMAIL';
