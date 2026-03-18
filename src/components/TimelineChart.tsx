"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { ChartDataPoint, Moment } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import {
  TrackWithRole, HandoverMoment, NormalizedPoint,
  getTrackRoleLabel,
} from "@/lib/transforms";

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
function truncLabel(title: string, max: number = 16): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.4 ? cut.slice(0, sp) : cut) + "\u2026";
}

export type ChartMode = "campaign" | "tracks";

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
}

// Tooltip for campaign mode
function CampaignTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const events = dp.events || [];
  const prev = dp.prev_week_streams;
  const wow = prev != null && prev > 0 && dp.total_streams > 0
    ? ((dp.total_streams - prev) / prev) * 100 : null;
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

// Tooltip for tracks mode (normalized %)
function TracksTooltip({ active, payload, label, trackRoles }: { active?: boolean; payload?: any[]; label?: string; trackRoles: TrackWithRole[] }) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const roleMap = new Map(trackRoles.map(r => [r.track_name, r]));
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-3 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? formatFullDate(label) : ""}</p>
      {trackRoles
        .filter(tr => dp[tr.track_name] != null)
        .sort((a, b) => b.strokeWidth - a.strokeWidth)
        .map((tr, i) => {
          const val = dp[tr.track_name] as number;
          return (
            <div key={i} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tr.color }} />
                <span className="text-xs text-[#9CA3AF]">{tr.track_name}</span>
              </div>
              <span className="text-xs font-semibold text-white tabular-nums">{val}%</span>
            </div>
          );
        })}
    </div>
  );
}


interface MomentMarker { date: string; label: string; color: string; row: number; }
function layoutMomentMarkers(data: ChartDataPoint[], visibleDates: Set<string>): MomentMarker[] {
  const byDate = new Map<string, { date: string; label: string; color: string; priority: number }>();
  const pMap: Record<string, number> = { music: 5, live: 4, editorial: 3, marketing: 2, product: 1 };
  data.forEach((d) => {
    if (d.events.length > 0) {
      const keyEvs = d.events.filter((e) => e.is_key && visibleDates.has(e.date));
      if (keyEvs.length > 0) {
        let best = keyEvs[0], bestP = 0;
        for (const e of keyEvs) { const cat = getCategoryConfig(e.moment_type); const p = pMap[cat.label.toLowerCase()] || 1; if (p > bestP) { bestP = p; best = e; } }
        const cat = getCategoryConfig(best.moment_type);
        const ex = byDate.get(d.date);
        if (!ex || bestP > ex.priority) byDate.set(d.date, { date: d.date, label: truncLabel(best.moment_title, 18), color: cat.color, priority: bestP });
      }
    }
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7)
    .map((m, i) => ({ date: m.date, label: m.label, color: m.color, row: i % 2 }));
}

export default function TimelineChart({
  data, normalizedData, selectedTracks, trackRoles, visibleEventDates,
  highlightedDate, handoverMoment, chartInsight, trackModeContext,
  chartMode, onChartModeChange,
}: TimelineChartProps) {
  const momentMarkers = useMemo(() => layoutMomentMarkers(data, visibleEventDates), [data, visibleEventDates]);
  const hasPhysical = useMemo(() => data.some((d) => d.physical_units > 0), [data]);
  const isCampaign = chartMode === "campaign";

  return (
    <div className="w-full">
      {/* Toggle + context */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 bg-[#0D1117] rounded-lg p-0.5 border border-[#1E2130]">
          <button onClick={() => onChartModeChange("campaign")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Campaign</button>
          <button onClick={() => onChartModeChange("tracks")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${!isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Tracks</button>
        </div>
        <span className="text-[10px] text-[#4B5563] max-w-[400px] text-right">
          {isCampaign ? "Overall campaign performance" : (trackModeContext || "Individual track breakdown")}
        </span>
      </div>

      {/* Moment labels */}
      {isCampaign && momentMarkers.length > 0 && (
        <div className="relative w-full mb-1" style={{ height: 44 }}>
          <div className="absolute inset-0 flex items-end">
            {momentMarkers.map((m, i) => {
              const dates = data.map((d) => d.date).sort();
              const dateIdx = dates.indexOf(m.date);
              const pct = dates.length > 1 ? (dateIdx / (dates.length - 1)) * 100 : 50;
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

      {/* ========= CAMPAIGN MODE CHART ========= */}
      {isCampaign && (
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: hasPhysical ? 60 : 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#1E2130" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis yAxisId="streams" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
              {hasPhysical && <YAxis yAxisId="physical" orientation="right" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />}
              <Tooltip content={<CampaignTooltip />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
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

      {/* ========= TRACKS MODE CHART (normalized) ========= */}
      {!isCampaign && (
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={normalizedData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#1E2130" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<TracksTooltip trackRoles={trackRoles} />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
              {highlightedDate && <ReferenceLine x={highlightedDate} stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />}
              {/* Handover annotation */}
              {handoverMoment && (
                <ReferenceLine x={handoverMoment.date} stroke="#FBBF24" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.7}
                  label={{ value: "Post-release single begins", position: "insideTopRight", fill: "#FBBF24", fontSize: 10, fontWeight: 700, offset: 8 }} />
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

      {/* Insight line */}
      {isCampaign && chartInsight && (
        <p className="text-[11px] text-[#9CA3AF] italic text-center mt-2">{chartInsight}</p>
      )}

      {/* Legend with role labels */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
        {isCampaign && <LI color={TOTAL_COLOR} label="Total Streams" type="line" bold />}
        {trackRoles
          .filter(tr => selectedTracks.includes(tr.track_name))
          .sort((a, b) => b.strokeWidth - a.strokeWidth)
          .map((tr) => (
            <LI key={tr.track_name} color={tr.color}
              label={isCampaign ? tr.track_name : `${getTrackRoleLabel(tr.role)} — ${tr.track_name}`}
              type="line"
              opacity={isCampaign ? 0.25 : tr.opacity}
              bold={!isCampaign && tr.role === "POST_RELEASE_BREAKOUT"} />
          ))}
        {isCampaign && hasPhysical && <LI color={PHYSICAL_COLOR} label="Physical" type="bar" />}
        {!isCampaign && <span className="text-[9px] text-[#4B5563] ml-2">Normalized to each track\u2019s peak (0\u2013100%)</span>}
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
