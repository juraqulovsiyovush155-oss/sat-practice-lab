type Student = { id: string; full_name: string | null; email: string | null; approved: boolean; created_at: string };
type Attempt = {
  student_id: string;
  test_id: string;
  correct_count: number | null;
  question_count: number | null;
  estimated_score: number | null;
  score_max: number | null;
  submitted_at: string | null;
  duration_seconds?: number | null;
};

function formatPracticeTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} soat ${minutes} daqiqa` : `${minutes} daqiqa`;
}

export default function AdminLearningAnalytics({
  students,
  attempts,
  durationTrackingAvailable,
}: {
  students: Student[];
  attempts: Attempt[];
  durationTrackingAvailable: boolean;
}) {
  const practiceSeconds = attempts.reduce((total, attempt) => total + Math.max(0, attempt.duration_seconds ?? 0), 0);

  return (
    <section className="panel">
      <div className="row">
        <div>
          <h2>O‘quvchilar natijasi va faolligi</h2>
          <p>Testlarda sarflangan vaqt, oxirgi ball va oldingi natijaga nisbatan o‘zgarish.</p>
        </div>
        <span className="tag">Jami: {formatPracticeTime(practiceSeconds)}</span>
      </div>
      {!durationTrackingAvailable && <p className="notice">Test va natijalar ko‘rinmoqda. Mashg‘ulot vaqtini yozib borish uchun Supabase’da `0008_student_learning_analytics.sql` migrationni ishga tushiring.</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>O‘quvchi</th>
              <th style={{ textAlign: "left", padding: 10 }}>Yakunlangan test</th>
              <th style={{ textAlign: "left", padding: 10 }}>Test mashqi vaqti</th>
              <th style={{ textAlign: "left", padding: 10 }}>Oxirgi ball</th>
              <th style={{ textAlign: "left", padding: 10 }}>O‘zgarish</th>
              <th style={{ textAlign: "left", padding: 10 }}>Oxirgi faollik</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const studentAttempts = attempts
                .filter((attempt) => attempt.student_id === student.id)
                .sort((left, right) => (right.submitted_at ?? "").localeCompare(left.submitted_at ?? ""));
              const latest = studentAttempts.find((attempt) => typeof attempt.estimated_score === "number");
              const previous = latest && studentAttempts.slice(studentAttempts.indexOf(latest) + 1)
                .find((attempt) => typeof attempt.estimated_score === "number" && attempt.score_max === latest.score_max);
              const delta = latest && previous ? latest.estimated_score! - previous.estimated_score! : null;
              const time = studentAttempts.reduce((total, attempt) => total + Math.max(0, attempt.duration_seconds ?? 0), 0);
              return (
                <tr key={student.id}>
                  <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>
                    <strong>{student.full_name || "Ism kiritilmagan"}</strong><br />
                    <small>{student.email ?? "—"}</small>
                  </td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{studentAttempts.length}</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{formatPracticeTime(time)}</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{latest ? `${latest.estimated_score}/${latest.score_max ?? 1600}` : "—"}</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--line)", color: delta === null ? "inherit" : delta > 0 ? "#176b47" : delta < 0 ? "#b42318" : "inherit" }}>
                    {delta === null ? "Taqqoslash uchun yana test kerak" : delta > 0 ? `↑ ${delta} ball` : delta < 0 ? `↓ ${Math.abs(delta)} ball` : "O‘zgarish yo‘q"}
                  </td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--line)" }}>{latest?.submitted_at ? new Date(latest.submitted_at).toLocaleString("uz-UZ") : "—"}</td>
                </tr>
              );
            })}
            {!students.length && <tr><td colSpan={6} style={{ padding: 10 }}>Hali o‘quvchi ro‘yxatdan o‘tmagan.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
