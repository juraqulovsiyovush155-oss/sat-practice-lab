"use client";

import katex from "katex";
import { useRef, useState } from "react";

type MathTextProps = { value: string; className?: string };

const mathToken = /(\\\([\s\S]*?\\\)|\$[^$]+\$)/g;

export function MathText({ value, className }: MathTextProps) {
  const parts = value.split(mathToken).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isParenMath = part.startsWith("\\(") && part.endsWith("\\)");
        const isDollarMath = part.startsWith("$") && part.endsWith("$");
        if (!isParenMath && !isDollarMath) return <span key={index}>{part}</span>;
        const tex = isParenMath ? part.slice(2, -2) : part.slice(1, -1);
        const html = katex.renderToString(tex, { throwOnError: false, strict: "ignore" });
        return <span key={index} className="math-rendered" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </span>
  );
}

type MathInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  required?: boolean;
};

const formulas = [
  { label: "√", snippet: "\\(\\sqrt{}\\)", cursor: 8, help: "Kvadrat ildiz" },
  { label: "∛", snippet: "\\(\\sqrt[3]{}\\)", cursor: 11, help: "Kub ildiz" },
  { label: "a/b", snippet: "\\(\\frac{}{}\\)", cursor: 8, help: "Kasr" },
  { label: "xⁿ", snippet: "\\(x^{}\\)", cursor: 5, help: "Daraja" },
  { label: "xₙ", snippet: "\\(x_{}\\)", cursor: 5, help: "Indeks" },
  { label: "|x|", snippet: "\\(\\left|{}\\right|\\)", cursor: 9, help: "Modul" },
  { label: "π", snippet: "\\(\\pi\\)", cursor: 5, help: "Pi" },
  { label: "θ", snippet: "\\(\\theta\\)", cursor: 8, help: "Teta" },
  { label: "sin", snippet: "\\(\\sin()\\)", cursor: 7, help: "Sinus" },
  { label: "log", snippet: "\\(\\log()\\)", cursor: 7, help: "Logarifm" },
  { label: "≤", snippet: "\\(\\leq\\)", cursor: 5, help: "Kichik yoki teng" },
  { label: "≥", snippet: "\\(\\geq\\)", cursor: 5, help: "Katta yoki teng" },
  { label: "≠", snippet: "\\(\\neq\\)", cursor: 5, help: "Teng emas" },
  { label: "±", snippet: "\\(\\pm\\)", cursor: 5, help: "Plus-minus" },
  { label: "×", snippet: "\\(\\times\\)", cursor: 8, help: "Ko‘paytirish" },
  { label: "÷", snippet: "\\(\\div\\)", cursor: 6, help: "Bo‘lish" },
  { label: "∞", snippet: "\\(\\infty\\)", cursor: 8, help: "Cheksizlik" },
];

export function MathInput({
  id,
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  required = false,
}: MathInputProps) {
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [showFormulas, setShowFormulas] = useState(true);

  function insertFormula(snippet: string, cursorOffset: number) {
    const field = fieldRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + snippet + value.slice(end));
    window.requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + cursorOffset, start + cursorOffset);
    });
  }

  return (
    <div className="math-input">
      <div className="math-input-heading">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="math-toggle"
          aria-expanded={showFormulas}
          onClick={() => setShowFormulas((open) => !open)}
        >
          ∑ Formula
        </button>
      </div>
      {showFormulas && (
        <div className="math-toolbar" aria-label="Formula belgilarini qo‘shish">
          {formulas.map((formula) => (
            <button
              type="button"
              key={formula.label}
              title={formula.help}
              aria-label={formula.help}
              onClick={() => insertFormula(formula.snippet, formula.cursor)}
            >
              {formula.label}
            </button>
          ))}
        </div>
      )}
      {multiline ? (
        <textarea
          ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          className="field"
          rows={rows}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          ref={fieldRef as React.RefObject<HTMLInputElement>}
          id={id}
          className="field"
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
      <div className="math-input-help">Formula tugmasini bosing va kursor qavs ichida turganda qiymatni yozing. Masalan, ildiz uchun tugmani bosing, 16 deb yozing. Matn bilan formulani birga yozish mumkin.</div>
      {value.includes("\\(") || value.includes("$") ? (
        <div className="math-preview"><MathText value={value} /></div>
      ) : null}
    </div>
  );
}
