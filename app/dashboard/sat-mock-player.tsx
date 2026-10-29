"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExamResults, { type ExamSummary } from "./exam-results";
import { MathText } from "@/components/math-formula";
import { createClient } from "@/lib/supabase/client";
import DesmosCalculator from "@/components/desmos-calculator";

type Test = { id: string; title: string; kind: "topic" | "mock"; section: string | null; topic: string | null; duration_seconds: number };
type Question = { id: string; section: "math" | "reading_writing"; module_number: number; topic: string; prompt: string; choices: string[]; position: number; image_url?: string | null; choice_images?: (string | null)[] | null; prompt_uz?: string | null; choices_uz?: string[] | null };
type Overlay = "directions" | "questions" | "review" | "reference" | "help" | "shortcuts" | null;

const modules = [
  { section: "reading_writing", module: 1, minutes: 32, label: "Reading and Writing", sectionNumber: 1 },
  { section: "reading_writing", module: 2, minutes: 32, label: "Reading and Writing", sectionNumber: 1 },
  { section: "math", module: 1, minutes: 35, label: "Math", sectionNumber: 2 },
  { section: "math", module: 2, minutes: 35, label: "Math", sectionNumber: 2 },
] as const;

function formatTime(seconds: number) {
  return Math.floor(seconds / 60).toString().padStart(2, "0") + ":" + (seconds % 60).toString().padStart(2, "0");
}

