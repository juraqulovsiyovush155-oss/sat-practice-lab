import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCreateTest from "./create-test";
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
        <p>Test yarating, savollarni kiriting va tayyor bo‘lgach o‘quvchilarga e’lon qiling.</p>

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
