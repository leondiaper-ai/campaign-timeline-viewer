"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { AppData, LoadedCampaign, Territory, Moment } from "@/types";
import {
  buildChartData, getAllTrackNames, getAllMoments,
  inferTrackRoles, detectHandoverMoment, getChartInsight,
  getCampaignSummary, buildNormalizedTrackData, getTrackModeContext,
} from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";
import CampaignInsights from "./CampaignInsights";
import CampaignLearnings from "./CampaignLearnings";
import TimelineChart, { ChartMode } from "./TimelineChart";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface DashboardProps { initialData: AppData; }

export default function Dashboard({ initialData }: DashboardProps) {
  const campaigns = initialData.campaigns;
  const [campaignIdx, setCampaignIdx] = useState(0);
  const [territory, setTerritory] = useState<Territory>("global");
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("campaign");
  const [pinnedDate, setPinnedDate] = useState<string | null>(null);

  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  useEffect(() => {
    if (sheet?.setup.default_territory) setTerritory(sheet.setup.default_territory);
  }, [sheet]);

  const allTrackNames = useMemo(() => sheet ? getAllTrackNames(sheet) : [], [sheet]);
  const trackRoles = useMemo(() => sheet ? inferTrackRoles(sheet, territory) : [], [sheet, territory]);
  const chartData = useMemo(() => sheet ? buildChartData(sheet, territory, allTrackNames) : [], [sheet, territory, allTrackNames]);
  const normalizedData = useMemo(() => sheet ? buildNormalizedTrackData(sheet, territory, allTrackNames) : [], [sheet, territory, allTrackNames]);
  const trackModeContext = useMemo(() => sheet ? getTrackModeContext(sheet, territory) : null, [sheet, territory]);
  const handoverMoment = useMemo(() => sheet ? detectHandoverMoment(sheet, territory) : null, [sheet, territory]);
  const chartInsight = useMemo(() => sheet ? getChartInsight(sheet, territory) : null, [sheet, territory]);
  const summary = useMemo(() => sheet ? getCampaignSummary(sheet, territory) : "", [sheet, territory]);
  const moments = useMemo(() => sheet ? getAllMoments(sheet) : [], [sheet]);
  const keyMomentDates = useMemo(() => new Set(moments.filter((m) => m.is_key).map((m) => m.date)), [moments]);

  const handleMomentClick = useCallback((date: string) => {
    setPinnedDate((prev) => prev === date ? null : date);
  }, []);

  const effectiveHighlight = pinnedDate || highlightedDate;

  const handleCampaignChange = useCallback((idx: number) => {
    setCampaignIdx(idx); setHighlightedDate(null); setPinnedDate(null); setChartMode("campaign");
  }, []);

  if (!campaign || !sheet) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <p className="text-[#6B7280] text-lg">No active campaigns found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <header className="border-b border-[#1E2130] px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {campaigns.length > 1 ? (
              <select className="bg-[#161922] border border-[#2A2D3E] rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                value={campaignIdx} onChange={(e) => handleCampaignChange(Number(e.target.value))}>
                {campaigns.map((c, i) => (
                  <option key={c.campaign_id} value={i}>{c.sheet.setup.artist_name} — {c.sheet.setup.campaign_name}</option>
                ))}
              </select>
            ) : (
              <h1 className="text-lg font-semibold">
                {sheet.setup.artist_name}
                <span className="text-[#6B7280] font-normal"> — {sheet.setup.campaign_name}</span>
              </h1>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#161922] text-[#6B7280] border border-[#2A2D3E]">
              {sheet.setup.campaign_type}
            </span>
            {sheet.setup.release_date && (
              <span className="text-[10px] text-[#4B5563]">Release: {formatDate(sheet.setup.release_date)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-[#161922] rounded-lg p-0.5 border border-[#2A2D3E]">
            {(["global", "UK"] as Territory[]).map((t) => (
              <button key={t} onClick={() => setTerritory(t)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  territory === t ? "bg-white/10 text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"
                }`}>
                {t === "global" ? "Global" : "UK"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        {/* Campaign Summary */}
        <div className="bg-[#131620] rounded-xl border border-[#1E2130] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mt-0.5 flex-shrink-0">Summary</span>
            <p className="text-[13px] text-[#D1D5DB] leading-relaxed">{summary}</p>
          </div>
        </div>

        {/* Stat cards */}
        <CampaignInsights sheet={sheet} territory={territory} />

        {/* Chart — toggle is INSIDE the TimelineChart component */}
        <div className="bg-[#131620] rounded-2xl border border-[#1E2130] p-5">
          <TimelineChart
            data={chartData}
            normalizedData={normalizedData}
            selectedTracks={allTrackNames}
            trackRoles={trackRoles}
            visibleEventDates={keyMomentDates}
            highlightedDate={effectiveHighlight}
            handoverMoment={handoverMoment}
            chartInsight={chartInsight}
            trackModeContext={trackModeContext}
            chartMode={chartMode}
            onChartModeChange={setChartMode}
            albumDate={sheet.setup.release_date}
          />
        </div>

        {/* Campaign Moments — full width, clickable */}
        {moments.length > 0 && (
          <div className="bg-[#131620] rounded-xl border border-[#1E2130] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
                Campaign Moments
                <span className="text-[#4B5563] font-normal ml-2">({moments.length})</span>
              </h3>
              {pinnedDate && (
                <button onClick={() => setPinnedDate(null)}
                  className="text-[10px] text-[#6B7280] hover:text-white underline underline-offset-2">
                  Clear selection
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 max-h-[320px] overflow-y-auto pr-1">
              {moments.map((moment: Moment, i: number) => {
                const cat = getCategoryConfig(moment.moment_type);
                const isPinned = pinnedDate === moment.date;
                return (
                  <div key={i}
                    onClick={() => handleMomentClick(moment.date)}
                    className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all cursor-pointer ${
                      isPinned
                        ? "bg-white/8 ring-1 ring-white/10"
                        : effectiveHighlight === moment.date
                        ? "bg-white/5"
                        : "hover:bg-white/[0.03]"
                    }`}
                    onMouseEnter={() => setHighlightedDate(moment.date)}
                    onMouseLeave={() => setHighlightedDate(null)}>
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: cat.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-white">{moment.moment_title}</span>
                        {moment.is_key && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Key</span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#4B5563]">{formatDate(moment.date)} · {cat.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Campaign Learnings */}
        <CampaignLearnings sheet={sheet} territory={territory} />
      </main>
    </div>
  );
}
