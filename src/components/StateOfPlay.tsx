"use client";

import { CampaignSheetData, Territory, WeeklyRow } from "@/types";
import type { ClassifiedMoment } from "@/lib/transforms";

// ——— Types ——————————————————————————————————————————————————

type CampaignState =
  | "BUILDING MOMENTUM"
  | "RELEASE SPIKE"
  | "SUSTAINING"
  | "DECLINING";

type Verdict = "PUSH" | "SUSTAIN" | "RE-IGNITE";

type ConfidenceLevel = "High" | "Medium" | "Low";

interface StateData {
  state: CampaignState;
  verdict: Verdict;
  verdictLine: string;
  headline: string;
  actions: string[];
  stateColor: string;
  verdictColor: string;
  confidence: ConfidenceLevel;
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

  // ——— State + Verdict ————————————————————————————————————————

  let state: CampaignState;
  let stateColor: string;
  let verdict: Verdict;
  let verdictColor: string;
  let verdictLine: string;
  let headline: string;
  let actions: string[];

  if (isAtPeak || (trendPct > 30 && latestStreams > peakStreams * 0.9)) {
    state = "RELEASE SPIKE";
    stateColor = "#FF4A1C";
    verdict = "PUSH";
    verdictColor = "#FF4A1C";
    verdictLine = "At peak — extend reach now";
    headline = `${fmtStreams(latestStreams)} ${territoryLabel} this week — album-week peak`;
    actions = [
      "Push all channels now — maximise album-week reach",
      "Capture audience data for retargeting within 48 hrs",
      "Line up the next moment before the curve softens",
    ];
  } else if (trendPct > 10) {
    state = "BUILDING MOMENTUM";
    stateColor = "#2C25FF";
    verdict = "SUSTAIN";
    verdictColor = "#2C25FF";
    verdictLine = "Growth accelerating — hold cadence";
    const wowLabel =
      wow > 0
        ? `${wowStr} WoW — growth accelerating`
        : `${fmtStreams(latestStreams)} ${territoryLabel} — trending up over 4 weeks`;
    headline = wowLabel;
    actions = [
      "Hold cadence — don't break the growth run",
      "Trigger next moment within 7–10 days",
      "Protect paid efficiency while WoW is positive",
    ];
  } else if (trendPct >= -15 && latestStreams > peakStreams * 0.4) {
    state = "SUSTAINING";
    stateColor = "#1FBE7A";
    verdict = "SUSTAIN";
    verdictColor = "#1FBE7A";
    const pct = Math.round((latestStreams / peakStreams) * 100);
    const dir = wow > 3 ? "ticking up" : wow < -3 ? "cooling" : "holding steady";
    verdictLine =
      dir === "cooling"
        ? "Momentum cooling post-peak"
        : dir === "ticking up"
        ? "Holding strong post-peak"
        : "Holding steady near peak";
    headline = `${fmtStreams(latestStreams)} ${territoryLabel} weekly — ${dir} at ~${pct}% of peak`;
    actions = [
      "Trigger next moment to re-ignite growth",
      "Shift spend to strongest territory",
      "Tighten cadence before the curve falls below 40% of peak",
    ];
  } else {
    state = "DECLINING";
    stateColor = "#FF4A1C";
    verdict = "RE-IGNITE";
    verdictColor = "#FF4A1C";
    verdictLine = "Momentum lost — trigger the next moment";
    headline = `${wowStr} WoW — down to ${fmtStreams(latestStreams)} ${territoryLabel} from ${fmtStreams(peakStreams)} peak`;
    actions = [
      "Bring forward next single or moment — don't wait",
      "Pause spend until next release signal lands",
      "Refocus paid on the strongest remaining track",
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
  if (score >= 5 && !isVolatile) confidence = "High";
  else if (score >= 3) confidence = "Medium";
  else confidence = "Low";

  return { state, verdict, verdictLine, headline, actions, stateColor, verdictColor, confidence };
}

// ——— What drove performance (from classified moments) ————————————

function pickDrivers(classified: ClassifiedMoment[]): { title: string; context: string }[] {
  const drivers = classified.filter(c => c.tier === "driver");
  const supporting = classified.filter(c => c.tier === "supporting");

  // Prefer drivers; fill with supporting if needed. Dedupe by context+title.
  const seen = new Set<string>();
  const out: { title: string; context: string }[] = [];
  for (const c of [...drivers, ...supporting]) {
    const key = `${c.moment.moment_title}|${c.context}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: c.moment.moment_title, context: c.context });
    if (out.length >= 4) break;
  }
  return out;
}

// ——— Component ——————————————————————————————————————————————

interface Props {
  sheet: CampaignSheetData;
  territory: Territory;
  classified?: ClassifiedMoment[];
}

export default function StateOfPlay({ sheet, territory, classified = [] }: Props) {
  const data = deriveState(sheet, territory);
  const drivers = pickDrivers(classified);
  const confidenceColor =
    data.confidence === "High" ? "#1FBE7A" : data.confidence === "Medium" ? "#FFD24C" : "#FF4A1C";

  return (
    <div className="rounded-2xl bg-cream border border-ink/8 px-6 py-6">
      {/* Eyebrow row */}
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/50">
          Campaign Read
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidenceColor }} />
          <span
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color: confidenceColor }}
          >
            {data.confidence} confidence
          </span>
        </div>
      </div>

      {/* Verdict line — the single decision */}
      <p
        className="text-[22px] md:text-[26px] font-extrabold tracking-tight leading-tight text-ink"
        style={{ letterSpacing: "-0.02em" }}
      >
        <span style={{ color: data.verdictColor }}>{data.verdict}</span>
        <span className="text-ink/30 mx-2">—</span>
        <span>{data.verdictLine}</span>
      </p>
      <p className="text-[13px] text-ink/60 mt-1.5 leading-snug">
        {data.headline}
      </p>

      {/* Two-column split: What drove performance / What to do next */}
      <div className="mt-5 grid md:grid-cols-2 gap-5 pt-5 border-t border-ink/8">
        {/* What drove performance */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-2">
            What drove performance
          </p>
          {drivers.length > 0 ? (
            <ul className="space-y-1.5">
              {drivers.map((d, i) => (
                <li key={i} className="text-[12px] leading-snug text-ink">
                  <span className="text-ink/30 mr-1.5">—</span>
                  <span className="font-semibold">{d.title}</span>
                  <span className="text-ink/50"> · {d.context}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-ink/40 leading-snug">
              No clear drivers flagged yet — add moments to the campaign log.
            </p>
          )}
        </div>

        {/* What to do next */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-2">
            What to do next
          </p>
          <ul className="space-y-1.5">
            {data.actions.map((action, i) => (
              <li key={i} className="text-[12px] leading-snug text-ink">
                <span className="text-signal mr-1.5">→</span>
                <span className={i === 0 ? "font-semibold" : ""}>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* System signal line */}
      <p className="mt-5 pt-4 border-t border-ink/6 text-[10px] tracking-[0.14em] uppercase font-mono text-ink/30">
        Based on 28d streams vs baseline · aligned to release moments
      </p>
    </div>
  );
}
