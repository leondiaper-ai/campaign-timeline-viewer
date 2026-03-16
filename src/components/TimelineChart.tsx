"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { CampaignEvent } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import { UnifiedChartDataPoint } from "@/lib/transforms";

// ─── Track palette ────────────────────────────────────────────
const TRACK_COLORS = [
  "#FBBF24", // amber
  "#F472B6", // pink
  "#22D3EE", // cyan
  "#A78BFA", // purple
  "#FB7185", // rose
  "#F97316", // orange
];

interface TimelineChartProps {
  data: UnifiedChartDataPoint[];
  selectedTracks: string[];
  visibleEventDates: Set<string>;
  highlightedDate: string | null;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Custom Tooltip ───────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | null;
    color: string;
    payload: UnifiedChartDataPoint;
  }>;
  label?: string;
  selectedTracks: string[];
}

function CustomTooltip({ active, payload, label, selectedTracks }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  const events = dataPoint?.events || [];

  // Sort: campaign total first, then tracks by value, then physical
  const campaignEntry = payload.find((e) => e.name === "total_streams");
  const physicalEntry = payload.find((e) => e.name === "physical_units");
  const trackEntries = payload
    .filter((e) => selectedTracks.includes(e.name) && e.value !== null)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
    <div
      className="bg-surface-raised rounded-xl shadow-2xl border border-border-light p-4 max-w-xs backdrop-blur-sm"
    >
      <p className="text-[11px] font-semibold text-label-muted uppercase tracking-wider mb-2.5">
        {label ? formatDate(label) : ""}
      </p>

      {/* Campaign total */}
      {campaignEntry && (
        <div className="flex items-center gap-2.5 mb-1.5">
          <span
            className="w-2.5 h-[3px] rounded-full inline-block"
            style={{ backgroundColor: campaignEntry.color }}
          />
          <span className="text-xs text-label-secondary">Total Streams</span>
          <span className="text-sm font-bold text-label-primary ml-auto tabular-nums">
            {formatNumber(campaignEntry.value || 0)}
          </span>
        </div>
      )}

      {/* Track lines */}
      {trackEntries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2.5 mb-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[11px] text-label-muted truncate max-w-[140px]">
            {entry.name}
          </span>
          <span className="text-xs font-semibold text-label-secondary ml-auto tabular-nums">
            {formatNumber(entry.value || 0)}
          </span>
        </div>
      ))}

      {/* Physical */}
      {physicalEntry && physicalEntry.value !== null && physicalEntry.value > 0 && (
        <div className="flex items-center gap-2.5 mb-1 mt-1 pt-1 border-t border-border/50">
          <span
            className="w-2 h-2 rounded-sm flex-shrink-0"
            style={{ backgroundColor: "#4ADE80", opacity: 0.5 }}
          />
          <span className="text-[11px] text-label-muted">Physical Units</span>
          <span className="text-xs font-semibold text-label-secondary ml-auto tabular-nums">
            {formatNumber(physicalEntry.value)}
          </span>
        </div>
      )}

      {/* Events */}
      {events.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-border">
          {events.map((event: CampaignEvent, i: number) => {
            const cat = getCategoryConfig(event.event_type);
            return (
              <div key={i} className="mb-1.5 last:mb-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs font-semibold text-label-primary">
                    {event.event_title}
                  </span>
                </div>
                {event.notes && (
                  <p className="text-[10px] text-label-muted ml-3">
                    {event.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Custom Event Label ───────────────────────────────────────

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
  const title =
    mainEvent.event_title.length > 22
      ? mainEvent.event_title.substring(0, 20) + "..."
      : mainEvent.event_title;

  return (
    <g>
      <rect
        x={(viewBox.x || 0) - 4}
        y={12}
        width={8}
        height={8}
        rx={1}
        fill={cat.color}
        transform={`rotate(45, ${viewBox.x}, 16)`}
      />
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

// ─── Main Chart ───────────────────────────────────────────────

export default function TimelineChart({
  data,
  selectedTracks,
  visibleEventDates,
  highlightedDate,
}: TimelineChartProps) {
  const visibleEvents = data.filter(
    (d) =>
      d.events.length > 0 &&
      d.events.some((e) => visibleEventDates.has(e.date) || e.is_major)
  );

  const hasPhysicalData = data.some((d) => d.physical_units > 0);

  return (
    <div className="w-full h-[440px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
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
              value: "DSP STREAMS",
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

          {hasPhysicalData && (
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
          )}

          <Tooltip
            content={<CustomTooltip selectedTracks={selectedTracks} />}
            cursor={{ stroke: "#353849", strokeDasharray: "4 4" }}
          />

          {/* Highlighted date area */}
          {highlightedDate && (
            <ReferenceArea
              x1={highlightedDate}
              x2={highlightedDate}
              yAxisId="streams"
              fill="#6C9EFF"
              fillOpacity={0.08}
            />
          )}

          {/* Event reference lines */}
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

          {/* Physical units as subtle bars (behind everything) */}
          {hasPhysicalData && (
            <Bar
              yAxisId="units"
              dataKey="physical_units"
              name="physical_units"
              fill="#4ADE80"
              fillOpacity={0.18}
              stroke="#4ADE80"
              strokeOpacity={0.3}
              strokeWidth={1}
              radius={[2, 2, 0, 0]}
              barSize={14}
            />
          )}

          {/* Track lines — thinner, reduced opacity, behind campaign line */}
          {selectedTracks.map((track, i) => (
            <Line
              key={track}
              yAxisId="streams"
              type="monotone"
              dataKey={track}
              name={track}
              stroke={TRACK_COLORS[i % TRACK_COLORS.length]}
              strokeWidth={1.5}
              strokeOpacity={0.7}
              dot={false}
              activeDot={{
                r: 4,
                fill: TRACK_COLORS[i % TRACK_COLORS.length],
                stroke: "#0F1117",
                strokeWidth: 2,
              }}
              connectNulls={false}
            />
          ))}

          {/* Campaign total streams — primary line, thickest */}
          <Line
            yAxisId="streams"
            type="monotone"
            dataKey="total_streams"
            name="total_streams"
            stroke="#6C9EFF"
            strokeWidth={3}
            dot={false}
            activeDot={{
              r: 5,
              fill: "#6C9EFF",
              stroke: "#0F1117",
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
