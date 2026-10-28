import Link from "next/link";

export function SiteHeader({ actionHref = "/signup", actionLabel = "Boshlash" }: { actionHref?: string; actionLabel?: string }) {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="Siyovush Academy bosh sahifasi">
        <span className="site-mark">S</span>
        <span className="site-brand-copy">
          <strong>Siyovush</strong>
          <small>SAT · GRE</small>
        </span>
      </Link>
      <nav className="site-nav" aria-label="Asosiy navigatsiya">
        <Link href="/programs/sat">SAT</Link>
        <Link href="/programs/gre">GRE</Link>
        <a href="/#method">Metodika</a>
      </nav>
      <div className="site-actions">
        <Link className="site-login" href="/login">Kirish</Link>
        <Link className="site-header-cta" href={actionHref}>{actionLabel} <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <Link className="site-brand site-brand-footer" href="/">
          <span className="site-mark">S</span>
          <span className="site-brand-copy"><strong>Siyovush</strong><small>SAT · GRE</small></span>
        </Link>
        <p>Imtihonga puxta tayyorgarlik, bir qadamdan boshlanadi.</p>
        <div className="site-footer-links">
          <Link href="/programs/sat">SAT dasturi</Link>
          <Link href="/programs/gre">GRE dasturi</Link>
          <Link href="/login">Platformaga kirish</Link>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© 2026 Siyovush SAT · GRE</span>
        <span>College Board va ETS bilan bog‘liq rasmiy sayt emas.</span>
      </div>
    </footer>
  );
}

