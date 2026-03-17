"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { ChartDataPoint, Moment } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import { TrackWithRole, HandoverMoment } from "@/lib/transforms";

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

interface TimelineChartProps {
  data: ChartDataPoint[];
  selectedTracks: string[];
  trackRoles: TrackWithRole[];
  visibleEventDates: Set<string>;
  highlightedDate: string | null;
  handoverMoment?: HandoverMoment | null;
  chartInsight?: string | null;
}

// ——— Tooltip ————————————————————————————————————————————————
function CustomTooltip({ active, payload, label, trackRoles }: {
  active?: boolean; payload?: any[]; label?: string; trackRoles: TrackWithRole[];
}) {
  if (!active || !payload || !payload.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const events = dp.events || [];

  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-4 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? formatFullDate(label) : ""}</p>
      {dp.total_streams > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TOTAL_COLOR }} />
            <span className="text-xs text-[#9CA3AF]">Total Streams</span>
          </div>
          <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.total_streams)}</span>
        </div>
      )}
      {/* Track values — ordered by role */}
      {trackRoles
        .filter(tr => dp[tr.track_name] != null && dp[tr.track_name] > 0)
        .sort((a,b) => b.strokeWidth - a.strokeWidth)
        .map((tr, i) => (
          <div key={i} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tr.color }} />
              <span className="text-xs text-[#9CA3AF] truncate max-w-[120px]">{tr.track_name}</span>
              {tr.role === "POST_RELEASE_BREAKOUT" && (
                <span className="text-[7px] font-bold uppercase px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">BREAKOUT</span>
              )}
            </div>
            <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp[tr.track_name] as number)}</span>
          </div>
        ))}
      {dp.physical_units > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHYSICAL_COLOR }} />
            <span className="text-xs text-[#9CA3AF]">Physical</span>
          </div>
          <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.physical_units)}</span>
        </div>
      )}
      {events.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#2A2D3E]">
          {events.map((m: Moment, i: number) => {
            const cat = getCategoryConfig(m.moment_type);
            return (
              <div key={i} className="mb-1.5 last:mb-0 flex items-center gap-1.5">
                <span style={{ color: cat.color }} className="text-xs">{cat.icon}</span>
                <span className="text-xs font-medium text-white">{m.moment_title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ——— Moment label layout ————————————————————————————————————
interface MomentMarker { date: string; label: string; color: string; row: number; }

function layoutMomentMarkers(data: ChartDataPoint[], visibleDates: Set<string>): MomentMarker[] {
  const byDate = new Map<string, { date: string; label: string; color: string; priority: number }>();
  const priorityMap: Record<string, number> = { music: 5, live: 4, editorial: 3, marketing: 2, product: 1 };
  data.forEach((d) => {
    if (d.events.length > 0) {
      const keyEvents = d.events.filter((e) => e.is_key && visibleDates.has(e.date));
      if (keyEvents.length > 0) {
        let bestEvent = keyEvents[0], bestP = 0;
        for (const e of keyEvents) {
          const cat = getCategoryConfig(e.moment_type);
          const p = priorityMap[cat.label.toLowerCase()] || 1;
          if (p > bestP) { bestP = p; bestEvent = e; }
        }
        const cat = getCategoryConfig(bestEvent.moment_type);
        const existing = byDate.get(d.date);
        if (!existing || bestP > existing.priority) {
          byDate.set(d.date, { date: d.date, label: truncLabel(bestEvent.moment_title, 18), color: cat.color, priority: bestP });
        }
      }
    }
  });
  const deduped = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  return deduped.map((m, i) => ({ date: m.date, label: m.label, color: m.color, row: i % 2 }));
}

// ——— Main Chart ————————————————————————————————————————————
export default function TimelineChart({
  data, selectedTracks, trackRoles, visibleEventDates,
  highlightedDate, handoverMoment, chartInsight,
}: TimelineChartProps) {

  const momentMarkers = useMemo(() => layoutMomentMarkers(data, visibleEventDates), [data, visibleEventDates]);
  const hasPhysical = useMemo(() => data.some((d) => d.physical_units > 0), [data]);

  // Build role lookup for selected tracks
  const roleMap = useMemo(() => {
    const map = new Map<string, TrackWithRole>();
    trackRoles.forEach(r => map.set(r.track_name, r));
    return map;
  }, [trackRoles]);

  return (
    <div className="w-full">
      {/* Moment labels above chart */}
      {momentMarkers.length > 0 && (
        <div className="relative w-full mb-1" style={{ height: 44 }}>
          <div className="absolute inset-0 flex items-end">
            {momentMarkers.map((m, i) => {
              const dates = data.map((d) => d.date).sort();
              const dateIdx = dates.indexOf(m.date);
              const pct = dates.length > 1 ? (dateIdx / (dates.length - 1)) * 100 : 50;
              const leftPct = 4 + pct * 0.88;
              return (
                <div key={i} className="absolute flex flex-col items-center"
                  style={{ left: `${leftPct}%`, bottom: m.row === 0 ? 20 : 2, transform: "translateX(-50%)" }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap px-1"
                    style={{ color: m.color }}>{m.label}</span>
                  <div className="w-px h-1.5 mt-0.5" style={{ backgroundColor: m.color, opacity: 0.4 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: hasPhysical ? 60 : 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#1E2130" }}
              tickLine={false} dy={8} interval="preserveStartEnd" />
            <YAxis yAxisId="streams" tickFormatter={fmt}
              tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
            {hasPhysical && (
              <YAxis yAxisId="physical" orientation="right" tickFormatter={fmt}
                tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
            )}
            <Tooltip content={<CustomTooltip trackRoles={trackRoles} />}
              cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />

            {/* Highlighted date */}
            {highlightedDate && (
              <ReferenceLine x={highlightedDate} yAxisId="streams" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />
            )}

            {/* Key moment vertical lines */}
            {momentMarkers.map((m, i) => (
              <ReferenceLine key={`mk-${i}`} x={m.date} yAxisId="streams"
                stroke={m.color} strokeDasharray="3 4" strokeWidth={1.5} strokeOpacity={0.5} />
            ))}

            {/* HANDOVER MARKER — "Post-release single" */}
            {handoverMoment && (
              <ReferenceLine x={handoverMoment.date} yAxisId="streams"
                stroke="#FBBF24" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.8}
                label={{ value: handoverMoment.label, position: "insideTopRight",
                  fill: "#FBBF24", fontSize: 10, fontWeight: 700, offset: 8 }} />
            )}

            {/* Total streams area + line */}
            <Area yAxisId="streams" type="monotone" dataKey="total_streams"
              fill={`${TOTAL_COLOR}08`} stroke="none" />
            <Line yAxisId="streams" type="monotone" dataKey="total_streams"
              stroke={TOTAL_COLOR} strokeWidth={2} dot={false}
              activeDot={{ r: 4, fill: TOTAL_COLOR, stroke: "#0D1117", strokeWidth: 2 }}
              name="Total Streams" />

            {/* Track lines — rendered with narrative role hierarchy */}
            {selectedTracks.map((track) => {
              const role = roleMap.get(track);
              const sw = role?.strokeWidth ?? 1.5;
              const op = role?.opacity ?? 0.5;
              const col = role?.color ?? "#6B7280";
              return (
                <Line key={track} yAxisId="streams" type="monotone" dataKey={track}
                  stroke={col} strokeWidth={sw} strokeOpacity={op}
                  dot={false}
                  activeDot={op > 0.5 ? { r: sw > 2 ? 5 : 3, fill: col, stroke: "#0D1117", strokeWidth: 2 } : false}
                  connectNulls={false} name={track} />
              );
            })}

            {/* Physical bars */}
            {hasPhysical && (
              <Bar yAxisId="physical" dataKey="physical_units"
                fill={`${PHYSICAL_COLOR}35`} stroke={PHYSICAL_COLOR} strokeWidth={1}
                radius={[3, 3, 0, 0]} name="Physical" barSize={18} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Inline insight */}
      {chartInsight && (
        <p className="text-[11px] text-[#9CA3AF] italic text-center mt-2">{chartInsight}</p>
      )}

      {/* Legend with role indicators */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        <LegendItem color={TOTAL_COLOR} label="Total Streams" type="line" />
        {trackRoles
          .filter(tr => selectedTracks.includes(tr.track_name))
          .sort((a, b) => b.strokeWidth - a.strokeWidth)
          .map((tr) => (
            <LegendItem key={tr.track_name} color={tr.color} label={tr.track_name} type="line"
              opacity={tr.opacity} bold={tr.role === "POST_RELEASE_BREAKOUT"} />
          ))}
        {hasPhysical && <LegendItem color={PHYSICAL_COLOR} label="Physical" type="bar" />}
      </div>
    </div>
  );
}

function LegendItem({ color, label, type, opacity = 1, bold = false }: {
  color: string; label: string; type: "line" | "bar"; opacity?: number; bold?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" style={{ opacity }}>
      {type === "line" ? (
        <span className={`inline-block rounded-full ${bold ? "w-4 h-1" : "w-3 h-0.5"}`} style={{ backgroundColor: color }} />
      ) : (
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: `${color}40`, border: `1px solid ${color}` }} />
      )}
      <span className={`text-[10px] ${bold ? "text-white font-semibold" : "text-[#6B7280]"}`}>{label}</span>
    </div>
  );
}
