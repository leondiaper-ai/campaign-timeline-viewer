"use client";

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import { CampaignSheetData, Moment, ChartDataPoint, Territory } from "@/types";
import { buildChartData, getAllTrackNames, getAllMoments, inferTrackRoles } from "@/lib/transforms";
import TimelineChart, { ChartMode } from "./TimelineChart";
import CampaignInsights from "./CampaignInsights";

// ——— Fallback planned moments if sheet moments tab is empty ———
const FALLBACK_MOMENTS: Moment[] = [
  { date: "2026-04-07", moment_title: "Pre-save Launch", moment_type: "marketing", is_key: true },
  { date: "2026-04-21", moment_title: "Lead Single Release", moment_type: "music", is_key: true },
  { date: "2026-05-05", moment_title: "D2C Launch", moment_type: "product", is_key: true },
  { date: "2026-05-19", moment_title: "Bundle / Offer Push", moment_type: "marketing", is_key: true },
  { date: "2026-06-02", moment_title: "Second Single", moment_type: "music", is_key: true },
  { date: "2026-06-16", moment_title: "Album Release", moment_type: "music", is_key: true },
];

// Build empty chart data from moments when no real streaming data exists.
// Uses daily points so the categorical x-axis spacing matches real calendar gaps.
function buildEmptyChartData(moments: Moment[]): ChartDataPoint[] {
  if (moments.length === 0) return [];
  const dates = moments.map(m => m.date).sort();
  const start = new Date(dates[0] + "T00:00:00");
  const end = new Date(dates[dates.length - 1] + "T00:00:00");
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
      date: d, total_streams: 0, physical_units: 0,
      cumulative_streams: 0, prev_week_streams: null,
      events: momentsByDate.get(d) || [],
    });
    current.setDate(current.getDate() + 1);
  }
  return points;
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

interface Props {
  sheet: CampaignSheetData;
}

