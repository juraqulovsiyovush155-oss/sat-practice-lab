'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/client";
import { MathInput, MathText } from "@/components/math-formula";

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
  section: "math" | "reading_writing";
  module_number: number;
  position: number;
  topic: string;
  image_url: string | null;
  choice_images: (string | null)[] | null;
  prompt_uz: string | null;
  choices_uz: string[] | null;
};
type EditorValues = {
  prompt: string;
  promptUz: string;
  choices: string[];
  choicesUz: string[];
  answerIndex: number;
  explanation: string;
  imageFile: File | null;
  imagePath: string | null;
  imagePreview: string | null;
  choiceImageFiles: (File | null)[];
  choiceImagePaths: (string | null)[];
  choiceImagePreviews: (string | null)[];
};
type ImportedQuestion = {
  section: "math" | "reading_writing";
  module_number: 1 | 2;
  topic: string;
  prompt: string;
  choices: [string, string, string, string];
  answerIndex: number;
  explanation: string;
  prompt_uz?: string;
  choices_uz?: [string, string, string, string];
  has_figure?: boolean;
  imageFile?: File | null;
  imagePreview?: string | null;
  choiceImageFiles?: (File | null)[];
  choiceImagePaths?: (string | null)[];
  choiceImagePreviews?: (string | null)[];
};

const emptyEditor: EditorValues = {
  prompt: "",
  promptUz: "",
  choices: ["", "", "", ""],
  choicesUz: ["", "", "", ""],
  answerIndex: 0,
  explanation: "",
  imageFile: null,
  imagePath: null,
  imagePreview: null,
  choiceImageFiles: [null, null, null, null],
  choiceImagePaths: [null, null, null, null],
  choiceImagePreviews: [null, null, null, null],
};
const letters = ["A", "B", "C", "D"];
const VISION_CHUNK_PAGES = 2;
const VISION_CHUNK_STEP = 2;
const VISION_CHUNK_BYTES = 450_000;
const MAX_VISION_PAGES = 48;
const VISION_CONCURRENCY = 1;
const sortQuestions = (questions: QuestionRecord[]) => [...questions].sort((left, right) => {
  const sectionOrder = (section: QuestionRecord["section"]) => section === "reading_writing" ? 0 : 1;
  return sectionOrder(left.section) - sectionOrder(right.section)
    || left.module_number - right.module_number
    || left.position - right.position;
});

type ImportReview = {
  index: number;
  status: "ok" | "needs_review" | "duplicate";
  issues: string[];
  duplicateOf: number | null;
  suggestedPrompt: string | null;
  suggestedChoices: string[] | null;
  suggestedAnswerIndex: number | null;
  suggestedExplanation: string | null;
};
type PdfImportResponse = {
  error?: string;
  needsVision?: boolean;
  pageCount?: number;
  questions?: ImportedQuestion[];
  warnings?: string[];
};

async function readPdfImportResponse(response: Response): Promise<PdfImportResponse> {
  const body = await response.text();
  let result: PdfImportResponse;
  try {
    result = body ? JSON.parse(body) as PdfImportResponse : {};
  } catch {
    if (response.status === 413) throw new Error("PDF server limitidan katta. Faylni kichikroq yoki siqilgan PDF qilib yuklang.");
    if (response.status === 504 || response.status === 502) throw new Error("PDF tahlili server vaqt chegarasiga yetdi. Skaner PDF’ni kichikroq bo‘laklarda qayta urinib ko‘ring.");
    throw new Error(`PDF serveri JSON javob qaytarmadi (HTTP ${response.status}). Sahifani yangilab, qayta urinib ko‘ring.`);
  }
  if (!response.ok) throw new Error(result.error || `PDF tahlilida server xatosi (HTTP ${response.status}).`);
  return result;
}

async function splitPdfForBrowser(file: File) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const pageCount = source.getPageCount();
  if (!pageCount) throw new Error("PDF ichida sahifa topilmadi.");
  if (pageCount > MAX_VISION_PAGES) throw new Error(`Skaner PDF ${pageCount} sahifa. Hozircha ${MAX_VISION_PAGES} sahifagacha bo‘lgan qismlarni yuklang.`);

  const chunks: Array<{ firstPage: number; lastPage: number; file: File }> = [];
  const appendRange = async (start: number, end: number): Promise<void> => {
    const piece = await PDFDocument.create();
    const pages = await piece.copyPages(source, Array.from({ length: end - start }, (_, index) => start + index));
    pages.forEach((page) => piece.addPage(page));
    const bytes = await piece.save();
    if (bytes.byteLength > VISION_CHUNK_BYTES) {
      if (end - start === 1) throw new Error(`PDF’ning ${start + 1}-sahifasi juda katta. Uni kichikroq yoki siqilgan PDF qilib yuklang.`);
      const middle = start + Math.ceil((end - start) / 2);
      await appendRange(start, middle);
      await appendRange(Math.max(start, middle - 1), end);
      return;
    }
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    chunks.push({
      firstPage: start + 1,
      lastPage: end,
      file: new File([buffer], `sat-pages-${start + 1}-${end}.pdf`, { type: "application/pdf" }),
    });
  };

  for (let start = 0; start < pageCount; start += VISION_CHUNK_STEP) {
    await appendRange(start, Math.min(start + VISION_CHUNK_PAGES, pageCount));
  }
  return chunks;
}

