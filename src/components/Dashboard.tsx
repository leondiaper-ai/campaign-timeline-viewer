"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  CampaignData,
  Territory,
  TrackMeta,
  TRACK_COLORS,
  MAX_VISIBLE_TRACKS,
} from "@/types";
import {
  buildChartData,
  buildMultiTrackChartData,
  getFilteredEvents,
  getTopLearnings,
  getTrackList,
} from "@/lib/transforms";
import { generateObservations } from "@/lib/observations";
import { generateCampaignInsight } from "@/lib/insights";
import CampaignSelector from "./CampaignSelector";
import TerritoryToggle from "./TerritoryToggle";
import PerformanceChart from "./PerformanceChart";
import EventList from "./EventList";
import CategoryLegend from "./CategoryLegend";
import CampaignLearnings from "./CampaignLearnings";
import CampaignInsights from "./CampaignInsights";
import SingleComparisonTable from "./SingleComparisonTable";

interface DashboardProps {
  initialData: CampaignData;
}

export default function Dashboard({ initialData }: DashboardProps) {
  const [campaignId, setCampaignId] = useState(
    initialData.campaigns[0]?.campaign_id || ""
  );
  const [territory, setTerritory] = useState<Territory>("global");
  const [toggledDates, setToggledDates] = useState<Set<string>>(new Set());
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);

  // Stream view toggle state
  const [streamView, setStreamView] = useState<"total" | "by_track">("total");
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(
    new Set()
  );

  const chartData = useMemo(
    () => buildChartData(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  const events = useMemo(
    () => getFilteredEvents(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  const observations = useMemo(
    () =>
      generateObservations(
        initialData.events,
        initialData.metrics,
        campaignId,
        territory
      ),
    [initialData, campaignId, territory]
  );

  const insight = useMemo(
    () =>
      generateCampaignInsight(
        initialData.metrics,
        initialData.events,
        observations,
        campaignId,
        territory
      ),
    [initialData, observations, campaignId, territory]
  );

  const learnings = useMemo(
    () => getTopLearnings(events, observations, 3),
    [events, observations]
  );

  // Track list for Tracks mode
  const trackList = useMemo(
    () => getTrackList(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  const hasTrackData = trackList.length > 0;

  // Build track metadata (color assignments for selected tracks)
  const trackMeta: TrackMeta[] = useMemo(() => {
    const ids = Array.from(selectedTrackIds);
    return ids.map((id, i) => {
      const track = trackList.find((t) => t.track_id === id);
      return {
        track_id: id,
        track_name: track?.track_name || id,
        color: TRACK_COLORS[i % TRACK_COLORS.length],
        index: i,
      };
    });
  }, [selectedTrackIds, trackList]);

  // Multi-track chart data
  const multiTrackData = useMemo(() => {
    if (selectedTrackIds.size === 0) return null;
    return buildMultiTrackChartData(
      initialData,
      campaignId,
      territory,
      Array.from(selectedTrackIds)
    );
  }, [initialData, campaignId, territory, selectedTrackIds]);

  // Auto-select first 2 tracks when entering tracks mode
  useEffect(() => {
    if (
      streamView === "by_track" &&
      selectedTrackIds.size === 0 &&
      trackList.length > 0
    ) {
      const initial = new Set<string>();
      initial.add(trackList[0].track_id);
      if (trackList.length > 1) initial.add(trackList[1].track_id);
      setSelectedTrackIds(initial);
    }
  }, [streamView, selectedTrackIds.size, trackList]);

  // Reset stream view when campaign/territory changes
  useEffect(() => {
    setStreamView("total");
    setSelectedTrackIds(new Set());
  }, [campaignId, territory]);

  const selectedCampaign = initialData.campaigns.find(
    (c) => c.campaign_id === campaignId
  );

  const handleCampaignChange = useCallback((id: string) => {
    setCampaignId(id);
    setToggledDates(new Set());
  }, []);

  const handleTerritoryChange = useCallback((t: Territory) => {
    setTerritory(t);
    setToggledDates(new Set());
  }, []);

  const handleToggleVisibility = useCallback((date: string) => {
    setToggledDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  const handleTrackToggle = useCallback(
    (trackId: string) => {
      setSelectedTrackIds((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) {
          next.delete(trackId);
        } else {
          if (next.size >= MAX_VISIBLE_TRACKS) return prev;
          next.add(trackId);
        }
        return next;
      });
    },
    []
  );

  const visibleEventDates = useMemo(() => {
    const dates = new Set<string>();
    events.forEach((e) => {
      if (e.is_major || toggledDates.has(e.date)) {
        dates.add(e.date);
      }
    });
    return dates;
  }, [events, toggledDates]);

  const majorCount = events.filter((e) => e.is_major).length;

  const isTrackMode = streamView === "by_track";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0F1117" }}>
      {/* Header */}
      <header
        className="border-b"
        style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
      >
        <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full bg-streams" />
              <h1 className="text-base font-bold text-label-primary tracking-tight">
                Campaign Timeline
              </h1>
            </div>
            <div className="w-px h-6 bg-border" />
            <CampaignSelector
              campaigns={initialData.campaigns}
              selectedId={campaignId}
              onChange={handleCampaignChange}
            />
          </div>
          <TerritoryToggle
            selected={territory}
            onChange={handleTerritoryChange}
          />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1440px] mx-auto px-8 py-8">
        {/* Campaign hero */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold text-label-primary tracking-tight">
              {selectedCampaign?.artist}
            </h2>
            <p className="text-sm text-label-muted mt-1">
              {selectedCampaign?.campaign_name}
              <span className="mx-2 text-border">|</span>
              {territory === "global" ? "Global" : territory}
              <span className="mx-2 text-border">|</span>
              {majorCount} key moments &middot; {events.length} total
            </p>
          </div>
          <CategoryLegend />
        </div>

        {/* Campaign Stats (4 primary stat cards) */}
        <CampaignInsights
          insight={insight}
          metrics={initialData.metrics}
          campaignId={campaignId}
          territory={territory}
        />

        {/* Chart Card */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
        >
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
                Weekly Performance
              </h3>

              {/* Stream View Toggle */}
              {hasTrackData && (
                <div
                  className="flex items-center rounded-lg overflow-hidden border"
                  style={{ borderColor: "#2A2D3E" }}
                >
                  <button
                    className="text-[10px] font-semibold px-3 py-1.5 transition-colors"
                    style={{
                      backgroundColor:
                        streamView === "total" ? "#1E2130" : "transparent",
                      color:
                        streamView === "total" ? "#E2E8F0" : "#5F6578",
                    }}
                    onClick={() => setStreamView("total")}
                  >
                    Campaign
                  </button>
                  <button
                    className="text-[10px] font-semibold px-3 py-1.5 transition-colors"
                    style={{
                      backgroundColor:
                        streamView === "by_track" ? "#1E2130" : "transparent",
                      color:
                        streamView === "by_track" ? "#E2E8F0" : "#5F6578",
                    }}
                    onClick={() => setStreamView("by_track")}
                  >
                    Tracks
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              {/* Legend adapts to mode */}
              {isTrackMode ? (
                <>
                  {trackMeta.map((tm) => (
                    <div key={tm.track_id} className="flex items-center gap-2">
                      <span
                        className="w-4 h-[2px] rounded-full inline-block"
                        style={{ backgroundColor: tm.color }}
                      />
                      <span className="text-[11px] text-label-muted font-medium">
                        {tm.track_name.length > 20
                          ? tm.track_name.substring(0, 18) + "..."
                          : tm.track_name}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-[2px] inline-block"
                      style={{ backgroundColor: "#6C9EFF", opacity: 0.2 }}
                    />
                    <span className="text-[11px] text-label-muted font-medium">
                      Total Campaign
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-[2px] rounded-full bg-streams inline-block" />
                  <span className="text-[11px] text-label-muted font-medium">
                    Total DSP Streams
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-[2px] inline-block"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, #4ADE80 0, #4ADE80 4px, transparent 4px, transparent 7px)",
                  }}
                />
                <span className="text-[11px] text-label-muted font-medium">
                  Physical Units
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-[2px] inline-block"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, #353849 0, #353849 2px, transparent 2px, transparent 5px)",
                  }}
                />
                <span className="text-[11px] text-label-muted font-medium">
                  Campaign Moment
                </span>
              </div>
            </div>
          </div>

          {/* Track selector panel */}
          {isTrackMode && hasTrackData && (
            <div className="px-6 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-label-muted uppercase tracking-wider mr-1">
                  Tracks
                </span>
                {trackList.map((t) => {
                  const isSelected = selectedTrackIds.has(t.track_id);
                  const meta = trackMeta.find(
                    (m) => m.track_id === t.track_id
                  );
                  const atLimit =
                    selectedTrackIds.size >= MAX_VISIBLE_TRACKS && !isSelected;

                  return (
                    <button
                      key={t.track_id}
                      className="text-[10px] font-medium px-2.5 py-1 rounded-md border transition-colors"
                      style={{
                        backgroundColor: isSelected
                          ? (meta?.color || "#6C9EFF") + "20"
                          : "transparent",
                        borderColor: isSelected
                          ? meta?.color || "#6C9EFF"
                          : "#2A2D3E",
                        color: isSelected
                          ? "#E2E8F0"
                          : atLimit
                            ? "#3A3D4E"
                            : "#5F6578",
                        cursor: atLimit ? "not-allowed" : "pointer",
                        opacity: atLimit ? 0.5 : 1,
                      }}
                      onClick={() => {
                        if (!atLimit) handleTrackToggle(t.track_id);
                      }}
                    >
                      {isSelected ? "\u2713 " : ""}
                      {t.track_name}
                    </button>
                  );
                })}
                {selectedTrackIds.size >= MAX_VISIBLE_TRACKS && (
                  <span className="text-[9px] text-label-muted italic ml-2">
                    Max {MAX_VISIBLE_TRACKS} tracks visible
                  </span>
                )}
              </div>
            </div>
          )}

          <PerformanceChart
            data={chartData}
            visibleEventDates={visibleEventDates}
            highlightedDate={highlightedDate}
            streamView={streamView}
            multiTrackData={multiTrackData}
            trackMeta={trackMeta}
          />
        </div>

        {/* Events Card */}
        <div
          className="mt-6 rounded-xl border overflow-hidden"
          style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
        >
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
                Campaign Moments
              </h3>
              <span className="text-[10px] text-label-muted font-mono px-2 py-0.5 rounded bg-surface-primary border border-border/50">
                {events.length}
              </span>
            </div>
            <p className="text-[11px] text-label-muted">
              <span className="text-streams font-medium">Key</span> moments
              always visible &middot; click to expand insights &middot; minor
              rows toggle chart markers
            </p>
          </div>
          <EventList
            events={events}
            observations={observations}
            visibleDates={toggledDates}
            onToggleVisibility={handleToggleVisibility}
            onHoverDate={setHighlightedDate}
            trackPerformance={initialData.trackPerformance}
            territory={territory}
          />
        </div>

        {/* Single Comparison Table */}
        <SingleComparisonTable
          trackPerformance={initialData.trackPerformance}
          campaignId={campaignId}
          territory={territory}
        />

        {/* Learnings Panel */}
        {learnings.length > 0 && (
          <div className="mt-6">
            <CampaignLearnings learnings={learnings} />
          </div>
        )}
      </main>
    </div>
  );
}
