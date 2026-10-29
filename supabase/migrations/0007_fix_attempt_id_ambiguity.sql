-- Resolve the OUT parameter/table-column ambiguity when saving answers.
-- Replaces only the grading RPC body; unanswered answers and score calculation remain unchanged.
create or replace function public.submit_test_attempt(p_test_id uuid, p_answers jsonb)
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
