# SAT Practice Lab — Supabase + Next.js starter

This is a backend-connected starter scaffold for SAT Practice Lab. It is not deployed yet and does not include live credentials.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth with cookie-based SSR sessions
- PostgreSQL with RLS
- Vercel-ready environment variables

## 1. Create the Supabase project
1. Open https://database.new and create a project.
2. In Project Settings / API (or Connect), copy the Project URL and the **Publishable key**.
3. Copy `.env.example` to `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Never place a Supabase secret/service-role key in any `NEXT_PUBLIC_*` variable or browser code.

## 2. Create the database
1. In Supabase SQL Editor, run `supabase/migrations/0001_initial.sql`.
2. Optional: run `supabase/seed.sql` to create a draft sample test.
3. Register your admin email through the app, confirm email if enabled, then run the commented admin promotion SQL in the migration with your exact email substituted. Do not allow users to set their own role.
4. Add questions and answer keys using SQL Editor until the admin question editor is implemented.
5. Publish a test only after all questions and answer keys are inserted.

### Example insert for a question
```sql
with t as (select id from public.tests where title = 'Algebra Starter — Demo' limit 1),
q as (
  insert into public.questions(test_id, section, topic, prompt, choices, position)
  select t.id, 'math', 'Algebra', 'If 3x + 5 = 20, what is x?', '["3","5","7","15"]'::jsonb, 2 from t
  returning id
)
insert into public.question_keys(question_id, answer_index, explanation)
select id, 1, '3x + 5 = 20 → 3x = 15 → x = 5.' from q;
```

## 3. Run locally
Use Node.js 20.9+ (recommended) and npm:
```bash
npm install
cp .env.example .env.local
# edit .env.local
npm run dev
```
Visit http://localhost:3000.

## 4. Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel, choose Add New → Project and import the repository.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Environment Variables for Production and Preview as needed.
4. Deploy. Vercel assigns a `*.vercel.app` URL. Rename the project to `sat-practice-lab` if available.
5. In Supabase Auth → URL Configuration, set Site URL to the deployed Vercel URL and add it to Redirect URLs.

## Included
- Uzbek landing page
- Login and student signup forms
- Authenticated dashboard
- Published test listing
- Student attempt history
- Basic admin test creation screen
- SQL schema with profile roles, tests, questions, answer keys, attempts, RLS and server-side grading RPC

## Important limitations before production
- The SQL should be reviewed and tested in a staging project before production use.
- Add a dedicated admin question/answer-key editor and full mock timing/navigation.
- Add rate limiting, monitoring, backup policy, email/password reset, and security tests.
- The score estimator is a rough placeholder, not official SAT scoring.
- RLS is the primary enforcement layer. Never trust role values sent by the browser.