export function FAQ({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="faq-list">
      {items.map((item, index) => (
        <details className="faq-item" key={item.q} open={index === 0}>
          <summary>{item.q}<span aria-hidden="true">+</span></summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}

type Domain = { title: string; body: string; topics: string[]; number: string };
type Program = {
  name: string;
  eyebrow: string;
  title: string;
  lead: string;
  accent: string;
  focus: string;
  sections: string[];
  intro: string;
  domains: Domain[];
  faqs: { q: string; a: string }[];
};

const programs: Record<"sat" | "gre", Program> = {
  sat: {
    name: "SAT",
    eyebrow: "Digital SAT · tayyorgarlik dasturi",
    title: "SAT maqsadingizga aniq reja bilan boring.",
    lead: "Reading & Writing va Math bo‘limlarini bosqichma-bosqich o‘rganing, savol uslublariga mos mashq qiling va xatolaringiz ustida ishlang.",
    accent: "01",
    focus: "Ikki bo‘lim, yagona tayyorgarlik rejasi",
    sections: ["Reading & Writing", "Math"],
    intro: "Digital SAT’da savolni tushunish, vaqtni to‘g‘ri taqsimlash va yechimni tekshirish birdek muhim. Dastur mavzular bo‘yicha bilimni mustahkamlash va test formatida mashq qilishga yordam beradi.",
    domains: [
      { number: "01", title: "Information and Ideas", body: "Matndan asosiy fikr, dalil va xulosalarni topish.", topics: ["Asosiy fikr va tafsilotlar", "Dalillarni tahlil qilish", "Xulosa chiqarish"] },
      { number: "02", title: "Craft and Structure", body: "Matn tuzilishi, muallif maqsadi va so‘z ma’nosini kontekstda anglash.", topics: ["Words in context", "Matn tuzilishi", "Cross-text connections"] },
      { number: "03", title: "Expression and Conventions", body: "Fikrlarni mantiqan bog‘lash va ingliz tili qoidalarini qo‘llash.", topics: ["Transitions", "Rhetorical synthesis", "Grammar and punctuation"] },
      { number: "04", title: "Math", body: "SAT Math savollarida algebraik fikrlash va miqdoriy tahlilni rivojlantirish.", topics: ["Algebra va Advanced Math", "Data Analysis", "Geometry and Trigonometry"] },
    ],
    faqs: [
      { q: "SAT dasturi kimlar uchun?", a: "Digital SAT topshirishni rejalashtirayotgan va Reading & Writing hamda Math bo‘limlarida bilimini tizimli mustahkamlamoqchi bo‘lganlar uchun." },
      { q: "Dasturda qaysi mavzular bor?", a: "Reading & Writing bo‘limida matnni tahlil qilish, so‘z ma’nosi, matnni tahrirlash va grammatik qoidalar; Math bo‘limida algebra, advanced math, data analysis, geometriya va trigonometriya yo‘nalishlari." },
      { q: "Mustaqil mashq qilish mumkinmi?", a: "Ha. Akkaunt ochib platformaga kiring, admin e’lon qilgan testlarni ishlang va natijalaringizni ko‘ring." },
    ],
  },
  gre: {
    name: "GRE",
    eyebrow: "GRE General Test · tayyorgarlik dasturi",
    title: "GRE’ga puxta tayyorlaning. Keyingi bosqichga ishonch bilan o‘ting.",
    lead: "Verbal Reasoning, Quantitative Reasoning va Analytical Writing ko‘nikmalarini tartibli reja va maqsadli mashqlar bilan rivojlantiring.",
    accent: "02",
    focus: "Uch ko‘nikma, yagona tayyorgarlik yo‘li",
    sections: ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
    intro: "GRE General Test matnni chuqur anglash, miqdoriy ma’lumot bilan ishlash va fikrni asoslab yozishni baholaydi. Tayyorlanishda har bir bo‘limga alohida e’tibor berib, o‘zlashtirilgan mavzularni vaqtli mashqlar bilan mustahkamlash muhim.",
    domains: [
      { number: "01", title: "Verbal Reasoning", body: "Murakkab matnlarni tahlil qilish, dalillarni ajratish va so‘zlarning kontekstdagi ma’nosini tushunish.", topics: ["Reading comprehension", "Text completion", "Sentence equivalence"] },
      { number: "02", title: "Quantitative Reasoning", body: "Sonli ma’lumotni sharhlash va matematik modellar orqali masalalarni yechish.", topics: ["Arithmetic and Algebra", "Geometry", "Data analysis"] },
      { number: "03", title: "Analytical Writing", body: "Pozitsiyani aniq ifodalash, dalillar bilan asoslash va mantiqli esse yozish.", topics: ["Issue tahlili", "Dalil va misollar", "Mantiqiy tuzilma"] },
      { number: "04", title: "Test strategiyasi", body: "Vaqtni rejalashtirish, savol turini tez aniqlash va xatolarni tahlil qilish.", topics: ["Vaqt taqsimoti", "Qiyin savollarga yondashuv", "Natija tahlili"] },
    ],
    faqs: [
      { q: "GRE kimlarga kerak bo‘ladi?", a: "GRE General Test ko‘plab magistratura va doktorantura dasturlariga hujjat topshiruvchilar tomonidan ishlatiladi. Talablar universitet va dasturga qarab farqlanadi." },
      { q: "GRE tayyorgarligi qaysi bo‘limlarni qamrab oladi?", a: "Verbal Reasoning, Quantitative Reasoning va Analytical Writing bo‘limlari uchun alohida ko‘nikmalar ustida ishlanadi." },
      { q: "GRE Quant faqat murakkab matematikadan iboratmi?", a: "Yo‘q. U arifmetika, algebra, geometriya va ma’lumotlar tahlili kabi asosiy yo‘nalishlarda miqdoriy fikrlashni tekshiradi." },
    ],
  },
};

export function ProgramPage({ exam }: { exam: "sat" | "gre" }) {
  const program = programs[exam];
  const practiceHref = exam === "sat" ? "/login" : "/signup";
  const practiceLabel = exam === "sat" ? "SAT mashqlariga o‘tish" : "Tayyorgarlikni boshlash";

  return (
    <>
      <SiteHeader />
      <main className="program-page">
        <section className={"program-hero program-hero-" + exam}>
          <div className="program-hero-copy">
            <span className="program-eyebrow"><i>{program.accent}</i>{program.eyebrow}</span>
            <h1>{program.title}</h1>
            <p>{program.lead}</p>
            <div className="hero-cta-row">
              <Link className="site-header-cta" href={practiceHref}>{practiceLabel}<span aria-hidden="true">↗</span></Link>
              <a className="site-outline-cta" href="#curriculum">Dastur bilan tanishing <span aria-hidden="true">↓</span></a>
            </div>
            <div className="program-chip-row">
              {program.sections.map((section) => <span key={section}>{section}</span>)}
            </div>
          </div>
          <div className="program-visual" aria-hidden="true">
            <div className="program-orbit orbit-one"></div>
            <div className="program-orbit orbit-two"></div>
            <div className="program-score-card">
              <div className="score-card-top"><span>{program.name}</span><span className="score-dot"></span></div>
              <div className="score-card-line"></div>
              <div className="score-card-scribble">{exam === "sat" ? "x + 4 = 12" : "∑  reasoning"}</div>
              <div className="score-card-bottom"><span>{program.focus}</span><span>↗</span></div>
            </div>
            <span className="visual-label visual-label-one">Maqsad</span>
            <span className="visual-label visual-label-two">Reja</span>
            <span className="visual-spark">✳</span>
          </div>
        </section>

        <section className="program-intro">
          <div>
            <span className="section-kicker">IMTIHON HAQIDA</span>
            <h2>{program.name}’ni tushunib, to‘g‘ri tayyorlaning.</h2>
          </div>
          <p>{program.intro}</p>
        </section>

        <section className="program-domains" id="curriculum">
          <div className="section-head">
            <div><span className="section-kicker">O‘QUV YO‘NALISHLARI</span><h2>Reja bo‘yicha, bosqichma-bosqich.</h2></div>
            <p>Har bir mavzu muhim ko‘nikmaga va real savol turiga bog‘langan.</p>
          </div>
          <div className="domain-grid">
            {program.domains.map((domain) => (
              <article className="domain-card" key={domain.title}>
                <span className="domain-number">{domain.number}</span>
                <h3>{domain.title}</h3>
                <p>{domain.body}</p>
                <ul>{domain.topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="method-section" id="method">
          <div className="method-title">
            <span className="section-kicker">TAYYORGARLIK METODIKASI</span>
            <h2>Har bir mashq keyingi qadamni ko‘rsatadi.</h2>
            <p>Reja bilimni aniqlash, maqsadli o‘rganish va testga mos mashqni birlashtiradi.</p>
          </div>
          <div className="method-steps">
            {[
              ["01", "Boshlang‘ich baholash", "Qaysi ko‘nikmalar mustahkam, qaysilariga ko‘proq vaqt kerakligini aniqlang."],
              ["02", "Mavzuli tayyorgarlik", "Bo‘lim va mavzularni kichik maqsadlarga ajratib, izchil mashq qiling."],
              ["03", "Vaqt bilan ishlash", "Savollarni imtihon ritmida yechib, vaqt taqsimotini shakllantiring."],
              ["04", "Natijani tahlil qilish", "Xatolar sababini toping va keyingi mashq rejasini aniqlang."],
            ].map(([number, title, body]) => (
              <article className="method-step" key={number}>
                <span>{number}</span><div><h3>{title}</h3><p>{body}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="program-faq">
          <div><span className="section-kicker">FAQ</span><h2>{program.name} haqida ko‘p so‘raladi.</h2><p>Imtihon va tayyorgarlik haqidagi qisqa javoblar.</p></div>
          <FAQ items={program.faqs} />
        </section>

        <section className="final-cta">
          <div><span className="section-kicker">KEYINGI QADAM</span><h2>Maqsadingizga bugun yaqinlashing.</h2><p>Akkaunt oching va Siyovush tayyorgarlik platformasidan foydalanishni boshlang.</p></div>
          <Link className="site-light-cta" href={practiceHref}>{practiceLabel}<span aria-hidden="true">↗</span></Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

