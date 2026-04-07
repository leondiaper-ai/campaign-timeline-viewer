"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area,
  XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea,
} from "recharts";
import { ChartDataPoint, Moment, Territory, PaidCampaignRow } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import { TrackWithRole, HandoverMoment, UKMilestone } from "@/lib/transforms";

// ── Paper palette ──
const STREAM_COLOR = "#2C25FF"; // electric blue — primary line
const STREAM_FILL = "#2C25FF10";
const INK = "#0E0E0E";
const INK_20 = "rgba(14,14,14,0.12)";
const INK_6 = "rgba(14,14,14,0.06)";
const INK_50 = "rgba(14,14,14,0.5)";
const PHASE_PRE = "rgba(44,37,255,0.04)";
const PHASE_RELEASE = "rgba(255,74,28,0.06)";
const PHASE_POST = "rgba(255,210,76,0.04)";

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
function trunc(t: string, m: number = 18): string {
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
  pinnedDate?: string | null;
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

// ── Tooltip (clean, minimal) ──
function CleanTooltip({ active, payload, label, territory }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const rawEvents: Moment[] = dp.events || [];
  const isUK = territory === "UK";
  const prev = dp.prev_week_streams;
  const wow = prev != null && prev > 0 && dp.total_streams > 0
    ? ((dp.total_streams - prev) / prev) * 100 : null;

  return (
    <div className="bg-paper rounded-2xl border border-ink/10 px-4 py-3 shadow-[4px_4px_0_0_rgba(14,14,14,0.08)] max-w-xs">
      <p className="text-[11px] font-semibold text-ink/40 mb-1.5">{label ? fmtFull(label) : ""}</p>
      {dp.total_streams > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-ink tracking-tight tabular-nums">{fmt(dp.total_streams)}</span>
          {wow != null && (
            <span className={`text-xs font-bold ${wow >= 0 ? "text-mint" : "text-signal"}`}>
              {wow >= 0 ? "+" : ""}{wow.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <p className="text-[10px] text-ink/40 mt-0.5">{isUK ? "UK streams" : "Global streams"}</p>
      {rawEvents.length > 0 && (
        <div className="mt-2 pt-2 border-t border-ink/10 space-y-1">
          {rawEvents.slice(0, 3).map((m: Moment, i: number) => {
            const cfg = getCategoryConfig(m.moment_type);
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                <span className="text-[11px] text-ink/70">{trunc(m.moment_title, 30)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tracks tooltip ──
function TrackTip({ active, payload, label, trackRoles }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const ranked = (trackRoles as TrackWithRole[])
    .filter(tr => dp[tr.track_name] != null && (dp[tr.track_name] as number) > 0)
    .sort((a: TrackWithRole, b: TrackWithRole) => (dp[b.track_name] as number) - (dp[a.track_name] as number));
  return (
    <div className="bg-paper rounded-2xl border border-ink/10 px-4 py-3 shadow-[4px_4px_0_0_rgba(14,14,14,0.08)] max-w-xs">
      <p className="text-[11px] font-semibold text-ink/40 mb-2">{label ? fmtFull(label) : ""}</p>
      {ranked.slice(0, 5).map((tr: TrackWithRole, i: number) => (
        <div key={i} className={`flex items-center justify-between gap-4 ${i > 0 ? "mt-1" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tr.color }} />
            <span className="text-xs text-ink/70">{tr.track_name}</span>
          </div>
          <span className="text-xs font-bold text-ink tabular-nums">{fmt(dp[tr.track_name] as number)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Moment markers — key events only, narrative priority ──
type NarrativeCategory = "album_release" | "single_release" | "narrative_major" | "paid_support" | "editorial_support" | "other";

function classifyNarrative(m: Moment): NarrativeCategory {
  const t = m.moment_title.toLowerCase();
  const type = m.moment_type.toLowerCase();
  if (type === "music" && (t.includes("album") || t.includes("release")) && !t.includes("single")) return "album_release";
  if (type === "music" && (t.includes("single") || t.includes("lead") || t.includes("follow-up"))) return "single_release";
  if (type === "marquee" || type === "paid" || type === "showcase") return "paid_support";
  if (type === "tour" || type === "tv" || type === "radio" || type === "live") return "narrative_major";
  if (type === "product" || type === "marketing") return "narrative_major";
  if (type === "music") return "narrative_major";
  if (type === "editorial") return "editorial_support";
  return "other";
}

interface MM { date: string; label: string; fullTitle: string; type: string; color: string; row: number; }

function layoutMoments(allMoments: Moment[], chartDates: string[]): MM[] {
  const keyMoments = allMoments.filter(m => m.is_key);
  const catPriority: Record<NarrativeCategory, number> = {
    album_release: 100, single_release: 90, narrative_major: 50, paid_support: 20, editorial_support: 10, other: 5,
  };
  const byDate = new Map<string, { date: string; label: string; fullTitle: string; type: string; color: string; cat: NarrativeCategory; p: number }>();
  for (const e of keyMoments) {
    const nc = classifyNarrative(e);
    const p = catPriority[nc];
    const vis = getCategoryConfig(e.moment_type);
    const ex = byDate.get(e.date);
    if (!ex || p > ex.p) byDate.set(e.date, { date: e.date, label: trunc(e.moment_title, 16), fullTitle: e.moment_title, type: e.moment_type, color: vis.color, cat: nc, p });
  }

  // Only show the most important moments: album, singles, max 1 paid
  const all = [...byDate.values()];
  const selected: typeof all = [];
  for (const m of all.filter(m => m.cat === "album_release" || m.cat === "single_release" || m.cat === "narrative_major")
    .sort((a, b) => b.p - a.p || a.date.localeCompare(b.date))) {
    selected.push(m);
  }
  // Max 1 paid
  const paid = all.filter(m => m.cat === "paid_support").sort((a, b) => a.date.localeCompare(b.date));
  if (paid.length > 0) selected.push(paid[0]);

  return selected
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m, i) => ({ date: m.date, label: m.label, fullTitle: m.fullTitle, type: m.type, color: m.color, row: i % 2 }));
}

// ── Phase boundaries ──
function getPhases(data: ChartDataPoint[], albumDate?: string) {
  if (!albumDate) return null;
  const dates = data.map(d => d.date).filter(d => d).sort();
  const first = dates[0], last = dates[dates.length - 1];
  const post = dates.filter(d => d > albumDate);
  return { first, albumDate, postStart: post.length > 1 ? post[1] : post[0] || last, last };
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function TimelineChart({
  data, selectedTracks, trackRoles,
  highlightedDate, pinnedDate, handoverMoment,
  chartInsight, trackModeContext,
  chartMode, onChartModeChange, albumDate, ukMilestones, territory,
  paidCampaigns, moments: allMoments,
}: Props) {
  const chartDates = useMemo(() => data.map(d => d.date).sort(), [data]);
  const moments = useMemo(() => layoutMoments(allMoments || [], chartDates), [allMoments, chartDates]);
  const isCampaign = chartMode === "campaign";
  const phases = useMemo(() => getPhases(data, albumDate), [data, albumDate]);
  const isSparse = useMemo(() => data.filter(d => d.total_streams > 0).length <= 3, [data]);

  // Track mode: smart Y-axis capping
  const trackYDomain = useMemo(() => {
    if (selectedTracks.length === 0) return undefined;
    const vals: number[] = [];
    for (const dp of data) {
      for (const tn of selectedTracks) {
        const v = dp[tn];
        if (typeof v === "number" && v > 0) vals.push(v);
      }
    }
    if (vals.length < 2) return undefined;
    vals.sort((a, b) => a - b);
    const p95 = vals[Math.floor(vals.length * 0.95)];
    const max = vals[vals.length - 1];
    if (max > p95 * 3) return [0, Math.ceil(p95 * 1.3)];
    return undefined;
  }, [data, selectedTracks]);

  const keyTracks = useMemo(() => trackRoles.filter(tr => tr.opacity >= 0.5), [trackRoles]);
  const topTrack = useMemo(() => {
    if (keyTracks.length === 0) return null;
    const rows = albumDate ? data.filter(dp => dp.date >= albumDate) : data;
    let best: TrackWithRole | null = null;
    let bestSum = 0;
    for (const tr of keyTracks) {
      const sum = rows.reduce((s, dp) => s + ((dp as Record<string, unknown>)[tr.track_name] as number || 0), 0);
      if (sum > bestSum) { bestSum = sum; best = tr; }
    }
    return best;
  }, [keyTracks, data, albumDate]);

  return (
    <div className="w-full">
      {/* Mode toggle — clean pill */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-0.5 bg-cream rounded-full p-1 border border-ink/10">
          <button onClick={() => onChartModeChange("campaign")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${isCampaign ? "bg-ink text-paper shadow-sm" : "text-ink/40 hover:text-ink/70"}`}>Campaign</button>
          <button onClick={() => onChartModeChange("tracks")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${!isCampaign ? "bg-ink text-paper shadow-sm" : "text-ink/40 hover:text-ink/70"}`}>Tracks</button>
        </div>
        <span className="text-[11px] text-ink/40">
          {isCampaign
            ? (territory === "UK" ? "UK streams" : "Global streams")
            : (topTrack ? `Lead: ${topTrack.track_name}` : "Track performance")}
        </span>
      </div>

      {/* Campaign mode: moment markers above chart */}
      {isCampaign && moments.length > 0 && (
        <div className="relative w-full mb-2" style={{ height: 40 }}>
          <div className="absolute inset-0 flex items-end" style={{ left: 58, right: 24 }}>
            {moments.map((m, i) => {
              const dates = data.map(d => d.date).sort();
              const idx = dates.indexOf(m.date);
              const pct = dates.length > 1 ? (idx / (dates.length - 1)) * 100 : 50;
              return (
                <div key={i} className="absolute flex flex-col items-center"
                  style={{ left: `${pct}%`, bottom: m.row === 0 ? 18 : 2, transform: "translateX(-50%)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap px-1" style={{ color: m.color }}>{m.label}</span>
                  <div className="w-px h-2 mt-0.5" style={{ backgroundColor: m.color, opacity: 0.4 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═════ CAMPAIGN MODE — single bold line ═════ */}
      {isCampaign && (
        <div className="w-full h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              {/* Minimal grid — horizontal only, very light */}
              <XAxis
                dataKey="date" tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: INK_50, fontWeight: 500 }}
                axisLine={{ stroke: INK_20 }}
                tickLine={false} dy={10}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="s" tickFormatter={fmt}
                tick={{ fontSize: 10, fill: INK_50 }}
                axisLine={false} tickLine={false} width={50}
              />
              <Tooltip content={<CleanTooltip territory={territory} />} cursor={{ stroke: INK_20, strokeDasharray: "4 4" }} />

              {/* Phase backgrounds — ultra subtle */}
              {phases && phases.first < phases.albumDate && (
                <ReferenceArea x1={phases.first} x2={phases.albumDate} yAxisId="s" fill={PHASE_PRE}
                  label={{ value: "PRE-RELEASE", position: "insideTopLeft", fill: INK_50, fontSize: 9, fontWeight: 700 }} />
              )}
              {phases && (
                <ReferenceArea x1={phases.albumDate} x2={phases.postStart} yAxisId="s" fill={PHASE_RELEASE}
                  label={{ value: "RELEASE", position: "insideTop", fill: "#FF4A1C", fontSize: 9, fontWeight: 700 }} />
              )}
              {phases && (
                <ReferenceArea x1={phases.postStart} x2={phases.last} yAxisId="s" fill={PHASE_POST}
                  label={{ value: "POST-RELEASE", position: "insideTopRight", fill: INK_50, fontSize: 9, fontWeight: 700 }} />
              )}

              {pinnedDate && <ReferenceLine x={pinnedDate} yAxisId="s" stroke="#FF4A1C" strokeWidth={2.5} strokeOpacity={0.8} />}
              {highlightedDate && !pinnedDate && <ReferenceLine x={highlightedDate} yAxisId="s" stroke={INK} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.3} />}
              {moments.map((m, i) => <ReferenceLine key={`m${i}`} x={m.date} yAxisId="s" stroke={m.color} strokeDasharray="4 6" strokeWidth={1} strokeOpacity={0.25} />)}

              {/* Area fill + bold line */}
              <Area yAxisId="s" type="monotone" dataKey="total_streams" fill={STREAM_FILL} stroke="none" />
              <Line
                yAxisId="s" type="monotone" dataKey="total_streams"
                stroke={STREAM_COLOR} strokeWidth={3.5}
                dot={isSparse ? { r: 5, fill: STREAM_COLOR, stroke: "#FAF7F2", strokeWidth: 2 } : false}
                activeDot={{ r: 6, fill: STREAM_COLOR, stroke: "#FAF7F2", strokeWidth: 2 }}
                name="Streams"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═════ TRACKS MODE ═════ */}
      {!isCampaign && (
        <div className="w-full h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <XAxis
                dataKey="date" tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: INK_50, fontWeight: 500 }}
                axisLine={{ stroke: INK_20 }}
                tickLine={false} dy={10}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={fmt}
                tick={{ fontSize: 10, fill: INK_50 }}
                axisLine={false} tickLine={false} width={50}
                domain={trackYDomain as [number, number] | undefined}
                allowDataOverflow={!!trackYDomain}
              />
              <Tooltip content={<TrackTip trackRoles={trackRoles} ukMilestones={ukMilestones} />} cursor={{ stroke: INK_20, strokeDasharray: "4 4" }} />

              {/* Phase backgrounds */}
              {phases && (
                <>
                  <ReferenceArea x1={phases.first} x2={phases.albumDate} fill={PHASE_PRE}
                    label={{ value: "PRE-RELEASE", position: "insideTopLeft", fill: INK_50, fontSize: 9, fontWeight: 700 }} />
                  <ReferenceArea x1={phases.albumDate} x2={phases.postStart} fill={PHASE_RELEASE}
                    label={{ value: "RELEASE", position: "insideTop", fill: "#FF4A1C", fontSize: 9, fontWeight: 700 }} />
                  <ReferenceArea x1={phases.postStart} x2={phases.last} fill={PHASE_POST}
                    label={{ value: "POST-RELEASE", position: "insideTopRight", fill: INK_50, fontSize: 9, fontWeight: 700 }} />
                </>
              )}

              {albumDate && <ReferenceLine x={albumDate} stroke="#FF4A1C" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.5}
                label={{ value: "Album", position: "insideTopLeft", fill: "#FF4A1C", fontSize: 9, fontWeight: 600, offset: 4 }} />}

              {pinnedDate && <ReferenceLine x={pinnedDate} stroke="#FF4A1C" strokeWidth={2.5} strokeOpacity={0.8} />}
              {highlightedDate && !pinnedDate && <ReferenceLine x={highlightedDate} stroke={INK} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.3} />}

              {selectedTracks.map(track => {
                const role = trackRoles.find(r => r.track_name === track);
                if (!role) return null;
                const isKey = role.opacity >= 0.5;
                return <Line key={track} type="monotone" dataKey={track}
                  stroke={role.color}
                  strokeWidth={isKey ? 3 : 1.5}
                  strokeOpacity={role.opacity}
                  dot={isSparse ? { r: isKey ? 5 : 3, fill: role.color, stroke: "#FAF7F2", strokeWidth: 2 } : false}
                  activeDot={isKey ? { r: 5, fill: role.color, stroke: "#FAF7F2", strokeWidth: 2 } : false}
                  connectNulls={false} name={track} />;
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insight line */}
      {isCampaign && chartInsight && (
        <p className="text-[12px] text-ink/50 italic text-center mt-3">{chartInsight}</p>
      )}

      {/* Minimal legend — tracks mode only */}
      {!isCampaign && keyTracks.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-5 mt-4">
          {keyTracks.sort((a, b) => b.strokeWidth - a.strokeWidth).map(tr => (
            <div key={tr.track_name} className="flex items-center gap-2">
              <span className={`inline-block rounded-full ${topTrack?.track_name === tr.track_name ? "w-5 h-1.5" : "w-3 h-1"}`} style={{ backgroundColor: tr.color }} />
              <span className={`text-[11px] ${topTrack?.track_name === tr.track_name ? "text-ink font-bold" : "text-ink/40"}`}>{tr.track_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
