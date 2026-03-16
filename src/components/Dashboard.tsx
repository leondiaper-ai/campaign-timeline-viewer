"use client";

import { useState, useMemo, useCallback } from "react";
import { CampaignData, Territory } from "@/types";
import {
  buildUnifiedChartData,
  getFilteredEvents,
  getTopLearnings,
  getTrackList,
  getDefaultTracks,
} from "@/lib/transforms";
import { generateObservations } from "@/lib/observations";

import CampaignSelector from "./CampaignSelector";
import TerritoryToggle from "./TerritoryToggle";
import CampaignInsights from "./CampaignInsights";
import TimelineChart from "./TimelineChart";
import EventList from "./EventList";
import CategoryLegend from "./CategoryLegend";
import CampaignLearnings from "./CampaignLearnings";

// ─── Track palette (must match TimelineChart) ─────────────────
const TRACK_COLORS = [
  "#FBBF24",
  "#F472B6",
  "#22D3EE",
  "#A78BFA",
  "#FB7185",
  "#F97316",
];

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
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [tracksInitialized, setTracksInitialized] = useState(false);

  // ─── Derived Data ─────────────────────────────────────────

  const trackList = useMemo(
    () => getTrackList(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  // Auto-select default tracks on first render / campaign change
  if (!tracksInitialized && trackList.length > 0) {
    const defaults = getDefaultTracks(trackList);
    if (defaults.length > 0) {
      setSelectedTracks(defaults);
      setTracksInitialized(true);
    }
  }

  const chartData = useMemo(
    () =>
      buildUnifiedChartData(initialData, campaignId, territory, selectedTracks),
    [initialData, campaignId, territory, selectedTracks]
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

  const selectedCampaign = initialData.campaigns.find(
    (c) => c.campaign_id === campaignId
  );

  // ─── Handlers ─────────────────────────────────────────────

  const handleCampaignChange = useCallback(
    (id: string) => {
      setCampaignId(id);
      setToggledDates(new Set());
      setSelectedTracks([]);
      setTracksInitialized(false);
    },
    []
  );

  const handleTerritoryChange = useCallback((t: Territory) => {
    setTerritory(t);
    setToggledDates(new Set());
    setSelectedTracks([]);
    setTracksInitialized(false);
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

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0F1117" }}>
      {/* ─── Header ──────────────────────────────── */}
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

      {/* ─── Main ────────────────────────────────── */}
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

        {/* ─── KPI Cards ─────────────────────────── */}
        <CampaignInsights
          metrics={initialData.metrics}
          campaignId={campaignId}
          territory={territory}
        />

        {/* ─── Chart Card ────────────────────────── */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
        >
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
              Weekly Performance
            </h3>

            {/* Chart legend */}
            <div className="flex items-center gap-5">
              {/* Campaign total */}
              <div className="flex items-center gap-2">
                <span className="w-5 h-[3px] rounded-full bg-streams inline-block" />
                <span className="text-[11px] text-label-muted font-medium">
                  Total Streams
                </span>
              </div>

              {/* Track legend entries */}
              {selectedTracks.map((track, i) => (
                <div key={track} className="flex items-center gap-2">
                  <span
                    className="w-4 h-[2px] rounded-full inline-block"
                    style={{
                      backgroundColor: TRACK_COLORS[i % TRACK_COLORS.length],
                      opacity: 0.7,
                    }}
                  />
                  <span className="text-[10px] text-label-muted">
                    {track.length > 18
                      ? track.substring(0, 16) + "..."
                      : track}
                  </span>
                </div>
              ))}

              {/* Physical */}
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-3 rounded-sm inline-block"
                  style={{ backgroundColor: "#4ADE80", opacity: 0.25 }}
                />
                <span className="text-[11px] text-label-muted font-medium">
                  Physical
                </span>
              </div>

              {/* Moments */}
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-[2px] inline-block"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, #353849 0, #353849 2px, transparent 2px, transparent 5px)",
                  }}
                />
                <span className="text-[11px] text-label-muted font-medium">
                  Moment
                </span>
              </div>
            </div>
          </div>

          {/* Track selector chips */}
          {trackList.length > 0 && (
            <div className="px-6 pb-2 flex flex-wrap gap-2">
              {trackList.map((track) => {
                const isSelected = selectedTracks.includes(track.track_name);
                const trackIndex = selectedTracks.indexOf(track.track_name);
                const chipColor =
                  trackIndex >= 0
                    ? TRACK_COLORS[trackIndex % TRACK_COLORS.length]
                    : undefined;

                return (
                  <button
                    key={track.track_name}
                    onClick={() => handleTrackToggle(track.track_name)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                      isSelected
                        ? "text-label-primary"
                        : "bg-transparent border-border text-label-muted hover:border-border-light"
                    }`}
                    style={
                      isSelected && chipColor
                        ? {
                            backgroundColor: chipColor + "15",
                            borderColor: chipColor + "60",
                          }
                        : undefined
                    }
                  >
                    {track.track_name}
                  </button>
                );
              })}
            </div>
          )}

          {/* The unified chart */}
          <TimelineChart
            data={chartData}
            selectedTracks={selectedTracks}
            visibleEventDates={visibleEventDates}
            highlightedDate={highlightedDate}
          />
        </div>

        {/* ─── Events Card ───────────────────────── */}
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
            trackPerformance={[]}
            territory={territory}
          />
        </div>

        {/* ─── Learnings Panel ───────────────────── */}
        {learnings.length > 0 && (
          <div className="mt-6">
            <CampaignLearnings learnings={learnings} />
          </div>
        )}
      </main>
    </div>
  );
}
