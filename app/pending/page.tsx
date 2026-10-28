import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/dashboard/signout";

export default async function PendingAccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,approved")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "admin" || profile?.approved === true) redirect("/dashboard");

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="logo">S</div>
          <span>Siyovush SAT · GRE</span>
        </a>
        <SignOutButton />
      </header>
      <main className="wrap" style={{ maxWidth: 680 }}>
        <section className="panel">
          <div className="eyebrow">Kirish so‘rovi</div>
          <h1>Admin tasdig‘ini kuting</h1>
          <p>Akkauntingiz yaratildi. Administrator sizga kirish huquqini bergach, e’lon qilingan testlar ochiladi.</p>
          <p className="notice" style={{ marginTop: 18 }}>Akkaunt: {user.email}</p>
          <div className="row" style={{ marginTop: 12 }}><Link className="btn primary" href="/dashboard">Kirishni qayta tekshirish</Link><Link className="btn secondary" href="/">Bosh sahifa</Link></div>
        </section>
      </main>
    </>
  );
}
