"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea,
} from "recharts";
import { ChartDataPoint, Moment } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import { TrackWithRole, HandoverMoment, NormalizedPoint, getTrackRoleLabel } from "@/lib/transforms";

const TOTAL_COLOR = "#6C9EFF";
const PHYSICAL_COLOR = "#4ADE80";

function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function formatFullDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function truncLabel(t: string, m: number = 16): string {
  if (t.length <= m) return t;
  const c = t.slice(0, m - 1); const s = c.lastIndexOf(" ");
  return (s > m * 0.4 ? c.slice(0, s) : c) + "\u2026";
}

export type ChartMode = "campaign" | "tracks";
export type MetricMode = "streams" | "relative";

interface TimelineChartProps {
  data: ChartDataPoint[];
  normalizedData: NormalizedPoint[];
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
}

// ——— Tooltips ———
function CampaignTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const events = dp.events || [];
  const prev = dp.prev_week_streams;
  const wow = prev != null && prev > 0 && dp.total_streams > 0 ? ((dp.total_streams - prev) / prev) * 100 : null;
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-3 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? formatFullDate(label) : ""}</p>
      {dp.total_streams > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#9CA3AF]">Total Streams</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.total_streams)}</span>
            {wow != null && <span className={`text-[10px] font-semibold ${wow >= 0 ? "text-emerald-400" : "text-red-400"}`}>{wow >= 0 ? "+" : ""}{wow.toFixed(0)}%</span>}
          </div>
        </div>
      )}
      {dp.physical_units > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#9CA3AF]">Physical</span>
          <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.physical_units)}</span>
        </div>
      )}
      {events.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#2A2D3E]">
          {events.map((m: Moment, i: number) => {
            const cat = getCategoryConfig(m.moment_type);
            return (<div key={i} className="mb-1 last:mb-0 flex items-center gap-1.5">
              <span style={{ color: cat.color }} className="text-xs">{cat.icon}</span>
              <span className="text-[11px] font-medium text-white">{m.moment_title}</span>
            </div>);
          })}
        </div>
      )}
    </div>
  );
}

function TracksTip({ active, payload, label, trackRoles, isRelative }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-3 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? formatFullDate(label) : ""}</p>
      {(trackRoles as TrackWithRole[])
        .filter(tr => dp[tr.track_name] != null)
        .sort((a: TrackWithRole, b: TrackWithRole) => b.strokeWidth - a.strokeWidth)
        .map((tr: TrackWithRole, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tr.color }} />
              <span className="text-xs text-[#9CA3AF]">{tr.track_name}</span>
            </div>
            <span className="text-xs font-semibold text-white tabular-nums">
              {isRelative ? `${dp[tr.track_name]}%` : fmt(dp[tr.track_name] as number)}
            </span>
          </div>
        ))}
    </div>
  );
}


