import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LoginForm from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <Image src="/images/siyovush-sat-gre-hero.png" alt="SAT va GRE tayyorgarlik" fill priority sizes="(max-width: 850px) 100vw, 55vw" />
        <div className="auth-visual-shade" />
        <div className="auth-visual-copy"><span>SIYOVUSH · SAT & GRE</span><h2>Har bir savol<br />maqsadga yaqinlashtiradi.</h2><p>Reja bilan o‘rganing. Vaqt bilan mashq qiling. Natijani tahlil qiling.</p></div>
        <div className="auth-visual-orbit">ANALYZE <i /> PRACTICE <i /> GROW</div>
      </section>
      <section className="auth-panel">
        <Link href="/" className="auth-back">← Siyovush SAT · GRE</Link>
        <div className="panel auth-form-panel">
          <div className="eyebrow">Xush kelibsiz</div>
          <h1>Akkauntga kirish</h1>
          <p>Email va parolingizni kiriting.</p>
          {params.message && <p className="notice">{params.message}</p>}
          <LoginForm />
          <p className="auth-switch">Yangi o‘quvchimisiz? <Link href="/signup">Kirish so‘rovi yuboring</Link></p>
        </div>
      </section>
    </main>
  );
}
