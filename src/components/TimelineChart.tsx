"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { ChartDataPoint, Moment } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";

const TOTAL_COLOR = "#6C9EFF";
const PHYSICAL_COLOR = "#4ADE80";
const TRACK_COLORS = [
  "#FBBF24", "#F472B6", "#22D3EE", "#A78BFA", "#FB7185", "#F97316",
];

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
  name: string;
  value: number | null;
  color: string;
  dataKey: string;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  streamView?: "total" | "by_track";
  trackName?: string;
}

function CustomTooltip({ active, payload, label, streamView, trackName }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const dataPoint = payload[0]?.payload;
  if (!dataPoint) return null;

  const events = dataPoint.events || [];
  const isByTrack = streamView === "by_track";
  const mainStreams = isByTrack ? ((dataPoint.track_streams as number) || 0) : dataPoint.total_streams;
  const prevStreams = dataPoint.prev_week_streams;
  const wowChange = prevStreams !== null && prevStreams > 0
    ? ((mainStreams - prevStreams) / prevStreams) * 100 : null;

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 max-w-xs shadow-lg">
      <p className="text-[11px] font-semibold text-label-muted mb-2">
        {label ? formatFullDate(label) : ""}
      </p>

      {mainStreams > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TOTAL_COLOR }} />
            <span className="text-xs text-label-secondary">
              {isByTrack ? trackName || "Track" : "Weekly Streams"}
            </span>
          </div>
          <span className="text-xs font-semibold text-label-primary tabular-nums">{fmt(mainStreams)}</span>
        </div>
      )}

      {wowChange !== null && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-label-muted ml-4">vs Last Week</span>
          <span className={`text-xs font-semibold tabular-nums ${wowChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {wowChange >= 0 ? "+" : ""}{wowChange.toFixed(1)}%
          </span>
        </div>
      )}

      {isByTrack && dataPoint.total_streams > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full opacity-30" style={{ backgroundColor: TOTAL_COLOR }} />
            <span className="text-xs text-label-muted">Total Campaign</span>
          </div>
          <span className="text-xs font-medium text-label-muted tabular-nums">{fmt(dataPoint.total_streams)}</span>
        </div>
      )}

      {dataPoint.cumulative_streams > 0 && !isByTrack && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-label-muted ml-4">Campaign Total</span>
          <span className="text-xs font-medium text-label-secondary tabular-nums">{fmt(dataPoint.cumulative_streams)}</span>
        </div>
      )}

      {!isByTrack && payload
        .filter((entry) => entry.dataKey !== "total_streams" && entry.dataKey !== "physical_units" && entry.value !== null && entry.value !== undefined)
        .map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-label-secondary truncate max-w-[120px]">{entry.dataKey}</span>
            </div>
            <span className="text-xs font-semibold text-label-primary tabular-nums">{fmt(entry.value as number)}</span>
          </div>
        ))}

      {dataPoint.physical_units > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHYSICAL_COLOR }} />
            <span className="text-xs text-label-secondary">Physical</span>
          </div>
          <span className="text-xs font-semibold text-label-primary tabular-nums">{fmt(dataPoint.physical_units)}</span>
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          {events.map((moment: Moment, i: number) => {
            const cat = getCategoryConfig(moment.moment_type);
            return (
              <div key={i} className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: cat.color }} className="text-xs">{cat.icon}</span>
                  <span className="text-xs font-medium text-label-primary">{moment.moment_title}</span>
                  {moment.is_key && (
                    <span className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">Key</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TimelineChart({
  data,
  selectedTracks,
  visibleEventDates,
  highlightedDate,
  streamView = "total",
  trackData,
  trackName,
}: TimelineChartProps) {
  const isByTrack = streamView === "by_track" && trackData;

  const momentMarkers = useMemo(() => {
    const markers: { date: string; color: string }[] = [];
    const sourceData = isByTrack ? trackData : data;
    if (!sourceData) return markers;
    sourceData.forEach((d) => {
      if (d.events.length > 0) {
        const visibleEvents = d.events.filter((e) => visibleEventDates.has(e.date));
        if (visibleEvents.length > 0) {
          const primary = visibleEvents.find((e) => e.is_key) || visibleEvents[0];
          const cat = getCategoryConfig(primary.moment_type);
          markers.push({ date: d.date, color: cat.color });
        }
      }
    });
    return markers;
  }, [data, trackData, isByTrack, visibleEventDates]);

  const hasPhysical = useMemo(() => {
    const sourceData = isByTrack ? trackData : data;
    return sourceData ? sourceData.some((d) => d.physical_units > 0) : false;
  }, [data, trackData, isByTrack]);

  const chartSource = isByTrack ? trackData! : data;

  return (
    <div className="w-full">
      <div className="w-full h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartSource}
            margin={{ top: 20, right: hasPhysical ? 60 : 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: "#6B7280" }}
              axisLine={{ stroke: "#2A2D3E" }}
              tickLine={false}
              dy={8}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="streams"
              tickFormatter={fmt}
              tick={{ fontSize: 11, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            {hasPhysical && (
              <YAxis
                yAxisId="physical"
                orientation="right"
                tickFormatter={fmt}
                tick={{ fontSize: 11, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
            )}
            <Tooltip
              content={<CustomTooltip streamView={streamView} trackName={trackName} />}
              cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }}
            />

            {highlightedDate && (
              <ReferenceLine x={highlightedDate} yAxisId="streams" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />
            )}

            {momentMarkers.map((m, i) => (
              <ReferenceLine
                key={`moment-${i}`}
                x={m.date}
                yAxisId="streams"
                stroke={m.color}
                strokeDasharray="4 3"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            ))}

            {/* Total Campaign mode: area fill */}
            {!isByTrack && (
              <Area
                yAxisId="streams"
                type="monotone"
                dataKey="total_streams"
                fill={`${TOTAL_COLOR}10`}
                stroke="none"
              />
            )}

            {/* Total Campaign mode: main line */}
            {!isByTrack && (
              <Line
                yAxisId="streams"
                type="monotone"
                dataKey="total_streams"
                stroke={TOTAL_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: TOTAL_COLOR }}
                name="Total Streams"
              />
            )}

            {/* Total Campaign mode: individual track lines */}
            {!isByTrack && selectedTracks.map((track, i) => (
              <Line
                key={track}
                yAxisId="streams"
                type="monotone"
                dataKey={track}
                stroke={TRACK_COLORS[i % TRACK_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: TRACK_COLORS[i % TRACK_COLORS.length] }}
                connectNulls={false}
                name={track}
              />
            ))}

            {/* By Track mode: faint total campaign reference */}
            {isByTrack && (
              <Line
                yAxisId="streams"
                type="monotone"
                dataKey="total_streams"
                stroke={TOTAL_COLOR}
                strokeWidth={1.5}
                strokeOpacity={0.2}
                dot={false}
                activeDot={false}
                name="Total Campaign"
              />
            )}

            {/* By Track mode: selected track line */}
            {isByTrack && (
              <Line
                yAxisId="streams"
                type="monotone"
                dataKey="track_streams"
                stroke={TOTAL_COLOR}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: TOTAL_COLOR }}
                name={trackName || "Track"}
              />
            )}

            {/* Physical units — BAR chart on right axis */}
            {hasPhysical && (
              <Bar
                yAxisId="physical"
                dataKey="physical_units"
                fill={`${PHYSICAL_COLOR}40`}
                stroke={PHYSICAL_COLOR}
                strokeWidth={1}
                radius={[2, 2, 0, 0]}
                name="Physical Units"
                barSize={20}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        {isByTrack ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: TOTAL_COLOR }} />
              <span className="text-[10px] text-label-muted">{trackName || "Track"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block opacity-20" style={{ backgroundColor: TOTAL_COLOR }} />
              <span className="text-[10px] text-label-muted">Total Campaign</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: TOTAL_COLOR }} />
              <span className="text-[10px] text-label-muted">Total Streams</span>
            </div>
            {selectedTracks.map((track, i) => (
              <div key={track} className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: TRACK_COLORS[i % TRACK_COLORS.length] }} />
                <span className="text-[10px] text-label-muted">{track}</span>
              </div>
            ))}
          </div>
        )}
        {hasPhysical && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: `${PHYSICAL_COLOR}40`, border: `1px solid ${PHYSICAL_COLOR}` }} />
            <span className="text-[10px] text-label-muted">Physical</span>
          </div>
        )}
      </div>
    </div>
  );
}