// ——— Moment labels ———
interface MM { date: string; label: string; color: string; row: number; }
function layoutMoments(data: ChartDataPoint[], vis: Set<string>): MM[] {
  const byDate = new Map<string, { date: string; label: string; color: string; p: number }>();
  const pm: Record<string, number> = { music: 5, live: 4, editorial: 3, marketing: 2, product: 1 };
  data.forEach((d) => {
    if (d.events.length > 0) {
      const ke = d.events.filter((e) => e.is_key && vis.has(e.date));
      if (ke.length > 0) {
        let best = ke[0], bp = 0;
        for (const e of ke) { const cat = getCategoryConfig(e.moment_type); const p = pm[cat.label.toLowerCase()] || 1; if (p > bp) { bp = p; best = e; } }
        const cat = getCategoryConfig(best.moment_type);
        const ex = byDate.get(d.date);
        if (!ex || bp > ex.p) byDate.set(d.date, { date: d.date, label: truncLabel(best.moment_title, 18), color: cat.color, p: bp });
      }
    }
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7)
    .map((m, i) => ({ date: m.date, label: m.label, color: m.color, row: i % 2 }));
}

// ——— Phase boundaries ———
function getPhases(data: ChartDataPoint[], albumDate?: string) {
  if (!albumDate) return null;
  const dates = data.map(d => d.date).filter(d => d).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  // Find first post-album date in data
  const postDates = dates.filter(d => d > albumDate);
  const firstPostDate = postDates.length > 1 ? postDates[1] : postDates[0] || lastDate;
  return { firstDate, albumDate, firstPostDate, lastDate };
}

// ——— Main Component ———
export default function TimelineChart({
  data, normalizedData, selectedTracks, trackRoles, visibleEventDates,
  highlightedDate, handoverMoment, chartInsight, trackModeContext,
  chartMode, onChartModeChange, albumDate,
}: TimelineChartProps) {
  const [metricMode, setMetricMode] = useState<MetricMode>("streams");

  const momentMarkers = useMemo(() => layoutMoments(data, visibleEventDates), [data, visibleEventDates]);
  const hasPhysical = useMemo(() => data.some((d) => d.physical_units > 0), [data]);
  const isCampaign = chartMode === "campaign";
  const isRelative = metricMode === "relative";
  const phases = useMemo(() => getPhases(data, albumDate), [data, albumDate]);

  // In tracks+streams mode, use the raw chart data (which has track values)
  // In tracks+relative mode, use normalized data
  const tracksChartData = isRelative ? normalizedData : data;

  return (
    <div className="w-full">
      {/* Toggle bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* Campaign / Tracks */}
          <div className="flex items-center gap-0.5 bg-[#0D1117] rounded-lg p-0.5 border border-[#1E2130]">
            <button onClick={() => { onChartModeChange("campaign"); setMetricMode("streams"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Campaign</button>
            <button onClick={() => onChartModeChange("tracks")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Tracks</button>
          </div>
          {/* Streams / Relative (only in tracks mode) */}
          {!isCampaign && (
            <div className="flex items-center gap-0.5 bg-[#0D1117] rounded-lg p-0.5 border border-[#1E2130]">
              <button onClick={() => setMetricMode("streams")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!isRelative ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Streams</button>
              <button onClick={() => setMetricMode("relative")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isRelative ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Relative</button>
            </div>
          )}
        </div>
        <span className="text-[10px] text-[#4B5563] max-w-[420px] text-right">
          {isCampaign ? "Overall campaign performance" : (isRelative ? "Each track normalized to its own peak (0\u2013100%)" : (trackModeContext || "Real stream values per track"))}
        </span>
      </div>

      {/* Moment labels (campaign mode) */}
      {isCampaign && momentMarkers.length > 0 && (
        <div className="relative w-full mb-1" style={{ height: 44 }}>
          <div className="absolute inset-0 flex items-end">
            {momentMarkers.map((m, i) => {
              const dates = data.map(d => d.date).sort();
              const idx = dates.indexOf(m.date);
              const pct = dates.length > 1 ? (idx / (dates.length - 1)) * 100 : 50;
              return (
                <div key={i} className="absolute flex flex-col items-center"
                  style={{ left: `${4 + pct * 0.88}%`, bottom: m.row === 0 ? 20 : 2, transform: "translateX(-50%)" }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap px-1" style={{ color: m.color }}>{m.label}</span>
                  <div className="w-px h-1.5 mt-0.5" style={{ backgroundColor: m.color, opacity: 0.4 }} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#1E2130" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis yAxisId="streams" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
              {hasPhysical && <YAxis yAxisId="physical" orientation="right" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />}
              <Tooltip content={<CampaignTip />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
              {highlightedDate && <ReferenceLine x={highlightedDate} yAxisId="streams" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />}
              {momentMarkers.map((m, i) => (
                <ReferenceLine key={`mk-${i}`} x={m.date} yAxisId="streams" stroke={m.color} strokeDasharray="3 4" strokeWidth={1.5} strokeOpacity={0.5} />
              ))}
              <Area yAxisId="streams" type="monotone" dataKey="total_streams" fill={`${TOTAL_COLOR}15`} stroke="none" />
              <Line yAxisId="streams" type="monotone" dataKey="total_streams" stroke={TOTAL_COLOR} strokeWidth={3} dot={false}
                activeDot={{ r: 5, fill: TOTAL_COLOR, stroke: "#0D1117", strokeWidth: 2 }} name="Total Streams" />
              {selectedTracks.map((track) => {
                const role = trackRoles.find(r => r.track_name === track);
                return <Line key={track} yAxisId="streams" type="monotone" dataKey={track}
                  stroke={role?.color ?? "#4B5563"} strokeWidth={1} strokeOpacity={0.25}
                  dot={false} activeDot={false} connectNulls={false} name={track} />;
              })}
              {hasPhysical && <Bar yAxisId="physical" dataKey="physical_units" fill={`${PHYSICAL_COLOR}35`} stroke={PHYSICAL_COLOR} strokeWidth={1} radius={[3, 3, 0, 0]} name="Physical" barSize={18} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ========= TRACKS MODE ========= */}
      {!isCampaign && (
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={tracksChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#1E2130" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis tickFormatter={isRelative ? (v: number) => `${v}%` : fmt}
                domain={isRelative ? [0, 100] : undefined}
                tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={isRelative ? 40 : 50} />
              <Tooltip content={<TracksTip trackRoles={trackRoles} isRelative={isRelative} />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
              {highlightedDate && <ReferenceLine x={highlightedDate} stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />}

              {/* Phase background markers */}
              {phases && (
                <>
                  <ReferenceArea x1={phases.firstDate} x2={phases.albumDate} fill="#6B728008" />
                  <ReferenceArea x1={phases.albumDate} x2={phases.firstPostDate} fill="#6C9EFF08" />
                  <ReferenceArea x1={phases.firstPostDate} x2={phases.lastDate} fill="#FBBF2408" />
                </>
              )}

              {/* Album release line */}
              {albumDate && (
                <ReferenceLine x={albumDate} stroke="#6B7280" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.5}
                  label={{ value: "Album Release", position: "insideTopLeft", fill: "#6B7280", fontSize: 9, fontWeight: 600, offset: 8 }} />
              )}

              {/* DJH handover marker */}
              {handoverMoment && (
                <ReferenceLine x={handoverMoment.date} stroke="#FBBF24" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.7}
                  label={{ value: "Post-release single", position: "insideTopRight", fill: "#FBBF24", fontSize: 9, fontWeight: 700, offset: 8 }} />
              )}

              {/* Track lines with role hierarchy */}
              {selectedTracks.map((track) => {
                const role = trackRoles.find(r => r.track_name === track);
                const sw = role?.strokeWidth ?? 1.5;
                const op = role?.opacity ?? 0.5;
                const col = role?.color ?? "#6B7280";
                const isBreakout = role?.role === "POST_RELEASE_BREAKOUT";
                return <Line key={track} type="monotone" dataKey={track}
                  stroke={col} strokeWidth={isBreakout ? 4 : sw} strokeOpacity={op}
                  dot={false}
                  activeDot={op > 0.5 ? { r: isBreakout ? 6 : 3, fill: col, stroke: "#0D1117", strokeWidth: 2 } : false}
                  connectNulls={false} name={track} />;
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insight */}
      {isCampaign && chartInsight && (
        <p className="text-[11px] text-[#9CA3AF] italic text-center mt-2">{chartInsight}</p>
      )}

      {/* Phase labels (tracks mode) */}
      {!isCampaign && phases && (
        <div className="flex items-center justify-center gap-6 mt-1 mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280]">Pre-release</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#6C9EFF]">Album Week</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#FBBF24]">Post-release</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        {isCampaign && <LI color={TOTAL_COLOR} label="Total Streams" type="line" bold />}
        {trackRoles
          .filter(tr => selectedTracks.includes(tr.track_name))
          .sort((a, b) => b.strokeWidth - a.strokeWidth)
          .map((tr) => (
            <LI key={tr.track_name} color={tr.color}
              label={isCampaign ? tr.track_name : `${getTrackRoleLabel(tr.role)} — ${tr.track_name}`}
              type="line" opacity={isCampaign ? 0.25 : tr.opacity}
              bold={!isCampaign && tr.role === "POST_RELEASE_BREAKOUT"} />
          ))}
        {isCampaign && hasPhysical && <LI color={PHYSICAL_COLOR} label="Physical" type="bar" />}
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
