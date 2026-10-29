import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCreateTest from "./create-test";
import AdminLearningAnalytics from "./learning-analytics";
import AdminManageStudents from "./manage-students";
import AdminManageTests from "./manage-tests";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: tests } = await supabase
    .from("tests")
    .select("id,title,kind,section,topic,published,created_at")
    .order("created_at", { ascending: false });
  const testList = tests ?? [];
  const { data: studentRows, error: studentError } = await supabase
    .from("profiles")
    .select("id,full_name,email,approved,created_at")
    .eq("role", "student")
    .order("created_at", { ascending: false });
  const students = studentRows ?? [];
  let durationTrackingAvailable = true;
  let learningAttempts: {
    student_id: string;
    test_id: string;
    correct_count: number | null;
    question_count: number | null;
    estimated_score: number | null;
    score_max: number | null;
    submitted_at: string | null;
    duration_seconds?: number | null;
  }[] = [];
  if (students.length) {
    const studentIds = students.map((student) => student.id);
    const attemptsWithDuration = await supabase.from("attempts")
      .select("student_id,test_id,correct_count,question_count,estimated_score,score_max,submitted_at,duration_seconds")
      .in("student_id", studentIds)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (attemptsWithDuration.error && /duration_seconds|column .* does not exist/i.test(attemptsWithDuration.error.message)) {
      durationTrackingAvailable = false;
      const fallback = await supabase.from("attempts")
        .select("student_id,test_id,correct_count,question_count,estimated_score,score_max,submitted_at")
        .in("student_id", studentIds)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      learningAttempts = (fallback.data ?? []).map((attempt) => ({ ...attempt, duration_seconds: 0 }));
    } else {
      learningAttempts = attemptsWithDuration.data ?? [];
    }
  }

  return (
    <>
      <header className="topbar">
        <Link href="/dashboard" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="logo">S</div>
          <span>Siyovush SAT</span>
        </Link>
        <span className="tag">Admin panel</span>
      </header>
      <main className="wrap">
        <div className="eyebrow">Boshqaruv</div>
        <h1>Testlar boshqaruvi</h1>
        <p>O‘quvchi akkauntlarini tasdiqlang, test yarating, savollarni kiriting va tayyor bo‘lgach o‘quvchilarga e’lon qiling.</p>

        <AdminLearningAnalytics students={students} attempts={learningAttempts} durationTrackingAvailable={durationTrackingAvailable} />
        {studentError ? <p className="error">O‘quvchilar ro‘yxati yuklanmadi. Supabase migratsiyasini tekshiring: {studentError.message}</p> : <AdminManageStudents initialStudents={students} />}
        <AdminCreateTest />
        <AdminManageTests tests={testList} />

        <section className="panel">
          <h2>Mavjud testlar ({testList.length})</h2>
          {testList.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 10 }}>Test</th>
                    <th style={{ textAlign: "left", padding: 10 }}>Tur</th>
                    <th style={{ textAlign: "left", padding: 10 }}>Bo‘lim</th>
                    <th style={{ textAlign: "left", padding: 10 }}>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {testList.map((test) => (
                    <tr key={test.id}>
                      <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{test.title}</td>
                      <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>
                        {test.kind === "mock" ? "Full Mock" : "Topic Practice"}
                      </td>
                      <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>
                        {test.section === "math" ? "Math" : test.section === "reading_writing" ? "Reading & Writing" : "—"}
                      </td>
                      <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>
                        {test.published ? "E’lon qilingan" : "Qoralama"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Testlar hali yaratilmagan.</p>
          )}
        </section>
        <p className="notice">
          O‘quvchilar javob kalitlarini ko‘ra olmaydi. Admin huquqi test va savollarni boshqarish uchun ishlatiladi.
        </p>
      </main>
    </>
  );
}
