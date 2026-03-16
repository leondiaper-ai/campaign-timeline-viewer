"use client";

import { useState, useMemo, useCallback } from "react";
import { CampaignData, Territory, ChartViewMode, TrackDisplayMode } from "@/types";
import {
  buildChartData,
  getFilteredEvents,
  getTopLearnings,
  getTrackList,
  buildTrackChartData,
} from "@/lib/transforms";
import { generateObservations } from "@/lib/observations";
import { generateCampaignNarrative, generateTrackNarrative } from "@/lib/narratives";
import CampaignSelector from "./CampaignSelector";
import TerritoryToggle from "./TerritoryToggle";
import CampaignInsights from "./CampaignInsights";
import PerformanceChart from "./PerformanceChart";
import TrackComparisonChart from "./TrackComparisonChart";
import EventList from "./EventList";
import CategoryLegend from "./CategoryLegend";
import CampaignLearnings from "./CampaignLearnings";
import NarrativeSummary from "./NarrativeSummary";

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

  // Chart view mode: campaign overview vs track comparison
  const [chartView, setChartView] = useState<ChartViewMode>("campaign");
  const [trackDisplayMode, setTrackDisplayMode] = useState<TrackDisplayMode>("raw");
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);

  // ─── Derived Data ──────────────────────────────────────────────

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

  const learnings = useMemo(
    () => getTopLearnings(events, observations, 3),
    [events, observations]
  );

  const trackList = useMemo(
    () => getTrackList(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  const hasTrackData = trackList.length > 0;

  const trackChartData = useMemo(
    () =>
      hasTrackData && selectedTracks.length > 0
        ? buildTrackChartData(
            initialData,
            campaignId,
            territory,
            selectedTracks,
            trackDisplayMode
          )
        : [],
    [initialData, campaignId, territory, selectedTracks, trackDisplayMode, hasTrackData]
  );

  // Narrative
  const narrative = useMemo(
    () => generateCampaignNarrative(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  const trackNarrative = useMemo(
    () => (hasTrackData ? generateTrackNarrative(trackList, territory) : undefined),
    [hasTrackData, trackList, territory]
  );

  const selectedCampaign = initialData.campaigns.find(
    (c) => c.campaign_id === campaignId
  );

  // ─── Handlers ─────────────────────────────────────────────────

  const handleCampaignChange = useCallback(
    (id: string) => {
      setCampaignId(id);
      setToggledDates(new Set());
      setChartView("campaign");
      setSelectedTracks([]);
    },
    []
  );

  const handleTerritoryChange = useCallback((t: Territory) => {
    setTerritory(t);
    setToggledDates(new Set());
    setSelectedTracks([]);
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

  const handleChartViewChange = useCallback(
    (view: ChartViewMode) => {
      setChartView(view);
      // Auto-select top 3 tracks when entering track view
      if (view === "tracks" && selectedTracks.length === 0 && trackList.length > 0) {
        setSelectedTracks(trackList.slice(0, 3).map((t) => t.track_name));
      }
    },
    [selectedTracks, trackList]
  );

  const handleTrackToggle = useCallback((trackName: string) => {
    setSelectedTracks((prev) => {
      if (prev.includes(trackName)) {
        return prev.filter((t) => t !== trackName);
      }
      if (prev.length >= 6) return prev; // max 6 tracks
      return [...prev, trackName];
    });
  }, []);

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

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0F1117" }}>
      {/* ─── Header ─────────────────────────────────────── */}
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

      {/* ─── Main ───────────────────────────────────────── */}
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

        {/* ─── Narrative Summary ──────────────────────────── */}
        <NarrativeSummary
          narrative={narrative}
          trackNarrative={trackNarrative}
        />

        {/* ─── Stat Cards ─────────────────────────────────── */}
        <CampaignInsights
          metrics={initialData.metrics}
          campaignId={campaignId}
          territory={territory}
        />

        {/* ─── Chart Card ───────────────────────────────── */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
        >
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
                {chartView === "campaign"
                  ? "Weekly Performance"
                  : "Track Comparison"}
              </h3>

              {/* View toggle — only show if track data exists */}
              {hasTrackData && (
                <div className="inline-flex rounded-lg border border-border bg-surface-primary p-0.5">
                  <button
                    onClick={() => handleChartViewChange("campaign")}
                    className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all uppercase tracking-wider ${
                      chartView === "campaign"
                        ? "bg-surface-card text-label-primary shadow-sm"
                        : "text-label-muted hover:text-label-secondary"
                    }`}
                  >
                    Campaign
                  </button>
                  <button
                    onClick={() => handleChartViewChange("tracks")}
                    className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all uppercase tracking-wider ${
                      chartView === "tracks"
                        ? "bg-surface-card text-label-primary shadow-sm"
                        : "text-label-muted hover:text-label-secondary"
                    }`}
                  >
                    Tracks
                  </button>
                </div>
              )}
            </div>

            {/* Chart legend / track controls */}
            {chartView === "campaign" ? (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-[2px] rounded-full bg-streams inline-block" />
                  <span className="text-[11px] text-label-muted font-medium">
                    Total DSP Streams
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-3 rounded-sm inline-block"
                    style={{ backgroundColor: "#4ADE80", opacity: 0.3 }}
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
            ) : (
              <div className="flex items-center gap-3">
                {/* Raw / Indexed toggle */}
                <div className="inline-flex rounded-lg border border-border bg-surface-primary p-0.5">
                  <button
                    onClick={() => setTrackDisplayMode("raw")}
                    className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all uppercase tracking-wider ${
                      trackDisplayMode === "raw"
                        ? "bg-surface-card text-label-primary shadow-sm"
                        : "text-label-muted hover:text-label-secondary"
                    }`}
                  >
                    Raw
                  </button>
                  <button
                    onClick={() => setTrackDisplayMode("indexed")}
                    className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all uppercase tracking-wider ${
                      trackDisplayMode === "indexed"
                        ? "bg-surface-card text-label-primary shadow-sm"
                        : "text-label-muted hover:text-label-secondary"
                    }`}
                  >
                    Indexed
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Track selector chips — only in track view */}
          {chartView === "tracks" && hasTrackData && (
            <div className="px-6 pb-2 flex flex-wrap gap-2">
              {trackList.map((track) => {
                const isSelected = selectedTracks.includes(track.track_name);
                return (
                  <button
                    key={track.track_name}
                    onClick={() => handleTrackToggle(track.track_name)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                      isSelected
                        ? "bg-streams/10 border-streams/40 text-label-primary"
                        : "bg-transparent border-border text-label-muted hover:border-border-light"
                    }`}
                  >
                    {track.track_name}
                  </button>
                );
              })}
            </div>
          )}

          {/* The chart itself */}
          {chartView === "campaign" ? (
            <PerformanceChart
              data={chartData}
              visibleEventDates={visibleEventDates}
              highlightedDate={highlightedDate}
            />
          ) : (
            <TrackComparisonChart
              data={trackChartData}
              selectedTracks={selectedTracks}
              displayMode={trackDisplayMode}
            />
          )}
        </div>

        {/* ─── Events Card ──────────────────────────────── */}
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
          />
        </div>

        {/* ─── Learnings Panel ──────────────────────────── */}
        {learnings.length > 0 && (
          <div className="mt-6">
            <CampaignLearnings learnings={learnings} />
          </div>
        )}
      </main>
    </div>
  );
}
