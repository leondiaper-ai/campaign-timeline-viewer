"use client";

import { useMemo } from "react";
import type { CampaignSheetData, Territory } from "@/types";
import {
  getCampaignVerdict,
  getMomentumStatus,
} from "@/lib/transforms";

interface Props {
  sheet: CampaignSheetData;
  territory: Territory;
}

export type DecisionSignal = "PUSH" | "TEST" | "HOLD";

export interface DecisionData {
  signal: DecisionSignal;
  headline: string;
  reasons: string[]; // 2–3 short supporting lines
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ── Build decision from sheet ─────────────────────────────────
export function buildDecision(
  sheet: CampaignSheetData,
  territory: Territory,
): DecisionData {
  const verdict = getCampaignVerdict(sheet, territory);
  const momentum = getMomentumStatus(sheet, territory);
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  const totalRows = (sheet.weeklyData || [])
    .filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));

  const albumDate = sheet.setup.release_date;
  const preAlbum = albumDate
    ? totalRows.filter((r) => r.week_start_date < albumDate)
    : [];
  const postAlbum = albumDate
    ? totalRows.filter((r) => r.week_start_date >= albumDate)
    : [];
  const prePeak = preAlbum.length
    ? Math.max(...preAlbum.map((r) => r[streamKey]))
    : 0;
  const postPeak = postAlbum.length
    ? Math.max(...postAlbum.map((r) => r[streamKey]))
    : 0;

  const conversionLift = prePeak > 0 && postPeak > 0 ? postPeak / prePeak : 0;
  const weakConversion = conversionLift > 0 && conversionLift < 1.4;
  const strongConversion = conversionLift >= 2.5;

  const pcs = sheet.paidCampaigns || [];
  const totalSpend = pcs.reduce((s, p) => s + p.spend, 0);

  // ── Signal logic ──
  let signal: DecisionSignal;
  if (verdict.level === "strong" && momentum.direction === "rising") {
    signal = "PUSH";
  } else if (verdict.level === "strong" && momentum.direction === "declining") {
    signal = "TEST";
  } else if (verdict.level === "strong") {
    signal = "HOLD";
  } else if (verdict.level === "building" && momentum.direction === "rising") {
    signal = "PUSH";
  } else if (verdict.level === "building" && momentum.direction === "declining") {
    signal = "HOLD";
  } else if (verdict.level === "building") {
    signal = "TEST";
  } else if (momentum.direction === "rising") {
    signal = "TEST";
  } else {
    signal = "HOLD";
  }

  // ── Headline ──
  const headline =
    signal === "PUSH"
      ? "Momentum is live — back it."
      : signal === "TEST"
        ? "Signal is mixed — learn before you invest."
        : "Hold the line — no new investment yet.";

  // ── Reasons (2–3 short lines) ──
  const reasons: string[] = [];

  // Reason 1 — momentum
  if (momentum.direction === "rising") {
    reasons.push(`${momentum.label} — ${momentum.detail.replace(/\.$/, "")}`);
  } else if (momentum.direction === "declining") {
    reasons.push(`${momentum.label} — ${momentum.detail.replace(/\.$/, "")}`);
  } else {
    reasons.push(`${momentum.label} — ${momentum.detail.replace(/\.$/, "")}`);
  }

  // Reason 2 — conversion
  if (strongConversion) {
    reasons.push(`Release lifted streams ${conversionLift.toFixed(1)}× over pre-release peak`);
  } else if (weakConversion) {
    reasons.push(`Weak pre-release conversion (${conversionLift.toFixed(1)}× lift)`);
  } else if (postPeak > 0) {
    reasons.push(`Release peak: ${fmtNum(postPeak)}`);
  }

  // Reason 3 — paid / spend context
  if (signal === "PUSH" && totalSpend > 0) {
    reasons.push(`Paid already at $${totalSpend >= 1000 ? (totalSpend / 1000).toFixed(0) + "K" : totalSpend} — headroom to scale`);
  } else if (signal === "TEST" && totalSpend > 0) {
    reasons.push(`Paid spend $${totalSpend >= 1000 ? (totalSpend / 1000).toFixed(0) + "K" : totalSpend} — not yet compounding`);
  } else if (signal === "HOLD" && totalSpend > 0) {
    reasons.push(`Paid spend $${totalSpend >= 1000 ? (totalSpend / 1000).toFixed(0) + "K" : totalSpend} — let earned reach breathe`);
  } else if (totalSpend === 0) {
    reasons.push("No paid spend logged yet");
  }

  return { signal, headline, reasons: reasons.slice(0, 3) };
}

// ── Component ─────────────────────────────────────────────────
const SIGNAL_STYLES: Record<DecisionSignal, { bg: string; fg: string; label: string }> = {
  PUSH: { bg: "bg-mint", fg: "text-ink", label: "PUSH" },
  TEST: { bg: "bg-sun", fg: "text-ink", label: "TEST" },
  HOLD: { bg: "bg-cream", fg: "text-ink", label: "HOLD" },
};

export default function CampaignDecisionStrip({ sheet, territory }: Props) {
  const decision = useMemo(
    () => buildDecision(sheet, territory),
    [sheet, territory],
  );
  const style = SIGNAL_STYLES[decision.signal];

  return (
    <div className="rounded-2xl bg-ink text-paper px-6 py-5 shadow-[4px_4px_0_0_rgba(14,14,14,0.1)]">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/45">
          Decision
        </span>
        <span
          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-black tracking-[0.14em] ${style.bg} ${style.fg}`}
        >
          {style.label}
        </span>
      </div>
      <p className="text-[17px] md:text-[18px] font-bold leading-snug text-paper mb-3">
        {decision.headline}
      </p>
      <ul className="space-y-1.5">
        {decision.reasons.map((r, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[13px] leading-snug text-paper/80"
          >
            <span className="text-paper/40 mt-0.5">·</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
