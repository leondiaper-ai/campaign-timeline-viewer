"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { ChartDataPoint, CampaignEvent } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import { formatNumber } from "@/lib/format";

interface PerformanceChartProps {
  data: ChartDataPoint[];
  visibleEventDates: Set<string>;
  highlightedDate: string | null;
  // New for By Track mode
  streamView?: "total" | "by_track";
  trackData?: ChartDataPoint[] | null;
  trackName?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Merged data point for By Track mode ────────────────────────

interface MergedChartPoint {
  date: string;
  track_streams: number;
  total_streams_ref: number;
  physical_units: number;
  events: CampaignEvent[];
}

function mergeTrackData(
  campaignData: ChartDataPoint[],
  trackData: ChartDataPoint[]
): MergedChartPoint[] {
  const trackMap = new Map<string, ChartDataPoint>();
  trackData.forEach((d) => trackMap.set(d.date, d));

  const campaignMap = new Map<string, ChartDataPoint>();
  campaignData.forEach((d) => campaignMap.set(d.date, d));

  // Use all dates from both datasets
  const allDates = new Set([
    ...campaignData.map((d) => d.date),
    ...trackData.map((d) => d.date),
  ]);

  return Array.from(allDates)
    .sort()
    .map((date) => {
      const campaign = campaignMap.get(date);
      const track = trackMap.get(date);
      return {
        date,
        track_streams: track?.total_streams || 0,
        total_streams_ref: campaign?.total_streams || 0,
        physical_units: campaign?.physical_units || track?.physical_units || 0,
        events: campaign?.events || track?.events || [],
      };
    });
}

// ─── Custom Tooltip ─────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<any>;
  label?: string;
  isTrackMode?: boolean;
  trackName?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  isTrackMode,
  trackName,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  const events = dataPoint?.events || [];

