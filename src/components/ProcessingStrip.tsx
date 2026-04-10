"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Aligning release moments across territories…",
  "Cross-referencing paid + editorial activity…",
  "Reading momentum against baseline…",
];

/**
 * Subtle one-shot processing indicator. Cycles through STEPS on mount, then
 * lands on a minimal "Ready" state. Designed to make the engine feel like
 * it's actually doing work on the CSV exports, without turning into a loader.
 */
export default function ProcessingStrip() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (step < STEPS.length - 1) {
      const t = setTimeout(() => setStep(step + 1), 550);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone(true), 700);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.14em] text-ink/30">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          done ? "bg-[#1FBE7A]" : "bg-[#2C25FF] animate-pulse"
        }`}
      />
      <span className="truncate">
        {done ? "Engine ready · last read 28d window" : STEPS[step]}
      </span>
    </div>
  );
}
