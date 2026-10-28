'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminCreateTest() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"topic" | "mock">("topic");
  const [section, setSection] = useState<"math" | "reading_writing">("math");
  const [topic, setTopic] = useState("Algebra");
  const [duration, setDuration] = useState("300");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Login talab qilinadi.");

      const { error: insertError } = await supabase.from("tests").insert({
        title: title.trim(),
        kind,
        section,
        topic: topic.trim(),
        duration_seconds: Number(duration),
        published: false,
        created_by: user.id,
      });
      if (insertError) throw insertError;

      setMessage("Test qoralama sifatida yaratildi. Endi pastdagi “Test savollari” bo‘limida savollarni kiriting.");
      setTitle("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test yaratilmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Yangi test yaratish</h2>
      <form onSubmit={submit}>
        <label htmlFor="title">Test nomi</label>
        <input
          id="title"
          className="field"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Masalan, Algebra — Linear Equations"
        />
        <div className="cards">
          <div>
            <label htmlFor="kind">Test turi</label>
            <select id="kind" className="field" value={kind} onChange={(event) => setKind(event.target.value as "topic" | "mock")}>
              <option value="topic">Topic Practice</option>
              <option value="mock">Full Mock</option>
            </select>
          </div>
          <div>
            <label htmlFor="section">Bo‘lim</label>
            <select id="section" className="field" value={section} onChange={(event) => setSection(event.target.value as "math" | "reading_writing")}>
              <option value="math">Math</option>
              <option value="reading_writing">Reading & Writing</option>
            </select>
          </div>
          <div>
            <label htmlFor="topic">Mavzu</label>
            <input id="topic" className="field" required value={topic} onChange={(event) => setTopic(event.target.value)} />
          </div>
          <div>
            <label htmlFor="duration">Vaqt (soniya)</label>
            <input id="duration" className="field" type="number" min="60" required value={duration} onChange={(event) => setDuration(event.target.value)} />
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Yaratilmoqda…" : "Qoralama test yaratish"}
        </button>
      </form>
    </section>
  );
}
