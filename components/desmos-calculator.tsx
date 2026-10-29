"use client";

import { useState } from "react";

type CalculatorMode = "graphing" | "scientific";

export default function DesmosCalculator({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<CalculatorMode>("graphing");
  const src = mode === "graphing"
    ? "https://www.desmos.com/calculator?embed"
    : "https://www.desmos.com/scientific?embed";
  return (
    <aside className="bb-calculator bb-desmos" aria-label="Desmos kalkulyatori">
      <div className="bb-calc-head">
        <div className="bb-desmos-tabs" role="tablist" aria-label="Kalkulyator turi">
          <button type="button" role="tab" aria-selected={mode === "graphing"} onClick={() => setMode("graphing")}>Grafikli</button>
          <button type="button" role="tab" aria-selected={mode === "scientific"} onClick={() => setMode("scientific")}>Ilmiy</button>
        </div>
        <div className="bb-desmos-actions">
          <a href={src} target="_blank" rel="noreferrer">Yangi oynada</a>
          <button type="button" aria-label="Kalkulyatorni yopish" onClick={onClose}>×</button>
        </div>
      </div>
      <iframe key={mode} src={src} title={mode === "graphing" ? "Desmos Graphing Calculator" : "Desmos Scientific Calculator"} loading="lazy" />
      <small>Desmos mashq kalkulyatori. Imtihondagi ruxsat etilgan funksiyalar farq qilishi mumkin.</small>
    </aside>
  );
}
