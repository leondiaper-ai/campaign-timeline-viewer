"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { AppData, LoadedCampaign, Territory, Moment } from "@/types";
import {
  buildChartData, buildTrackChartData, getTrackList, getTrackListForChart,
  getDefaultTracks, getPeakWeekStats, getAllMoments,
} from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";
import CampaignInsights from "./CampaignInsights";
import CampaignStatusRow from "./CampaignStatusRow";
import CampaignLearnings from "./CampaignLearnings";
import TimelineChart from "./TimelineChart";

function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const TRACK_COLORS = ["#FBBF24", "#F472B6", "#22D3EE", "#A78BFA", "#FB7185", "#F97316"];

interface DashboardProps { initialData: AppData; }

export default function Dashboard({ initialData }: DashboardProps) {
  const campaigns = initialData.campaigns;
  const [campaignIdx, setCampaignIdx] = useState(0);
  const [territory, setTerritory] = useState<Territory>("global");
  const [selectedTracks, setSelectedTracks] = useState<string[] | null>(null);
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [streamView, setStreamView] = useState<"total" | "by_track">("total");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  useEffect(() => {
    if (sheet?.setup.default_territory) setTerritory(sheet.setup.default_territory);
  }, [sheet]);

  const trackList = useMemo(() => (sheet ? getTrackList(sheet) : []), [sheet]);
  const activeTracks = useMemo(() => {
    if (selectedTracks !== null) return selectedTracks;
    return getDefaultTracks(trackList);
  }, [selectedTracks, trackList]);

  const chartData = useMemo(
    () => (sheet ? buildChartData(sheet, territory, activeTracks) : []),
    [sheet, territory, activeTracks]
  );

  const trackListForChart = useMemo(
    () => campaign ? getTrackListForChart(campaign.trackWeeklyMetrics, territory) : [],
    [campaign, territory]
  );

  useEffect(() => {
    if (streamView === "by_track" && !selectedTrackId && trackListForChart.length > 0)
      setSelectedTrackId(trackListForChart[0].track_id);
  }, [streamView, selectedTrackId, trackListForChart]);

  const trackChartData = useMemo(() => {
    if (!sheet || !campaign || !selectedTrackId) return null;
    return buildTrackChartData(sheet, territory, campaign.trackWeeklyMetrics, selectedTrackId);
  }, [sheet, campaign, territory, selectedTrackId]);

  const selectedTrackName = useMemo(() => {
    if (!selectedTrackId) return "";
    return trackListForChart.find((t) => t.track_id === selectedTrackId)?.track_name ?? "";
  }, [selectedTrackId, trackListForChart]);

  const moments = useMemo(() => (sheet ? getAllMoments(sheet) : []), [sheet]);
  const keyMomentDates = useMemo(
    () => new Set(moments.filter((m) => m.is_key).map((m) => m.date)),
    [moments]
  );

  const hasTrackWeeklyData = campaign && campaign.trackWeeklyMetrics.length > 0;

  const toggleTrack = useCallback((trackName: string) => {
    setSelectedTracks((prev) => {
      const current = prev ?? getDefaultTracks(trackList);
      return current.includes(trackName)
        ? current.filter((t) => t !== trackName)
        : [...current, trackName];
    });
  }, [trackList]);

  const handleCampaignChange = useCallback((idx: number) => {
    setCampaignIdx(idx);
    setSelectedTracks(null);
    setHighlightedDate(null);
    setStreamView("total");
    setSelectedTrackId(null);
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
              <select
                className="bg-[#161922] border border-[#2A2D3E] rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                value={campaignIdx}
                onChange={(e) => handleCampaignChange(Number(e.target.value))}
              >
                {campaigns.map((c, i) => (
                  <option key={c.campaign_id} value={i}>
                    {c.sheet.setup.artist_name} — {c.sheet.setup.campaign_name}
                  </option>
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
              <span className="text-[10px] text-[#4B5563]">
                Release: {formatDate(sheet.setup.release_date)}
              </span>
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
        {/* Status Row — Verdict, Top Moment, Momentum */}
        <CampaignStatusRow sheet={sheet} territory={territory} />

        {/* Stat Cards */}
        <CampaignInsights sheet={sheet} territory={territory} />

        {/* Track Toggles */}
        {trackList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mr-1">Tracks</span>
            {trackList.map((track, i) => {
              const isOn = activeTracks.includes(track.track_name);
              const color = TRACK_COLORS[i % TRACK_COLORS.length];
              return (
                <button key={track.track_name} onClick={() => toggleTrack(track.track_name)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    isOn ? "border-white/20 bg-white/5 text-white" : "border-[#2A2D3E] bg-transparent text-[#6B7280] hover:text-[#9CA3AF]"
                  }`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isOn ? color : "#3A3D4E", opacity: isOn ? 1 : 0.4 }} />
                  {track.track_name}
                </button>
              );
            })}
          </div>
        )}

        {/* Chart */}
        <div className="bg-[#131620] rounded-2xl border border-[#1E2130] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Weekly Performance</h2>
            {hasTrackWeeklyData && (
              <div className="flex items-center gap-1 bg-[#0D1117] rounded-lg p-0.5 border border-[#1E2130]">
                <button onClick={() => setStreamView("total")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    streamView === "total" ? "bg-[#161922] text-white" : "text-[#6B7280] hover:text-[#9CA3AF]"
                  }`}>Total Campaign</button>
                <button onClick={() => setStreamView("by_track")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    streamView === "by_track" ? "bg-[#161922] text-white" : "text-[#6B7280] hover:text-[#9CA3AF]"
                  }`}>By Track</button>
              </div>
            )}
          </div>
          <TimelineChart
            data={streamView === "by_track" && trackChartData ? trackChartData : chartData}
            selectedTracks={streamView === "by_track" ? [] : activeTracks}
            visibleEventDates={keyMomentDates}
            highlightedDate={highlightedDate}
            streamView={streamView}
            trackData={streamView === "by_track" ? trackChartData : undefined}
            trackName={selectedTrackName}
            totalCampaignData={streamView === "by_track" ? chartData : undefined}
          />
        </div>

        {/* Bottom row: Learnings + Moments side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Learnings */}
          <div className="lg:col-span-2">
            <CampaignLearnings sheet={sheet} territory={territory} />
          </div>

          {/* Moments */}
          {moments.length > 0 && (
            <div className="lg:col-span-3 bg-[#131620] rounded-xl border border-[#1E2130] p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mb-3">
                Campaign Moments
                <span className="text-[#4B5563] font-normal ml-2">({moments.length})</span>
              </h3>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
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
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                              Key
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#4B5563]">
                          {formatDate(moment.date)} · {cat.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
