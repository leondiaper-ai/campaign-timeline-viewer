import {
  CampaignData,
  ChartDataPoint,
  CampaignEvent,
  AutoObservation,
  Territory,
  TrackWeeklyMetric,
  TrackInfo,
} from "@/types";

// âââ Unified Chart Data Point âââââââââââââââââââââââââââââ

export interface UnifiedChartDataPoint {
  date: string;
  total_streams: number;
  physical_units: number;
  events: CampaignEvent[];
  // Dynamic track keys: [trackName]: number | null
  [key: string]: number | string | null | CampaignEvent[];
}

// âââ Build Unified Timeline âââââââââââââââââââââââââââââ
// Single preprocessing step that creates a continuous weekly dataset
// with campaign totals AND per-track streams layered in.

export function buildUnifiedChartData(
  data: CampaignData,
  campaignId: string,
  territory: Territory,
  selectedTracks: string[]
): UnifiedChartDataPoint[] {
  // 1. Get campaign-level weekly metrics
  const campaignMetrics = data.metrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );

  // 2. Get campaign events
  const campaignEvents = data.events.filter(
    (e) =>
      e.campaign_id === campaignId &&
      (e.territory === "global" || e.territory === territory)
  );

  // 3. Get track metrics for selected tracks
  const trackMetrics = data.trackMetrics.filter(
    (m) =>
      m.campaign_id === campaignId &&
      m.territory === territory &&
      selectedTracks.includes(m.track_name)
  );

  // 4. Build a continuous week timeline from campaign metrics
  const allDates = new Set<string>();
  campaignMetrics.forEach((m) => allDates.add(m.week_ending));
  trackMetrics.forEach((m) => allDates.add(m.week_ending));

  const sortedDates = [...allDates].sort();

  // 5. Build event lookup
  const eventsByDate = new Map<string, CampaignEvent[]>();
  campaignEvents.forEach((e) => {
    const existing = eventsByDate.get(e.date) || [];
    existing.push(e);
    eventsByDate.set(e.date, existing);
  });

  // 6. Build campaign metrics lookup
  const metricsLookup = new Map<string, { streams: number; physical: number }>();
  campaignMetrics.forEach((m) => {
    metricsLookup.set(m.week_ending, {
      streams: m.total_streams,
      physical: m.retail_units + m.d2c_units,
    });
  });

  // 7. Build track lookup: track -> date -> streams
  const trackLookup = new Map<string, Map<string, number>>();
  trackMetrics.forEach((m) => {
    if (!trackLookup.has(m.track_name)) trackLookup.set(m.track_name, new Map());
    trackLookup.get(m.track_name)!.set(m.week_ending, m.total_streams);
  });

  // 8. Determine each track's first active week (first week with streams > 0)
  const trackFirstWeek = new Map<string, string>();
  selectedTracks.forEach((track) => {
    const dates = trackLookup.get(track);
    if (!dates) return;
    for (const date of sortedDates) {
      const val = dates.get(date);
      if (val && val > 0) {
        trackFirstWeek.set(track, date);
        break;
      }
    }
  });

  // 9. Build unified data points
  const result: UnifiedChartDataPoint[] = sortedDates.map((date) => {
    const metric = metricsLookup.get(date);
    const point: UnifiedChartDataPoint = {
      date,
      total_streams: metric?.streams ?? 0,
      physical_units: metric?.physical ?? 0,
      events: eventsByDate.get(date) || [],
    };

    // Add track data â NULL before release week, actual value after
    selectedTracks.forEach((track) => {
      const firstWeek = trackFirstWeek.get(track);
      if (!firstWeek || date < firstWeek) {
        // Before release: null (not zero) so line doesn't render
        point[track] = null;
      } else {
        const val = trackLookup.get(track)?.get(date);
        point[track] = val ?? 0;
      }
    });

    return point;
  });

  // 10. Add orphan event dates as ghost points
  const metricDates = new Set(sortedDates);
  campaignEvents.forEach((e) => {
    if (!metricDates.has(e.date)) {
      const point: UnifiedChartDataPoint = {
        date: e.date,
        total_streams: 0,
        physical_units: 0,
        events: eventsByDate.get(e.date) || [],
      };
      selectedTracks.forEach((track) => {
        point[track] = null;
      });
      result.push(point);
    }
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// âââ Legacy buildChartData (kept for compatibility) âââââââââââ

export function buildChartData(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): ChartDataPoint[] {
  const unified = buildUnifiedChartData(data, campaignId, territory, []);
  return unified.map((p) => ({
    date: p.date,
    total_streams: p.total_streams,
    physical_units: p.physical_units,
    events: p.events,
  }));
}

// âââ Filter events for event list âââââââââââââââââââââââââ

export function getFilteredEvents(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): CampaignEvent[] {
  return data.events
    .filter(
      (e) =>
        e.campaign_id === campaignId &&
        (e.territory === "global" || e.territory === territory)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

// âââ Track List âââââââââââââââââââââââââââââââââââââââââ

export function getTrackList(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): TrackInfo[] {
  const trackMetrics = data.trackMetrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );

  if (trackMetrics.length === 0) return [];

  const trackMap = new Map<string, TrackWeeklyMetric[]>();
  trackMetrics.forEach((m) => {
    const existing = trackMap.get(m.track_name) || [];
    existing.push(m);
    trackMap.set(m.track_name, existing);
  });

  const tracks: TrackInfo[] = [];
  trackMap.forEach((metrics, trackName) => {
    const sorted = [...metrics].sort((a, b) =>
      a.week_ending.localeCompare(b.week_ending)
    );

    const firstActive = sorted.find((m) => m.total_streams > 0);
    const totalStreams = sorted.reduce((s, m) => s + m.total_streams, 0);
    const peakWeek = sorted.reduce(
      (best, m) => (m.total_streams > best.total_streams ? m : best),
      sorted[0]
    );

    tracks.push({
      track_name: trackName,
      first_active_week: firstActive?.week_ending || sorted[0].week_ending,
      total_streams: totalStreams,
      peak_week: peakWeek.week_ending,
      peak_streams: peakWeek.total_streams,
    });
  });

  // Sort by total streams descending
  tracks.sort((a, b) => b.total_streams - a.total_streams);
  return tracks;
}

// âââ Default track selection ââââââââââââââââââââââââââââ
// Auto-select the top 2 tracks (lead single + second single)

export function getDefaultTracks(trackList: TrackInfo[]): string[] {
  return trackList.slice(0, 2).map((t) => t.track_name);
}

// âââ Extract top learnings from major events ââââââââââââââ

export interface CampaignLearning {
  event_title: string;
  event_type: CampaignEvent["event_type"];
  what_we_learned: string;
  observed_impact: string;
  confidence: CampaignEvent["confidence"];
  date: string;
  source: "manual" | "auto";
}

export function getTopLearnings(
  events: CampaignEvent[],
  observations: Map<string, AutoObservation>,
  limit = 3
): CampaignLearning[] {
  const results: Array<{ learning: CampaignLearning; score: number }> = [];

  const withManual = events.filter(
    (e) => e.what_we_learned && e.observed_impact
  );

  for (const e of withManual) {
    let score = 20;
    if (e.is_major) score += 10;
    if (e.confidence === "high") score += 6;
    else if (e.confidence === "medium") score += 3;
    else if (e.confidence === "low") score += 1;

    results.push({
      learning: {
        event_title: e.event_title,
        event_type: e.event_type,
        what_we_learned: e.what_we_learned!,
        observed_impact: e.observed_impact!,
        confidence: e.confidence,
        date: e.date,
        source: "manual",
      },
      score,
    });
  }

  const manualDates = new Set(withManual.map((e) => e.date));
  const majorWithoutManual = events.filter(
    (e) => e.is_major && !manualDates.has(e.date)
  );

  for (const e of majorWithoutManual) {
    const obs = observations.get(e.date);
    if (!obs || obs.summary.startsWith("Not enough")) continue;

    results.push({
      learning: {
        event_title: e.event_title,
        event_type: e.event_type,
        what_we_learned: obs.summary,
        observed_impact:
          obs.streams_change_pct !== null
            ? `${obs.streams_change_pct > 0 ? "+" : ""}${obs.streams_change_pct}% streams week-on-week`
            : "Insufficient data",
        confidence: undefined,
        date: e.date,
        source: "auto",
      },
      score: 5,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => r.learning);
}
((a, b) => b.score - a.score);