  return (
    <div className="bg-surface-raised rounded-xl shadow-2xl border border-border-light p-4 max-w-xs backdrop-blur-sm">
      <p className="text-[11px] font-semibold text-label-muted uppercase tracking-wider mb-2.5">
        {label ? formatDate(label) : ""}
      </p>

      {isTrackMode ? (
        <>
          {/* Track streams */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#6C9EFF" }}
            />
            <span className="text-xs text-label-secondary">
              {trackName || "Track"}
            </span>
            <span className="text-sm font-bold text-label-primary ml-auto tabular-nums">
              {formatNumber(dataPoint?.track_streams || 0)}
            </span>
          </div>
          {/* Total campaign reference */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#6C9EFF", opacity: 0.3 }}
            />
            <span className="text-xs text-label-muted">Total Campaign</span>
            <span className="text-sm font-bold text-label-muted ml-auto tabular-nums">
              {formatNumber(dataPoint?.total_streams_ref || 0)}
            </span>
          </div>
          {/* Physical units */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#4ADE80" }}
            />
            <span className="text-xs text-label-secondary">Physical Units</span>
            <span className="text-sm font-bold text-label-primary ml-auto tabular-nums">
              {formatNumber(dataPoint?.physical_units || 0)}
            </span>
          </div>
        </>
      ) : (
        payload.map((entry: { name: string; value: number; color: string }, i: number) => (
          <div key={i} className="flex items-center gap-2.5 mb-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-label-secondary">
              {entry.name === "total_streams"
                ? "Total DSP Streams"
                : "Physical Units"}
            </span>
            <span className="text-sm font-bold text-label-primary ml-auto tabular-nums">
              {formatNumber(entry.value)}
            </span>
          </div>
        ))
      )}

      {events.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          {events.map((event: CampaignEvent, i: number) => {
            const cat = getCategoryConfig(event.event_type);
            return (
              <div key={i} className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs font-semibold text-label-primary">
                    {event.event_title}
                  </span>
                </div>
                <p className="text-[11px] text-label-muted ml-3">
                  {event.notes}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Custom Reference Line Label ────────────────────────────────

function EventLabel({
  viewBox,
  events,
}: {
  viewBox?: { x?: number; y?: number };
  events: CampaignEvent[];
}) {
  if (!viewBox?.x) return null;

  const mainEvent = events[0];
  if (!mainEvent) return null;

  const cat = getCategoryConfig(mainEvent.event_type);

  // Truncate long titles
  const title =
    mainEvent.event_title.length > 22
      ? mainEvent.event_title.substring(0, 20) + "..."
      : mainEvent.event_title;

  return (
    <g>
      {/* Diamond marker */}
      <rect
        x={(viewBox.x || 0) - 4}
        y={12}
        width={8}
        height={8}
        rx={1}
        fill={cat.color}
        transform={`rotate(45, ${viewBox.x}, 16)`}
      />
      {/* Label */}
      <text
        x={(viewBox.x || 0) + 2}
        y={8}
        textAnchor="middle"
        style={{
          fontSize: "9px",
          fontWeight: 600,
          fill: cat.color,
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </text>
    </g>
  );
}

// ─── Main Chart ─────────────────────────────────────────────────

export default function PerformanceChart({
  data,
  visibleEventDates,
  highlightedDate,
  streamView = "total",
  trackData,
  trackName,
}: PerformanceChartProps) {
  const isTrackMode = streamView === "by_track" && trackData && trackData.length > 0;

  // Merged data for by_track mode
  const mergedData = useMemo(() => {
    if (!isTrackMode || !trackData) return null;
    return mergeTrackData(data, trackData);
  }, [isTrackMode, data, trackData]);

  // Choose the right data source for reference lines
  const chartSource = isTrackMode && mergedData ? mergedData : data;

  // Events to show as reference lines (visible via toggle or major)
  const visibleEvents = (chartSource as Array<{ date: string; events: CampaignEvent[] }>).filter(
    (d) =>
      d.events.length > 0 &&
      d.events.some(
        (e) => visibleEventDates.has(e.date) || e.is_major
      )
  );

  return (
    <div className="w-full h-[440px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={isTrackMode && mergedData ? mergedData : data}
          margin={{ top: 28, right: 28, left: 4, bottom: 20 }}
        >
          <defs>
            <linearGradient id="streamsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6C9EFF" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#6C9EFF" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 6"
            stroke="#1E2130"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "#5F6578", fontWeight: 500 }}
            axisLine={{ stroke: "#2A2D3E" }}
            tickLine={false}
            dy={8}
          />

          <YAxis
            yAxisId="streams"
            tickFormatter={formatNumber}
            tick={{ fontSize: 11, fill: "#5F6578" }}
            axisLine={false}
            tickLine={false}
            width={56}
            label={{
              value: isTrackMode ? "TRACK STREAMS" : "DSP STREAMS",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: {
                fontSize: 9,
                fill: "#5F6578",
                fontWeight: 600,
                letterSpacing: "0.1em",
              },
            }}
          />

          <YAxis
            yAxisId="units"
            orientation="right"
            tickFormatter={formatNumber}
            tick={{ fontSize: 11, fill: "#5F6578" }}
            axisLine={false}
            tickLine={false}
            width={64}
            label={{
              value: "PHYSICAL",
              angle: 90,
              position: "insideRight",
              offset: 10,
              style: {
                fontSize: 9,
                fill: "#5F6578",
                fontWeight: 600,
                letterSpacing: "0.1em",
              },
            }}
          />

          <Tooltip
            content={
              <CustomTooltip
                isTrackMode={!!isTrackMode}
                trackName={trackName}
              />
            }
            cursor={{ stroke: "#353849", strokeDasharray: "4 4" }}
          />

          {/* Highlighted date glow */}
          {highlightedDate && (
            <ReferenceArea
              x1={highlightedDate}
              x2={highlightedDate}
              yAxisId="streams"
              fill="#6C9EFF"
              fillOpacity={0.08}
            />
          )}

          {/* Event reference lines with labels */}
          {visibleEvents.map((d, i) => {
            const isHighlighted = highlightedDate === d.date;
            return (
              <ReferenceLine
                key={`evt-${i}`}
                x={d.date}
                yAxisId="streams"
                stroke={isHighlighted ? "#6C9EFF" : "#353849"}
                strokeDasharray={isHighlighted ? "0" : "3 6"}
                strokeWidth={isHighlighted ? 2 : 1}
                label={<EventLabel events={d.events} />}
              />
            );
          })}

          {isTrackMode ? (
            <>
              {/* Faint total campaign reference line */}
              <Line
                yAxisId="streams"
                type="monotone"
                dataKey="total_streams_ref"
                name="total_streams_ref"
                stroke="#6C9EFF"
                strokeWidth={1.5}
                strokeOpacity={0.2}
                dot={false}
                activeDot={false}
              />
              {/* Highlighted track line */}
              <Line
                yAxisId="streams"
                type="monotone"
                dataKey="track_streams"
                name="track_streams"
                stroke="#6C9EFF"
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "#6C9EFF",
                  stroke: "#0F1117",
                  strokeWidth: 2,
                }}
              />
            </>
          ) : (
            <Line
              yAxisId="streams"
              type="monotone"
              dataKey="total_streams"
              name="total_streams"
              stroke="#6C9EFF"
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                fill: "#6C9EFF",
                stroke: "#0F1117",
                strokeWidth: 2,
              }}
            />
          )}

          <Line
            yAxisId="units"
            type="monotone"
            dataKey="physical_units"
            name="physical_units"
            stroke="#4ADE80"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#4ADE80",
              stroke: "#0F1117",
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
