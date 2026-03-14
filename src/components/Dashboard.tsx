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
