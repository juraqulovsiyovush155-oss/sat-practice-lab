import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let user = null;
  let configError = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    configError = true;
  }
  return <>
    <header className="topbar"><div className="brand"><div className="logo">S</div><span>Siyovush <span style={{color:"var(--green)"}}>SAT</span></span></div><span className="tag">Student · Admin</span></header>
    <main className="wrap">
      <div className="eyebrow">SAT tayyorgarlik platformasi</div>
      <h1>Bilimingizni sinang.<br/>Natijangizni yaxshilang.</h1>
      <p style={{maxWidth:650}}>Mavzuli mashqlar, mock testlar va natijalar tahlili — barchasi bir joyda.</p>
      {configError && <div className="notice" style={{marginTop:18}}>Backendni ulash uchun .env.local fayliga Supabase Project URL va Publishable Key kiriting.</div>}
      {user ? <section className="panel"><h2>Xush kelibsiz!</h2><p>{user.email}</p><Link className="btn primary" href="/dashboard" style={{marginTop:12}}>Dashboardga o‘tish →</Link></section> :
        <section className="panel" style={{maxWidth:520,marginTop:26}}><h2>Platformaga kirish</h2><p>Kurs o‘quvchilari o‘z akkaunti orqali kiradi.</p><div className="row" style={{marginTop:18}}><Link className="btn primary" href="/login">Login qilish</Link><Link className="btn secondary" href="/signup">Akkaunt yaratish</Link></div></section>}
      <div className="cards" style={{marginTop:22}}>
        <article className="test-card"><span className="tag">01 · Practice</span><h3>Mavzuli testlar</h3><p>Algebra, Advanced Math, Data Analysis va boshqa yo‘nalishlar.</p></article>
        <article className="test-card"><span className="tag">02 · Mock</span><h3>Sinov imtihonlari</h3><p>Vaqt bilan ishlash va test natijalarini tahlil qilish.</p></article>
      </div>
    </main><footer>Siyovush SAT · Rasmiy College Board mahsuloti emas.</footer>
  </>;
}
