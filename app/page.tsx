import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FAQ, SiteFooter, SiteHeader } from "@/components/marketing";

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

  const startHref = user ? "/dashboard" : "/signup";
  const startLabel = user ? "Mashqlarni davom ettirish" : "Akkaunt yaratish";

  return (
    <>
      <SiteHeader actionHref={startHref} actionLabel={startLabel} />
      <main className="home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="section-kicker"><i className="kicker-mark"></i>SAT & GRE · tayyorgarlik platformasi</span>
            <h1>Katta maqsadlar.<br /><em>Aniq tayyorgarlik.</em></h1>
            <p>SAT va GRE imtihonlariga puxta tayyorlaning. Mavzularni o‘rganing, reja asosida mashq qiling va o‘sishingizni kuzating.</p>
            <div className="hero-cta-row">
              <Link className="site-header-cta" href={startHref}>{startLabel}<span aria-hidden="true">↗</span></Link>
              <Link className="site-outline-cta" href="#programs">Dasturlarni ko‘rish <span aria-hidden="true">↓</span></Link>
            </div>
            {user && <div className="home-account-note">Kirish amalga oshirilgan: {user.email}</div>}
            {configError && <div className="site-config-notice">Platforma sozlanmoqda. Bir ozdan so‘ng qayta urinib ko‘ring.</div>}
          </div>
          <div className="home-hero-visual" aria-label="SAT va GRE tayyorgarlik kartalari">
            <div className="hero-visual-glow"></div>
            <div className="hero-mini-label">MAQSADGA YO‘L</div>
            <div className="hero-paper hero-paper-back"><span>Verbal</span><b>Reasoning</b><i>Read · Analyze · Answer</i></div>
            <div className="hero-paper hero-paper-front">
              <div className="paper-header"><span className="paper-logo">S</span><span>STUDY PLAN</span><span className="paper-status">ACTIVE</span></div>
              <div className="paper-title">Bugungi maqsad</div>
              <div className="paper-task"><span className="paper-check">✓</span><span>Yangi mavzu</span><b>01</b></div>
              <div className="paper-task"><span className="paper-check">✓</span><span>Maqsadli mashq</span><b>02</b></div>
              <div className="paper-task paper-task-muted"><span className="paper-check">·</span><span>Xatolar tahlili</span><b>03</b></div>
              <div className="paper-progress"><span></span></div>
              <div className="paper-progress-caption"><span>Bugungi reja</span><b>2 / 3</b></div>
            </div>
            <div className="hero-float hero-float-top">SAT <span>Reading & Writing · Math</span></div>
            <div className="hero-float hero-float-bottom">GRE <span>Verbal · Quant · Writing</span></div>
            <div className="hero-star">✳</div>
          </div>
          <div className="home-hero-bottom">
            <span>IKKI YO‘NALISH</span><i></i><span>SAT · GRE</span><i></i><span>REJALI MASHQLAR</span><i></i><span>O‘SISHNI KUZATING</span>
          </div>
        </section>

        <section className="program-section" id="programs">
          <div className="section-head">
            <div><span className="section-kicker">DASTURLAR</span><h2>Qaysi maqsad sari ketyapsiz?</h2></div>
            <p>O‘zingizga kerakli imtihon yo‘nalishini tanlang.</p>
          </div>
          <div className="program-cards">
            <Link className="program-card program-card-sat" href="/programs/sat">
              <div className="program-card-top"><span>01 / UNDERGRADUATE</span><span className="program-arrow">↗</span></div>
              <div className="program-card-symbol">S</div>
              <h3>SAT</h3>
              <p>Reading & Writing va Math bo‘limlarida ko‘nikmalarni rivojlantiring va digital test formatida mashq qiling.</p>
              <div className="program-card-tags"><span>Reading & Writing</span><span>Math</span></div>
              <div className="program-card-link">SAT dasturini ko‘rish <b>→</b></div>
            </Link>
            <Link className="program-card program-card-gre" href="/programs/gre">
              <div className="program-card-top"><span>02 / GRADUATE STUDY</span><span className="program-arrow">↗</span></div>
              <div className="program-card-symbol">G</div>
              <h3>GRE</h3>
              <p>Verbal Reasoning, Quantitative Reasoning va Analytical Writing uchun maqsadli tayyorgarlik.</p>
              <div className="program-card-tags"><span>Verbal</span><span>Quant</span><span>Writing</span></div>
              <div className="program-card-link">GRE dasturini ko‘rish <b>→</b></div>
            </Link>
          </div>
        </section>

        <section className="learning-section" id="method">
          <div className="learning-copy">
            <span className="section-kicker">BIZNING YONDASHUV</span>
            <h2>Shunchaki ko‘p mashq emas. To‘g‘ri mashq.</h2>
            <p>Har bir qadam nimani bilishingizni va keyin nimani o‘rganish kerakligini ko‘rsatadi.</p>
            <Link className="text-link" href={startHref}>{startLabel} <span>→</span></Link>
          </div>
          <div className="learning-list">
            <article><span>01</span><div><h3>Rejangizni belgilang</h3><p>SAT yoki GRE yo‘nalishini, maqsadingizni va hozirgi darajangizni aniqlang.</p></div><b>↗</b></article>
            <article><span>02</span><div><h3>Mavzularni mustahkamlang</h3><p>Ko‘nikmalarni bo‘limlar va savol turlari bo‘yicha tartib bilan o‘rganing.</p></div><b>↗</b></article>
            <article><span>03</span><div><h3>Sinab ko‘ring va tahlil qiling</h3><p>Vaqt bilan mashq qiling, javoblaringizni ko‘rib chiqing va takrorlang.</p></div><b>↗</b></article>
          </div>
        </section>

        <section className="practice-band">
          <div className="practice-band-mark">S</div>
          <div><span className="section-kicker">SIYOVUSH PRACTICE</span><h2>O‘rganing. Mashq qiling. O‘sishni kuzating.</h2><p>Admin e’lon qilgan testlarni akkauntingizdan ishlashingiz mumkin.</p></div>
          <Link className="site-light-cta" href={startHref}>{startLabel}<span aria-hidden="true">↗</span></Link>
        </section>

        <section className="home-faq">
          <div><span className="section-kicker">FAQ</span><h2>Ko‘p so‘raladigan savollar.</h2><p>Platforma va tayyorgarlik dasturlari haqida.</p></div>
          <FAQ items={[
            { q: "SAT va GRE uchun alohida dasturlar bormi?", a: "Ha. SAT va GRE sahifalarida har bir imtihon bo‘limlari, o‘quv yo‘nalishlari va tayyorgarlik usuli alohida berilgan." },
            { q: "Platformada testni qayerdan boshlayman?", a: "Akkaunt yarating yoki tizimga kiring. Dashboardda admin e’lon qilgan mavjud testlar ko‘rinadi." },
            { q: "Platformada testlar qayerdan ko‘rinadi?", a: "Akkauntga kirgach, admin e’lon qilgan mavjud testlar dashboardda ko‘rinadi." },
          ]} />
        </section>

        <section className="home-bottom-cta">
          <span className="section-kicker">SIZNING KEYINGI QADAMINGIZ</span>
          <h2>Bugun boshlang. Maqsadingiz sari izchil boring.</h2>
          <Link className="site-light-cta" href={startHref}>{startLabel}<span aria-hidden="true">↗</span></Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
