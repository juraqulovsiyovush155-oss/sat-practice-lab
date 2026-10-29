"use client";

import { useEffect, useMemo, useState } from "react";
import { MathText } from "@/components/math-formula";
import { createClient } from "@/lib/supabase/client";

type ReviewQuestion = {
  question_id: string;
  section: "math" | "reading_writing";
  module_number: number;
  topic: string;
  position: number;
  prompt: string;
  choices: string[];
  answer_index: number;
  selected_index: number | null;
  is_correct: boolean;
  explanation: string;
  image_url?: string | null;
  choice_images?: (string | null)[] | null;
  prompt_uz?: string | null;
  choices_uz?: string[] | null;
};

export type ExamSummary = {
  attemptId: string;
  title: string;
  correct: number;
  total: number;
  score: number;
  scoreMax: number;
};

export default function ExamResults({ summary, onBack }: { summary: ExamSummary; onBack: () => void }) {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;
    async function loadReview() {
      const { data, error: reviewError } = await supabase.rpc("get_attempt_review", {
        p_attempt_id: summary.attemptId,
      });
      if (!active) return;
      if (reviewError) setError(reviewError.message);
      else {
        const signedQuestions = await Promise.all(((data ?? []) as ReviewQuestion[]).map(async (question) => {
          const imageUrl = question.image_url ? (await supabase.storage.from("question-images").createSignedUrl(question.image_url, 3600)).data?.signedUrl ?? null : null;
          const choiceImages = await Promise.all((question.choice_images ?? []).map(async (path) => path ? (await supabase.storage.from("question-images").createSignedUrl(path, 3600)).data?.signedUrl ?? null : null));
          return { ...question, image_url: imageUrl, choice_images: choiceImages };
        }));
        setQuestions(signedQuestions);
      }
      setLoading(false);
    }
    void loadReview();
    return () => { active = false; };
  }, [summary.attemptId, supabase]);

  async function requestAiExplanation(questionId: string) {
    setAiBusyId(questionId);
    setError("");
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "attempt", attemptId: summary.attemptId, questionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI izohi olinmadi.");
      setAiExplanations((current) => ({ ...current, [questionId]: result.explanation }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI izohi olinmadi.");
    } finally {
      setAiBusyId(null);
    }
  }

  return (
    <main className="bb-result">
      <div className="bb-result-header">
        <div><span className="eyebrow">TEST NATIJASI</span><h1>{summary.title}</h1></div>
        <button className="btn secondary" type="button" onClick={onBack}>Testlar ro‘yxatiga qaytish</button>
      </div>
      <section className="bb-result-score" aria-label="Taxminiy SAT balli">
        <strong>{summary.score}</strong><span>/ {summary.scoreMax} · taxminiy SAT balli</span>
      </section>
      <p className="bb-result-note">{summary.correct}/{summary.total} ta savol to‘g‘ri. Bu mashq uchun taxminiy natija; rasmiy College Board konvertatsiyasi emas.</p>
      {error && <p className="bb-error" role="alert">{error}</p>}
      <section className="bb-result-list">
        <h2>Javoblar va izohlar</h2>
        {loading ? <p>Javoblar tahlili yuklanmoqda…</p> : questions.length ? questions.map((question) => {
          const correct = question.choices[question.answer_index] ?? "—";
          const selected = question.selected_index === null ? "Javob berilmagan" : question.choices[question.selected_index] ?? "—";
          return (
            <article className="bb-review-item" key={question.question_id}>
              <h3>{question.section === "reading_writing" ? "Reading and Writing" : "Math"} · Module {question.module_number} · Savol {question.position}</h3>
              <p><MathText value={question.prompt} /></p>
              {question.image_url && <img className="bb-question-image" src={question.image_url} alt="Savolga tegishli rasm yoki grafik" />}
              {question.prompt_uz && <details className="bb-translation"><summary>O‘zbekcha tarjimani ko‘rish</summary><p><MathText value={question.prompt_uz} /></p></details>}
              <div className="bb-review-correct"><b>To‘g‘ri javob:</b> <MathText value={correct} />{question.choice_images?.[question.answer_index] && <img className="bb-choice-image" src={question.choice_images[question.answer_index] ?? ""} alt="To‘g‘ri javob rasmi" />}</div>
              <p><b>Sizning javobingiz:</b> <MathText value={selected} /> {question.is_correct ? "✓" : "·"}</p>
              {question.explanation && <div className="bb-ai-explanation"><b>Admin izohi:</b><br /><MathText value={question.explanation} /></div>}
              {aiExplanations[question.question_id] ? (
                <div className="bb-ai-explanation"><b>AI izohi:</b><br /><MathText value={aiExplanations[question.question_id]} /></div>
              ) : (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={aiBusyId === question.question_id}
                  onClick={() => void requestAiExplanation(question.question_id)}
                >
                  {aiBusyId === question.question_id ? "AI tahlil qilmoqda…" : "AI bilan izohlash"}
                </button>
              )}
            </article>
          );
        }) : !error ? <p>Ushbu test uchun javoblar tahlili topilmadi.</p> : null}
      </section>
      <div className="bb-result-actions"><button className="btn primary" type="button" onClick={onBack}>Dashboardga qaytish</button></div>
    </main>
  );
}
