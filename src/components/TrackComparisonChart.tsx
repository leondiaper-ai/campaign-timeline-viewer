"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TrackChartDataPoint, TrackDisplayMode } from "@/types";

// Track palette — distinct, accessible on dark backgrounds
const TRACK_COLORS = [
  "#6C9EFF", // blue
  "#4ADE80", // green
  "#FBBF24", // amber
  "#F472B6", // pink
  "#22D3EE", // cyan
  "#A78BFA", // purple
  "#FB7185", // rose
  "#F97316", // orange
];

interface TrackComparisonChartProps {
  data: TrackChartDataPoint[];
  selectedTracks: string[];
  displayMode: TrackDisplayMode;
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

// ─── Custom Tooltip ─────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
  displayMode: TrackDisplayMode;
}

function TrackTooltip({ active, payload, label, displayMode }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-surface-raised rounded-xl shadow-2xl border border-border-light p-4 max-w-xs backdrop-blur-sm">
      <p className="text-[11px] font-semibold text-label-muted uppercase tracking-wider mb-2.5">
        {label ? formatDate(label) : ""}
      </p>

      {payload
        .filter((entry) => entry.name !== "date")
        .sort((a, b) => b.value - a.value)
        .map((entry, i) => (
          <div key={i} className="flex items-center gap-2.5 mb-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-label-secondary truncate max-w-[140px]">
              {entry.name}
            </span>
            <span className="text-sm font-bold text-label-primary ml-auto tabular-nums">
              {displayMode === "indexed"
                ? `${entry.value}`
                : formatNumber(entry.value)}
            </span>
          </div>
        ))}

      {displayMode === "indexed" && (
        <p className="text-[10px] text-label-muted mt-2 pt-2 border-t border-border">
          Index: 100 = first active week
        </p>
      )}
    </div>
  );
}

// ─── Main Chart ─────────────────────────────────────────────────

export default function TrackComparisonChart({
  data,
  selectedTracks,
  displayMode,
}: TrackComparisonChartProps) {
  if (data.length === 0 || selectedTracks.length === 0) {
    return (
      <div className="w-full h-[440px] flex items-center justify-center">
        <p className="text-sm text-label-muted">
          Select tracks to compare
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[440px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 28, left: 4, bottom: 20 }}
        >
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
            tickFormatter={
              displayMode === "indexed"
                ? (v: number) => `${v}`
                : formatNumber
            }
            tick={{ fontSize: 11, fill: "#5F6578" }}
            axisLine={false}
            tickLine={false}
            width={56}
            label={{
              value: displayMode === "indexed" ? "INDEX (100 = START)" : "STREAMS",
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

          <Tooltip
            content={<TrackTooltip displayMode={displayMode} />}
            cursor={{ stroke: "#353849", strokeDasharray: "4 4" }}
          />

          {/* Indexed baseline reference */}
          {displayMode === "indexed" && (
            <Line
              type="monotone"
              dataKey={() => 100}
              stroke="#353849"
              strokeDasharray="6 3"
              strokeWidth={1}
              dot={false}
              activeDot={false}
              name="_baseline"
              legendType="none"
            />
          )}

          {selectedTracks.map((track, i) => (
            <Line
              key={track}
              type="monotone"
              dataKey={track}
              name={track}
              stroke={TRACK_COLORS[i % TRACK_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                fill: TRACK_COLORS[i % TRACK_COLORS.length],
                stroke: "#0F1117",
                strokeWidth: 2,
              }}
              connectNulls={false}
            />
          ))}

          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: "11px",
              color: "#9BA1B0",
              paddingBottom: "8px",
            }}
            formatter={(value: string) => (
              <span style={{ color: "#9BA1B0", fontSize: "11px" }}>
                {value}
              </span>
            )}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
