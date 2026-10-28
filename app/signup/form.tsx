"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const { error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (signupError) throw signupError;
      setMessage(
        "So‘rov yuborildi. Email tasdiqlash yoqilgan bo‘lsa, pochtangizni tekshiring. Administrator kirish huquqini tasdiqlagach, testlar ochiladi.",
      );
      setName("");
      setEmail("");
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ro‘yxatdan o‘tib bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="name">Ism-familiya</label>
      <input
        id="name"
        className="field"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ismingiz"
      />
      <label htmlFor="email">Email</label>
      <input
        id="email"
        className="field"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />
      <label htmlFor="password">Parol (kamida 8 belgi)</label>
      <input
        id="password"
        className="field"
        type="password"
        minLength={8}
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {message && (
        <>
          <p className="success" role="status">{message}</p>
          <a className="text-link" href="/login">Emailni tasdiqlagach, tizimga kiring →</a>
        </>
      )}
      <button className="btn primary full" disabled={busy}>
        {busy ? "Yuborilmoqda…" : "Kirish so‘rovini yuborish"}
      </button>
      <p className="notice" style={{ marginTop: 12 }}>
        Akkaunt yaratilgandan keyin administrator tasdiqlamaguncha testlarga kira olmaysiz.
      </p>
    </form>
  );
}
