"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Student = {
  id: string;
  full_name: string;
  email: string | null;
  approved: boolean;
  created_at: string;
};

export default function AdminManageStudents({ initialStudents }: { initialStudents: Student[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const pending = students.filter((student) => !student.approved);
  const approved = students.filter((student) => student.approved);

  async function setAccess(student: Student, allowed: boolean) {
    setBusyId(student.id);
    setError("");
    setMessage("");
    const { error: updateError } = await supabase.rpc("set_student_access", {
      p_student_id: student.id,
      p_allowed: allowed,
    });
    if (updateError) {
      setError(updateError.message);
    } else {
      setStudents((current) =>
        current.map((item) => item.id === student.id ? { ...item, approved: allowed } : item),
      );
      setMessage(
        allowed
          ? (student.full_name || student.email || "O‘quvchi") + " uchun kirish berildi."
          : (student.full_name || student.email || "O‘quvchi") + " uchun kirish bekor qilindi.",
      );
    }
    setBusyId(null);
  }

  function studentRow(student: Student) {
    return (
      <li className="student-access-row" key={student.id}>
        <div>
          <strong>{student.full_name || "Ism kiritilmagan"}</strong>
          <span>{student.email || "Email topilmadi"}</span>
          <small>Ro‘yxatdan o‘tgan: {new Date(student.created_at).toLocaleDateString("uz-UZ")}</small>
        </div>
        {student.approved ? (
          <button
            className="btn admin-danger"
            type="button"
            disabled={busyId === student.id}
            onClick={() => void setAccess(student, false)}
          >
            {busyId === student.id ? "Saqlanmoqda…" : "Kirishni bekor qilish"}
          </button>
        ) : (
          <button
            className="btn primary"
            type="button"
            disabled={busyId === student.id}
            onClick={() => void setAccess(student, true)}
          >
            {busyId === student.id ? "Saqlanmoqda…" : "Kirish berish"}
          </button>
        )}
      </li>
    );
  }

  return (
    <section className="panel">
      <div className="row">
        <div>
          <h2>O‘quvchilarga kirish</h2>
          <p>Ro‘yxatdan o‘tgan o‘quvchilar siz tasdiqlamaguningizcha testlarni ko‘ra olmaydi.</p>
        </div>
        <span className="tag">Kutilmoqda: {pending.length}</span>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <h3>Kirish kutayotganlar</h3>
      {pending.length ? (
        <ul className="student-access-list">{pending.map(studentRow)}</ul>
      ) : (
        <p className="notice">Hozircha tasdiqlashni kutayotgan o‘quvchi yo‘q.</p>
      )}

      <hr className="divider" />
      <details>
        <summary className="student-approved-toggle">Ruxsat berilgan o‘quvchilar ({approved.length})</summary>
        {approved.length ? (
          <ul className="student-access-list">{approved.map(studentRow)}</ul>
        ) : (
          <p className="notice" style={{ marginTop: 12 }}>Hali hech bir o‘quvchiga ruxsat berilmagan.</p>
        )}
      </details>
    </section>
  );
}
