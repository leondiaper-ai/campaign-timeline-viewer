"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea,
} from "recharts";
import { ChartDataPoint, Moment, Territory, Track } from "@/types";

// ── Paper palette ──
const STREAM_COLOR = "#2C25FF";
const STREAM_FILL = "#2C25FF10";
const PHYSICAL_COLOR = "#1FBE7A"; // mint — physical sales
// PHYSICAL_FILL handled inline via fillOpacity
const INK_20 = "rgba(14,14,14,0.12)";
const INK_50 = "rgba(14,14,14,0.5)";
const PHASE_PRE = "rgba(44,37,255,0.04)";
const PHASE_RELEASE = "rgba(255,74,28,0.06)";
const PHASE_POST = "rgba(255,210,76,0.04)";

// Track role colours
const ROLE_COLORS: Record<string, string> = {
  lead_single:   "#F87171",
  second_single: "#60A5FA",
  focus_track:   "#34D399",
};
const ROLE_LABELS: Record<string, string> = {
  lead_single:   "Lead Single",
  second_single: "Second Single",
  focus_track:   "Album Focus",
};

// ── Moment type colours (by meaning, not raw type) ──
// release (singles, album) → purple
// editorial / playlist     → green
// marketing / paid         → amber
// live / external          → red
type MomentMeaning = "release" | "editorial" | "paid" | "live";

const MEANING_COLORS: Record<MomentMeaning, string> = {
  release:   "#8B5CF6", // purple
  editorial: "#10B981", // green
  paid:      "#F59E0B", // amber
  live:      "#EF4444", // red
};

function getMomentMeaning(m: Moment): MomentMeaning {
  const type = m.moment_type.toLowerCase();
  const title = m.moment_title.toLowerCase();
  // Music releases: singles, albums
  if (type === "music" || title.includes("single") || title.includes("album") || title.includes("release")) return "release";
  // Editorial / playlist
  if (type === "editorial" || title.includes("playlist") || title.includes("editorial")) return "editorial";
  // Paid / marketing
  if (type === "marquee" || type === "showcase" || type === "paid" || type === "marketing" || title.includes("pre-save") || title.includes("campaign")) return "paid";
  // Live / tour / festival / media
  if (type === "live" || type === "tour" || type === "media" || title.includes("tour") || title.includes("festival") || title.includes("radio") || title.includes("tv")) return "live";
  return "release"; // fallback
}

export type ChartMode = "campaign" | "tracks";

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
function trunc(t: string, m: number = 20): string {
  if (t.length <= m) return t;
  const c = t.slice(0, m - 1); const s = c.lastIndexOf(" ");
  return (s > m * 0.4 ? c.slice(0, s) : c) + "\u2026";
}

interface Props {
  data: ChartDataPoint[];
  moments: Moment[];
  highlightedDate: string | null;
  pinnedDate?: string | null;
  albumDate?: string;
  territory?: Territory;
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
  tracks?: Track[];
}

