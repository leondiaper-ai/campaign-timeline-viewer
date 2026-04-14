"use client";

/**
 * AIInterpretation — the same four-block AI layer used across the
 * music-decision-site product: System stance / AI Read / Watch / If
 * confirmed. Deterministic synth; grounded in the structured decision
 * output the tool has already produced. Never invents data.
 */

import { useState } from "react";
import type { DecisionData } from "./CampaignDecisionStrip";

interface Props {
  decision: DecisionData;
  /** Raw campaign headline — used to detect second-wind / plateau phrasing. */
  shapeHint?: string;
}

function systemStance(d: DecisionData): string {
  switch (d.signal) {
    case "PUSH":
      return d.headline.includes("Second wind")
        ? "Push — second wind is live"
        : "Push — momentum durable enough to back";
    case "TEST":
      return d.headline.includes("plateau")
        ? "Test — post-release flat, activate before scaling"
        : "Test — signal directional, not yet broad";
    case "HOLD":
    default:
      return "Hold — no fresh evidence to act on";
  }
}

function aiRead(d: DecisionData): string {
  const text = `${d.headline} ${d.reasons.join(" ")}`.toLowerCase();

  if (d.signal === "PUSH" && /second wind|lifted back/.test(text)) {
    return "This lift appears campaign-driven rather than release-driven — behaviour is being reactivated by moments rather than naturally compounding.";
  }
  if (d.signal === "PUSH" && /compound|rising|momentum/.test(text)) {
    return "Signals are moving together, not a single-metric spike — the shape of the campaign reads as sustained rather than reactive.";
  }
  if (d.signal === "TEST" && /plateau|flat/.test(text)) {
    return "Volume is strong but the release didn't compound the pre-release base — the audience is held, not widening.";
  }
  if (d.signal === "TEST") {
    return "The lift is real but narrow — a contained test reads durability before full commitment.";
  }
  if (d.signal === "HOLD" && /decline|cool|fad/.test(text)) {
    return "Post-release behaviour is softening inside normal variation — spending now teaches the algorithm the wrong lesson.";
  }
  return "Core engagement is stable but there's no evidence of widening reach yet — the campaign is held, not growing.";
}

function watch(d: DecisionData): string {
  switch (d.signal) {
    case "PUSH":
      return "Whether streams hold above the new baseline for 7–10 days rather than falling back.";
    case "TEST":
      return "Reach broadening outside the responsive segment within the next 14 days.";
    case "HOLD":
    default:
      return "One named signal — listener growth, save rate or reach — moving above baseline for two reporting weeks.";
  }
}

function ifConfirmed(d: DecisionData): string {
  switch (d.signal) {
    case "PUSH":
      return "Increase paid and editorial support while behaviour remains elevated — compound it before the window cools.";
    case "TEST":
      return "Move from test to push — scale spend and commit hero content behind the proven signal.";
    case "HOLD":
    default:
      return "Shift from hold to test with targeted spend on the strongest emerging segment.";
  }
}

function confidence(d: DecisionData): { level: "High" | "Medium" | "Low"; note: string } {
  if (d.signal === "PUSH") return { level: "High", note: "Multiple signals moving together across the cycle." };
  if (d.signal === "TEST") return { level: "Medium", note: "Early directional signal — real, but not yet durable." };
  return { level: "Medium", note: "Base is stable; no fresh signal to act on." };
}

const DOT: Record<"High" | "Medium" | "Low", string> = {
  High: "bg-push",
  Medium: "bg-hold",
  Low: "bg-test",
};

export default function AIInterpretation({ decision }: Props) {
  const [open, setOpen] = useState(false);
  const c = confidence(decision);

  return (
    <div className="mt-4 pt-4 border-t border-ink/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink text-paper text-[9px] font-mono tracking-[0.12em]">
            AI
          </span>
          <span className="text-sm font-medium text-ink/75 group-hover:text-ink transition-colors">
            AI interpretation
          </span>
        </span>
        <span
          className="text-ink/30 text-sm"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-ink/10 bg-paper/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/30">
              AI interpretation
            </div>
            <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-ink/25">
              Grounded synth
            </div>
          </div>

          <Block label="System stance" body={systemStance(decision)} />
          <Block label="AI Read" body={aiRead(decision)} />
          <Block label="Watch" body={watch(decision)} />
          <Block label="If confirmed" body={ifConfirmed(decision)} />

          <div className="pt-4 mt-4 border-t border-ink/10 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${DOT[c.level]}`} />
              <span className="text-[11px] font-mono tracking-[0.14em] uppercase text-ink/45">
                Confidence · {c.level}
              </span>
            </div>
            <div className="text-[12px] text-ink/55 leading-snug">{c.note}</div>
          </div>

          <p className="mt-4 pt-4 border-t border-ink/10 text-[10px] font-mono tracking-[0.12em] uppercase text-ink/30">
            Layered on top of structured decision logic
          </p>
        </div>
      )}
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/35 mb-1.5">
        {label}
      </div>
      <p className="text-[14.5px] text-ink/85 leading-relaxed">{body}</p>
    </div>
  );
}