export default function SatMockPlayer({ test, onExit }: { test: Test; onExit: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState(0);
  const [phase, setPhase] = useState<"test" | "break">("test");
  const [seconds, setSeconds] = useState(modules[0].minutes * 60);
  const [breakSeconds, setBreakSeconds] = useState(10 * 60);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [eliminated, setEliminated] = useState<Record<string, number[]>>({});
  const [overlay, setOverlay] = useState<Overlay>("directions");
  const [directionsSeen, setDirectionsSeen] = useState(false);
  const [showTimer, setShowTimer] = useState(true);
  const [crossMode, setCrossMode] = useState(false);
  const [lineReader, setLineReader] = useState(false);
  const [menu, setMenu] = useState(false);
  const [calc, setCalc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ExamSummary | null>(null);
  const autoAdvance = useRef(false);
  const submitLock = useRef(false);
  const activePracticeSeconds = useRef(0);

  const currentModule = modules[stage];
  const currentItems = useMemo(
    () => items.filter((question) => question.section === currentModule.section && question.module_number === currentModule.module),
    [items, currentModule],
  );
  const current = currentItems[index];

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      const { data, error: rpcError } = await supabase.rpc("get_test_questions", { p_test_id: test.id });
      if (!mounted) return;
      if (rpcError) {
        setLoadError(rpcError.message);
      } else {
        const questions = await Promise.all(((data ?? []) as Question[]).map(async (question) => {
          const imageUrl = question.image_url ? (await supabase.storage.from("question-images").createSignedUrl(question.image_url, 3600)).data?.signedUrl ?? null : null;
          const choiceImages = await Promise.all((question.choice_images ?? []).map(async (path) => path ? (await supabase.storage.from("question-images").createSignedUrl(path, 3600)).data?.signedUrl ?? null : null));
          return { ...question, image_url: imageUrl, choice_images: choiceImages };
        }));
        const missing = modules.filter((part) => !questions.some((q) => q.section === part.section && q.module_number === part.module));
        if (missing.length) {
          setLoadError("Testning barcha modullari to‘liq emas. Admin har bir modulga savol qo‘shib, testni qayta e’lon qilsin.");
        } else {
          setItems(questions);
        }
      }
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [supabase, test.id]);

  useEffect(() => {
    if (loading || loadError || summary || phase !== "test" || !directionsSeen || seconds <= 0) return;
    const timer = window.setTimeout(() => {
      activePracticeSeconds.current += 1;
      setSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [loading, loadError, summary, phase, directionsSeen, seconds]);

  useEffect(() => {
    if (phase !== "break" || breakSeconds <= 0) return;
    const timer = window.setTimeout(() => setBreakSeconds((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, breakSeconds]);

  async function submitExam() {
    if (submitLock.current || summary) return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    const payload = items.map((question) => ({ question_id: question.id, selected_index: answers[question.id] ?? null }));
    let submitResult = await supabase.rpc("submit_test_attempt", {
      p_test_id: test.id,
      p_answers: payload,
      p_duration_seconds: activePracticeSeconds.current,
    });
    if (submitResult.error && ["PGRST202", "42883"].includes(submitResult.error.code ?? "")) {
      submitResult = await supabase.rpc("submit_test_attempt", { p_test_id: test.id, p_answers: payload });
    }
    const { data, error: submitError } = submitResult;
    if (submitError) {
      setError(submitError.message);
      setOverlay("review");
      submitLock.current = false;
      setBusy(false);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.attempt_id || typeof result.estimated_score !== "number") {
      setError("Natija bazaga qaytdi, ammo SAT ballini o‘qib bo‘lmadi. Dashboardda natijani tekshiring.");
      setOverlay("review");
      submitLock.current = false;
      setBusy(false);
      return;
    }
    setSummary({
      attemptId: result.attempt_id,
      title: test.title,
      correct: Number(result.correct_count ?? 0),
      total: Number(result.question_count ?? items.length),
      score: Number(result.estimated_score),
      scoreMax: Number(result.score_max ?? 1600),
    });
    setBusy(false);
  }

  function startStage(nextStage: number) {
    autoAdvance.current = false;
    setStage(nextStage);
    setPhase("test");
    setSeconds(modules[nextStage].minutes * 60);
    setIndex(0);
    setOverlay("directions");
    setDirectionsSeen(false);
    setError("");
  }

  function finishModule() {
    setError("");
    if (stage === 1) {
      autoAdvance.current = true;
      setPhase("break");
      setBreakSeconds(10 * 60);
      setOverlay(null);
      setDirectionsSeen(false);
      return;
    }
    if (stage === 3) {
      void submitExam();
      return;
    }
    startStage(stage + 1);
  }

  useEffect(() => {
    if (loading || loadError || summary || phase !== "test" || !directionsSeen || seconds !== 0 || autoAdvance.current) return;
    autoAdvance.current = true;
    if (stage === 3) void submitExam();
    else if (stage === 1) {
      setPhase("break");
      setBreakSeconds(10 * 60);
      setOverlay(null);
      setDirectionsSeen(false);
    } else startStage(stage + 1);
  }, [loading, loadError, summary, phase, directionsSeen, seconds, stage]);

  useEffect(() => {
    if (!current || overlay || phase !== "test") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((currentIndex) => Math.min(currentItems.length - 1, currentIndex + 1));
      if (event.key === "ArrowLeft") setIndex((currentIndex) => Math.max(0, currentIndex - 1));
      if (["1", "2", "3", "4"].includes(event.key)) setAnswers((old) => ({ ...old, [current.id]: Number(event.key) - 1 }));
      if (event.key.toLowerCase() === "r") setFlags((old) => ({ ...old, [current.id]: !old[current.id] }));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, currentItems.length, overlay, phase]);

  function chooseQuestion(nextIndex: number) {
    setIndex(nextIndex);
    setOverlay(null);
  }

  if (summary) return <ExamResults summary={summary} onBack={onExit} />;
  if (loading || loadError) {
    return (
      <main className="bb-result bb-loading">
        <span className="eyebrow">SAT FULL MOCK</span>
        <h1>{loading ? "Test yuklanmoqda…" : "Testni boshlashning iloji bo‘lmadi"}</h1>
        {loadError && <p className="bb-error">{loadError}</p>}
        <button className="btn secondary" type="button" onClick={onExit}>Testlar ro‘yxatiga qaytish</button>
      </main>
    );
  }

  if (phase === "break") {
    return (
      <main className="bb-break">
        <section className="bb-break-count"><strong>Qolgan tanaffus</strong><span>{formatTime(breakSeconds)}</span></section>
        <section className="bb-break-copy">
          <span className="eyebrow">SECTION 1 TUGADI</span>
          <h1>10 daqiqalik tanaffus</h1>
          <p>Javoblaringiz saqlandi. Tanaffus tugagach, Math bo‘limi boshlanadi. Qurilmani yopmasdan kuting.</p>
          <button
            className="bb-primary"
            type="button"
            disabled={breakSeconds > 0}
            onClick={() => startStage(2)}
          >
            {breakSeconds > 0 ? "Tanaffus davom etmoqda…" : "Math bo‘limini boshlash"}
          </button>
        </section>
      </main>
    );
  }

  if (!current) {
    return <main className="bb-result"><h1>Modulda savol topilmadi.</h1><button className="btn secondary" onClick={onExit}>Chiqish</button></main>;
  }

  return (
    <div className="bb-shell">
      <header className="bb-top">
        <div className="bb-testname">
          <strong>Section {currentModule.sectionNumber}, Module {currentModule.module}: {currentModule.label}</strong>
          <button type="button" onClick={() => setOverlay("directions")}>Directions⌄</button>
        </div>
        <div className="bb-clock">{showTimer ? formatTime(seconds) : <span className="bb-clock-hidden">◴</span>}<button type="button" onClick={() => setShowTimer((show) => !show)}>{showTimer ? "Hide" : "Show"}</button></div>
        <div className="bb-tools">
          {currentModule.section === "math" ? <><button type="button" onClick={() => setCalc((open) => !open)}>▦<span>Kalkulyator</span></button><button type="button" onClick={() => setOverlay("reference")}>x²<span>Formula</span></button></> : <button type="button" onClick={() => setLineReader((enabled) => !enabled)}>✎<span>Matnni belgilash</span></button>}
          <div className="bb-menu-wrap"><button type="button" onClick={() => setMenu((open) => !open)}>⋮<span>More</span></button>{menu && <div className="bb-menu">
            <button type="button" onClick={() => { setOverlay("help"); setMenu(false); }}>ⓘ　Yordam</button>
            <button type="button" onClick={() => { setOverlay("shortcuts"); setMenu(false); }}>⌨　Tugmalar</button>
            <button type="button" onClick={() => { setOverlay("review"); setMenu(false); }}>☑　Modulni yakunlash</button>
          </div>}</div>
        </div>
      </header>
      <div className="bb-practice">BU MASHQ TESTI <span className="bb-module-label">{currentModule.sectionNumber}/2 · Modul {currentModule.module}/2</span></div>
      <main className="bb-content">
        <section className="bb-question" key={current.id}>
          <div className="bb-qbar">
            <span className="bb-qnumber">{index + 1}</span>
            <button type="button" className={flags[current.id] ? "bb-mark active" : "bb-mark"} onClick={() => setFlags((old) => ({ ...old, [current.id]: !old[current.id] }))}>
              <span className="bb-bookmark">{flags[current.id] ? "▮" : "♧"}</span>{flags[current.id] ? "Review uchun belgilangan" : "Review uchun belgilash"}
            </button>
            <button type="button" className={crossMode ? "bb-cross-toggle active" : "bb-cross-toggle"} onClick={() => setCrossMode((enabled) => !enabled)}>A̸B̸C̸</button>
          </div>
          <p className={lineReader ? "bb-prompt line-reader" : "bb-prompt"}><MathText value={current.prompt} /></p>
          {current.image_url && <img className="bb-question-image" src={current.image_url} alt="Savolga tegishli rasm yoki grafik" />}
          {(current.prompt_uz || current.choices_uz?.some(Boolean)) && <details className="bb-translation"><summary>O‘zbekcha tarjimani ko‘rish</summary>{current.prompt_uz && <p className="bb-prompt"><MathText value={current.prompt_uz} /></p>}{current.choices_uz?.some(Boolean) && <ol type="A">{current.choices_uz.map((choice, choiceIndex) => <li key={choiceIndex}><MathText value={choice} /></li>)}</ol>}</details>}
          <div className="bb-choices">
            {(current.choices ?? []).map((choice, choiceIndex) => {
              const chosen = answers[current.id] === choiceIndex;
              const crossed = (eliminated[current.id] ?? []).includes(choiceIndex);
              return <div className={"bb-choice-wrap " + (crossed ? "crossed" : "")} key={choiceIndex}>
                <button type="button" className={"bb-choice " + (chosen ? "selected " : "") + (crossed ? "eliminated" : "")} onClick={() => crossMode ? setEliminated((old) => ({ ...old, [current.id]: crossed ? (old[current.id] ?? []).filter((i) => i !== choiceIndex) : [...(old[current.id] ?? []), choiceIndex] })) : (!crossed && setAnswers((old) => ({ ...old, [current.id]: choiceIndex })))}>
                  <span className="bb-letter">{String.fromCharCode(65 + choiceIndex)}</span><MathText value={choice} />{current.choice_images?.[choiceIndex] && <img className="bb-choice-image" src={current.choice_images[choiceIndex] ?? ""} alt={"Javob " + String.fromCharCode(65 + choiceIndex) + " rasmi"} />}
                </button>
                <button type="button" className="bb-choice-x" aria-label={crossed ? "Variantni qayta tiklash" : "Variantni chiqarib tashlash"} onClick={() => setEliminated((old) => ({ ...old, [current.id]: crossed ? (old[current.id] ?? []).filter((i) => i !== choiceIndex) : [...(old[current.id] ?? []), choiceIndex] }))}>{crossed ? "↶" : String.fromCharCode(65 + choiceIndex)}</button>
              </div>;
            })}
          </div>
        </section>
      </main>
      {calc && <DesmosCalculator onClose={() => setCalc(false)} />}
      <footer className="bb-footer">
        <strong>{test.title}</strong>
        <button type="button" className="bb-question-count" onClick={() => setOverlay("questions")}>Question {index + 1} of {currentItems.length}⌃</button>
        <div className="bb-nav">{index > 0 && <button type="button" onClick={() => setIndex((currentIndex) => currentIndex - 1)}>Back</button>}<button className={index === currentItems.length - 1 ? "bb-finish" : ""} type="button" onClick={() => index < currentItems.length - 1 ? setIndex((currentIndex) => currentIndex + 1) : setOverlay("review")}>{index < currentItems.length - 1 ? "Next" : "Review"}</button></div>
      </footer>

      {overlay && <div className="bb-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget && overlay !== "directions") setOverlay(null); }}>
        <div className={overlay === "directions" ? "bb-modal bb-directions" : "bb-modal"}>
          <button type="button" className="bb-close" onClick={() => overlay === "directions" ? (setDirectionsSeen(true), setOverlay(null)) : setOverlay(null)}>×</button>
          {overlay === "directions" && <>
            <span className="eyebrow">SECTION {currentModule.sectionNumber} · MODULE {currentModule.module}</span>
            <h2>{currentModule.label} directions</h2>
            <p>Bu modulda {currentItems.length} ta savol bor. Qolgan vaqt: {currentModule.minutes} daqiqa. Modul vaqti tugagach, javoblaringiz avtomatik saqlanadi va keyingi modul ochiladi.</p>
            {currentModule.section === "math" && <p>Kalkulyator va reference formulalaridan istalgan vaqtda foydalanishingiz mumkin.</p>}
            <div className="bb-modal-actions"><button type="button" className="bb-primary" onClick={() => { setDirectionsSeen(true); setOverlay(null); }}>Davom etish</button></div>
          </>}
          {overlay === "questions" && <>
            <h2>Section {currentModule.sectionNumber}, Module {currentModule.module} · Savollar</h2>
            <div className="bb-legend"><span>● Joriy</span><span>□ Javobsiz</span><span>▮ Review</span></div>
            <div className="bb-grid">{currentItems.map((question, questionIndex) => <button key={question.id} type="button" className={"bb-grid-item " + (questionIndex === index ? "current " : "") + (answers[question.id] !== undefined ? "answered " : "") + (flags[question.id] ? "flagged" : "")} onClick={() => chooseQuestion(questionIndex)}>{questionIndex + 1}</button>)}</div>
            <button type="button" className="bb-outline" onClick={() => setOverlay("review")}>Modulni ko‘rib chiqish</button>
          </>}
          {overlay === "review" && <>
            <h2>{stage === 3 ? "Testni yakunlashdan oldin" : "Modulni yakunlashdan oldin"}</h2>
            <p>{Object.keys(answers).filter((id) => currentItems.some((question) => question.id === id)).length} ta javob berildi · {currentItems.length - currentItems.filter((question) => answers[question.id] !== undefined).length} ta javobsiz · {currentItems.filter((question) => flags[question.id]).length} ta review belgisi</p>
            <div className="bb-review-list">{currentItems.map((question, questionIndex) => <button key={question.id} type="button" onClick={() => chooseQuestion(questionIndex)}><span>Savol {questionIndex + 1}</span><span>{answers[question.id] !== undefined ? "Javob berilgan" : "Javobsiz"} {flags[question.id] ? " · Review" : ""}</span></button>)}</div>
            {error && <p className="bb-error" role="alert">Yakunlab bo‘lmadi: {error}</p>}
            <div className="bb-modal-actions"><button type="button" className="bb-outline" onClick={() => setOverlay(null)}>Modulga qaytish</button><button type="button" className="bb-primary" disabled={busy} onClick={finishModule}>{busy ? "Saqlanmoqda…" : stage === 3 ? "Testni topshirish" : "Modulni yakunlash"}</button></div>
          </>}
          {overlay === "reference" && <><h2>Math Reference</h2><div className="bb-formulas"><p>Aylana: A = πr²　C = 2πr</p><p>To‘g‘ri to‘rtburchak: A = lw</p><p>Uchburchak: A = ½bh</p><p>Pifagor: c² = a² + b²</p><p>Silindr: V = πr²h　Shar: V = ⁴⁄₃πr³</p><p>Konus: V = ⅓πr²h</p><p>Aylana: 360° = 2π radian · Uchburchak: 180°</p></div></>}
          {overlay === "help" && <><h2>Yordam</h2><p>Savolni belgilash, javob variantini tanlash va modul ichida oldinga-orqaga o‘tish mumkin. Modul tugagach oldingi modulga qaytib bo‘lmaydi.</p><p>Modul oxirida javobsiz savollarni ko‘rib chiqib, modulni yakunlang.</p></>}
          {overlay === "shortcuts" && <><h2>Tugmalar</h2><div className="bb-shortcuts"><p><kbd>←</kbd> Oldingi savol</p><p><kbd>→</kbd> Keyingi savol</p><p><kbd>1–4</kbd> Javob tanlash</p><p><kbd>R</kbd> Review uchun belgilash</p></div></>}
        </div>
      </div>}
    </div>
  );
}
