"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { CampaignData, Territory } from "@/types";
import {
  buildChartData,
  buildTrackChartData,
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
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const chartData = useMemo(
    () => buildChartData(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  const events = useMemo(
    () => getFilteredEvents(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  // Auto-generate observations by comparing moments to weekly metrics
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

  // Campaign insight (verdict, top moment, momentum)
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

  // Track list for By Track mode
  const trackList = useMemo(
    () => getTrackList(initialData, campaignId, territory),
    [initialData, campaignId, territory]
  );

  const hasTrackData = trackList.length > 0;

  // Track chart data
  const trackChartData = useMemo(
    () =>
      selectedTrackId
        ? buildTrackChartData(initialData, campaignId, territory, selectedTrackId)
        : null,
    [initialData, campaignId, territory, selectedTrackId]
  );

  // Selected track name for tooltip
  const selectedTrackName = useMemo(() => {
    if (!selectedTrackId) return "";
    return trackList.find((t) => t.track_id === selectedTrackId)?.track_name || "";
  }, [trackList, selectedTrackId]);

  // Auto-select first track when entering by_track mode
  useEffect(() => {
    if (streamView === "by_track" && !selectedTrackId && trackList.length > 0) {
      setSelectedTrackId(trackList[0].track_id);
    }
  }, [streamView, selectedTrackId, trackList]);

  // Reset stream view when campaign/territory changes
  useEffect(() => {
    setStreamView("total");
    setSelectedTrackId(null);
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

      {/+ ─── Main ───────────────────────────────────────── */}
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

        {/* ─── Campaign Stats (4 primary stat cards) */}
        <CampaignInsights
          insight={insight}
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
                Weekly Performance
              </h3>

              {/* Stream View Toggle — only show if track data exists */}
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
                    Total Campaign
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
                    By Track
                  </button>
                </div>
              )}

              {/* Track selector — only show in by_track mode */}
              {streamView === "by_track" && hasTrackData && (
                <select
                  className="text-[11px] font-medium rounded-lg border px-2.5 py-1.5 appearance-none cursor-pointer"
                  style={{
                    backgroundColor: "#1E2130",
                    borderColor: "#2A2D3E",
                    color: "#E2E8F0",
                  }}
                  value={selectedTrackId || ""}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                >
                  {trackList.map((t) => (
                    <option key={t.track_id} value={t.track_id}>
                      {t.track_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-4 h-[2px] rounded-full bg-streams inline-block" />
                <span className="text-[11px] text-label-muted font-medium">
                  {streamView === "by_track" && selectedTrackName
                    ? selectedTrackName
                    : "Total DSP Streams"}
                </span>
              </div>
              {streamView === "by_track" && (
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-[2px] inline-block"
                    style={{ backgroundColor: "#6C9EFF", opacity: 0.25 }}
                  />
                  <span className="text-[11px] text-label-muted font-medium">
                    Total Campaign
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

          <PerformanceChart
            data={chartData}
            visibleEventDates={visibleEventDates}
            highlightedDate={highlightedDate}
            streamView={streamView}
            trackData={trackChartData}
            trackName={selectedTrackName}
          />
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
            trackPerformance={initialData.trackPerformance}
            territory={territory}
          />
        </div>

        {/* ─── Single Comparison Table ──────────────────── */}
        <SingleComparisonTable
          trackPerformance={initialData.trackPerformance}
          campaignId={campaignId}
          territory={territory}
        />

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
