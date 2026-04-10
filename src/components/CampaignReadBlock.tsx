"use client";

import type { SampleCampaign } from "@/lib/sampleCampaigns";

interface Props {
  sample: SampleCampaign;
  onRunOwn?: () => void;
  onChangeSample?: () => void;
}

/**
 * CampaignReadBlock — the meeting-friendly decision output used by DemoIntake.
 *
 * Structure:
 *   CAMPAIGN READ  [confidence]             [← Choose another sample]
 *   VERDICT — supporting line
 *   [supporting data line]
 *   ─────────────────────────────────────────
 *   WHY
 *     — bullet
 *     — bullet
 *   ─────────────────────────────────────────
 *   WHAT DROVE PERFORMANCE    |   WHAT TO DO NEXT
 *     — title · context       |     → action
 *     — title · context       |     → action
 *   ─────────────────────────────────────────
 *   system signal line
 *   [Run this on your own campaign export →]
 */
export default function CampaignReadBlock({ sample, onRunOwn, onChangeSample }: Props) {
  const confidenceColor =
    sample.confidence === "High"
      ? "#1FBE7A"
      : sample.confidence === "Medium"
      ? "#FFD24C"
      : "#FF4A1C";

  return (
    <div className="rounded-2xl bg-cream border border-ink/8 px-6 py-6">
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/50">
            Campaign Read
          </p>
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: confidenceColor }}
            />
            <span
              className="text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{ color: confidenceColor }}
            >
              {sample.confidence} confidence
            </span>
          </div>
        </div>
        {onChangeSample && (
          <button
            onClick={onChangeSample}
            className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/40 hover:text-ink transition-colors"
          >
            ← Choose another sample
          </button>
        )}
      </div>

      {/* Verdict line */}
      <p
        className="text-[22px] md:text-[26px] font-extrabold tracking-tight leading-tight text-ink"
        style={{ letterSpacing: "-0.02em" }}
      >
        <span style={{ color: sample.verdictColor }}>{sample.verdict}</span>
        <span className="text-ink/30 mx-2">—</span>
        <span>{sample.verdictLine}</span>
      </p>
      <p className="text-[13px] text-ink/60 mt-1.5 leading-snug">
        {sample.supporting}
      </p>

      {/* WHY */}
      <div className="mt-5 pt-5 border-t border-ink/8">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-2">
          Why
        </p>
        <ul className="space-y-1.5">
          {sample.why.map((w, i) => (
            <li key={i} className="text-[12px] leading-snug text-ink">
              <span className="text-ink/30 mr-1.5">—</span>
              {w}
            </li>
          ))}
        </ul>
      </div>

      {/* What drove performance / What to do next */}
      <div className="mt-5 pt-5 border-t border-ink/8 grid md:grid-cols-2 gap-5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-2">
            What drove performance
          </p>
          <ul className="space-y-1.5">
            {sample.drivers.map((d, i) => (
              <li key={i} className="text-[12px] leading-snug text-ink">
                <span className="text-ink/30 mr-1.5">—</span>
                <span className="font-semibold">{d.title}</span>
                <span className="text-ink/50"> · {d.context}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-2">
            What to do next
          </p>
          <ul className="space-y-1.5">
            {sample.actions.map((a, i) => (
              <li key={i} className="text-[12px] leading-snug text-ink">
                <span className="text-signal mr-1.5">→</span>
                <span className={i === 0 ? "font-semibold" : ""}>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* System signal line */}
      <p className="mt-5 pt-4 border-t border-ink/6 text-[10px] tracking-[0.14em] uppercase font-mono text-ink/30">
        Based on 90d streams vs baseline · aligned to release moments
      </p>

      {/* Run-on-your-own CTA */}
      {onRunOwn && (
        <div className="mt-4 pt-4 border-t border-ink/8 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px] text-ink/50">
            Use your own campaign export to get a real read.
          </p>
          <button
            onClick={onRunOwn}
            className="group inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[12px] font-semibold hover:bg-signal transition-colors"
          >
            Run this on your own campaign export
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