async function readQuestionRecords(client: ReturnType<typeof createClient>, testId: string) {
  const withChoiceImages = await client.from("questions")
    .select("id,prompt,choices,section,module_number,position,topic,image_url,prompt_uz,choices_uz,choice_images")
    .eq("test_id", testId)
    .order("section", { ascending: true })
    .order("module_number", { ascending: true })
    .order("position", { ascending: true });
  if (withChoiceImages.error && (withChoiceImages.error.code === "42703" || withChoiceImages.error.code === "PGRST204")) {
    const fallback = await client.from("questions")
      .select("id,prompt,choices,section,module_number,position,topic,image_url,prompt_uz,choices_uz")
      .eq("test_id", testId)
      .order("section", { ascending: true })
      .order("module_number", { ascending: true })
      .order("position", { ascending: true });
    return { data: ((fallback.data ?? []).map((question) => ({ ...question, choice_images: null })) as QuestionRecord[]), error: fallback.error, choiceImagesAvailable: false };
  }
  return { data: (withChoiceImages.data ?? []) as QuestionRecord[], error: withChoiceImages.error, choiceImagesAvailable: true };
}

export default function AdminManageTests({ tests }: { tests: TestSummary[] }) {
  const [selectedTestId, setSelectedTestId] = useState(tests[0]?.id ?? "");
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [choiceImagesAvailable, setChoiceImagesAvailable] = useState(true);
  const [draftSection, setDraftSection] = useState<"math" | "reading_writing">(tests[0]?.section ?? "math");
  const [draftModule, setDraftModule] = useState(1);
  const [editor, setEditor] = useState<EditorValues>(emptyEditor);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [importCandidates, setImportCandidates] = useState<ImportedQuestion[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importReviews, setImportReviews] = useState<ImportReview[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [editingImportIndex, setEditingImportIndex] = useState<number | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const knownTestIds = useRef(new Set(tests.map((test) => test.id)));
  const selectedTest = tests.find((test) => test.id === selectedTestId) ?? null;

  useEffect(() => {
    const newlyCreatedTest = tests.find((test) => !knownTestIds.current.has(test.id));
    for (const test of tests) knownTestIds.current.add(test.id);
    if (newlyCreatedTest) {
      setSelectedTestId(newlyCreatedTest.id);
      setDraftSection(newlyCreatedTest.section ?? "math");
      setDraftModule(1);
      resetEditor();
      setMessage("Yangi qoralama tanlandi. Endi shu testga savollarni kiriting.");
      setError("");
      setImportCandidates([]);
      setImportWarnings([]);
      setImportReviews([]);
      setEditingImportIndex(null);
      setPdfFile(null);
      return;
    }
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
      const questionResult = await readQuestionRecords(supabase, selectedTestId);
      const { data, error: questionsError } = questionResult;
      setChoiceImagesAvailable(questionResult.choiceImagesAvailable);
      if (cancelled) return;
      if (questionsError) {
        setError(questionsError.message);
        setQuestions([]);
        setLoading(false);
        return;
      }
      setQuestions(sortQuestions((data ?? []) as QuestionRecord[]));
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

  function imageFileChange(file: File | null, update: (file: File | null, preview: string | null) => void) {
    if (!file) { update(null, null); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Savol rasmi PNG, JPG yoki WEBP bo‘lsin va 5 MB dan oshmasin.");
      return;
    }
    setError("");
    update(file, URL.createObjectURL(file));
  }

  async function uploadQuestionImage(file: File, testId: string, questionId: string) {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${testId}/${questionId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("question-images").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    return path;
  }

  async function analyzePdf() {
    if (!selectedTest || selectedTest.published || !pdfFile) return;
    setPdfBusy(true);
    setError("");
    setMessage("");
    setImportCandidates([]);
    setImportWarnings([]);
    setImportReviews([]);
    setEditingImportIndex(null);
    try {
      const form = new FormData();
      form.set("file", pdfFile);
      form.set("testId", selectedTest.id);
      const initialResponse = await fetch("/api/admin/import-pdf", { method: "POST", body: form });
      const initialResult = await readPdfImportResponse(initialResponse);
      let importedQuestions = initialResult.questions ?? [];
      let warnings = initialResult.warnings ?? [];

      if (initialResult.needsVision) {
        setMessage("Skaner PDF sahifalari kichik bo‘laklarga ajratilmoqda…");
        const chunks = await splitPdfForBrowser(pdfFile);
        const chunkResults: PdfImportResponse[] = [];
        for (let offset = 0; offset < chunks.length; offset += VISION_CONCURRENCY) {
          const batch = chunks.slice(offset, offset + VISION_CONCURRENCY);
          const results = await Promise.all(batch.map(async (chunk) => {
            const chunkForm = new FormData();
            chunkForm.set("file", chunk.file);
            chunkForm.set("testId", selectedTest.id);
            chunkForm.set("visionChunk", "true");
            chunkForm.set("firstPage", String(chunk.firstPage));
            chunkForm.set("lastPage", String(chunk.lastPage));
            try {
              const response = await fetch("/api/admin/import-pdf", { method: "POST", body: chunkForm });
              return await readPdfImportResponse(response);
            } catch (caught) {
              const reason = caught instanceof Error ? caught.message : "server xatosi";
              throw new Error(`${chunk.firstPage}–${chunk.lastPage}-sahifalarni tahlil qilib bo‘lmadi: ${reason}`);
            }
          }));
          chunkResults.push(...results);
          const completed = Math.min(offset + batch.length, chunks.length);
          setMessage(`PDF sahifalari AI bilan tahlil qilinmoqda… ${completed}/${chunks.length} bo‘lak`);
        }

        const seen = new Set<string>();
        importedQuestions = chunkResults.flatMap((result) => result.questions ?? []).filter((question) => {
          const key = question.section + ":" + question.prompt.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 180);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        warnings = [...new Set(chunkResults.flatMap((result) => result.warnings ?? []))];
      }

      if (!importedQuestions.length) {
        setImportWarnings(warnings);
        if (warnings.length) {
          setMessage("Grafik yoki inglizcha asl matni o‘qilmagan savollar import qilinmadi. Ogohlantirishlarni ko‘rib, keraklilarini qo‘lda kiriting.");
          return;
        }
        throw new Error("PDF’dan inglizcha asl matn va javob variantlari bilan savollar ajratilmadi. Aniqroq PDF yoki javoblar kaliti bor faylni sinang.");
      }
      setImportCandidates(importedQuestions);
      setImportWarnings(warnings);
      setMessage(`${importedQuestions.length} ta savol PDF’dan ajratildi. Saqlashdan oldin javoblarni tekshiring.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PDF tahlil qilinmadi.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function reviewImportedQuestions() {
    if (!importCandidates.length || reviewBusy) return;
    setReviewBusy(true);
    setError("");
    setImportReviews([]);
    try {
      const reviews: ImportReview[] = [];
      for (let offset = 0; offset < importCandidates.length; offset += 10) {
        const batch = importCandidates.slice(offset, offset + 10);
        const response = await fetch("/api/admin/review-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: batch.map(({ prompt, choices, answerIndex, explanation }) => ({ prompt, choices, answerIndex, explanation })) }),
        });
        const body = await response.json().catch(() => null) as { error?: string; reviews?: ImportReview[] } | null;
        if (!response.ok) throw new Error(body?.error || "AI tekshiruv so‘rovi bajarilmadi.");
        reviews.push(...(body?.reviews ?? []).map((item) => ({ ...item, index: item.index + offset, duplicateOf: item.duplicateOf === null ? null : item.duplicateOf + offset })));
      }
      setImportReviews(reviews);
      const issueCount = reviews.filter((item) => item.status !== "ok" || item.issues.length).length;
      setMessage(issueCount ? "AI " + issueCount + " ta savolni tekshirishni tavsiya qildi. Tuzatishlarni bittalab ko‘rib chiqing." : "AI tekshiruvi tugadi. Aniq xato topilmadi; baribir manba bilan solishtirib chiqing.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI savollarni tekshirmadi.");
    } finally {
      setReviewBusy(false);
    }
  }

  function applyImportReview(review: ImportReview) {
    const changes: Partial<ImportedQuestion> = {};
    if (review.suggestedPrompt) changes.prompt = review.suggestedPrompt;
    if (review.suggestedChoices?.length === 4) changes.choices = review.suggestedChoices as ImportedQuestion["choices"];
    if (review.suggestedAnswerIndex !== null) changes.answerIndex = review.suggestedAnswerIndex;
    if (review.suggestedExplanation) changes.explanation = review.suggestedExplanation;
    setImportCandidates((items) => items.map((item, index) => index === review.index ? { ...item, ...changes } : item));
    setImportReviews((items) => items.filter((item) => item.index !== review.index));
  }

  async function saveImportedQuestions() {
    if (!selectedTest || selectedTest.published || !importCandidates.length) return;
    setSaving(true);
    setError("");
    setMessage("");
    const nextPosition = new Map<string, number>();
    for (const question of questions) {
      const key = `${question.section}:${question.module_number}`;
      nextPosition.set(key, Math.max(nextPosition.get(key) ?? 0, question.position));
    }
    const rows = importCandidates.map((question) => {
      const key = `${question.section}:${question.module_number}`;
      const position = (nextPosition.get(key) ?? 0) + 1;
      nextPosition.set(key, position);
      return {
        id: crypto.randomUUID(),
        test_id: selectedTest.id,
        section: question.section,
        topic: question.topic || selectedTest.topic || "SAT",
        prompt: question.prompt,
        choices: question.choices,
        prompt_uz: question.prompt_uz?.trim() || null,
        choices_uz: question.choices_uz?.every((choice) => choice.trim()) ? question.choices_uz.map((choice) => choice.trim()) : null,
        image_url: null as string | null,
        ...(choiceImagesAvailable ? { choice_images: (question.choiceImagePaths ?? [null, null, null, null]).slice(0, 4) } : {}),
        module_number: selectedTest.kind === "topic" ? 1 : question.module_number,
        position,
      };
    });
    try {
      for (let index = 0; index < rows.length; index++) {
        const candidate = importCandidates[index];
        const row = rows[index];
        if (!candidate || !row) continue;
        const imageFile = candidate.imageFile;
        if (imageFile) row.image_url = await uploadQuestionImage(imageFile, selectedTest.id, row.id);
        const choiceFiles = candidate.choiceImageFiles ?? [];
        for (let choiceIndex = 0; choiceIndex < 4; choiceIndex++) {
          const choiceFile = choiceFiles[choiceIndex];
          if (choiceFile && row.choice_images) row.choice_images[choiceIndex] = await uploadQuestionImage(choiceFile, selectedTest.id, row.id);
        }
      }
      const { error: insertError } = await supabase.from("questions").insert(rows);
      if (insertError) throw insertError;
      const { error: keyError } = await supabase.from("question_keys").upsert(
        importCandidates.map((question, index) => ({
          question_id: rows[index].id,
          answer_index: question.answerIndex,
          explanation: question.explanation,
        })),
        { onConflict: "question_id" },
      );
      if (keyError) {
        await supabase.from("questions").delete().in("id", rows.map((row) => row.id));
        throw keyError;
      }
      const questionResult = await readQuestionRecords(supabase, selectedTest.id);
      const { data, error: reloadError } = questionResult;
      setChoiceImagesAvailable(questionResult.choiceImagesAvailable);
      if (reloadError) throw reloadError;
      setQuestions(sortQuestions((data ?? []) as QuestionRecord[]));
      setImportCandidates([]);
      setImportWarnings([]);
      setEditingImportIndex(null);
      setPdfFile(null);
      setMessage(`${rows.length} ta savol va javob kaliti testga saqlandi.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PDF savollari bazaga saqlanmadi.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedTest() {
    if (!selectedTest) return;
    const confirmed = window.confirm(`“${selectedTest.title}” testini butunlay o‘chirasizmi? O‘quvchi urinishlari mavjud bo‘lsa, natijalarni saqlash uchun o‘chirish bloklanadi.`);
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setMessage("");
    const { error: deleteError } = await supabase.rpc("delete_test", { p_test_id: selectedTest.id });
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    setMessage("Test va unga tegishli savollar o‘chirildi.");
    window.location.reload();
  }

  async function saveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTest || selectedTest.published) return;

    const prompt = editor.prompt.trim();
    const choices = editor.choices.map((choice) => choice.trim());
    const promptUz = editor.promptUz.trim();
    const choicesUz = editor.choicesUz.map((choice) => choice.trim());
    const section = selectedTest.kind === "mock" ? draftSection : selectedTest.section ?? "math";
    const moduleNumber = selectedTest.kind === "mock" ? draftModule : 1;
    if (!prompt || choices.some((choice) => !choice)) {
      setError("Savol matni va A–D javoblarining barchasini to‘ldiring.");
      return;
    }

    if (!choiceImagesAvailable && editor.choiceImageFiles.some(Boolean)) {
      setError("Javob varianti rasmlarini saqlash uchun Supabase’dagi 0006_choice_images.sql migrationni ishga tushiring.");
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
          .update({
            prompt,
            choices,
            prompt_uz: promptUz || null,
            choices_uz: choicesUz.every(Boolean) ? choicesUz : null,
            image_url: editor.imagePath,
            ...(choiceImagesAvailable ? { choice_images: editor.choiceImagePaths } : {}),
            section,
            module_number: moduleNumber,
          })
          .eq("id", questionId)
          .eq("test_id", selectedTest.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("questions")
          .insert({
            test_id: selectedTest.id,
            id: crypto.randomUUID(),
            section,
            topic: selectedTest.topic?.trim() || "SAT",
            prompt,
            choices,
            prompt_uz: promptUz || null,
            choices_uz: choicesUz.every(Boolean) ? choicesUz : null,
            image_url: null,
            module_number: moduleNumber,
            position: Math.max(0, ...questions.filter((question) => question.section === section && question.module_number === moduleNumber).map((question) => question.position)) + 1,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        questionId = data.id;
      }

      if (editor.imageFile && questionId) {
        const imagePath = await uploadQuestionImage(editor.imageFile, selectedTest.id, questionId);
        const { error: imageError } = await supabase.from("questions").update({ image_url: imagePath }).eq("id", questionId);
        if (imageError) throw imageError;
      }

      if (questionId && editor.choiceImageFiles.some(Boolean)) {
        const paths = [...editor.choiceImagePaths];
        for (let choiceIndex = 0; choiceIndex < 4; choiceIndex++) {
          const file = editor.choiceImageFiles[choiceIndex];
          if (file) paths[choiceIndex] = await uploadQuestionImage(file, selectedTest.id, questionId);
        }
        const { error: choiceImageError } = await supabase.from("questions").update({ choice_images: paths }).eq("id", questionId);
        if (choiceImageError) throw choiceImageError;
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
      const questionResult = await readQuestionRecords(supabase, selectedTest.id);
      const { data, error: reloadError } = questionResult;
      setChoiceImagesAvailable(questionResult.choiceImagesAvailable);
      if (reloadError) throw reloadError;
      setQuestions(sortQuestions((data ?? []) as QuestionRecord[]));
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
    setDraftSection(question.section);
    setDraftModule(question.module_number);
    const signedImage = question.image_url
      ? await supabase.storage.from("question-images").createSignedUrl(question.image_url, 3600)
      : null;
    const choicePaths = question.choice_images ?? [null, null, null, null];
    const choicePreviews = await Promise.all(choicePaths.map(async (path) => {
      if (!path) return null;
      const { data: signed } = await supabase.storage.from("question-images").createSignedUrl(path, 3600);
      return signed?.signedUrl ?? null;
    }));
    setEditor({
      prompt: question.prompt,
      promptUz: question.prompt_uz ?? "",
      choices: question.choices,
      choicesUz: question.choices_uz ?? ["", "", "", ""],
      answerIndex: data.answer_index,
      explanation: data.explanation ?? "",
      imageFile: null,
      imagePath: question.image_url,
      imagePreview: signedImage?.data?.signedUrl ?? null,
      choiceImageFiles: [null, null, null, null],
      choiceImagePaths: choicePaths,
      choiceImagePreviews: choicePreviews,
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
    const affected = remaining.filter((item) => item.section === question.section && item.module_number === question.module_number);
    let reorderError = "";
    for (const [index, item] of affected.entries()) {
      const { error: positionError } = await supabase
        .from("questions")
        .update({ position: index + 1 })
        .eq("id", item.id);
      if (positionError) {
        reorderError = positionError.message;
        break;
      }
    }
    setQuestions(remaining.map((item) => {
      if (reorderError || item.section !== question.section || item.module_number !== question.module_number) return item;
      return { ...item, position: affected.findIndex((candidate) => candidate.id === item.id) + 1 };
    }));
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
    if (selectedTest.kind === "mock") {
      const requiredModules = [
        { section: "reading_writing", module: 1, label: "Reading and Writing · Module 1" },
        { section: "reading_writing", module: 2, label: "Reading and Writing · Module 2" },
        { section: "math", module: 1, label: "Math · Module 1" },
        { section: "math", module: 2, label: "Math · Module 2" },
      ];
      const missing = requiredModules.filter((part) =>
        !questions.some((question) => question.section === part.section && question.module_number === part.module),
      );
      if (missing.length) {
        setError("E’lon qilishdan oldin har bir SAT moduliga kamida bitta savol qo‘shing: " + missing.map((part) => part.label).join(", "));
        return;
      }
      const expectedCounts = [
        { section: "reading_writing", module: 1, count: 27 },
        { section: "reading_writing", module: 2, count: 27 },
        { section: "math", module: 1, count: 22 },
        { section: "math", module: 2, count: 22 },
      ];
      const countProblem = expectedCounts.map((part) => {
        const actual = questions.filter((question) => question.section === part.section && question.module_number === part.module).length;
        return actual === part.count ? null : part.section + " · Module " + part.module + ": " + actual + "/" + part.count;
      }).filter(Boolean);
      if (countProblem.length) {
        setError("SAT mock uchun standart sonlar kerak: Reading and Writing 27+27, Math 22+22. " + countProblem.join("; "));
        return;
      }
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
          <p>Qoralama test tanlang, savol matni va 4 ta javobni kiriting, to‘g‘ri javobni belgilang, so‘ng saqlang.</p>
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
            const nextTest = tests.find((test) => test.id === event.target.value);
            setDraftSection(nextTest?.section ?? "math");
            setDraftModule(1);
          resetEditor();
          setMessage("");
          setError("");
          setImportCandidates([]);
          setImportWarnings([]);
          setEditingImportIndex(null);
          setPdfFile(null);
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
            <>
            <section className="pdf-import-panel" aria-labelledby="pdf-import-title">
              <div className="row">
                <div><h3 id="pdf-import-title">PDF’dan savollarni import qilish</h3><p>PDF yuklang: AI savollar, variantlar, javob kaliti va izohni ajratadi. Tekshirganingizdan keyin testga saqlang.</p></div>
                <span className="tag">AI · PDF</span>
              </div>
              <div className="pdf-import-controls">
                <input
                  className="field"
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Savollar PDF fayli"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setPdfFile(file);
                    setImportCandidates([]);
                    setImportWarnings([]);
                    if (file && file.size > 3.5 * 1024 * 1024) {
                      setPdfFile(null);
                      setError("PDF 3.5 MB dan kichik bo‘lishi kerak.");
                    } else {
                      setError("");
                    }
                  }}
                />
                <button type="button" className="btn secondary" disabled={!pdfFile || pdfBusy} onClick={() => void analyzePdf()}>
                  {pdfBusy ? "PDF tahlil qilinmoqda…" : "PDF’ni AI bilan o‘qish"}
                </button>
              </div>
              <p className="math-input-help">Fayl hajmi 3.5 MB gacha. Skaner PDF 48 sahifagacha kichik bo‘laklarda tahlil qilinadi. Savol va javoblarni testga saqlashdan oldin tekshiring.</p>
              {importCandidates.length > 0 && (
                <div className="pdf-import-preview">
                  <div className="row"><h4>Tekshirish uchun ajratilgan savollar ({importCandidates.length})</h4><button type="button" className="btn secondary" onClick={() => setImportCandidates([])}>Bekor qilish</button></div>
                  {importWarnings.length > 0 && <div className="notice"><strong>AI ogohlantirishi:</strong> {importWarnings.join("; ")}</div>}
                  <button type="button" className="btn secondary" disabled={reviewBusy || saving} onClick={() => void reviewImportedQuestions()}>{reviewBusy ? "AI savollarni tekshirmoqda…" : "AI bilan xatolarni tekshirish"}</button>
                  {importReviews.length > 0 && <div className="notice"><strong>AI tekshiruv tavsiyalari:</strong><ul>{importReviews.map((review) => {
                    const candidate = importCandidates[review.index];
                    const hasEdits = Boolean(review.suggestedPrompt || review.suggestedChoices || review.suggestedAnswerIndex !== null || review.suggestedExplanation);
                    return <li key={review.index}>Savol {review.index + 1}: {review.status === "duplicate" ? "ehtimol takroriy" : review.status === "needs_review" ? "qayta tekshiring" : "format/javob ko‘rildi"}. {review.issues.join("; ")}{review.duplicateOf !== null ? " (o‘xshashi " + (review.duplicateOf + 1) + "-savol)" : ""}{hasEdits && candidate && <button type="button" className="btn secondary" onClick={() => applyImportReview(review)}>AI taklifini ko‘rib qo‘llash</button>}</li>;
                  })}</ul><small>AI hech narsani o‘zi o‘zgartirmaydi yoki o‘chirmaydi. Taklifni siz tanlab qo‘llang; takrorni alohida olib tashlang.</small></div>}
                  <ol>
                    {importCandidates.map((candidate, index) => (
                      <li key={`${candidate.section}-${candidate.module_number}-${index}`}>
                        <div className="row"><strong>{candidate.section === "math" ? "Math" : "Reading and Writing"} · Module {candidate.module_number} · Javob {letters[candidate.answerIndex]}</strong><div className="row"><button type="button" className="btn secondary" onClick={() => setEditingImportIndex(index)}>Tahrirlash</button><button type="button" className="btn admin-danger" onClick={() => { setImportCandidates((items) => items.filter((_, itemIndex) => itemIndex !== index)); setEditingImportIndex(null); }}>Olib tashlash</button></div></div>
                        <div className="pdf-preview-prompt"><MathText value={candidate.prompt} /></div>
                        {candidate.prompt_uz && <p><strong>O‘zbekcha tarjima:</strong> <MathText value={candidate.prompt_uz} /></p>}
                        {candidate.imagePreview && <img src={candidate.imagePreview} alt="Savol chizmasi" style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }} />}
                        {candidate.has_figure && !candidate.imageFile && <p className="notice">PDF’da chizma bor deb topildi. Rasmni tahrirlash oynasida yuklang, aks holda faqat AI tasvirlagan matn qoladi.</p>}
                        <ol className="pdf-preview-choice-list" type="A">{candidate.choices.map((choice, choiceIndex) => <li key={choiceIndex} className={choiceIndex === candidate.answerIndex ? "correct" : ""}><MathText value={choice} /></li>)}</ol>
                        <p className="pdf-preview-explanation"><strong>AI izohi:</strong> <MathText value={candidate.explanation || "Izoh kiritilmagan."} /></p>
                      </li>
                    ))}
                  </ol>
                  <button type="button" className="btn primary" disabled={saving || !importCandidates.length} onClick={() => void saveImportedQuestions()}>
                    {saving ? "Bazaga saqlanmoqda…" : `${importCandidates.length} ta savolni bazaga saqlash`}
                  </button>
                </div>
              )}
            </section>

            {editingImportIndex !== null && importCandidates[editingImportIndex] && (() => {
              const candidate = importCandidates[editingImportIndex];
              const updateCandidate = (changes: Partial<ImportedQuestion>) => setImportCandidates((items) => items.map((item, itemIndex) => itemIndex === editingImportIndex ? { ...item, ...changes } : item));
              return <div className="math-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingImportIndex(null); }}>
                <section className="math-editor-dialog pdf-candidate-editor" role="dialog" aria-modal="true" aria-labelledby="pdf-candidate-title">
                  <div className="row"><div><h3 id="pdf-candidate-title">PDF savolini tekshirish</h3><p>AI ajratgan matn va matematik ifodalarni tahrirlab saqlang.</p></div><button type="button" className="math-editor-close" aria-label="Yopish" onClick={() => setEditingImportIndex(null)}>×</button></div>
                  {selectedTest.kind === "mock" && <div className="cards">
                    <div><label htmlFor="pdf-edit-section">Bo‘lim</label><select id="pdf-edit-section" className="field" value={candidate.section} onChange={(event) => updateCandidate({ section: event.target.value as ImportedQuestion["section"] })}><option value="reading_writing">Reading and Writing</option><option value="math">Math</option></select></div>
                    <div><label htmlFor="pdf-edit-module">Modul</label><select id="pdf-edit-module" className="field" value={candidate.module_number} onChange={(event) => updateCandidate({ module_number: Number(event.target.value) as 1 | 2 })}><option value={1}>Module 1</option><option value={2}>Module 2</option></select></div>
                  </div>}
                  <MathInput id="pdf-edit-prompt" label="Savol matni" multiline rows={4} value={candidate.prompt} onChange={(prompt) => updateCandidate({ prompt })} />
                  <MathInput id="pdf-edit-prompt-uz" label="O‘zbekcha tarjima (ixtiyoriy)" multiline rows={3} value={candidate.prompt_uz ?? ""} onChange={(prompt_uz) => updateCandidate({ prompt_uz })} />
                  <div className="cards">{candidate.choices.map((choice, choiceIndex) => <MathInput key={choiceIndex} id={`pdf-edit-choice-${choiceIndex}`} label={`Javob ${letters[choiceIndex]}`} value={choice} onChange={(next) => updateCandidate({ choices: candidate.choices.map((option, index) => index === choiceIndex ? next : option) as ImportedQuestion["choices"] })} />)}</div>
                  <div className="cards">{candidate.choices.map((_, choiceIndex) => <div key={"pdf-choice-image-" + choiceIndex}>
                    <label htmlFor={"pdf-edit-choice-image-" + choiceIndex}>Javob {letters[choiceIndex]} rasmi (ixtiyoriy)</label>
                    <input id={"pdf-edit-choice-image-" + choiceIndex} className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (!file) return;
                      imageFileChange(file, (imageFile, imagePreview) => updateCandidate({
                        choiceImageFiles: (candidate.choiceImageFiles ?? [null, null, null, null]).map((item, index) => index === choiceIndex ? imageFile : item),
                        choiceImagePaths: (candidate.choiceImagePaths ?? [null, null, null, null]).map((item, index) => index === choiceIndex ? null : item),
                        choiceImagePreviews: (candidate.choiceImagePreviews ?? [null, null, null, null]).map((item, index) => index === choiceIndex ? imagePreview : item),
                      }));
                    }} />
                    {candidate.choiceImagePreviews?.[choiceIndex] && <div><img className="bb-choice-image-preview" src={candidate.choiceImagePreviews[choiceIndex] ?? ""} alt={"Javob " + letters[choiceIndex] + " rasmi"} /><button type="button" className="btn secondary" onClick={() => updateCandidate({
                      choiceImageFiles: (candidate.choiceImageFiles ?? [null, null, null, null]).map((item, index) => index === choiceIndex ? null : item),
                      choiceImagePaths: (candidate.choiceImagePaths ?? [null, null, null, null]).map((item, index) => index === choiceIndex ? null : item),
                      choiceImagePreviews: (candidate.choiceImagePreviews ?? [null, null, null, null]).map((item, index) => index === choiceIndex ? null : item),
                    })}>Rasmni olib tashlash</button></div>}
                  </div>)}</div>
                  <div className="cards">{(candidate.choices_uz ?? ["", "", "", ""]).map((choice, choiceIndex) => <MathInput key={choiceIndex} id={`pdf-edit-choice-uz-${choiceIndex}`} label={`Tarjima ${letters[choiceIndex]}`} value={choice} onChange={(next) => updateCandidate({ choices_uz: (candidate.choices_uz ?? ["", "", "", ""]).map((option, index) => index === choiceIndex ? next : option) as ImportedQuestion["choices_uz"] })} />)}</div>
                  <label htmlFor="pdf-edit-image">Savol chizmasi yoki rasmi (PNG/JPG/WEBP, 5 MB gacha)</label>
                  <input id="pdf-edit-image" className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => imageFileChange(event.target.files?.[0] ?? null, (imageFile, imagePreview) => updateCandidate({ imageFile, imagePreview }))} />
                  {candidate.imagePreview && <img src={candidate.imagePreview} alt="Yuklanadigan savol rasmi" style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }} />}
                  <label htmlFor="pdf-edit-answer">To‘g‘ri javob</label><select id="pdf-edit-answer" className="field" value={candidate.answerIndex} onChange={(event) => updateCandidate({ answerIndex: Number(event.target.value) })}>{letters.map((letter, index) => <option key={letter} value={index}>{letter}</option>)}</select>
                  <MathInput id="pdf-edit-explanation" label="AI yechim izohi" multiline rows={4} value={candidate.explanation} onChange={(explanation) => updateCandidate({ explanation })} />
                  <div className="math-editor-actions"><button type="button" className="btn primary" onClick={() => setEditingImportIndex(null)}>O‘zgarishlarni saqlash</button></div>
                </section>
              </div>;
            })()}

            <form id="question-editor" onSubmit={saveQuestion}>
              <div className="row">
                <h3>{editingQuestionId ? "Savolni tahrirlash" : "Yangi savol"}</h3>
                {editingQuestionId && (
                  <button type="button" className="btn secondary" onClick={resetEditor}>
                    Bekor qilish
                  </button>
                )}
              </div>
              {selectedTest.kind === "mock" ? (
                <div className="cards">
                  <div>
                    <label htmlFor="question-section">Bo‘lim</label>
                    <select id="question-section" className="field" value={draftSection} onChange={(event) => setDraftSection(event.target.value as "math" | "reading_writing")}>
                      <option value="reading_writing">Reading and Writing</option>
                      <option value="math">Math</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="question-module">Modul</label>
                    <select id="question-module" className="field" value={draftModule} onChange={(event) => setDraftModule(Number(event.target.value))}>
                      <option value={1}>Module 1</option>
                      <option value={2}>Module 2</option>
                    </select>
                  </div>
                </div>
              ) : (
                <p className="notice">{selectedTest.section === "math" ? "Math · Module 1" : "Reading and Writing · Module 1"}</p>
              )}
              {!choiceImagesAvailable && <p className="notice">Javob variantlari rasmini yoqish uchun Supabase SQL Editor’da 0006_choice_images.sql migrationni ishga tushiring. Boshqa savol maydonlari ishlayveradi.</p>}
              <p className="notice">Math savolida ildiz, kasr, daraja va boshqa belgilar pastdagi ∑ Formula tugmalarida doim ochiq. Tugmani bosib, qavs ichiga qiymatni yozing — ko‘rinishini darhol tekshirishingiz mumkin.</p>
              <MathInput
                id="question-prompt"
                label="Savol matni"
                multiline
                rows={5}
                required
                value={editor.prompt}
                onChange={(prompt) => setEditor((current) => ({ ...current, prompt }))}
                placeholder="Savol yoki Reading & Writing matnini kiriting"
              />
              <MathInput id="question-prompt-uz" label="O‘zbekcha tarjima (ixtiyoriy)" multiline rows={3} value={editor.promptUz} onChange={(promptUz) => setEditor((current) => ({ ...current, promptUz }))} placeholder="Savolning o‘zbekcha tarjimasi" />
              <div className="cards">
                {editor.choices.map((choice, index) => (
                  <div key={letters[index]}>
                    <MathInput
                      id={"choice-" + letters[index]}
                      label={"Javob " + letters[index]}
                      required
                      value={choice}
                      onChange={(value) => updateChoice(index, value)}
                    />
                    <label htmlFor={"choice-image-" + index}>Javob {letters[index]} rasmi (ixtiyoriy)</label>
                    <input id={"choice-image-" + index} className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (!file) return;
                      imageFileChange(file, (nextFile, preview) => setEditor((current) => ({ ...current, choiceImageFiles: current.choiceImageFiles.map((item, i) => i === index ? nextFile : item), choiceImagePaths: current.choiceImagePaths.map((item, i) => i === index ? null : item), choiceImagePreviews: current.choiceImagePreviews.map((item, i) => i === index ? preview : item) })));
                    }} />
                    {editor.choiceImagePreviews[index] && <div><img className="bb-choice-image-preview" src={editor.choiceImagePreviews[index] ?? ""} alt={"Javob " + letters[index] + " rasmi"} /><button type="button" className="btn secondary" onClick={() => setEditor((current) => ({ ...current, choiceImageFiles: current.choiceImageFiles.map((item, i) => i === index ? null : item), choiceImagePaths: current.choiceImagePaths.map((item, i) => i === index ? null : item), choiceImagePreviews: current.choiceImagePreviews.map((item, i) => i === index ? null : item) }))}>Rasmni olib tashlash</button></div>}

                  </div>
                ))}
              </div>
              <div className="cards">
                {editor.choicesUz.map((choice, index) => <MathInput key={letters[index]} id={`choice-uz-${letters[index]}`} label={`O‘zbekcha javob ${letters[index]} (ixtiyoriy)`} value={choice} onChange={(value) => setEditor((current) => ({ ...current, choicesUz: current.choicesUz.map((option, choiceIndex) => choiceIndex === index ? value : option) }))} />)}
              </div>
              <label htmlFor="question-image">Savol rasmi yoki grafik (PNG/JPG/WEBP, 5 MB gacha)</label>
              <input id="question-image" className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => imageFileChange(event.target.files?.[0] ?? null, (imageFile, imagePreview) => setEditor((current) => ({ ...current, imageFile, imagePreview })))} />
              {editor.imagePreview && <div><img src={editor.imagePreview} alt="Savol chizmasi" style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }} /><button type="button" className="btn secondary" onClick={() => setEditor((current) => ({ ...current, imageFile: null, imagePath: null, imagePreview: null }))}>Rasmni olib tashlash</button></div>}
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
                  <MathInput
                    id="explanation"
                    label="Javob izohi (ixtiyoriy)"
                    multiline
                    rows={3}
                    value={editor.explanation}
                    onChange={(explanation) => setEditor((current) => ({ ...current, explanation }))}
                    placeholder="Javob izohi"
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn secondary"
                disabled={aiBusy || !editor.prompt.trim() || editor.choices.some((choice) => !choice.trim())}
                onClick={async () => {
                  setAiBusy(true);
                  setError("");
                  try {
                    const response = await fetch("/api/ai/explain", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mode: "draft", prompt: editor.prompt, choices: editor.choices, answerIndex: editor.answerIndex }),
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || "AI izoh yaratilmadi.");
                    setEditor((current) => ({ ...current, explanation: result.explanation }));
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "AI izoh yaratilmadi.");
                  } finally {
                    setAiBusy(false);
                  }
                }}
              >
                {aiBusy ? "AI izoh tayyorlayapti…" : "AI bilan izoh yaratish"}
              </button>

              {error && <p className="error" role="alert">{error}</p>}
              {message && <p className="success" role="status">{message}</p>}
              <button className="btn primary" disabled={saving}>
                {saving ? "Saqlanmoqda…" : editingQuestionId ? "O‘zgarishlarni saqlash" : "Savolni saqlash"}
              </button>
            </form>
            </>
          )}

          {selectedTest.published && error && <p className="error" role="alert">{error}</p>}
          {selectedTest.published && message && <p className="success" role="status">{message}</p>}

          <hr className="divider" />
          <div className="row">
            <h3>Savollar ({questions.length})</h3>
            <div className="row admin-test-actions">
              <button type="button" className="btn admin-danger" disabled={saving} onClick={() => void deleteSelectedTest()}>
                {saving ? "Ishlanmoqda…" : "Testni o‘chirish"}
              </button>
              {selectedTest.published ? null : (
              <button className="btn primary" type="button" onClick={publishTest} disabled={saving || loading}>
                {saving ? "Tekshirilmoqda…" : "Testni e’lon qilish"}
              </button>
              )}
            </div>
          </div>

          {loading ? (
            <p>Savollar yuklanmoqda…</p>
          ) : questions.length ? (
            <ol className="admin-question-list">
              {questions.map((question, index) => {
                const previous = questions[index - 1];
                const startsModule = !previous || previous.section !== question.section || previous.module_number !== question.module_number;
                return (
                  <Fragment key={question.id}>
                    {startsModule && <li className="admin-module-heading">{question.section === "reading_writing" ? "Reading and Writing" : "Math"} · Module {question.module_number}</li>}
                    <li>
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
                  </Fragment>
                );
              })}
            </ol>
          ) : (
            <p className="notice">Bu testga hali savol qo‘shilmagan.</p>
          )}
        </>
      )}
    </section>
  );
}