// ── Campaign Tooltip ──
function CampaignTooltip({ active, payload, label, territory, hasPhysical }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const rawEvents: Moment[] = dp.events || [];
  const isUK = territory === "UK";
  const prev = dp.prev_week_streams;
  const wow = prev != null && prev > 0 && dp.total_streams > 0
    ? ((dp.total_streams - prev) / prev) * 100 : null;
  const physical = dp.physical_units || 0;

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
      {hasPhysical && physical > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: PHYSICAL_COLOR }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: PHYSICAL_COLOR }}>{fmt(physical)}</span>
          <span className="text-[10px] text-ink/40">physical</span>
        </div>
      )}
      {rawEvents.length > 0 && (
        <div className="mt-2 pt-2 border-t border-ink/10 space-y-1">
          {rawEvents.slice(0, 3).map((m: Moment, i: number) => {
            const color = MEANING_COLORS[getMomentMeaning(m)];
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-ink/70">{trunc(m.moment_title, 30)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tracks Tooltip ──
function TracksTooltip({ active, payload, label, keyTracks }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const tracks = keyTracks as { name: string; role: string; color: string }[];

  return (
    <div className="bg-paper rounded-2xl border border-ink/10 px-4 py-3 shadow-[4px_4px_0_0_rgba(14,14,14,0.08)] max-w-xs">
      <p className="text-[11px] font-semibold text-ink/40 mb-2">{label ? fmtFull(label) : ""}</p>
      {tracks.map((t, i) => {
        const val = dp[t.name] as number;
        if (!val || val <= 0) return null;
        return (
          <div key={i} className={`flex items-center justify-between gap-4 ${i > 0 ? "mt-1" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <span className="text-xs text-ink/70">{t.name}</span>
            </div>
            <span className="text-xs font-bold text-ink tabular-nums">{fmt(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MOMENT LAYOUT — smart staggering with overlap prevention
// ════════════════════════════════════════════════════════════════

interface LayoutMoment {
  date: string;
  label: string;
  color: string;
  meaning: MomentMeaning;
  pct: number;    // x-position as percentage of chart width
  tier: number;   // vertical tier (0 = closest to chart, 1, 2 = highest)
}

// Snap a date to the nearest chart date (Recharts categorical axis needs exact matches)
function snapToChartDate(date: string, sortedDates: string[]): string {
  if (sortedDates.includes(date)) return date;
  const t = new Date(date).getTime();
  let best = sortedDates[0];
  let bestDiff = Math.abs(new Date(best).getTime() - t);
  for (const d of sortedDates) {
    const diff = Math.abs(new Date(d).getTime() - t);
    if (diff < bestDiff) { best = d; bestDiff = diff; }
  }
  return best;
}

function buildMomentLayout(allMoments: Moment[], chartDates: string[]): LayoutMoment[] {
  if (chartDates.length === 0) return [];
  const sortedDates = [...chartDates].sort();

  // 1. Filter to key moments, dedupe by snapped date (highest priority wins)
  const keyMoments = allMoments.filter(m => m.is_key);

  const typePriority = (m: Moment): number => {
    const meaning = getMomentMeaning(m);
    const title = m.moment_title.toLowerCase();
    if (meaning === "release" && title.includes("album")) return 100;
    if (meaning === "release") return 90;
    if (meaning === "live") return 60;
    if (meaning === "paid") return 40;
    if (meaning === "editorial") return 20;
    return 10;
  };

  const bySnappedDate = new Map<string, Moment>();
  for (const m of keyMoments) {
    const snapped = snapToChartDate(m.date, sortedDates);
    const existing = bySnappedDate.get(snapped);
    if (!existing || typePriority(m) > typePriority(existing)) {
      bySnappedDate.set(snapped, m);
    }
  }

  // 2. Cap at 5 moments max — prioritise by type then date order
  let selected = [...bySnappedDate.entries()].sort((a, b) => typePriority(b[1]) - typePriority(a[1]));
  if (selected.length > 5) selected = selected.slice(0, 5);
  selected.sort((a, b) => a[0].localeCompare(b[0]));

  // 3. Build layout items with snapped chart dates and tier staggering
  const items: LayoutMoment[] = selected.map(([snappedDate, m], idx) => ({
    date: snappedDate, // snapped to nearest chart date — ReferenceLine will render
    label: trunc(m.moment_title, 18),
    meaning: getMomentMeaning(m),
    color: MEANING_COLORS[getMomentMeaning(m)],
    pct: 0, // not used for ReferenceLine approach
    tier: idx % 3, // simple round-robin stagger
  }));

  return items;
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
  data, moments: allMoments, highlightedDate, pinnedDate, albumDate, territory,
  chartMode, onChartModeChange, tracks,
}: Props) {
  const chartDates = useMemo(() => data.map(d => d.date).sort(), [data]);
  const momentLayout = useMemo(() => buildMomentLayout(allMoments || [], chartDates), [allMoments, chartDates]);
  const phases = useMemo(() => getPhases(data, albumDate), [data, albumDate]);
  const isSparse = useMemo(() => data.filter(d => d.total_streams > 0).length <= 3, [data]);
  const hasPhysical = useMemo(() => data.some(d => (d.physical_units || 0) > 0), [data]);
  const physicalPeak = useMemo(() => Math.max(...data.map(d => d.physical_units || 0)), [data]);
  const isCampaign = chartMode === "campaign";

  // Key tracks: max 3, only lead/second/focus roles
  const keyTracks = useMemo(() => {
    if (!tracks) return [];
    const KEY_ROLES = ["lead_single", "second_single", "focus_track"];
    return tracks
      .filter(t => KEY_ROLES.includes(t.track_role))
      .slice(0, 3)
      .map(t => ({
        name: t.track_name,
        role: t.track_role,
        color: ROLE_COLORS[t.track_role] || "#6B7280",
        label: ROLE_LABELS[t.track_role] || t.track_role,
      }));
  }, [tracks]);

  if (data.length === 0) return null;

  return (
    <div className="w-full">
      {/* Mode toggle + context label */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-0.5 bg-cream rounded-full p-1 border border-ink/10">
          <button onClick={() => onChartModeChange("campaign")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${isCampaign ? "bg-ink text-paper shadow-sm" : "text-ink/40 hover:text-ink/70"}`}>Campaign</button>
          <button onClick={() => onChartModeChange("tracks")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${!isCampaign ? "bg-ink text-paper shadow-sm" : "text-ink/40 hover:text-ink/70"}`}>Tracks</button>
        </div>
        <span className="text-[11px] text-ink/40">
          {isCampaign
            ? (territory === "UK" ? "UK streams" : "Global streams")
            : `${keyTracks.length} key tracks`}
        </span>
      </div>

      {/* ═════ CAMPAIGN MODE — single bold line ═════ */}
      {isCampaign && (
        <div className="w-full h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 32, right: 24, left: 8, bottom: 8 }}>
              <XAxis dataKey="date" tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: INK_50, fontWeight: 500 }}
                axisLine={{ stroke: INK_20 }} tickLine={false} dy={10}
                interval="preserveStartEnd" />
              <YAxis yAxisId="s" tickFormatter={fmt}
                tick={{ fontSize: 10, fill: INK_50 }}
                axisLine={false} tickLine={false} width={50} />
              {hasPhysical && (
                <YAxis yAxisId="p" orientation="right" tickFormatter={(v: number) => v > 0 ? `${(v / 1000).toFixed(0)}K` : ""}
                  tick={{ fontSize: 9, fill: "rgba(31,190,122,0.5)" }}
                  axisLine={false} tickLine={false} width={40}
                  label={{ value: "Physical", angle: -90, position: "insideRight", fill: "rgba(31,190,122,0.5)", fontSize: 9, fontWeight: 600, offset: 10 }} />
              )}
              <Tooltip content={<CampaignTooltip territory={territory} hasPhysical={hasPhysical} />} cursor={{ stroke: INK_20, strokeDasharray: "4 4" }} />

              {/* Phase backgrounds */}
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

              {/* Pinned / highlighted moment — bold solid red line */}
              {pinnedDate && <ReferenceLine x={pinnedDate} yAxisId="s" stroke="#FF4A1C" strokeWidth={3} strokeOpacity={1}
                label={{ value: "◆", position: "top", fill: "#FF4A1C", fontSize: 14, fontWeight: 900, offset: 6 }} />}
              {highlightedDate && !pinnedDate && <ReferenceLine x={highlightedDate} yAxisId="s" stroke="#0E0E0E" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.3} />}

              {/* Key moment markers — colour-coded dashed lines with top labels */}
              {momentLayout.map((m, i) => (
                <ReferenceLine key={`m${i}`} x={m.date} yAxisId="s"
                  stroke={m.color} strokeDasharray="3 5" strokeWidth={1.5} strokeOpacity={0.4}
                  label={{
                    value: m.label,
                    position: "insideTopLeft",
                    fill: m.color,
                    fontSize: 8,
                    fontWeight: 700,
                    offset: 4 + (m.tier * 12),
                  }}
                />
              ))}

              {/* Physical bars — peak bar is bolder, minor bars are subtler */}
              {hasPhysical && (
                <Bar yAxisId="p" dataKey="physical_units" barSize={16} name="Physical" isAnimationActive={false}
                  shape={(props: any) => {
                    const { x, y, width, height, value } = props;
                    if (!value || value <= 0 || !height || height <= 0) return <g />;
                    const isPeak = value === physicalPeak;
                    const fo = isPeak ? 0.55 : 0.3;
                    const so = isPeak ? 0.9 : 0.6;
                    const sw = isPeak ? 2 : 1;
                    const r = 3;
                    // Rounded top rect
                    const d = `M${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} L${x},${y + height} Z`;
                    return <path d={d} fill={PHYSICAL_COLOR} fillOpacity={fo} stroke={PHYSICAL_COLOR} strokeOpacity={so} strokeWidth={sw} />;
                  }}
                />
              )}

              {/* Stream line + fill */}
              <Area yAxisId="s" type="monotone" dataKey="total_streams" fill={STREAM_FILL} stroke="none" />
              <Line yAxisId="s" type="monotone" dataKey="total_streams"
                stroke={STREAM_COLOR} strokeWidth={3.5}
                dot={isSparse ? { r: 5, fill: STREAM_COLOR, stroke: "#FAF7F2", strokeWidth: 2 } : false}
                activeDot={{ r: 6, fill: STREAM_COLOR, stroke: "#FAF7F2", strokeWidth: 2 }}
                name="Streams" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═════ TRACKS MODE — 2-3 key role lines ═════ */}
      {!isCampaign && (
        <div className="w-full h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <XAxis dataKey="date" tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: INK_50, fontWeight: 500 }}
                axisLine={{ stroke: INK_20 }} tickLine={false} dy={10}
                interval="preserveStartEnd" />
              <YAxis tickFormatter={fmt}
                tick={{ fontSize: 10, fill: INK_50 }}
                axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<TracksTooltip keyTracks={keyTracks} />} cursor={{ stroke: INK_20, strokeDasharray: "4 4" }} />

              {phases && phases.first < phases.albumDate && (
                <ReferenceArea x1={phases.first} x2={phases.albumDate} fill={PHASE_PRE}
                  label={{ value: "PRE-RELEASE", position: "insideTopLeft", fill: INK_50, fontSize: 9, fontWeight: 700 }} />
              )}
              {phases && (
                <ReferenceArea x1={phases.albumDate} x2={phases.postStart} fill={PHASE_RELEASE}
                  label={{ value: "RELEASE", position: "insideTop", fill: "#FF4A1C", fontSize: 9, fontWeight: 700 }} />
              )}
              {phases && (
                <ReferenceArea x1={phases.postStart} x2={phases.last} fill={PHASE_POST}
                  label={{ value: "POST-RELEASE", position: "insideTopRight", fill: INK_50, fontSize: 9, fontWeight: 700 }} />
              )}

              {albumDate && <ReferenceLine x={albumDate} stroke="#FF4A1C" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.5} />}
              {pinnedDate && <ReferenceLine x={pinnedDate} stroke="#FF4A1C" strokeWidth={3} strokeOpacity={1}
                label={{ value: "◆", position: "top", fill: "#FF4A1C", fontSize: 14, fontWeight: 900, offset: 6 }} />}

              {keyTracks.map(t => (
                <Line key={t.name} type="monotone" dataKey={t.name}
                  stroke={t.color} strokeWidth={2.5} strokeOpacity={0.9}
                  dot={isSparse ? { r: 4, fill: t.color, stroke: "#FAF7F2", strokeWidth: 2 } : false}
                  activeDot={{ r: 5, fill: t.color, stroke: "#FAF7F2", strokeWidth: 2 }}
                  connectNulls={false} name={t.name} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Minimal legend — tracks mode only */}
      {!isCampaign && keyTracks.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-5 mt-4">
          {keyTracks.map(t => (
            <div key={t.name} className="flex items-center gap-2">
              <span className="w-4 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="text-[11px] text-ink/60">{t.name}</span>
              <span className="text-[9px] text-ink/30">{t.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
