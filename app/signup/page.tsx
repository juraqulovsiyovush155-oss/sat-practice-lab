import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignupForm from "./form";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="wrap" style={{ maxWidth: 540 }}>
      <a href="/" style={{ color: "var(--green)", textDecoration: "none" }}>← Siyovush SAT · GRE</a>
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="eyebrow">O‘quvchi kirish so‘rovi</div>
        <h1 style={{ fontSize: 30 }}>Akkaunt yaratish</h1>
        <p>Akkaunt oching. Testlarga kirish admin tasdiqlagandan keyin beriladi.</p>
        <SignupForm />
      </section>
    </main>
  );
}
