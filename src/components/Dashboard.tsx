"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { AppData, LoadedCampaign, Territory, Moment } from "@/types";
import {
  buildChartData,
  buildTrackChartData,
  getTrackList,
  getTrackListForChart,
  getDefaultTracks,
  getPeakWeekStats,
  getAllMoments,
} from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";
import CampaignInsights from "./CampaignInsights";
import TimelineChart from "./TimelineChart";

// ——— Number formatting ——————————————————————————————————————
function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ——— Track Colors ——————————————————————————————————————————
const TRACK_COLORS = [
  "#FBBF24",
  "#F472B6",
  "#22D3EE",
  "#A78BFA",
  "#FB7185",
  "#F97316",
];

// ——— Dashboard ——————————————————————————————————————————————
interface DashboardProps {
  initialData: AppData;
}

export default function Dashboard({ initialData }: DashboardProps) {
  const campaigns = initialData.campaigns;

  // State
  const [campaignIdx, setCampaignIdx] = useState(0);
  const [territory, setTerritory] = useState<Territory>("global");
  const [selectedTracks, setSelectedTracks] = useState<string[] | null>(
    null
  );
  const [highlightedDate, setHighlightedDate] = useState<string | null>(
    null
  );
  const [streamView, setStreamView] = useState<"total" | "by_track">(
    "total"
  );
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
    null
  );

  // Current campaign
  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  // Set default territory from campaign setup
  useEffect(() => {
    if (sheet?.setup.default_territory) {
      setTerritory(sheet.setup.default_territory);
    }
  }, [sheet]);

  // Track list (sorted by sort_order)
  const trackList = useMemo(
    () => (sheet ? getTrackList(sheet) : []),
    [sheet]
  );

  // Active tracks (default or user-selected)
  const activeTracks = useMemo(() => {
    if (selectedTracks !== null) return selectedTracks;
    return getDefaultTracks(trackList);
  }, [selectedTracks, trackList]);

  // Chart data (Total Campaign mode)
  const chartData = useMemo(
    () => (sheet ? buildChartData(sheet, territory, activeTracks) : []),
    [sheet, territory, activeTracks]
  );

  // Track list for By Track selector
  const trackListForChart = useMemo(
    () =>
      campaign
        ? getTrackListForChart(campaign.trackWeeklyMetrics, territory)
        : [],
    [campaign, territory]
  );

  // Auto-select first track when entering by_track mode
  useEffect(() => {
    if (
      streamView === "by_track" &&
      !selectedTrackId &&
      trackListForChart.length > 0
    ) {
      setSelectedTrackId(trackListForChart[0].track_id);
    }
  }, [streamView, selectedTrackId, trackListForChart]);

  // Track chart data (By Track mode)
  const trackChartData = useMemo(() => {
    if (!sheet || !campaign || !selectedTrackId) return null;
    return buildTrackChartData(
      sheet,
      territory,
      campaign.trackWeeklyMetrics,
      selectedTrackId
    );
  }, [sheet, campaign, territory, selectedTrackId]);

  // Selected track name for display
  const selectedTrackName = useMemo(() => {
    if (!selectedTrackId) return "";
    const found = trackListForChart.find(
      (t) => t.track_id === selectedTrackId
    );
    return found?.track_name ?? "";
  }, [selectedTrackId, trackListForChart]);

  // KPI stats
  const stats = useMemo(
    () => (sheet ? getPeakWeekStats(sheet, territory) : null),
    [sheet, territory]
  );

  // Moments
  const moments = useMemo(
    () => (sheet ? getAllMoments(sheet) : []),
    [sheet]
  );

  const keyMomentDates = useMemo(
    () => new Set(moments.filter((m) => m.is_key).map((m) => m.date)),
    [moments]
  );

  // Has track weekly data?
  const hasTrackWeeklyData =
    campaign && campaign.trackWeeklyMetrics.length > 0;

  // Track toggle handler
  const toggleTrack = useCallback(
    (trackName: string) => {
      setSelectedTracks((prev) => {
        const current = prev ?? getDefaultTracks(trackList);
        if (current.includes(trackName)) {
          return current.filter((t) => t !== trackName);
        }
        return [...current, trackName];
      });
    },
    [trackList]
  );

  // Campaign switch
  const handleCampaignChange = useCallback((idx: number) => {
    setCampaignIdx(idx);
    setSelectedTracks(null);
    setHighlightedDate(null);
    setStreamView("total");
    setSelectedTrackId(null);
  }, []);

  if (!campaign || !sheet) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <p className="text-label-muted text-lg">
          No active campaigns found.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base text-label-primary">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {campaigns.length > 1 ? (
              <select
                className="bg-surface-raised border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-label-primary"
                value={campaignIdx}
                onChange={(e) =>
                  handleCampaignChange(Number(e.target.value))
                }
              >
                {campaigns.map((c, i) => (
                  <option key={c.campaign_id} value={i}>
                    {c.sheet.setup.artist_name} —{" "}
                    {c.sheet.setup.campaign_name}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="text-lg font-semibold">
                {sheet.setup.artist_name}{" "}
                <span className="text-label-muted font-normal">
                  — {sheet.setup.campaign_name}
                </span>
              </h1>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-raised text-label-muted border border-border">
              {sheet.setup.campaign_type}
            </span>
          </div>

          {/* Territory toggle */}
          <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-0.5 border border-border">
            {(["global", "UK"] as Territory[]).map((t) => (
              <button
                key={t}
                onClick={() => setTerritory(t)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  territory === t
                    ? "bg-white/10 text-label-primary shadow-sm"
                    : "text-label-muted hover:text-label-secondary"
                }`}
              >
                {t === "global" ? "Global" : "UK"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* 4 Primary Stat Cards */}
        <CampaignInsights sheet={sheet} territory={territory} />

        {/* Track Toggles */}
        {trackList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-label-muted mr-1">
              Tracks
            </span>
            {trackList.map((track, i) => {
              const isOn = activeTracks.includes(track.track_name);
              const color = TRACK_COLORS[i % TRACK_COLORS.length];
              return (
                <button
                  key={track.track_name}
                  onClick={() => toggleTrack(track.track_name)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    isOn
                      ? "border-white/20 bg-white/5 text-label-primary"
                      : "border-border bg-transparent text-label-muted hover:text-label-secondary"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: isOn ? color : "#3A3D4E",
                      opacity: isOn ? 1 : 0.4,
                    }}
                  />
                  {track.track_name}
                </button>
              );
            })}
          </div>
        )}

        {/* Chart */}
        <div className="bg-surface-raised rounded-2xl border border-border p-5">
          {/* Chart header with stream view toggle */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-label-primary">
              Weekly Performance
            </h2>
            <div className="flex items-center gap-3">
              {/* Stream view toggle — only show if track data exists */}
              {hasTrackWeeklyData && (
                <div className="flex items-center gap-1 bg-surface-base rounded-lg p-0.5 border border-border">
                  <button
                    onClick={() => setStreamView("total")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      streamView === "total"
                        ? "bg-surface-raised text-label-primary"
                        : "text-label-muted hover:text-label-secondary"
                    }`}
                  >
                    Total Campaign
                  </button>
                  <button
                    onClick={() => setStreamView("by_track")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      streamView === "by_track"
                        ? "bg-surface-raised text-label-primary"
                        : "text-label-muted hover:text-label-secondary"
                    }`}
                  >
                    By Track
                  </button>
                </div>
              )}

              {/* Track selector — only in by_track mode */}
              {streamView === "by_track" && trackListForChart.length > 0 && (
                <select
                  className="bg-surface-base border border-border rounded-lg px-2 py-1 text-xs font-medium text-label-primary"
                  value={selectedTrackId || ""}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                >
                  {trackListForChart.map((t) => (
                    <option key={t.track_id} value={t.track_id}>
                      {t.track_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <TimelineChart
            data={
              streamView === "by_track" && trackChartData
                ? trackChartData
                : chartData
            }
            selectedTracks={
              streamView === "by_track" ? [] : activeTracks
            }
            visibleEventDates={keyMomentDates}
            highlightedDate={highlightedDate}
            streamView={streamView}
            trackData={
              streamView === "by_track" ? trackChartData : undefined
            }
            trackName={selectedTrackName}
            totalCampaignData={
              streamView === "by_track" ? chartData : undefined
            }
          />
        </div>

        {/* Moments List */}
        {moments.length > 0 && (
          <div className="bg-surface-raised rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold text-label-primary mb-4">
              Campaign Moments
              <span className="text-label-muted font-normal ml-2">
                ({moments.length})
              </span>
            </h2>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {moments.map((moment: Moment, i: number) => {
                const cat = getCategoryConfig(moment.moment_type);
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                      highlightedDate === moment.date
                        ? "bg-white/5"
                        : "hover:bg-white/[0.02]"
                    }`}
                    onMouseEnter={() =>
                      setHighlightedDate(moment.date)
                    }
                    onMouseLeave={() => setHighlightedDate(null)}
                  >
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-label-primary">
                          {moment.moment_title}
                        </span>
                        {moment.is_key && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                            Key
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-label-muted">
                        {formatDate(moment.date)} · {cat.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
