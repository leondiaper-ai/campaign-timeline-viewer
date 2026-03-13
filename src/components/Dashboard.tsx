"use client";

import { useState, useMemo, useCallback } from "react";
import { CampaignData, Territory } from "@/types";
import {
  buildChartData,
  getFilteredEvents,
  getTopLearnings,
} from "@/lib/transforms";
import { generateObservations } from "@/lib/observations";
import CampaignSelector from "./CampaignSelector";
import TerritoryToggle from "./TerritoryToggle";
import PerformanceChart from "./PerformanceChart";
import EventList from "./EventList";
import CategoryLegend from "./CategoryLegend";
import CampaignLearnings from "./CampaignLearnings";
import CampaignStats from "./CampaignStats";

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

  const learnings = useMemo(
    () => getTopLearnings(events, observations, 3),
    [events, observations]
  );

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

        {/* ─── Campaign Stats Bar ──────────────────────── */}
        <CampaignStats
          metrics={initialData.metrics}
          campaignId={campaignId}
        />

        {/* ─── Chart Card ───────────────────────────────── */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
        >
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
              Weekly Performance
            </h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-4 h-[2px] rounded-full bg-streams inline-block" />
                <span className="text-[11px] text-label-muted font-medium">
                  Total DSP Streams
                </span>
              </div>
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
