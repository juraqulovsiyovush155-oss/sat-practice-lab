-- Digital SAT module timing, complete mock sequencing, and post-submit answer review.
alter table public.questions
  add column if not exists module_number smallint not null default 1
  check (module_number in (1, 2));

-- The return shape now includes the module number, so replace the old RPC signature.
drop function if exists public.get_test_questions(uuid);

create function public.get_test_questions(p_test_id uuid)
returns table (
  id uuid,
  section public.sat_section,
  topic text,
  prompt text,
  choices jsonb,
  "position" integer,
  module_number smallint
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
  select q.id, q.section, q.topic, q.prompt, q.choices, q.position, q.module_number
  from public.questions q
  where q.test_id = p_test_id
  order by q.section, q.module_number, q.position, q.id;
end;
$$;

grant execute on function public.get_test_questions(uuid) to authenticated;

-- Release answer keys only after a completed attempt, and only to its owner or an admin.
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid,
  section public.sat_section,
  module_number smallint,
  topic text,
  "position" integer,
  prompt text,
  choices jsonb,
  answer_index smallint,
  selected_index smallint,
  is_correct boolean,
  explanation text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_approved_user() then
    raise exception 'Student access is waiting for admin approval';
  end if;

  if not exists (
    select 1 from public.attempts a
    where a.id = p_attempt_id
      and a.submitted_at is not null
      and (a.student_id = v_user or public.is_admin())
  ) then
    raise exception 'Completed attempt not found';
  end if;

  return query
  select q.id,
         q.section,
         q.module_number,
         q.topic,
         q.position,
         q.prompt,
         q.choices,
         k.answer_index,
         aa.selected_index,
         aa.is_correct,
         k.explanation
  from public.attempts a
  join public.attempt_answers aa on aa.attempt_id = a.id
  join public.questions q on q.id = aa.question_id and q.test_id = a.test_id
  join public.question_keys k on k.question_id = q.id
  where a.id = p_attempt_id
    and a.submitted_at is not null
    and (a.student_id = v_user or public.is_admin())
  order by q.section, q.module_number, q.position, q.id;
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public;
grant execute on function public.get_attempt_review(uuid) to authenticated;
