"use client";

import { useMemo, useState } from "react";
import type { CampaignSheetData, Territory } from "@/types";
import {
  getCampaignVerdict,
  getMomentumStatus,
} from "@/lib/transforms";
export type DecisionScope = "campaign" | "track";

interface Props {
  sheet: CampaignSheetData;
  territory: Territory;
  /** Scope the decision to — campaign-wide or a specific track. */
  scope?: DecisionScope;
  /** When scope = "track", the track to compute the decision for. */
  focusTrack?: string;
}

export type DecisionSignal = "PUSH" | "TEST" | "HOLD";

export interface DecisionData {
  signal: DecisionSignal;
  headline: string;
  reasons: string[]; // 2–3 short supporting lines
  scope: DecisionScope;
  scopeLabel: string; // "CAMPAIGN" or "TRACK: Name"
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ── Per-track trend — lighter-weight cousin of getMomentumStatus ──
type TrackTrend = {
  direction: "rising" | "declining" | "stable" | "early";
  recent: number;
  total: number;
  weeks: number;
  peak: number;
  peakToRecentRatio: number;
};

function getTrackTrend(
  sheet: CampaignSheetData,
  territory: Territory,
  trackName: string,
): TrackTrend {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const rows = (sheet.weeklyData || [])
    .filter((r) => r.track_name === trackName)
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));

  if (rows.length === 0) {
    return { direction: "early", recent: 0, total: 0, weeks: 0, peak: 0, peakToRecentRatio: 0 };
  }
  const vals = rows.map((r) => r[streamKey] as number);
  const total = vals.reduce((s, v) => s + v, 0);
  const peak = Math.max(...vals);
  const recent = vals[vals.length - 1];
  const peakToRecentRatio = peak > 0 ? recent / peak : 0;

  if (vals.length < 3) {
    return { direction: "early", recent, total, weeks: vals.length, peak, peakToRecentRatio };
  }

  const [a, b, c] = vals.slice(-3);
  let direction: TrackTrend["direction"] = "stable";
  if (c > b && c > a) direction = "rising";
  else if (c < b && b < a) direction = "declining";

  return { direction, recent, total, weeks: vals.length, peak, peakToRecentRatio };
}

// ── Build decision from sheet ─────────────────────────────────
export function buildDecision(
  sheet: CampaignSheetData,
  territory: Territory,
  scope: DecisionScope = "campaign",
  focusTrack?: string,
): DecisionData {
  if (scope === "track" && focusTrack) {
    return buildTrackDecision(sheet, territory, focusTrack);
  }
  return buildCampaignDecision(sheet, territory);
}