export default function NewCampaignDashboard({ sheet }: Props) {
  const [chartMode, setChartMode] = useState<ChartMode>("campaign");
  const [territory, setTerritory] = useState<Territory>(sheet.setup.default_territory || "global");
  const chartRef = useRef<HTMLDivElement>(null);

  const setup = sheet.setup;
  const teamPush = useMemo(() => {
    const push = setup.team_push_push || "Lead Single";
    const support = setup.team_push_support || "Build early signals (save rate, D2C, listener growth)";
    const next = setup.team_push_next || "Scale if save rate + SPL thresholds are met";
    return { push, support, next };
  }, [setup]);

  // Use sheet moments if populated, otherwise fallback to planned skeleton
  const moments = useMemo(() => {
    const sheetMoments = getAllMoments(sheet);
    return sheetMoments.length > 0 ? sheetMoments : FALLBACK_MOMENTS;
  }, [sheet]);

  // Determine if we have real streaming data
  const allTrackNames = useMemo(() => getAllTrackNames(sheet), [sheet]);
  const hasRealData = useMemo(() => {
    const hasStreams = sheet.weeklyData.some(r => r.streams_global > 0 || r.streams_uk > 0);
    const hasDaily = sheet.dailyTrackData.length > 0;
    return hasStreams || hasDaily;
  }, [sheet]);

  const trackRoles = useMemo(() => hasRealData ? inferTrackRoles(sheet, territory) : [], [sheet, hasRealData, territory]);
  const chartData = useMemo(() => {
    if (hasRealData) return buildChartData(sheet, territory, allTrackNames);
    return buildEmptyChartData(moments);
  }, [sheet, hasRealData, allTrackNames, moments, territory]);

  const keyMomentDates = useMemo(() => new Set(moments.filter(m => m.is_key).map(m => m.date)), [moments]);
  const albumDate = setup.release_date || moments.find(m => m.moment_title.toLowerCase().includes("album"))?.date;

  // Check if we have real KPI-worthy data
  const hasKPIs = hasRealData || sheet.physicalData.length > 0 || (sheet.paidCampaigns && sheet.paidCampaigns.length > 0);

  // Campaign state label
  const isPreRelease = !setup.release_date || new Date(setup.release_date + "T00:00:00") > new Date();
  const stateLabel = isPreRelease ? "Pre-Release Build" : "Live";

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      {/* ——— Header — reads from sheet setup ——— */}
      <header className="border-b border-[#1E2130] px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[#4B5563] hover:text-[#6C9EFF] transition-colors text-sm">← All Campaigns</Link>
            <span className="text-[#2A2D3E]">|</span>
            <h1 className="text-lg font-semibold">
              {setup.artist_name}
              <span className="text-[#4B5563] font-normal"> — {setup.campaign_name}</span>
            </h1>
            <p className="text-[11px] text-[#4B5563] mt-0.5">
              <span className="capitalize">{setup.campaign_type || "Album"}</span>
              {setup.release_date
                ? <> · Release {fmtDate(setup.release_date)}</>
                : <> · Release date TBC</>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[#161922] rounded-lg p-0.5 border border-[#2A2D3E]">
              {(["global", "UK"] as Territory[]).map(t => (
                <button key={t} onClick={() => setTerritory(t)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${territory === t ? "bg-[#6C9EFF]/15 text-[#6C9EFF] shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>
                  {t === "global" ? "Global" : "UK"}
                </button>
              ))}
            </div>
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] rounded-full border ${
              isPreRelease
                ? "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/20"
                : "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/20"
            }`}>
              {stateLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        {/* ——— Team Push — from sheet setup, with defaults ——— */}
        <div className="bg-[#131620] rounded-xl border border-[#FBBF24]/10 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#FBBF24]/80 mb-2">Team Push</p>
          <div className="space-y-1">
            <p className="text-[12px] text-white">
              <span className="font-bold text-[#1FBE7A]">PUSH</span>
              <span className="text-[#4B5563] mx-1.5">&rarr;</span>
              <span className="font-semibold">{teamPush.push}</span>
            </p>
            <p className="text-[12px] text-[#D1D5DB]">
              <span className="font-bold text-[#6B7280]">Support</span>
              <span className="text-[#4B5563] mx-1.5">&rarr;</span>
              {teamPush.support}
            </p>
            <p className="text-[12px] text-[#9CA3AF]">
              <span className="font-bold text-[#6B7280]">Next</span>
              <span className="text-[#4B5563] mx-1.5">&rarr;</span>
              {teamPush.next}
            </p>
          </div>
        </div>

        {/* ——— KPI Cards — real data when available, intentional empty states otherwise ——— */}
        {hasKPIs ? (
          <CampaignInsights sheet={sheet} territory={territory} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">{territory === "UK" ? "UK Streams" : "Global Streams"}</p>
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
        )}

        {/* ——— Chart ——— */}
        <div ref={chartRef} className="bg-[#131620] rounded-2xl border border-[#1E2130] p-5">
          <TimelineChart
            data={chartData}
            moments={moments}
            highlightedDate={null}
            pinnedDate={null}
            albumDate={albumDate}
            territory={territory}
            chartMode={chartMode}
            onChartModeChange={setChartMode}
            tracks={sheet.tracks}
          />
          {!hasRealData && (
            <p className="text-[10px] text-[#4B5563] text-center mt-3 italic">
              No streaming data yet — planned moments shown on timeline
            </p>
          )}
        </div>

        {/* ——— Campaign moments list ——— */}
        <div className="bg-[#131620] rounded-xl border border-[#1E2D44] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B9CC7] mb-3">
            Campaign Moments <span className="text-[#5B6B8A] font-normal ml-1">({moments.length})</span>
          </h3>
          <div className="space-y-2">
            {moments.map((m, i) => {
              const isPast = new Date(m.date + "T00:00:00") < new Date();
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-[#4B5563] tabular-nums w-14 flex-shrink-0">{fmtDate(m.date)}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPast ? "bg-[#A78BFA]" : "bg-[#A78BFA]/40"}`} />
                  <span className={`text-[11px] ${isPast ? "text-[#D1D5DB]" : "text-[#9CA3AF]"}`}>{m.moment_title}</span>
                  {!isPast && <span className="text-[9px] text-[#4B5563] uppercase tracking-wider ml-auto">Planned</span>}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
