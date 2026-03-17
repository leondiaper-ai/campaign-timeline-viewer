"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { AppData, LoadedCampaign, Territory, Moment } from "@/types";
import {
  buildChartData, getTrackList, getDefaultTracks, getAllTrackNames,
  getAllMoments, inferTrackRoles, detectHandoverMoment, getChartInsight,
} from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";
import CampaignInsights from "./CampaignInsights";
import CampaignStatusRow from "./CampaignStatusRow";
import CampaignLearnings from "./CampaignLearnings";
import TimelineChart from "./TimelineChart";

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

  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  useEffect(() => {
    if (sheet?.setup.default_territory) setTerritory(sheet.setup.default_territory);
  }, [sheet]);

  // ALL tracks from weekly data (not just tracks tab) — ensures DJH shows
  const allTrackNames = useMemo(() => sheet ? getAllTrackNames(sheet) : [], [sheet]);

  // Narrative roles — computed from data patterns
  const trackRoles = useMemo(() => sheet ? inferTrackRoles(sheet, territory) : [], [sheet, territory]);

  // Chart data with ALL tracks
  const chartData = useMemo(
    () => sheet ? buildChartData(sheet, territory, allTrackNames) : [],
    [sheet, territory, allTrackNames]
  );

  // Handover moment detection
  const handoverMoment = useMemo(
    () => sheet ? detectHandoverMoment(sheet, territory) : null,
    [sheet, territory]
  );

  // Chart insight
  const chartInsight = useMemo(
    () => sheet ? getChartInsight(sheet, territory) : null,
    [sheet, territory]
  );

  // Moments
  const moments = useMemo(() => sheet ? getAllMoments(sheet) : [], [sheet]);
  const keyMomentDates = useMemo(
    () => new Set(moments.filter((m) => m.is_key).map((m) => m.date)),
    [moments]
  );

  const handleCampaignChange = useCallback((idx: number) => {
    setCampaignIdx(idx);
    setHighlightedDate(null);
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
      {/* Header */}
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
        {/* 1. Status Row — Verdict, Top Moment, Momentum */}
        <CampaignStatusRow sheet={sheet} territory={territory} />

        {/* 2. Two stat cards only */}
        <CampaignInsights sheet={sheet} territory={territory} />

        {/* 3. Chart (primary storytelling layer) */}
        <div className="bg-[#131620] rounded-2xl border border-[#1E2130] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Weekly Performance</h2>
          <TimelineChart
            data={chartData}
            selectedTracks={allTrackNames}
            trackRoles={trackRoles}
            visibleEventDates={keyMomentDates}
            highlightedDate={highlightedDate}
            handoverMoment={handoverMoment}
            chartInsight={chartInsight}
          />
        </div>

        {/* 4. Campaign Moments (primary narrative) */}
        {moments.length > 0 && (
          <div className="bg-[#131620] rounded-xl border border-[#1E2130] p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mb-3">
              Campaign Moments
              <span className="text-[#4B5563] font-normal ml-2">({moments.length})</span>
            </h3>
            <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
              {moments.map((moment: Moment, i: number) => {
                const cat = getCategoryConfig(moment.moment_type);
                return (
                  <div key={i}
                    className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                      highlightedDate === moment.date ? "bg-white/5" : "hover:bg-white/[0.02]"
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

        {/* 5. Campaign Learnings (supporting) */}
        <CampaignLearnings sheet={sheet} territory={territory} />
      </main>
    </div>
  );
}
