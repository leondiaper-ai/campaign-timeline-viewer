"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { ChartDataPoint, Moment } from "@/types";

const STREAM_COLOR = "#2C25FF";
const STREAM_FILL = "#2C25FF15";
const ACTIVITY_COLOR = "#1FBE7A"; // mint — supporting activity
const MOMENT_COLOR = "#8B5CF6"; // purple — releases / key moments
const INK_20 = "rgba(14,14,14,0.12)";
const INK_50 = "rgba(14,14,14,0.5)";

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function isReleaseMoment(m: Moment): boolean {
  const type = m.moment_type.toLowerCase();
  const title = m.moment_title.toLowerCase();
  return (
    type === "music" ||
    title.includes("album") ||
    title.includes("single") ||
    title.includes("release")
  );
}

interface Props {
  data: ChartDataPoint[];
  moments: Moment[];
  showStreams: boolean;
  showMoments: boolean;
  showActivity: boolean;
}

/**
 * ProgressiveDemoChart — a stripped-down chart for the progressive demo.
 *
 * Starts empty (grid only). Each layer renders when toggled on:
 *   • streams  → line + fill
 *   • moments  → vertical reference lines for releases
 *   • activity → physical/supporting bars
 */
export default function ProgressiveDemoChart({
  data,
  moments,
  showStreams,
  showMoments,
  showActivity,
}: Props) {
  const keyMoments = useMemo(() => {
    if (!showMoments) return [];
    // Snap moment dates to the nearest chart date so ReferenceLines render
    const chartDates = data.map((d) => d.date).sort();
    if (chartDates.length === 0) return [];
    const snap = (date: string): string => {
      if (chartDates.includes(date)) return date;
      const t = new Date(date).getTime();
      let best = chartDates[0];
      let bestDiff = Math.abs(new Date(best).getTime() - t);
      for (const d of chartDates) {
        const diff = Math.abs(new Date(d).getTime() - t);
        if (diff < bestDiff) {
          best = d;
          bestDiff = diff;
        }
      }
      return best;
    };
    const releases = moments.filter(isReleaseMoment);
    // Dedupe by snapped date
    const seen = new Map<string, Moment>();
    for (const m of releases) {
      const s = snap(m.date);
      if (!seen.has(s)) seen.set(s, { ...m, date: s });
    }
    return Array.from(seen.values()).slice(0, 5);
  }, [moments, data, showMoments]);

  const hasActivity = useMemo(
    () => showActivity && data.some((d) => (d.physical_units || 0) > 0),
    [data, showActivity],
  );

  const isEmpty = !showStreams && !showMoments && !showActivity;

  return (
    <div className="relative w-full h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 32, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke={INK_20}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11, fill: INK_50, fontWeight: 500 }}
            axisLine={{ stroke: INK_20 }}
            tickLine={false}
            dy={10}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="s"
            tickFormatter={fmt}
            tick={{ fontSize: 10, fill: INK_50 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          {hasActivity && (
            <YAxis
              yAxisId="p"
              orientation="right"
              tickFormatter={() => ""}
              axisLine={false}
              tickLine={false}
              width={20}
            />
          )}

          {showStreams && (
            <Tooltip
              cursor={{ stroke: INK_20, strokeDasharray: "4 4" }}
              contentStyle={{
                background: "#FAF7F2",
                border: "1px solid rgba(14,14,14,0.1)",
                borderRadius: 12,
                fontSize: 11,
              }}
              labelFormatter={(l: string) => fmtDate(l)}
              formatter={(value: number, name: string) => [
                fmt(value),
                name === "total_streams" ? "Streams" : name,
              ]}
            />
          )}

          {/* Step 2 — release moment markers */}
          {showMoments &&
            keyMoments.map((m, i) => (
              <ReferenceLine
                key={`m${i}`}
                x={m.date}
                yAxisId="s"
                stroke={MOMENT_COLOR}
                strokeDasharray="3 5"
                strokeWidth={1.5}
                strokeOpacity={0.55}
                label={{
                  value: trunc(m.moment_title, 18),
                  position: "insideTopLeft",
                  fill: MOMENT_COLOR,
                  fontSize: 9,
                  fontWeight: 700,
                  offset: 4 + (i % 3) * 12,
                }}
              />
            ))}

          {/* Step 3 — supporting activity bars */}
          {hasActivity && (
            <Bar
              yAxisId="p"
              dataKey="physical_units"
              barSize={14}
              fill={ACTIVITY_COLOR}
              fillOpacity={0.45}
              stroke={ACTIVITY_COLOR}
              strokeOpacity={0.75}
              radius={[3, 3, 0, 0]}
              isAnimationActive
            />
          )}

          {/* Step 1 — streams line */}
          {showStreams && (
            <>
              <Area
                yAxisId="s"
                type="monotone"
                dataKey="total_streams"
                fill={STREAM_FILL}
                stroke="none"
                isAnimationActive
              />
              <Line
                yAxisId="s"
                type="monotone"
                dataKey="total_streams"
                stroke={STREAM_COLOR}
                strokeWidth={3.5}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: STREAM_COLOR,
                  stroke: "#FAF7F2",
                  strokeWidth: 2,
                }}
                isAnimationActive
                name="total_streams"
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Empty-state overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[13px] text-ink/35 max-w-[320px] text-center leading-relaxed">
            Build a campaign timeline to see what actually drove performance
          </p>
        </div>
      )}
    </div>
  );
}
