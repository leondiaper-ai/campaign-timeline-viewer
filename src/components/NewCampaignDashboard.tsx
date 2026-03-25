"use client";

import { useMemo, useState, useRef } from "react";
import { Moment, ChartDataPoint } from "@/types";
import TimelineChart, { ChartMode } from "./TimelineChart";
import { type TrackWithRole } from "@/lib/transforms";

// ——— Planned moments: the campaign skeleton ———
const PLANNED_MOMENTS: Moment[] = [
  { date: "2026-04-07", moment_title: "Pre-save Launch", moment_type: "marketing", is_key: true },
  { date: "2026-04-21", moment_title: "Lead Single Release", moment_type: "music", is_key: true },
  { date: "2026-05-05", moment_title: "D2C Launch", moment_type: "product", is_key: true },
  { date: "2026-05-19", moment_title: "Bundle / Offer Push", moment_type: "marketing", is_key: true },
  { date: "2026-06-02", moment_title: "Second Single", moment_type: "music", is_key: true },
  { date: "2026-06-16", moment_title: "Album Release", moment_type: "music", is_key: true },
];

// Generate empty chart data points spanning the planned moment range
function buildEmptyChartData(moments: Moment[]): ChartDataPoint[] {
  if (moments.length === 0) return [];
  const dates = moments.map(m => m.date).sort();
  const start = new Date(dates[0] + "T00:00:00");
  const end = new Date(dates[dates.length - 1] + "T00:00:00");

  // One point per week from 2 weeks before first moment to 2 weeks after last
  start.setDate(start.getDate() - 14);
  end.setDate(end.getDate() + 14);

  const momentsByDate = new Map<string, Moment[]>();
  moments.forEach(m => {
    const existing = momentsByDate.get(m.date) || [];
    existing.push(m);
    momentsByDate.set(m.date, existing);
  });

  const points: ChartDataPoint[] = [];
  const current = new Date(start);
  while (current <= end) {
    const d = current.toISOString().slice(0, 10);
    points.push({
      date: d,
      total_streams: 0,
      physical_units: 0,
      cumulative_streams: 0,
      prev_week_streams: null,
      events: momentsByDate.get(d) || [],
    });
    current.setDate(current.getDate() + 7);
  }

  // Ensure moment dates are included even if they don't fall on a weekly interval
  moments.forEach(m => {
    if (!points.some(p => p.date === m.date)) {
      points.push({
        date: m.date,
        total_streams: 0,
        physical_units: 0,
        cumulative_streams: 0,
        prev_week_streams: null,
        events: momentsByDate.get(m.date) || [],
      });
    }
  });

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NewCampaignDashboard() {
  const [chartMode, setChartMode] = useState<ChartMode>("campaign");
  const chartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => buildEmptyChartData(PLANNED_MOMENTS), []);
  const keyMomentDates = useMemo(() => new Set(PLANNED_MOMENTS.filter(m => m.is_key).map(m => m.date)), []);

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      {/* ——— Header ——— */}
      <header className="border-b border-[#1E2130] px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              <span className="text-[#6B7280]">[Artist]</span>
              <span className="text-[#4B5563] font-normal"> — New Campaign</span>
            </h1>
            <p className="text-[11px] text-[#4B5563] mt-0.5">
              Album · Release date TBC
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] rounded-full bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
              Pre-Release Build
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        {/* ——— Team Push ——— */}
        <div className="bg-[#131620] rounded-xl border border-[#FBBF24]/10 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#FBBF24]/80 mb-2">Team Push</p>
          <div className="space-y-1">
            <p className="text-[12px] text-white">
              <span className="font-bold text-[#FBBF24]">TEST</span>
              <span className="text-[#4B5563] mx-1.5">&rarr;</span>
              <span className="font-semibold">Lead Single</span>
            </p>
            <p className="text-[12px] text-[#D1D5DB]">
              <span className="font-bold text-[#6B7280]">Support</span>
              <span className="text-[#4B5563] mx-1.5">&rarr;</span>
              Build early signals (save rate, D2C, listener growth)
            </p>
            <p className="text-[12px] text-[#9CA3AF]">
              <span className="font-bold text-[#6B7280]">Next</span>
              <span className="text-[#4B5563] mx-1.5">&rarr;</span>
              Scale if save rate + SPL thresholds are met
            </p>
          </div>
        </div>

        {/* ——— KPI Cards — intentional empty states ——— */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">UK Streams</p>
            <p className="text-lg font-semibold text-[#6C9EFF]/40 tabular-nums">&mdash;</p>
            <p className="text-[10px] text-[#4B5563] mt-1">Tracking from release</p>
          </div>
          <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">UK Physical</p>
            <p className="text-lg font-semibold text-[#4ADE80]/40 tabular-nums">&mdash;</p>
            <p className="text-[10px] text-[#4B5563] mt-1">Pre-orders building</p>
          </div>
          <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">Digital Campaign Spend</p>
            <p className="text-lg font-semibold text-[#FBBF24]/40 tabular-nums">&pound;0 planned</p>
          </div>
        </div>

        {/* ——— Chart with planned moments ——— */}
        <div ref={chartRef} className="bg-[#131620] rounded-2xl border border-[#1E2130] p-5">
          <TimelineChart
            data={chartData}
            selectedTracks={[]}
            trackRoles={[] as TrackWithRole[]}
            visibleEventDates={keyMomentDates}
            highlightedDate={null}
            pinnedDate={null}
            handoverMoment={null}
            chartInsight={null}
            trackModeContext={null}
            chartMode={chartMode}
            onChartModeChange={setChartMode}
            albumDate={PLANNED_MOMENTS.find(m => m.moment_title === "Album Release")?.date}
            ukMilestones={[]}
            territory="UK"
            paidCampaigns={[]}
            moments={PLANNED_MOMENTS}
          />
          <p className="text-[10px] text-[#4B5563] text-center mt-3 italic">
            No streaming data yet — planned moments shown on timeline
          </p>
        </div>

        {/* ——— Planned moments list ——— */}
        <div className="bg-[#131620] rounded-xl border border-[#1E2D44] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B9CC7] mb-3">
            Planned Campaign Moments <span className="text-[#5B6B8A] font-normal ml-1">({PLANNED_MOMENTS.length})</span>
          </h3>
          <div className="space-y-2">
            {PLANNED_MOMENTS.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] text-[#4B5563] tabular-nums w-14 flex-shrink-0">{fmtDate(m.date)}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]/40 flex-shrink-0" />
                <span className="text-[11px] text-[#9CA3AF]">{m.moment_title}</span>
                <span className="text-[9px] text-[#4B5563] uppercase tracking-wider ml-auto">Planned</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
