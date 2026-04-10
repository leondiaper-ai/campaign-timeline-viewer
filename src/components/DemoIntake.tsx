"use client";

import { useEffect, useState } from "react";
import { SAMPLE_CAMPAIGNS } from "@/lib/sampleCampaigns";
import CampaignReadBlock from "./CampaignReadBlock";

type Phase = "idle" | "processing" | "revealed";

const PROCESSING_MESSAGES = [
  "Aligning release moments across territories…",
  "Mapping campaign activity to stream response…",
  "Evaluating momentum vs event timing…",
];

const REAL_CTA_URL =
  "https://github.com/leondiaper-ai/campaign-timeline-viewer#setup";

/**
 * DemoIntake — lightweight input layer that mirrors the Artist / Track Lens pattern:
 *
 *   1. Pick a sample campaign export
 *   2. Run analysis
 *   3. Watch a short processing sequence
 *   4. Get a clear Campaign Read
 *
 * Sits above the timeline chart and acts as the primary decision surface.
 * The chart + breakdown below remain as supporting evidence.
 */
export default function DemoIntake() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [processingStep, setProcessingStep] = useState(0);

  const selected = SAMPLE_CAMPAIGNS[selectedIdx];

  useEffect(() => {
    if (phase !== "processing") return;
    if (processingStep < PROCESSING_MESSAGES.length - 1) {
      const t = setTimeout(() => setProcessingStep((s) => s + 1), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("revealed"), 550);
    return () => clearTimeout(t);
  }, [phase, processingStep]);

  const runAnalysis = () => {
    setProcessingStep(0);
    setPhase("processing");
  };

  const reset = () => {
    setPhase("idle");
    setProcessingStep(0);
  };

  const runOnOwn = () => {
    if (typeof window !== "undefined") {
      window.open(REAL_CTA_URL, "_blank", "noopener,noreferrer");
    }
  };

  // ——— Revealed ———
  if (phase === "revealed") {
    return (
      <CampaignReadBlock
        sample={selected}
        onRunOwn={runOnOwn}
        onChangeSample={reset}
      />
    );
  }

  // ——— Processing ———
  if (phase === "processing") {
    return (
      <div className="rounded-2xl bg-cream border border-ink/8 px-6 py-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/50 mb-3">
          Running analysis
        </p>
        <div className="flex items-center gap-3 text-[12px] font-mono text-ink/60">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2C25FF] animate-pulse" />
          <span className="truncate">{PROCESSING_MESSAGES[processingStep]}</span>
        </div>
        <p className="mt-4 text-[10px] tracking-[0.14em] uppercase font-mono text-ink/25">
          Reading {selected.filename}
        </p>
      </div>
    );
  }

  // ——— Idle: sample picker ———
  return (
    <div className="rounded-2xl bg-cream border border-ink/8 px-6 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/50">
          Sample campaign exports
        </p>
        <p className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/30">
          Pick one · run analysis
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {SAMPLE_CAMPAIGNS.map((s, i) => {
          const active = i === selectedIdx;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedIdx(i)}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                active
                  ? "border-ink bg-paper shadow-[3px_3px_0_0_rgba(14,14,14,1)]"
                  : "border-ink/10 bg-paper/60 hover:border-ink/30"
              }`}
            >
              <p
                className={`text-[12px] font-mono leading-snug break-all ${
                  active ? "text-ink" : "text-ink/70"
                }`}
              >
                {s.filename}
              </p>
              <p className="mt-1.5 text-[10px] text-ink/40 leading-snug">
                {s.source}
              </p>
              <p className="mt-0.5 text-[10px] text-ink/40 leading-snug">
                {s.includes}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-[11px] text-ink/50">
          Selected:{" "}
          <span className="font-mono text-ink/70">{selected.filename}</span>
        </p>
        <button
          onClick={runAnalysis}
          className="group inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[12px] font-semibold hover:bg-signal transition-colors"
        >
          Run analysis
          <span className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
