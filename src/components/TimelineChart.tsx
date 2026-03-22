"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea,
} from "recharts";
import { ChartDataPoint, Moment, Territory, PaidCampaignRow, type EventCategory } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import { TrackWithRole, HandoverMoment, UKMilestone } from "@/lib/transforms";

const TOTAL_COLOR = "#6C9EFF";
const PHYSICAL_COLOR = "#4ADE80";

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}
function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtFull(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function trunc(t: string, m: number = 16): string {
  if (t.length <= m) return t;
  const c = t.slice(0, m - 1); const s = c.lastIndexOf(" ");
  return (s > m * 0.4 ? c.slice(0, s) : c) + "\u2026";
}

export type ChartMode = "campaign" | "tracks";

interface Props {
  data: ChartDataPoint[];
  selectedTracks: string[];
  trackRoles: TrackWithRole[];
  visibleEventDates: Set<string>;
  highlightedDate: string | null;
  handoverMoment?: HandoverMoment | null;
  chartInsight?: string | null;
  trackModeContext?: string | null;
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
  albumDate?: string;
  ukMilestones?: UKMilestone[];
  territory?: Territory;
  paidCampaigns?: PaidCampaignRow[];
  moments?: Moment[];
}

// ——— Tooltip event priority (lower = higher priority) ———
function tipPriority(m: Moment): number {
  const t = m.moment_title.toLowerCase();
  const type = m.moment_type.toLowerCase();
  // 1. Album release
  if (type === "music" && (t.includes("album") || (t.includes("release") && !t.includes("single")))) return 1;
  // 2. Single / key track release
  if (type === "music" && (t.includes("single") || t.includes("lead") || t.includes("follow-up"))) return 2;
  if (type === "music") return 3;
  // 3. Editorial
  if (type === "editorial" || t.includes("playlist") || t.includes("editorial")) return 4;
  // 4. Paid support
  if (type === "marquee" || type === "showcase" || type === "paid") return 5;
  // 5. Media / TV / press
  if (type === "media" || type === "tv" || type === "radio" || t.includes("press") || t.includes("interview")) return 6;
  // 6. Tour / live
  if (type === "live" || type === "tour" || t.includes("tour")) return 7;
  return 8;
}

// ——— Tighten tooltip event labels ———
function tipLabel(m: Moment): string {
  const t = m.moment_title;
  const tl = t.toLowerCase();
  const type = m.moment_type.toLowerCase();

  // Paid campaigns: already formatted as "Platform (Territory) — Campaign"
  if (type === "marquee" || type === "showcase" || type === "paid") return t;

  // "Album Release - Title" → "Album Release"
  if (tl.includes("album") && tl.includes("release")) {
    const dash = t.indexOf(" - ");
    if (dash > 0) return t.slice(0, dash);
    const colon = t.indexOf(": ");
    if (colon > 0) return t.slice(0, colon);
    return t;
  }

  // Keep as-is if already short
  if (t.length <= 28) return t;

  // Truncate long labels
  return trunc(t, 28);
}

// ——— Campaign tooltip ———
function CampTip({ active, payload, label, territory }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const rawEvents: Moment[] = dp.events || [];
  const sorted = [...rawEvents].sort((a, b) => tipPriority(a) - tipPriority(b));
  const prev = dp.prev_week_streams;
  const wow = prev != null && prev > 0 && dp.total_streams > 0 ? ((dp.total_streams - prev) / prev) * 100 : null;
  const isUK = territory === "UK";
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-3 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? fmtFull(label) : ""}</p>
      {dp.total_streams > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#9CA3AF]">{isUK ? "UK Streams" : "Global Streams"}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.total_streams)}</span>
            {wow != null && <span className={`text-[10px] font-semibold ${wow >= 0 ? "text-emerald-400" : "text-red-400"}`}>{wow >= 0 ? "+" : ""}{wow.toFixed(0)}%</span>}
          </div>
        </div>
      )}
      {dp.physical_units > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#9CA3AF]">{isUK ? "UK Physical" : "Physical"}</span>
          <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.physical_units)}</span>
        </div>
      )}
      {sorted.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#2A2D3E]">
          {sorted.map((m: Moment, i: number) => {
            const cfg = getCategoryConfig(m.moment_type);
            const isPrimary = i === 0 && tipPriority(m) <= 3;
            // Add visual gap between groups: music (≤3), support (4-5), context (6+)
            const prevP = i > 0 ? tipPriority(sorted[i - 1]) : 0;
            const curP = tipPriority(m);
            const groupBreak = i > 0 && (
              (prevP <= 3 && curP > 3) || (prevP <= 5 && curP > 5)
            );
            return (
              <div key={i} className={`flex items-center gap-1.5 ${groupBreak ? "mt-2.5 pt-1.5 border-t border-[#2A2D3E]/50" : i > 0 ? "mt-1" : ""}`}>
                <span style={{ color: cfg.color }} className="text-[10px] w-3 text-center flex-shrink-0">{cfg.icon}</span>
                <span className={`text-[11px] ${isPrimary ? "font-semibold text-white" : "font-normal text-[#D1D5DB]"}`}>{tipLabel(m)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ——— Tracks tooltip ———
function TrackTip({ active, payload, label, trackRoles, ukMilestones }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const ranked = (trackRoles as TrackWithRole[])
    .filter(tr => dp[tr.track_name] != null && (dp[tr.track_name] as number) > 0)
    .sort((a: TrackWithRole, b: TrackWithRole) => (dp[b.track_name] as number) - (dp[a.track_name] as number));
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-3 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? fmtFull(label) : ""}</p>
      {ranked.map((tr: TrackWithRole, i: number) => {
        const ukm = (ukMilestones as UKMilestone[] || []).find((m: UKMilestone) => m.date === label && m.track_name === tr.track_name);
        const isTop = i < 3;
        return (
          <div key={i} className={`${i > 0 ? "mt-1" : ""} ${!isTop && i === 3 ? "mt-2 pt-1.5 border-t border-[#2A2D3E]/50" : ""}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tr.color, opacity: isTop ? 1 : 0.4 }} />
                <span className={`text-xs ${isTop ? "text-[#D1D5DB] font-medium" : "text-[#6B7280]"}`}>{tr.track_name}</span>
              </div>
              <span className={`text-xs tabular-nums ${isTop ? "font-semibold text-white" : "font-normal text-[#6B7280]"}`}>{fmt(dp[tr.track_name] as number)}</span>
            </div>
            {ukm && isTop && (
              <div className="flex items-center justify-between gap-4 ml-4">
                <span className="text-[10px] text-[#6B7280]">UK</span>
                <span className="text-[10px] text-[#6B7280] tabular-nums">{fmt(ukm.uk_streams)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ——— Paid campaign tooltip helpers ———
function fmtSpend(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  if (v > 0) return `$${v}`;
  return "";
}
function intentGrade(total: number): string {
  if (total <= 0) return "";
  // Intent rate benchmarks: 30%+ Strong, 25-29.9% On Benchmark, <25% Weak
  if (total >= 30) return "Strong";
  if (total >= 25) return "On Benchmark";
  return "Weak";
}

// ——— Moment markers for campaign mode ———
// Narrative-aware: album/single releases first, then major beats, paid support last
interface MM { date: string; label: string; fullTitle: string; type: string; color: string; row: number; }

type NarrativeCategory = "album_release" | "single_release" | "narrative_major" | "paid_support" | "editorial_support" | "other";

function classifyNarrative(m: Moment): NarrativeCategory {
  const t = m.moment_title.toLowerCase();
  const type = m.moment_type.toLowerCase();
  // Album release
  if (type === "music" && (t.includes("album") || t.includes("release")) && !t.includes("single")) return "album_release";
  // Singles
  if (type === "music" && (t.includes("single one") || t.includes("single two") || t.includes("single 1") || t.includes("single 2") || t.includes("lead single") || t.includes("follow-up"))) return "single_release";
  if (type === "music" && t.includes("single")) return "single_release";
  // Paid support (Marquee, Showcase, etc.)
  if (type === "marquee" || type === "paid" || type === "showcase") return "paid_support";
  // Major narrative beats: tour, TV, radio premiere
  if (type === "tour" || type === "tv" || type === "radio" || type === "live") return "narrative_major";
  // Editorial
  if (type === "editorial") return "editorial_support";
  // Music moments that aren't singles/album (e.g. featured tracks)
  if (type === "music") return "narrative_major";
  return "other";
}

function layoutMoments(allMoments: Moment[], chartDates: string[]): MM[] {
  const dateSet = new Set(chartDates);
  const keyMoments = allMoments.filter(m => m.is_key && dateSet.has(m.date));

  // Deduplicate per date: pick best narrative category per date
  const catPriority: Record<NarrativeCategory, number> = {
    album_release: 100, single_release: 90, narrative_major: 50, paid_support: 20, editorial_support: 10, other: 5,
  };
  const byDate = new Map<string, { date: string; label: string; fullTitle: string; type: string; color: string; cat: NarrativeCategory; p: number }>();
  for (const e of keyMoments) {
    const nc = classifyNarrative(e);
    const p = catPriority[nc];
    const vis = getCategoryConfig(e.moment_type);
    const ex = byDate.get(e.date);
    if (!ex || p > ex.p) byDate.set(e.date, { date: e.date, label: trunc(e.moment_title, 18), fullTitle: e.moment_title, type: e.moment_type, color: vis.color, cat: nc, p });
  }

  // Slot-based selection: narrative first, paid support fills remaining slots
  const MAX_LABELS = 5;
  const MAX_PAID = 1;
  const all = [...byDate.values()];
  const narrative = all.filter(m => m.cat !== "paid_support" && m.cat !== "editorial_support" && m.cat !== "other");
  const paid = all.filter(m => m.cat === "paid_support");
  const rest = all.filter(m => m.cat === "editorial_support" || m.cat === "other");

  // Sort narrative by priority desc then date
  narrative.sort((a, b) => b.p - a.p || a.date.localeCompare(b.date));
  paid.sort((a, b) => a.date.localeCompare(b.date));
  rest.sort((a, b) => b.p - a.p || a.date.localeCompare(b.date));

  const selected: typeof all = [];
  // 1. Fill with narrative moments
  for (const m of narrative) {
    if (selected.length >= MAX_LABELS) break;
    selected.push(m);
  }
  // 2. Add up to MAX_PAID paid support if room
  let paidCount = 0;
  for (const m of paid) {
    if (selected.length >= MAX_LABELS || paidCount >= MAX_PAID) break;
    selected.push(m);
    paidCount++;
  }
  // 3. Fill remaining with editorial/other if room
  for (const m of rest) {
    if (selected.length >= MAX_LABELS) break;
    selected.push(m);
  }

  return selected
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m, i) => ({ date: m.date, label: m.label, fullTitle: m.fullTitle, type: m.type, color: m.color, row: i % 2 }));
}

// ——— Phase boundaries ———
function getPhases(data: ChartDataPoint[], albumDate?: string) {
  if (!albumDate) return null;
  const dates = data.map(d => d.date).filter(d => d).sort();
  const first = dates[0], last = dates[dates.length - 1];
  const post = dates.filter(d => d > albumDate);
  return { first, albumDate, postStart: post.length > 1 ? post[1] : post[0] || last, last };
}

export default function TimelineChart({
  data, selectedTracks, trackRoles, visibleEventDates,
  highlightedDate, handoverMoment, chartInsight, trackModeContext,
  chartMode, onChartModeChange, albumDate, ukMilestones, territory,
  paidCampaigns, moments: allMoments,
}: Props) {
  const chartDates = useMemo(() => data.map(d => d.date).sort(), [data]);
  const moments = useMemo(() => layoutMoments(allMoments || [], chartDates), [allMoments, chartDates]);
  const hasPhysical = useMemo(() => data.some(d => d.physical_units > 0), [data]);
  const isCampaign = chartMode === "campaign";
  const phases = useMemo(() => getPhases(data, albumDate), [data, albumDate]);
  const isSparse = useMemo(() => data.filter(d => d.total_streams > 0).length <= 3, [data]);

  // Key vs muted tracks for track mode
  const keyTracks = useMemo(() => trackRoles.filter(tr => tr.opacity >= 0.5), [trackRoles]);
  const topTrack = useMemo(() => {
    if (keyTracks.length === 0) return null;
    // Find the key track with highest total streams across all data points
    let best: TrackWithRole | null = null;
    let bestSum = 0;
    for (const tr of keyTracks) {
      const sum = data.reduce((s, dp) => s + ((dp as Record<string, unknown>)[tr.track_name] as number || 0), 0);
      if (sum > bestSum) { bestSum = sum; best = tr; }
    }
    return best;
  }, [keyTracks, data]);

  return (
    <div className="w-full">
      {/* Campaign / Tracks toggle — clean, no sub-toggles */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-0.5 bg-[#0D1117] rounded-lg p-0.5 border border-[#1E2130]">
          <button onClick={() => onChartModeChange("campaign")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Campaign</button>
          <button onClick={() => onChartModeChange("tracks")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Tracks</button>
        </div>
        <span className="text-[10px] max-w-[420px] text-right">
          {isCampaign ? (
            paidCampaigns && paidCampaigns.length > 0 ? (
              <span className="text-[#6B7280]"><span className="text-[#9CA3AF] font-medium">Hover moments</span> for performance &amp; spend</span>
            ) : (
              <span className="text-[#4B5563]">{territory === "UK" ? "UK campaign performance" : "Global campaign performance"}</span>
            )
          ) : (
            topTrack ? (
              <span className="text-[#6B7280]">Top Track: <span className="font-medium" style={{ color: topTrack.color }}>{topTrack.track_name}</span></span>
            ) : (
              <span className="text-[#4B5563]">{trackModeContext || "Individual track performance"}</span>
            )
          )}
        </span>
      </div>

      {/* Campaign mode: moment labels above chart */}
      {isCampaign && moments.length > 0 && (
        <div className="relative w-full mb-1" style={{ height: 44 }}>
          <div className="absolute inset-0 flex items-end">
            {moments.map((m, i) => {
              const dates = data.map(d => d.date).sort();
              const idx = dates.indexOf(m.date);
              const pct = dates.length > 1 ? (idx / (dates.length - 1)) * 100 : 50;
              // Match ALL paid campaigns on this date (regardless of label type)
              const pcs = paidCampaigns?.length
                ? paidCampaigns.filter(p => p.start_date === m.date)
                : [];
              return (
                <div key={i} className={`absolute flex flex-col items-center ${pcs.length > 0 ? "group" : ""}`}
                  style={{ left: `${4 + pct * 0.88}%`, bottom: m.row === 0 ? 20 : 2, transform: "translateX(-50%)" }}>
                  <span className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap px-1.5 ${pcs.length > 0 ? "cursor-pointer" : ""}`} style={{ color: m.color }}>{m.label}</span>
                  <div className="w-px h-2 mt-0.5" style={{ backgroundColor: m.color, opacity: 0.5 }} />
                  {pcs.length > 0 && (
                    <div className="hidden group-hover:block absolute bottom-full mb-2 z-50 bg-[#1A1D2E] rounded-lg border border-[#2A2D3E] p-2.5 shadow-2xl whitespace-nowrap">
                      {pcs.map((pc, pi) => (
                        <div key={pi} className={pi > 0 ? "mt-2 pt-2 border-t border-[#2A2D3E]" : ""}>
                          <p className="text-[10px] font-semibold text-white mb-1">{pc.platform} &mdash; {pc.territory} <span className="text-[#6B7280] font-normal">(Campaign Impact)</span></p>
                          {pc.spend > 0 && <p className="text-[10px] text-[#9CA3AF]">Spend: <span className="text-white font-medium">{fmtSpend(pc.spend)}{pc.spend_planned > 0 ? ` / ${fmtSpend(pc.spend_planned)} planned` : ""}</span></p>}
                          {pc.intent_total > 0 && <p className="text-[10px] text-[#9CA3AF]">Intent: <span className="text-white font-medium">{pc.intent_total}%</span> <span className="text-[#6B7280]">({intentGrade(pc.intent_total)})</span></p>}
                          {pc.best_segment && <p className="text-[10px] text-[#9CA3AF]">Driver: <span className="text-white font-medium">{pc.best_segment}</span></p>}
                          {pc.top_track && <p className="text-[10px] text-[#9CA3AF]">Top Track: <span className="text-white font-medium">{pc.top_track}</span></p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========= CAMPAIGN MODE ========= */}
      {isCampaign && (
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: hasPhysical ? 60 : 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1D2A" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#1E2130" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis yAxisId="s" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
              {hasPhysical && <YAxis yAxisId="p" orientation="right" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />}
              <Tooltip content={<CampTip territory={territory} />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
              {highlightedDate && <ReferenceLine x={highlightedDate} yAxisId="s" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />}
              {moments.map((m, i) => <ReferenceLine key={`m${i}`} x={m.date} yAxisId="s" stroke={m.color} strokeDasharray="4 6" strokeWidth={1} strokeOpacity={0.35} />)}
              <Area yAxisId="s" type="monotone" dataKey="total_streams" fill={`${TOTAL_COLOR}12`} stroke="none" />
              <Line yAxisId="s" type="monotone" dataKey="total_streams" stroke={TOTAL_COLOR} strokeWidth={2.5}
                dot={isSparse ? { r: 4, fill: TOTAL_COLOR, stroke: "#0D1117", strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: TOTAL_COLOR, stroke: "#0D1117", strokeWidth: 2 }} name="Total Streams" />
              {hasPhysical && <Bar yAxisId="p" dataKey="physical_units" fill={`${PHYSICAL_COLOR}30`} stroke={PHYSICAL_COLOR} strokeWidth={1} radius={[3, 3, 0, 0]} name="Physical" barSize={16} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ========= TRACKS MODE — narrative chart, real values ========= */}
      {!isCampaign && (
        <div className="w-full h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#151825" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#151825" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<TrackTip trackRoles={trackRoles} ukMilestones={ukMilestones} />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
              {highlightedDate && <ReferenceLine x={highlightedDate} stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />}

              {/* Phase background shading */}
              {phases && (
                <>
                  <ReferenceArea x1={phases.first} x2={phases.albumDate} fill="#6B728006" label={{ value: "PRE-RELEASE", position: "insideTopLeft", fill: "#4B5563", fontSize: 9, fontWeight: 700 }} />
                  <ReferenceArea x1={phases.albumDate} x2={phases.postStart} fill="#6C9EFF08" label={{ value: "RELEASE", position: "insideTop", fill: "#6C9EFF", fontSize: 9, fontWeight: 700 }} />
                  <ReferenceArea x1={phases.postStart} x2={phases.last} fill="#FBBF2406" label={{ value: "POST-RELEASE", position: "insideTopRight", fill: "#FBBF24", fontSize: 9, fontWeight: 700 }} />
                </>
              )}

              {/* Album release marker */}
              {albumDate && <ReferenceLine x={albumDate} stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: "Album Release", position: "insideTopLeft", fill: "#8B5CF6", fontSize: 9, fontWeight: 600, offset: 4 }} />}

              {/* DJH handover annotation */}
              {handoverMoment && (
                <ReferenceLine x={handoverMoment.date} stroke="#FBBF24" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.6}
                  label={{ value: "Holding post-release", position: "insideTopRight", fill: "#FBBF24", fontSize: 9, fontWeight: 700, offset: 8 }} />
              )}

              {/* Track lines — fixed colours for key tracks, muted for others */}
              {selectedTracks.map(track => {
                const role = trackRoles.find(r => r.track_name === track);
                if (!role) return null;
                const isKey = role.opacity >= 0.5;
                return <Line key={track} type="monotone" dataKey={track}
                  stroke={role.color}
                  strokeWidth={role.strokeWidth}
                  strokeOpacity={role.opacity}
                  dot={isSparse ? { r: isKey ? 5 : 3, fill: role.color, stroke: "#0D1117", strokeWidth: 2 } : false}
                  activeDot={isKey ? { r: 5, fill: role.color, stroke: "#0D1117", strokeWidth: 2 } : false}
                  connectNulls={false} name={track} />;
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaign insight */}
      {isCampaign && chartInsight && (
        <p className="text-[11px] text-[#9CA3AF] italic text-center mt-2">{chartInsight}</p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
        {isCampaign ? (
          <>
            <LI color={TOTAL_COLOR} label={territory === "UK" ? "UK Streams" : "Global Streams"} type="line" bold />
            {hasPhysical && <LI color={PHYSICAL_COLOR} label={territory === "UK" ? "UK Physical" : "Physical"} type="bar" />}
          </>
        ) : (
          keyTracks
            .sort((a, b) => b.strokeWidth - a.strokeWidth)
            .map(tr => (
              <LI key={tr.track_name} color={tr.color}
                label={tr.track_name}
                type="line" opacity={1}
                bold={topTrack?.track_name === tr.track_name} />
            ))
        )}
      </div>
    </div>
  );
}

function LI({ color, label, type, opacity = 1, bold = false }: {
  color: string; label: string; type: "line" | "bar"; opacity?: number; bold?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" style={{ opacity: Math.max(opacity, 0.35) }}>
      {type === "line" ? (
        <span className={`inline-block rounded-full ${bold ? "w-4 h-1" : "w-3 h-0.5"}`} style={{ backgroundColor: color }} />
      ) : (
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: `${color}40`, border: `1px solid ${color}` }} />
      )}
      <span className={`text-[10px] ${bold ? "text-white font-semibold" : "text-[#6B7280]"}`}>{label}</span>
    </div>
  );
}