// ── CAMPAIGN SCOPE ───────────────────────────────────────────
function buildCampaignDecision(
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

  // ── Post-release behaviour — second wind vs plateau vs decay ──
  // Skip the release-week spike itself so we read the true post-release trend.
  const postReleaseTail = postAlbum.slice(1).map((r) => r[streamKey]);
  const lastN = postReleaseTail.slice(-4);

  let secondWind = false;
  let flatPlateau = false;
  if (postReleaseTail.length >= 3) {
    const tailMin = Math.min(...postReleaseTail);
    const tailMax = Math.max(...postReleaseTail);
    const recentVal = postReleaseTail[postReleaseTail.length - 1];
    const priorPeak = Math.max(...postReleaseTail.slice(0, -2));
    // Second wind: recent weeks lifted ≥20% above the post-release trough,
    // AND the recent peak beats the earlier post-release peak.
    if (tailMin > 0 && recentVal / tailMin >= 1.2 && tailMax >= priorPeak) {
      secondWind = true;
    }
    // Flat plateau: last 4 weeks range within ~10% of mean — no direction either way.
    if (lastN.length >= 4) {
      const mean = lastN.reduce((s, v) => s + v, 0) / lastN.length;
      const range = Math.max(...lastN) - Math.min(...lastN);
      if (mean > 0 && range / mean < 0.1) flatPlateau = true;
    }
  }

  // ── Signal logic — layered on verdict + momentum + conversion + post-release shape ──
  let signal: DecisionSignal;
  if (verdict.level === "strong" && strongConversion && (momentum.direction === "rising" || secondWind)) {
    // Release compounded the singles AND it's still climbing (or has a second wind) → PUSH.
    signal = "PUSH";
  } else if (verdict.level === "strong" && momentum.direction === "rising") {
    signal = "PUSH";
  } else if (verdict.level === "strong" && flatPlateau && !strongConversion) {
    // Strong total volume but release didn't compound and post-release is flat → needs activation.
    signal = "TEST";
  } else if (verdict.level === "strong" && momentum.direction === "declining") {
    signal = "TEST";
  } else if (verdict.level === "strong") {
    signal = strongConversion ? "PUSH" : "HOLD";
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
      ? secondWind
        ? "Second wind is live — back it before it cools."
        : "Momentum is live — back it."
      : signal === "TEST"
        ? flatPlateau
          ? "Post-release has plateaued — activate before you scale."
          : "Signal is mixed — learn before you invest."
        : "Hold the line — no new investment yet.";

  // ── Reasons ──
  const reasons: string[] = [];

  if (secondWind && signal === "PUSH") {
    reasons.push(`Post-release second wind — lifted back to ${fmtNum(postReleaseTail[postReleaseTail.length - 1])}`);
  } else if (flatPlateau) {
    const mean = lastN.reduce((s, v) => s + v, 0) / lastN.length;
    reasons.push(`Flat plateau — last 4 weeks holding around ${fmtNum(Math.round(mean))}`);
  } else {
    reasons.push(`${momentum.label} — ${momentum.detail.replace(/\.$/, "")}`);
  }

  if (strongConversion) {
    reasons.push(`Release lifted streams ${conversionLift.toFixed(1)}× over pre-release peak`);
  } else if (weakConversion) {
    reasons.push(`Weak pre-release conversion (${conversionLift.toFixed(1)}× lift)`);
  } else if (conversionLift > 0) {
    reasons.push(`Release converted at ${conversionLift.toFixed(1)}× pre-release peak — singles didn't fully compound`);
  } else if (postPeak > 0) {
    reasons.push(`Release peak: ${fmtNum(postPeak)}`);
  }

  if (signal === "PUSH" && totalSpend > 0) {
    reasons.push(`Paid already at $${totalSpend >= 1000 ? (totalSpend / 1000).toFixed(0) + "K" : totalSpend} — headroom to scale`);
  } else if (signal === "TEST" && totalSpend > 0) {
    reasons.push(`Paid spend $${totalSpend >= 1000 ? (totalSpend / 1000).toFixed(0) + "K" : totalSpend} — not yet compounding`);
  } else if (signal === "HOLD" && totalSpend > 0) {
    reasons.push(`Paid spend $${totalSpend >= 1000 ? (totalSpend / 1000).toFixed(0) + "K" : totalSpend} — let earned reach breathe`);
  } else if (totalSpend === 0) {
    reasons.push("No paid spend logged yet");
  }

  return {
    signal,
    headline,
    reasons: reasons.slice(0, 3),
    scope: "campaign",
    scopeLabel: "CAMPAIGN",
  };
}

// ── TRACK SCOPE ──────────────────────────────────────────────
function buildTrackDecision(
  sheet: CampaignSheetData,
  territory: Territory,
  trackName: string,
): DecisionData {
  const trend = getTrackTrend(sheet, territory, trackName);
  const albumDate = sheet.setup.release_date;
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  // Does the track already have post-release weeks?
  const postAlbumRows = albumDate
    ? (sheet.weeklyData || []).filter(
        (r) =>
          r.track_name === trackName && r.week_start_date >= albumDate,
      )
    : [];
  const hasPostRelease = postAlbumRows.length > 0;
  const postPeak = postAlbumRows.length
    ? Math.max(...postAlbumRows.map((r) => r[streamKey] as number))
    : 0;

  // ── Signal logic ──
  let signal: DecisionSignal;
  if (trend.weeks === 0) {
    signal = "TEST";
  } else if (trend.direction === "rising" && trend.recent >= 0.7 * trend.peak) {
    // still near or above peak AND rising → back it
    signal = "PUSH";
  } else if (trend.direction === "rising") {
    // rising but still well below peak → validate
    signal = "TEST";
  } else if (trend.direction === "declining" && trend.peakToRecentRatio < 0.4) {
    // fallen far below peak → pull back
    signal = "HOLD";
  } else if (trend.direction === "declining") {
    signal = "TEST";
  } else if (trend.direction === "early") {
    signal = "TEST";
  } else {
    // stable
    signal = trend.recent > 0 && trend.recent >= 0.6 * trend.peak ? "HOLD" : "TEST";
  }

  // ── Headline ──
  const headline =
    signal === "PUSH"
      ? `"${trackName}" is holding its peak — scale reach.`
      : signal === "TEST"
        ? `"${trackName}" signal is unproven — test before committing.`
        : `"${trackName}" has cooled — hold spend, let it settle.`;

  // ── Reasons ──
  const reasons: string[] = [];

  if (trend.weeks === 0) {
    reasons.push("No track data yet — awaiting streams");
  } else {
    const directionLabel =
      trend.direction === "rising"
        ? "Rising"
        : trend.direction === "declining"
          ? "Declining"
          : trend.direction === "early"
            ? "Early"
            : "Holding";
    reasons.push(
      `${directionLabel} — last week ${fmtNum(trend.recent)} (peak ${fmtNum(trend.peak)})`,
    );
  }

  if (trend.total > 0) {
    reasons.push(`Track total: ${fmtNum(trend.total)} across ${trend.weeks} week${trend.weeks === 1 ? "" : "s"}`);
  }

  if (hasPostRelease && postPeak > 0) {
    if (signal === "PUSH") {
      reasons.push(`Post-release peak ${fmtNum(postPeak)} — headroom to extend`);
    } else if (signal === "TEST") {
      reasons.push(`Post-release peak ${fmtNum(postPeak)} — not yet compounding`);
    } else {
      reasons.push(`Post-release peak ${fmtNum(postPeak)} — momentum faded`);
    }
  }

  return {
    signal,
    headline,
    reasons: reasons.slice(0, 3),
    scope: "track",
    scopeLabel: `TRACK: ${trackName}`,
  };
}

// ── Component ─────────────────────────────────────────────────
const SIGNAL_STYLES: Record<DecisionSignal, { bg: string; fg: string; label: string }> = {
  PUSH: { bg: "bg-push", fg: "text-ink", label: "PUSH" },
  HOLD: { bg: "bg-hold", fg: "text-ink", label: "HOLD" },
  TEST: { bg: "bg-test", fg: "text-paper", label: "TEST" },
};

export default function CampaignDecisionStrip({
  sheet,
  territory,
  scope = "campaign",
  focusTrack,
}: Props) {
  const decision = useMemo(
    () => buildDecision(sheet, territory, scope, focusTrack),
    [sheet, territory, scope, focusTrack],
  );
  const style = SIGNAL_STYLES[decision.signal];

  const text = `${decision.headline} ${decision.reasons.join(" ")}`.toLowerCase();

  let why = "";
  if (decision.signal === "PUSH" && /second wind|lifted back/.test(text)) {
    why = "Campaign moments are driving the lift — momentum is real, not organic drift.";
  } else if (decision.signal === "PUSH") {
    why = "Signals are moving together — the shape reads as sustained, not a single-metric spike.";
  } else if (decision.signal === "TEST" && /plateau|flat/.test(text)) {
    why = "Volume is strong but the release didn\u2019t compound the base — audience is held, not widening.";
  } else if (decision.signal === "TEST") {
    why = "The lift is real but narrow — not yet a broad enough signal to commit against.";
  } else if (/decline|cool|fad/.test(text)) {
    why = "Post-release is softening — spending into a weakening curve teaches the wrong lesson.";
  } else {
    why = "Core engagement is stable, but reach isn\u2019t widening yet.";
  }

  const todo =
    decision.signal === "PUSH"
      ? "Back the momentum — extend reach against the working moment while behaviour holds."
      : decision.signal === "TEST"
        ? "Run a contained test against the responsive segment — validate before scaling."
        : "Hold — protect the base, don\u2019t spend into noise.";

  const spendLogic =
    decision.signal === "PUSH"
      ? "Concentrated paid + editorial against the working moment — scale intensity, not surface area."
      : decision.signal === "TEST"
        ? "Controlled test spend on the responsive segment — no broad allocation until reach widens."
        : "No new spend — let earned reach breathe.";

  const watch =
    decision.signal === "PUSH"
      ? "Whether streams hold above the new baseline for 7\u201310 days."
      : decision.signal === "TEST"
        ? "Reach broadening outside the responsive segment within 14 days."
        : "One signal — listener growth, save rate or reach — clearing baseline for two reporting weeks.";

  const ifConfirmed =
    decision.signal === "PUSH"
      ? "Extend into adjacent cohorts — move from backing momentum to scaling it."
      : decision.signal === "TEST"
        ? "Shift from test to push — commit support to the format the signal validated."
        : "Move to a contained test on the format starting to separate.";

  return (
    <div className="rounded-2xl bg-ink text-paper px-6 py-5 shadow-[4px_4px_0_0_rgba(14,14,14,0.1)]">
      {/* Scope + signal tag */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
          Decision
        </span>
        <span className="text-paper/25 text-[10px]">—</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-paper/75 truncate max-w-[60%]">
          {decision.scopeLabel}
        </span>
        <span
          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-black tracking-[0.14em] ${style.bg} ${style.fg} ml-auto`}
        >
          {style.label}
        </span>
      </div>

      {/* System 1 — headline + one-line why + one-line do now */}
      <p className="text-[17px] md:text-[18px] font-bold leading-snug text-paper mb-3">
        {decision.headline}
      </p>
      <p className="text-[13.5px] leading-snug text-paper/80 mb-2">
        {why}
      </p>
      <p className="text-[13.5px] leading-snug text-paper/95 font-medium">
        <span className="mr-2 text-[10px] font-mono uppercase tracking-[0.14em] text-paper/45">
          Do now
        </span>
        {todo}
      </p>

      {/* Optional signals — single line */}
      {decision.reasons.length > 0 && (
        <p className="mt-3 text-[12px] text-paper/55 leading-snug">
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-paper/40 mr-2">
            Signals
          </span>
          {decision.reasons.slice(0, 3).join(" · ")}
        </p>
      )}

      {/* System 2 — collapsible intelligence */}
      <IntelligencePanel
        aiReadDeep={
          decision.signal === "PUSH"
            ? "Post-release behaviour is lifting in parallel with organic discovery — the curve has the shape of sustained pull, not a promo spike."
            : decision.signal === "TEST"
              ? "The responsive segment is acting first; the broader audience hasn\u2019t joined yet — the read is narrow, not weak."
              : "Behaviour is settling into a stable base — no cohort is pulling ahead, so there is nothing to intensify."
        }
        spendLogic={spendLogic}
        watch={watch}
        ifConfirmed={ifConfirmed}
      />
    </div>
  );
}

function IntelligencePanel({
  aiReadDeep,
  spendLogic,
  watch,
  ifConfirmed,
}: {
  aiReadDeep: string;
  spendLogic: string;
  watch: string;
  ifConfirmed: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 pt-4 border-t border-paper/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-paper/10 bg-paper/[0.05] hover:bg-paper/[0.10] px-3.5 py-2.5 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="relative inline-flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-paper/30 animate-pulse" />
            <span className="relative inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-mono tracking-[0.1em] bg-paper text-ink">
              AI
            </span>
          </span>
          <span className="text-[11.5px] font-mono uppercase tracking-[0.14em] text-paper/65">
            {open ? "Hide intelligence" : "Open intelligence"}
          </span>
        </span>
        <span className={`text-[11px] font-mono text-paper/45 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-paper/10 bg-paper/[0.04] p-4 space-y-3.5">
          <Row label="AI Read" body={aiReadDeep} />
          <Row label="Spend logic" body={spendLogic} />
          <Row label="Watch" body={watch} />
          <Row label="If confirmed" body={ifConfirmed} />
        </div>
      )}
    </div>
  );
}

function Row({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-paper/45 mb-1">
        {label}
      </div>
      <p className="text-[13.5px] leading-snug text-paper/90">{body}</p>
    </div>
  );
}
