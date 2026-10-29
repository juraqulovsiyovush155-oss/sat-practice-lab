import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./signout";
import TestList from "./tests";

type Attempt = {
  id: string;
  correct_count: number | null;
  question_count: number | null;
  estimated_score: number | null;
  score_max: number | null;
  submitted_at: string | null;
  test_id: string;
  duration_seconds?: number | null;
};

function formatPracticeTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} soat ${minutes} daqiqa` : `${minutes} daqiqa`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name,role,approved").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";
  if (!isAdmin && profile?.approved !== true) redirect("/pending");
  const { data: tests } = await supabase.from("tests").select("id,title,kind,section,topic,duration_seconds").eq("published", true).order("created_at", { ascending: false });

  let durationTrackingAvailable = true;
  let attemptsResult = await supabase.from("attempts")
    .select("id,correct_count,question_count,estimated_score,score_max,submitted_at,test_id,duration_seconds")
    .eq("student_id", user.id)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });
  if (attemptsResult.error && /duration_seconds|column .* does not exist/i.test(attemptsResult.error.message)) {
    durationTrackingAvailable = false;
    attemptsResult = await supabase.from("attempts")
      .select("id,correct_count,question_count,estimated_score,score_max,submitted_at,test_id")
      .eq("student_id", user.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false }) as typeof attemptsResult;
  }
  const attempts = (attemptsResult.data ?? []) as Attempt[];
  const studySeconds = attempts.reduce((total, attempt) => total + Math.max(0, attempt.duration_seconds ?? 0), 0);
  const latest = attempts.find((attempt) => typeof attempt.estimated_score === "number");
  const previous = latest && attempts.slice(attempts.indexOf(latest) + 1)
    .find((attempt) => typeof attempt.estimated_score === "number" && attempt.score_max === latest.score_max);
  const scoreChange = latest && previous ? latest.estimated_score! - previous.estimated_score! : null;

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="logo">S</div>
          <span>Siyovush <span style={{ color: "var(--green)" }}>SAT</span></span>
        </Link>
        <div className="row"><span className="tag">{isAdmin ? "Admin" : "Student"}</span><SignOutButton /></div>
      </header>
      <main className="wrap">
        <div className="eyebrow">Dashboard</div>
        <h1>Salom, {profile?.full_name || user.user_metadata?.full_name || user.email}!</h1>
        <p>Bugungi mashg‘ulotni tanlang.</p>
        <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
          <div className="stat"><small>Yakunlangan testlar</small><strong>{attempts.length}</strong></div>
          <div className="stat"><small>Test mashqi vaqti</small><strong>{formatPracticeTime(studySeconds)}</strong><p>Faqat test ishlash vaqti hisoblanadi.</p></div>
          <div className="stat"><small>Oxirgi natija</small><strong>{latest?.estimated_score ?? "—"} / {latest?.score_max ?? 1600}</strong><p>Taxminiy SAT balli</p></div>
          <div className="stat"><small>Natija o‘zgarishi</small><strong>{scoreChange === null ? "—" : `${scoreChange > 0 ? "+" : ""}${scoreChange}`}</strong><p>{scoreChange === null ? "Taqqoslash uchun yana test kerak" : "Oldingi shu turdagi testga nisbatan"}</p></div>
        </div>
        {!durationTrackingAvailable && <p className="notice">Natijalar saqlanmoqda. Test vaqtini kuzatish uchun admin Supabase’da `0008_student_learning_analytics.sql` migrationni ishga tushirishi kerak.</p>}
        <section className="panel">
          <div className="row"><div><h2>Mavjud testlar</h2><p>Faqat admin e’lon qilgan testlar ko‘rsatiladi.</p></div>{isAdmin && <Link className="btn secondary" href="/admin">Admin panel →</Link>}</div>
          <TestList tests={tests ?? []} />
        </section>
        <section className="panel">
          <h2>Oxirgi natijalar</h2>
          {attempts.length ? <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead><tr>
                <th style={{ textAlign: "left", padding: 10 }}>Yakunlangan</th>
                <th style={{ textAlign: "left", padding: 10 }}>To‘g‘ri</th>
                <th style={{ textAlign: "left", padding: 10 }}>Vaqt</th>
                <th style={{ textAlign: "left", padding: 10 }}>Taxminiy SAT balli</th>
              </tr></thead>
              <tbody>{attempts.map((attempt) => <tr key={attempt.id}>
                <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString("uz-UZ") : "—"}</td>
                <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{attempt.correct_count}/{attempt.question_count}</td>
                <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{formatPracticeTime(attempt.duration_seconds ?? 0)}</td>
                <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{attempt.estimated_score ?? "—"} / {attempt.score_max ?? 1600}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p>Hali yakunlangan test yo‘q.</p>}
        </section>
        <p className="notice">Ball hozircha taxminiy. Rasmiy SAT scoring uchun kalibrlangan testlar va alohida baholash modeli kerak.</p>
      </main>
      <footer>Siyovush SAT · O‘quv platformasi</footer>
    </>
  );
}
