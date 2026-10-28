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
  const [duration, setDuration] = useState("2100");
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
        section: kind === "mock" ? null : section,
        topic: kind === "mock" ? "Full SAT" : topic.trim(),
        duration_seconds: kind === "mock" ? 8040 : Number(duration),
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
              <option value="mock">SAT Full Mock · 4 modul</option>
            </select>
          </div>
          {kind === "topic" && <>
            <div>
              <label htmlFor="section">Bo‘lim</label>
              <select id="section" className="field" value={section} onChange={(event) => {
                const next = event.target.value as "math" | "reading_writing";
                setSection(next);
                setDuration(next === "math" ? "2100" : "1920");
              }}>
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
          </>}
        </div>
        {kind === "mock" && <p className="notice">Full SAT mock 4 moduldan iborat: Reading and Writing — 32 daqiqadan, Math — 35 daqiqadan. Reading and Writing tugagach 10 daqiqalik tanaffus bo‘ladi. Savollarni pastdagi muharrirda har bir modulga ajrating.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Yaratilmoqda…" : "Qoralama test yaratish"}
        </button>
      </form>
    </section>
  );
}
