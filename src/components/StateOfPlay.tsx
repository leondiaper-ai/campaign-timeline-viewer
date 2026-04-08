"use client";

import { CampaignSheetData, Territory, WeeklyRow } from "@/types";

// ——— Types ——————————————————————————————————————————————————

type CampaignState =
  | "BUILDING MOMENTUM"
  | "RELEASE SPIKE"
  | "SUSTAINING"
  | "DECLINING";

type ConfidenceLevel = "High" | "Medium" | "Low";

interface StateData {
  state: CampaignState;
  headline: string;
  actions: string[];
  stateColor: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
}

// ——— Derivation ——————————————————————————————————————————————

function getWeeklyStreams(weeklyData: WeeklyRow[], territory: Territory): { date: string; streams: number }[] {
  return weeklyData
    .filter(r => r.track_name === "TOTAL")
    .map(r => ({
      date: r.week_start_date,
      streams: territory === "UK" ? r.streams_uk : r.streams_global,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fmtStreams(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function deriveState(sheet: CampaignSheetData, territory: Territory): StateData {
  const weekly = getWeeklyStreams(sheet.weeklyData, territory);
  const territoryLabel = territory === "UK" ? "UK" : "Global";

  const recent = weekly.slice(-4);
  const prev = weekly.slice(-8, -4);
  const latestStreams = recent.length > 0 ? recent[recent.length - 1].streams : 0;
  const peakStreams = weekly.length > 0 ? Math.max(...weekly.map(w => w.streams)) : 0;

  const recentAvg = recent.length > 0 ? recent.reduce((s, w) => s + w.streams, 0) / recent.length : 0;
  const prevAvg = prev.length > 0 ? prev.reduce((s, w) => s + w.streams, 0) / prev.length : 0;
  const trendPct = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;

  const isAtPeak = latestStreams === peakStreams && peakStreams > 0;

  // WoW: last week vs the week before
  const prevWeekStreams = recent.length >= 2 ? recent[recent.length - 2].streams : 0;
  const wow = prevWeekStreams > 0 ? ((latestStreams - prevWeekStreams) / prevWeekStreams) * 100 : 0;
  const wowStr = wow >= 0 ? `+${Math.round(wow)}%` : `${Math.round(wow)}%`;

  // Consecutive growth/decline streaks
  let growthStreak = 0;
  let declineStreak = 0;
  for (let i = recent.length - 1; i > 0; i--) {
    if (recent[i].streams > recent[i - 1].streams) {
      if (declineStreak > 0) break;
      growthStreak++;
    } else if (recent[i].streams < recent[i - 1].streams) {
      if (growthStreak > 0) break;
      declineStreak++;
    }
  }

  // Volatility: avg week-over-week % swing in recent period
  let volatility = 0;
  if (recent.length >= 3) {
    const changes: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      if (recent[i - 1].streams > 0) {
        changes.push(Math.abs(((recent[i].streams - recent[i - 1].streams) / recent[i - 1].streams) * 100));
      }
    }
    volatility = changes.length > 0 ? changes.reduce((s, v) => s + v, 0) / changes.length : 0;
  }

  // ——— State ————————————————————————————————————————

  let state: CampaignState;
  let stateColor: string;
  let headline: string;
  let actions: string[];

  if (isAtPeak || (trendPct > 30 && latestStreams > peakStreams * 0.9)) {
    state = "RELEASE SPIKE";
    stateColor = "#FF4A1C";
    headline = `${fmtStreams(latestStreams)} ${territoryLabel} this week — at peak`;
    actions = [
      "Push all channels now — maximise album week reach",
      "Capture audience data for retargeting within 48 hrs",
    ];
  } else if (trendPct > 10) {
    state = "BUILDING MOMENTUM";
    stateColor = "#2C25FF";
    // Only say "rising" if WoW actually positive; otherwise clarify the trend window
    const wowLabel = wow > 0 ? `${wowStr} WoW — growth accelerating` : `${fmtStreams(latestStreams)} ${territoryLabel} — trending up over 4 weeks`;
    headline = wowLabel;
    actions = [
      "Hold cadence — don't break the growth run",
      "Trigger next moment within 7–10 days",
    ];
  } else if (trendPct >= -15 && latestStreams > peakStreams * 0.4) {
    state = "SUSTAINING";
    stateColor = "#1FBE7A";
    const pct = Math.round(latestStreams / peakStreams * 100);
    // Direction language must match WoW sign
    const dir = wow > 3 ? "ticking up" : wow < -3 ? "cooling" : "holding steady";
    headline = `${fmtStreams(latestStreams)} ${territoryLabel} weekly — ${dir} at ~${pct}% of peak`;
    actions = [
      "Trigger next moment to re-ignite growth",
      "Shift spend to strongest territory",
    ];
  } else {
    state = "DECLINING";
    stateColor = "#FF4A1C";
    headline = `${wowStr} WoW — down to ${fmtStreams(latestStreams)} ${territoryLabel} from ${fmtStreams(peakStreams)} peak`;
    actions = [
      "Bring forward next single or moment — don't wait",
      "Pause spend until next release signal lands",
    ];
  }

  // ——— Confidence ————————————————————————————————————

  const dataPoints = weekly.length;
  const hasPaidData = (sheet.paidCampaigns || []).length > 0;
  const trendConsistent = growthStreak >= 3 || declineStreak >= 3;
  const isVolatile = volatility > 25;
  const isStable = volatility < 10;

  let score = 0;
  if (dataPoints >= 12) score += 2; else if (dataPoints >= 8) score += 1;
  if (hasPaidData) score += 1;
  if (sheet.setup.chart_result) score += 1;
  if (trendConsistent) score += 2;
  if (isStable) score += 1;
  if (isVolatile) score -= 1;

  let confidence: ConfidenceLevel;
  let confidenceReason: string;

  if (score >= 5 && !isVolatile) {
    confidence = "High";
    confidenceReason = "";
  } else if (score >= 3) {
    confidence = "Medium";
    confidenceReason = "";
  } else {
    confidence = "Low";
    confidenceReason = "";
  }

  return { state, headline, actions, stateColor, confidence, confidenceReason };
}

// ——— Component ——————————————————————————————————————————————

interface Props {
  sheet: CampaignSheetData;
  territory: Territory;
}

export default function StateOfPlay({ sheet, territory }: Props) {
  const data = deriveState(sheet, territory);
  const confidenceColor = data.confidence === "High" ? "#1FBE7A" : data.confidence === "Medium" ? "#FFD24C" : "#FF4A1C";

  return (
    <div className="rounded-2xl bg-cream border border-ink/8 px-6 py-5">
      <div className="flex items-center gap-3 mb-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: data.stateColor }}>
          State of Play
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidenceColor }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: confidenceColor }}>
            {data.confidence} confidence
          </span>
        </div>
      </div>
      <p className="text-[22px] font-extrabold tracking-tight leading-tight text-ink" style={{ letterSpacing: "-0.02em" }}>
        {data.state}
      </p>
      <p className="text-[13px] text-ink/70 mt-1 leading-snug">
        {data.headline}
      </p>

      <div className="border-t border-ink/8 my-3" />

      <div className="space-y-1">
        {data.actions.map((action, i) => (
          <p key={i} className="text-[12px] text-ink leading-snug">
            <span className="text-ink/30 mr-1.5">→</span>
            <span className={i === 0 ? "font-semibold" : ""}>{action}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
