import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SignupForm from "./form";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <Image src="/images/siyovush-sat-gre-hero.png" alt="SAT va GRE tayyorgarlik" fill priority sizes="(max-width: 850px) 100vw, 55vw" />
        <div className="auth-visual-shade" />
        <div className="auth-visual-copy"><span>SIYOVUSH · SAT & GRE</span><h2>Bugungi mehnat<br />ertangi natija.</h2><p>O‘quvchi akkaunti admin tasdig‘idan keyin testlarga kiradi.</p></div>
        <div className="auth-visual-orbit">LEARN <i /> PRACTICE <i /> SUCCEED</div>
      </section>
      <section className="auth-panel">
        <Link href="/" className="auth-back">← Siyovush SAT · GRE</Link>
        <div className="panel auth-form-panel">
          <div className="eyebrow">O‘quvchi kirish so‘rovi</div>
          <h1>Akkaunt yaratish</h1>
          <p>Ro‘yxatdan o‘ting. Testlarga kirish admin tasdiqlagach ochiladi.</p>
          <SignupForm />
          <p className="auth-switch">Akkauntingiz bormi? <Link href="/login">Tizimga kiring</Link></p>
        </div>
      </section>
    </main>
  );
}
