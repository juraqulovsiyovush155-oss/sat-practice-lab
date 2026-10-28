-- Optional sample test. Run only after migration.
with new_test as (
  insert into public.tests(title, kind, section, topic, duration_seconds, published)
  values ('Algebra Starter — Demo', 'topic', 'math', 'Algebra', 300, false)
  returning id
), q1 as (
  insert into public.questions(test_id, section, topic, prompt, choices, position)
  select id, 'math', 'Algebra', 'If 3x + 5 = 20, what is x?', '["3","5","7","15"]'::jsonb, 1 from new_test
  returning id, test_id
)
insert into public.question_keys(question_id, answer_index, explanation)
select id, 1, '3x + 5 = 20 → 3x = 15 → x = 5.' from q1;

-- After checking the test and questions, an admin can publish:
-- update public.tests set published = true where title = 'Algebra Starter — Demo';
