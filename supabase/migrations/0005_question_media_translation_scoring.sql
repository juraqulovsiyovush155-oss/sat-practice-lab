-- Add question images and Uzbek translations. Images stay in a private bucket.
alter table public.questions
  add column if not exists image_url text,
  add column if not exists prompt_uz text,
  add column if not exists choices_uz jsonb;

alter table public.questions drop constraint if exists questions_choices_uz_check;
alter table public.questions add constraint questions_choices_uz_check
  check (choices_uz is null or (jsonb_typeof(choices_uz) = 'array' and jsonb_array_length(choices_uz) = 4));

alter table public.attempts add column if not exists score_max integer not null default 1600;
alter table public.attempts drop constraint if exists attempts_estimated_score_check;
alter table public.attempts add constraint attempts_estimated_score_check check (estimated_score between 200 and 1600);
alter table public.attempts drop constraint if exists attempts_score_max_check;
alter table public.attempts add constraint attempts_score_max_check check (score_max in (800, 1600));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']::text[])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Approved users view question images" on storage.objects;
create policy "Approved users view question images"
on storage.objects for select to authenticated
using (bucket_id = 'question-images' and ((select public.is_admin()) or (select public.is_approved_user())));

drop policy if exists "Admins upload question images" on storage.objects;
create policy "Admins upload question images"
on storage.objects for insert to authenticated
with check (bucket_id = 'question-images' and (select public.is_admin()));

drop policy if exists "Admins update question images" on storage.objects;
create policy "Admins update question images"
on storage.objects for update to authenticated
using (bucket_id = 'question-images' and (select public.is_admin()))
with check (bucket_id = 'question-images' and (select public.is_admin()));

drop policy if exists "Admins delete question images" on storage.objects;
create policy "Admins delete question images"
on storage.objects for delete to authenticated
using (bucket_id = 'question-images' and (select public.is_admin()));

drop function if exists public.get_test_questions(uuid);
create function public.get_test_questions(p_test_id uuid)
returns table (
  id uuid, section public.sat_section, topic text, prompt text, choices jsonb,
  "position" integer, module_number smallint, image_url text, prompt_uz text, choices_uz jsonb
)
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tests t
    where t.id = p_test_id and ((t.published = true and public.is_approved_user()) or public.is_admin())
  ) then raise exception 'Test not found or access not approved'; end if;
  return query
  select q.id, q.section, q.topic, q.prompt, q.choices, q.position,
         q.module_number, q.image_url, q.prompt_uz, q.choices_uz
  from public.questions q where q.test_id = p_test_id
  order by q.section, q.module_number, q.position, q.id;
end;
$$;
grant execute on function public.get_test_questions(uuid) to authenticated;

drop function if exists public.get_attempt_review(uuid);
create function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid, section public.sat_section, module_number smallint, topic text,
  "position" integer, prompt text, choices jsonb, answer_index smallint,
  selected_index smallint, is_correct boolean, explanation text,
  image_url text, prompt_uz text, choices_uz jsonb
)
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.is_approved_user() then raise exception 'Student access is waiting for admin approval'; end if;
  if not exists (
    select 1 from public.attempts a where a.id = p_attempt_id and a.submitted_at is not null
      and (a.student_id = v_user or public.is_admin())
  ) then raise exception 'Completed attempt not found'; end if;
  return query
  select q.id, q.section, q.module_number, q.topic, q.position, q.prompt,
         q.choices, k.answer_index, aa.selected_index, aa.is_correct, k.explanation,
         q.image_url, q.prompt_uz, q.choices_uz
  from public.attempts a
  join public.attempt_answers aa on aa.attempt_id = a.id
  join public.questions q on q.id = aa.question_id and q.test_id = a.test_id
  join public.question_keys k on k.question_id = q.id
  where a.id = p_attempt_id and a.submitted_at is not null
    and (a.student_id = v_user or public.is_admin())
  order by q.section, q.module_number, q.position, q.id;
end;
$$;
revoke all on function public.get_attempt_review(uuid) from public;
grant execute on function public.get_attempt_review(uuid) to authenticated;

drop function if exists public.submit_test_attempt(uuid, jsonb);
create function public.submit_test_attempt(p_test_id uuid, p_answers jsonb)
returns table (attempt_id uuid, correct_count integer, question_count integer, estimated_score integer, score_max integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_attempt uuid;
  v_kind public.test_kind;
  v_total integer;
  v_correct integer;
  v_pct numeric;
  v_score integer;
  v_score_max integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Answers must be a JSON array'; end if;
  select t.kind into v_kind from public.tests t
  where t.id = p_test_id and ((t.published = true and public.is_approved_user()) or public.is_admin());
  if not found then raise exception 'Test not found, not published, or access not approved'; end if;

  select count(*) into v_total from public.questions q where q.test_id = p_test_id;
  if v_total = 0 then raise exception 'Test has no questions'; end if;
  insert into public.attempts(student_id, test_id, started_at)
  values (v_user, p_test_id, now()) returning id into v_attempt;

  insert into public.attempt_answers(attempt_id, question_id, selected_index, is_correct)
  select v_attempt, q.id,
         case when (a.item ->> 'selected_index') ~ '^[0-3]$' then (a.item ->> 'selected_index')::smallint else null end,
         case when (a.item ->> 'selected_index') ~ '^[0-3]$'
           then ((a.item ->> 'selected_index')::smallint = k.answer_index) else false end
  from jsonb_array_elements(p_answers) a(item)
  join public.questions q on q.id = (a.item ->> 'question_id')::uuid and q.test_id = p_test_id
  join public.question_keys k on k.question_id = q.id
  on conflict on constraint attempt_answers_pkey do update
    set selected_index = excluded.selected_index, is_correct = excluded.is_correct;

  -- Save omitted answers as unanswered so the review and denominator include every item.
  insert into public.attempt_answers(attempt_id, question_id, selected_index, is_correct)
  select v_attempt, q.id, null, false from public.questions q
  where q.test_id = p_test_id and not exists (
    select 1 from public.attempt_answers aa where aa.attempt_id = v_attempt and aa.question_id = q.id
  );

  select count(*) filter (where aa.is_correct) into v_correct
  from public.attempt_answers aa where aa.attempt_id = v_attempt;
  select count(*) into v_total from public.questions q where q.test_id = p_test_id;
  v_pct := case when v_total = 0 then 0 else v_correct::numeric / v_total end;
  if v_kind = 'mock' then
    v_score_max := 1600;
    v_score := least(1600, greatest(400, round(400 + v_pct * 1200)::integer));
  else
    v_score_max := 800;
    v_score := least(800, greatest(200, round(200 + v_pct * 600)::integer));
  end if;

  update public.attempts set submitted_at = now(), correct_count = v_correct, question_count = v_total,
      estimated_score = v_score, score_max = v_score_max
  where id = v_attempt and student_id = v_user;
  return query select v_attempt, v_correct, v_total, v_score, v_score_max;
end;
$$;
grant execute on function public.submit_test_attempt(uuid, jsonb) to authenticated;
