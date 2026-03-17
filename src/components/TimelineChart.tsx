"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { ChartDataPoint, Moment } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";

const TOTAL_COLOR = "#6C9EFF";
const PHYSICAL_COLOR = "#4ADE80";
const TRACK_COLORS = ["#FBBF24", "#F472B6", "#22D3EE", "#A78BFA", "#FB7185", "#F97316"];

function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Aggressive label truncation for chart markers
function truncLabel(title: string, max: number = 16): string {
  if (title.length <= max) return title;
  // Try to cut at a word boundary
  const cut = title.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.4 ? cut.slice(0, lastSpace) : cut) + "\u2026";
}

interface TimelineChartProps {
  data: ChartDataPoint[];
  selectedTracks: string[];
  visibleEventDates: Set<string>;
  highlightedDate: string | null;
  streamView?: "total" | "by_track";
  trackData?: ChartDataPoint[] | null;
  trackName?: string;
  totalCampaignData?: ChartDataPoint[];
}

interface TooltipPayloadEntry {
  name: string; value: number | null; color: string; dataKey: string; payload: ChartDataPoint;
}

function CustomTooltip({ active, payload, label, streamView, trackName }: {
  active?: boolean; payload?: TooltipPayloadEntry[]; label?: string;
  streamView?: "total" | "by_track"; trackName?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;

  const events = dp.events || [];
  const isByTrack = streamView === "by_track";
  const mainStreams = isByTrack ? ((dp.track_streams as number) || 0) : dp.total_streams;
  const prevStreams = dp.prev_week_streams;
  const wowChange = prevStreams !== null && prevStreams > 0
    ? ((mainStreams - prevStreams) / prevStreams) * 100 : null;

  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-4 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? formatFullDate(label) : ""}</p>
      {mainStreams > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TOTAL_COLOR }} />
            <span className="text-xs text-[#9CA3AF]">{isByTrack ? trackName || "Track" : "Weekly Streams"}</span>
          </div>
          <span className="text-xs font-semibold text-white tabular-nums">{fmt(mainStreams)}</span>
        </div>
      )}
      {wowChange !== null && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#6B7280] ml-4">vs Last Week</span>
          <span className={`text-xs font-semibold tabular-nums ${wowChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {wowChange >= 0 ? "+" : ""}{wowChange.toFixed(1)}%
          </span>
        </div>
      )}
      {dp.cumulative_streams > 0 && !isByTrack && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#6B7280] ml-4">Campaign Total</span>
          <span className="text-xs font-medium text-[#9CA3AF] tabular-nums">{fmt(dp.cumulative_streams)}</span>
        </div>
      )}
      {!isByTrack && payload.filter((e) => e.dataKey !== "total_streams" && e.dataKey !== "physical_units" && e.value != null)
        .map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-[#9CA3AF] truncate max-w-[120px]">{entry.dataKey}</span>
            </div>
            <span className="text-xs font-semibold text-white tabular-nums">{fmt(entry.value as number)}</span>
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
                {m.is_key && <span className="text-[7px] font-bold uppercase px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">KEY</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ——— Moment marker layout: stagger to avoid collision, max 7 ———
interface MomentMarker {
  date: string;
  label: string;
  color: string;
  row: number; // 0 = top row, 1 = staggered row
}

function layoutMomentMarkers(data: ChartDataPoint[], visibleDates: Set<string>): MomentMarker[] {
  // Collect key moments — dedupe by date (pick highest priority per date)
  const byDate = new Map<string, { date: string; label: string; color: string; priority: number }>();
  const priorityMap: Record<string, number> = { music: 5, live: 4, editorial: 3, marketing: 2, product: 1 };

  data.forEach((d) => {
    if (d.events.length > 0) {
      const keyEvents = d.events.filter((e) => e.is_key && visibleDates.has(e.date));
      if (keyEvents.length > 0) {
        // Pick the highest-priority event for this date
        let bestEvent = keyEvents[0];
        let bestPriority = 0;
        for (const e of keyEvents) {
          const cat = getCategoryConfig(e.moment_type);
          const p = priorityMap[cat.label.toLowerCase()] || 1;
          if (p > bestPriority) { bestPriority = p; bestEvent = e; }
        }
        const cat = getCategoryConfig(bestEvent.moment_type);
        const existing = byDate.get(d.date);
        if (!existing || bestPriority > existing.priority) {
          byDate.set(d.date, {
            date: d.date,
            label: truncLabel(bestEvent.moment_title, 18),
            color: cat.color,
            priority: bestPriority,
          });
        }
      }
    }
  });

  // Sort by date, cap at 7
  const deduped = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const capped = deduped.slice(0, 7);

  // Stagger: alternate row 0 and 1 for adjacent markers
  return capped.map((m, i) => ({
    date: m.date,
    label: m.label,
    color: m.color,
    row: i % 2,
  }));
}

export default function TimelineChart({
  data, selectedTracks, visibleEventDates, highlightedDate,
  streamView = "total", trackData, trackName,
}: TimelineChartProps) {
  const isByTrack = streamView === "by_track" && trackData;
  const chartSource = isByTrack ? trackData! : data;

  // Build moment markers with stagger layout
  const momentMarkers = useMemo(
    () => layoutMomentMarkers(chartSource, visibleEventDates),
    [chartSource, visibleEventDates]
  );

  const hasPhysical = useMemo(
    () => chartSource.some((d) => d.physical_units > 0),
    [chartSource]
  );

  return (
    <div className="w-full">
      {/* ——— K Trap-style moment labels above chart ——— */}
      {momentMarkers.length > 0 && (
        <div className="relative w-full mb-1" style={{ height: 44 }}>
          {/* We position labels using approximate % across chart width */}
          {/* Chart left margin ~55px, right ~60px on ~full width */}
          <div className="absolute inset-0 flex items-end">
            {momentMarkers.map((m, i) => {
              // Calculate approximate horizontal position
              const dates = chartSource.map((d) => d.date).sort();
              const dateIdx = dates.indexOf(m.date);
              const pct = dates.length > 1 ? (dateIdx / (dates.length - 1)) * 100 : 50;
              // Offset to account for chart margins
              const leftPct = 4 + pct * 0.88; // ~4% left margin, ~88% chart area

              return (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${leftPct}%`,
                    bottom: m.row === 0 ? 20 : 2,
                    transform: "translateX(-50%)",
                  }}
                >
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap px-1"
                    style={{ color: m.color }}
                  >
                    {m.label}
                  </span>
                  <div className="w-px h-1.5 mt-0.5" style={{ backgroundColor: m.color, opacity: 0.4 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ——— Main Chart ——— */}
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartSource}
            margin={{ top: 8, right: hasPhysical ? 60 : 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
            <XAxis
              dataKey="date" tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: "#4B5563" }}
              axisLine={{ stroke: "#1E2130" }} tickLine={false} dy={8}
              interval="preserveStartEnd"
            />
            <YAxis yAxisId="streams" tickFormatter={fmt}
              tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50}
            />
            {hasPhysical && (
              <YAxis yAxisId="physical" orientation="right" tickFormatter={fmt}
                tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50}
              />
            )}
            <Tooltip
              content={<CustomTooltip streamView={streamView} trackName={trackName} />}
              cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }}
            />

            {/* Highlighted date from moments list hover */}
            {highlightedDate && (
              <ReferenceLine x={highlightedDate} yAxisId="streams" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />
            )}

            {/* Key moment vertical dotted lines — visible, colored */}
            {momentMarkers.map((m, i) => (
              <ReferenceLine
                key={`mk-${i}`} x={m.date} yAxisId="streams"
                stroke={m.color} strokeDasharray="3 4" strokeWidth={1.5} strokeOpacity={0.6}
              />
            ))}

            {/* Total Campaign mode */}
            {!isByTrack && (
              <Area yAxisId="streams" type="monotone" dataKey="total_streams"
                fill={`${TOTAL_COLOR}12`} stroke="none" />
            )}
            {!isByTrack && (
              <Line yAxisId="streams" type="monotone" dataKey="total_streams"
                stroke={TOTAL_COLOR} strokeWidth={2.5} dot={false}
                activeDot={{ r: 5, fill: TOTAL_COLOR, stroke: "#0D1117", strokeWidth: 2 }}
                name="Total Streams" />
            )}
            {!isByTrack && selectedTracks.map((track, i) => (
              <Line key={track} yAxisId="streams" type="monotone" dataKey={track}
                stroke={TRACK_COLORS[i % TRACK_COLORS.length]} strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: TRACK_COLORS[i % TRACK_COLORS.length] }}
                connectNulls={false} name={track} />
            ))}

            {/* By Track mode */}
            {isByTrack && (
              <Line yAxisId="streams" type="monotone" dataKey="total_streams"
                stroke={TOTAL_COLOR} strokeWidth={1.5} strokeOpacity={0.2}
                dot={false} activeDot={false} name="Total Campaign" />
            )}
            {isByTrack && (
              <Line yAxisId="streams" type="monotone" dataKey="track_streams"
                stroke={TOTAL_COLOR} strokeWidth={2.5} dot={false}
                activeDot={{ r: 4, fill: TOTAL_COLOR }} name={trackName || "Track"} />
            )}

            {/* Physical bars */}
            {hasPhysical && (
              <Bar yAxisId="physical" dataKey="physical_units"
                fill={`${PHYSICAL_COLOR}35`} stroke={PHYSICAL_COLOR} strokeWidth={1}
                radius={[3, 3, 0, 0]} name="Physical Units" barSize={18} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        {!isByTrack && (
          <>
            <LegendItem color={TOTAL_COLOR} label="Total Streams" type="line" />
            {selectedTracks.map((track, i) => (
              <LegendItem key={track} color={TRACK_COLORS[i % TRACK_COLORS.length]} label={track} type="line" />
            ))}
          </>
        )}
        {isByTrack && (
          <>
            <LegendItem color={TOTAL_COLOR} label={trackName || "Track"} type="line" />
            <LegendItem color={TOTAL_COLOR} label="Total Campaign" type="line" opacity={0.2} />
          </>
        )}
        {hasPhysical && <LegendItem color={PHYSICAL_COLOR} label="Physical" type="bar" />}
      </div>
    </div>
  );
}

function LegendItem({ color, label, type, opacity = 1 }: { color: string; label: string; type: "line" | "bar"; opacity?: number }) {
  return (
    <div className="flex items-center gap-1.5" style={{ opacity }}>
      {type === "line" ? (
        <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: color }} />
      ) : (
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: `${color}40`, border: `1px solid ${color}` }} />
      )}
      <span className="text-[10px] text-[#6B7280]">{label}</span>
    </div>
  );
}
