'use client';

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TestSummary = {
  id: string;
  title: string;
  kind: "topic" | "mock";
  section: "math" | "reading_writing" | null;
  topic: string | null;
  published: boolean;
  created_at: string;
};
type QuestionRecord = {
  id: string;
  prompt: string;
  choices: string[];
  position: number;
  topic: string;
};
type EditorValues = {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

const emptyEditor: EditorValues = {
  prompt: "",
  choices: ["", "", "", ""],
  answerIndex: 0,
  explanation: "",
};
const letters = ["A", "B", "C", "D"];

export default function AdminManageTests({ tests }: { tests: TestSummary[] }) {
  const [selectedTestId, setSelectedTestId] = useState(tests[0]?.id ?? "");
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [editor, setEditor] = useState<EditorValues>(emptyEditor);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const selectedTest = tests.find((test) => test.id === selectedTestId) ?? null;

  useEffect(() => {
    if (!tests.length) {
      setSelectedTestId("");
      return;
    }
    if (!tests.some((test) => test.id === selectedTestId)) {
      setSelectedTestId(tests[0].id);
    }
  }, [tests, selectedTestId]);

  useEffect(() => {
    let cancelled = false;
    async function loadQuestions() {
      if (!selectedTestId) {
        setQuestions([]);
        return;
      }
      setLoading(true);
      setError("");
      const { data, error: questionsError } = await supabase
        .from("questions")
        .select("id,prompt,choices,position,topic")
        .eq("test_id", selectedTestId)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (questionsError) {
        setError(questionsError.message);
        setQuestions([]);
        setLoading(false);
        return;
      }
      setQuestions((data ?? []) as QuestionRecord[]);
      setLoading(false);
    }
    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [selectedTestId, supabase]);

  function resetEditor() {
    setEditor(emptyEditor);
    setEditingQuestionId(null);
  }

  function updateChoice(index: number, value: string) {
    setEditor((current) => ({
      ...current,
      choices: current.choices.map((choice, choiceIndex) =>
        choiceIndex === index ? value : choice,
      ),
    }));
  }

  async function saveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTest || selectedTest.published) return;

    const prompt = editor.prompt.trim();
    const choices = editor.choices.map((choice) => choice.trim());
    if (!prompt || choices.some((choice) => !choice)) {
      setError("Savol matni va A–D javoblarining barchasini to‘ldiring.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      let questionId = editingQuestionId;
      if (questionId) {
        const { error: updateError } = await supabase
          .from("questions")
          .update({ prompt, choices })
          .eq("id", questionId)
          .eq("test_id", selectedTest.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("questions")
          .insert({
            test_id: selectedTest.id,
            section: selectedTest.section ?? "math",
            topic: selectedTest.topic?.trim() || "SAT",
            prompt,
            choices,
            position: Math.max(0, ...questions.map((question) => question.position)) + 1,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        questionId = data.id;
      }

      const { error: keyError } = await supabase.from("question_keys").upsert(
        {
          question_id: questionId,
          answer_index: editor.answerIndex,
          explanation: editor.explanation.trim(),
        },
        { onConflict: "question_id" },
      );
      if (keyError) {
        if (!editingQuestionId && questionId) {
          await supabase.from("questions").delete().eq("id", questionId);
        }
        throw keyError;
      }

      setMessage(editingQuestionId ? "Savol yangilandi." : "Savol testga qo‘shildi.");
      resetEditor();
      const { data, error: reloadError } = await supabase
        .from("questions")
        .select("id,prompt,choices,position,topic")
        .eq("test_id", selectedTest.id)
        .order("position", { ascending: true });
      if (reloadError) throw reloadError;
      setQuestions((data ?? []) as QuestionRecord[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Savol saqlanmadi.");
    } finally {
      setSaving(false);
    }
  }

  async function editQuestion(question: QuestionRecord) {
    setError("");
    setMessage("");
    const { data, error: keyError } = await supabase
      .from("question_keys")
      .select("answer_index,explanation")
      .eq("question_id", question.id)
      .maybeSingle();
    if (keyError) {
      setError(keyError.message);
      return;
    }
    if (!data) {
      setError("Bu savolning to‘g‘ri javobi topilmadi. Savolni o‘chirib, qayta kiriting.");
      return;
    }
    setEditingQuestionId(question.id);
    setEditor({
      prompt: question.prompt,
      choices: question.choices,
      answerIndex: data.answer_index,
      explanation: data.explanation ?? "",
    });
    document.getElementById("question-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteQuestion(question: QuestionRecord) {
    if (!selectedTest || selectedTest.published) return;
    const confirmed = window.confirm("Ushbu savolni testdan o‘chirasizmi?");
    if (!confirmed) return;

    setError("");
    setMessage("");
    const { error: deleteError } = await supabase
      .from("questions")
      .delete()
      .eq("id", question.id)
      .eq("test_id", selectedTest.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingQuestionId === question.id) resetEditor();
    const remaining = questions.filter((item) => item.id !== question.id);
    let reorderError = "";
    for (const [index, item] of remaining.entries()) {
      const { error: positionError } = await supabase
        .from("questions")
        .update({ position: index + 1 })
        .eq("id", item.id);
      if (positionError) {
        reorderError = positionError.message;
        break;
      }
    }
    setQuestions(
      remaining.map((item, index) => ({
        ...item,
        position: reorderError ? item.position : index + 1,
      })),
    );
    if (reorderError) {
      setError("Savol o‘chirildi, lekin tartibni yangilashda xatolik yuz berdi: " + reorderError);
    } else {
      setMessage("Savol o‘chirildi.");
    }
  }

  async function publishTest() {
    if (!selectedTest || selectedTest.published) return;
    setError("");
    setMessage("");
    if (!questions.length) {
      setError("E’lon qilishdan oldin testga kamida bitta savol qo‘shing.");
      return;
    }
    setSaving(true);
    try {
      const { data: keys, error: keysError } = await supabase
        .from("question_keys")
        .select("question_id")
        .in("question_id", questions.map((question) => question.id));
      if (keysError) throw keysError;
      const keyedIds = new Set((keys ?? []).map((key) => key.question_id));
      const missing = questions.filter((question) => !keyedIds.has(question.id));
      if (missing.length) {
        setError(missing.length + " ta savolga to‘g‘ri javob belgilanmagan.");
        return;
      }
      const { error: publishError } = await supabase
        .from("tests")
        .update({ published: true })
        .eq("id", selectedTest.id);
      if (publishError) throw publishError;
      setMessage("Test e’lon qilindi. O‘quvchilar dashboardida ko‘rinadi.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test e’lon qilinmadi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="row">
        <div>
          <h2>Test savollari</h2>
          <p>Testni tanlang, savollarni kiriting va tayyor bo‘lgach e’lon qiling.</p>
        </div>
        {selectedTest && (
          <span className="tag">{selectedTest.published ? "E’lon qilingan" : "Qoralama"}</span>
        )}
      </div>

      <label htmlFor="managed-test">Test</label>
      <select
        id="managed-test"
        className="field"
        value={selectedTestId}
        onChange={(event) => {
          setSelectedTestId(event.target.value);
          resetEditor();
          setMessage("");
          setError("");
        }}
        disabled={!tests.length}
      >
        {tests.length ? (
          tests.map((test) => (
            <option key={test.id} value={test.id}>
              {test.title}{test.published ? " — e’lon qilingan" : " — qoralama"}
            </option>
          ))
        ) : (
          <option value="">Avval test yarating</option>
        )}
      </select>

      {!selectedTest ? (
        <p className="notice">Savol qo‘shishdan oldin yuqoridagi shaklda test yarating.</p>
      ) : (
        <>
          {selectedTest.published ? (
            <p className="notice">E’lon qilingan test savollari bu panelda tahrirlanmaydi.</p>
          ) : (
            <form id="question-editor" onSubmit={saveQuestion}>
              <div className="row">
                <h3>{editingQuestionId ? "Savolni tahrirlash" : "Yangi savol"}</h3>
                {editingQuestionId && (
                  <button type="button" className="btn secondary" onClick={resetEditor}>
                    Bekor qilish
                  </button>
                )}
              </div>
              <label htmlFor="question-prompt">Savol matni</label>
              <textarea
                id="question-prompt"
                className="field"
                rows={5}
                required
                value={editor.prompt}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, prompt: event.target.value }))
                }
                placeholder="Savol yoki Reading & Writing matnini kiriting"
              />
              <div className="cards">
                {editor.choices.map((choice, index) => (
                  <div key={letters[index]}>
                    <label htmlFor={"choice-" + letters[index]}>Javob {letters[index]}</label>
                    <input
                      id={"choice-" + letters[index]}
                      className="field"
                      required
                      value={choice}
                      onChange={(event) => updateChoice(index, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="cards">
                <div>
                  <label htmlFor="correct-answer">To‘g‘ri javob</label>
                  <select
                    id="correct-answer"
                    className="field"
                    value={editor.answerIndex}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        answerIndex: Number(event.target.value),
                      }))
                    }
                  >
                    {letters.map((letter, index) => (
                      <option key={letter} value={index}>
                        {letter}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="explanation">Izoh (ixtiyoriy)</label>
                  <input
                    id="explanation"
                    className="field"
                    value={editor.explanation}
                    onChange={(event) =>
                      setEditor((current) => ({ ...current, explanation: event.target.value }))
                    }
                    placeholder="Javob izohi"
                  />
                </div>
              </div>

              {error && <p className="error" role="alert">{error}</p>}
              {message && <p className="success" role="status">{message}</p>}
              <button className="btn primary" disabled={saving}>
                {saving ? "Saqlanmoqda…" : editingQuestionId ? "O‘zgarishlarni saqlash" : "Savolni saqlash"}
              </button>
            </form>
          )}

          {selectedTest.published && error && <p className="error" role="alert">{error}</p>}
          {selectedTest.published && message && <p className="success" role="status">{message}</p>}

          <hr className="divider" />
          <div className="row">
            <h3>Savollar ({questions.length})</h3>
            {selectedTest.published ? null : (
              <button className="btn primary" type="button" onClick={publishTest} disabled={saving || loading}>
                {saving ? "Tekshirilmoqda…" : "Testni e’lon qilish"}
              </button>
            )}
          </div>

          {loading ? (
            <p>Savollar yuklanmoqda…</p>
          ) : questions.length ? (
            <ol className="admin-question-list">
              {questions.map((question) => (
                <li key={question.id}>
                  <div className="admin-question-copy">
                    <strong>{question.position}.</strong>
                    <span>{question.prompt}</span>
                  </div>
                  {!selectedTest.published && (
                    <div className="admin-question-actions">
                      <button type="button" className="btn secondary" onClick={() => void editQuestion(question)}>
                        Tahrirlash
                      </button>
                      <button type="button" className="btn admin-danger" onClick={() => void deleteQuestion(question)}>
                        O‘chirish
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="notice">Bu testga hali savol qo‘shilmagan.</p>
          )}
        </>
      )}
    </section>
  );
}

