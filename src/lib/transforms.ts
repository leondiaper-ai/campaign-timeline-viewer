import {
  CampaignData,
  ChartDataPoint,
  CampaignEvent,
  AutoObservation,
  Territory,
  TrackWeeklyMetric,
  TrackInfo,
  TrackLookupEntry,
} from "@/types";

// ——— Unified Chart Data Point ——————————————————————————————

export interface UnifiedChartDataPoint {
  date: string;
  total_streams: number;
  physical_units: number;
  events: CampaignEvent[];
  // Dynamic track keys: [trackName]: number | null
  [key: string]: number | string | null | CampaignEvent[];
}

// ——— Build Unified Timeline ————————————————————————————————
// Single preprocessing step that creates a continuous weekly dataset
// with campaign totals AND per-track streams layered in.
// Uses tracks_lookup release_week for strict line suppression.

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

  // 4. Build tracks_lookup index for release_week
  const tracksLookupMap = new Map<string, TrackLookupEntry>();
  (data.tracksLookup || []).forEach((entry) => {
    tracksLookupMap.set(entry.track_name, entry);
  });

  // 5. Build a continuous week timeline from campaign metrics
  const allDates = new Set<string>();
  campaignMetrics.forEach((m) => allDates.add(m.week_ending));
  trackMetrics.forEach((m) => allDates.add(m.week_ending));
  const sortedDates = [...allDates].sort();

  // 6. Build event lookup
  const eventsByDate = new Map<string, CampaignEvent[]>();
  campaignEvents.forEach((e) => {
    const existing = eventsByDate.get(e.date) || [];
    existing.push(e);
    eventsByDate.set(e.date, existing);
  });

  // 7. Build campaign metrics lookup
  const metricsLookup = new Map<
    string,
    { streams: number; physical: number }
  >();
  campaignMetrics.forEach((m) => {
    metricsLookup.set(m.week_ending, {
      streams: m.total_streams,
      physical: m.retail_units + m.d2c_units,
    });
  });

  // 8. Build track lookup: track -> date -> streams
  const trackLookup = new Map<string, Map<string, number>>();
  trackMetrics.forEach((m) => {
    if (!trackLookup.has(m.track_name))
      trackLookup.set(m.track_name, new Map());
    trackLookup.get(m.track_name)!.set(m.week_ending, m.total_streams);
  });

  // 9. Determine each track's release week:
  //    Priority: tracks_lookup.release_week > first week with streams > 0
  const trackReleaseWeek = new Map<string, string>();
  selectedTracks.forEach((track) => {
    const lookup = tracksLookupMap.get(track);
    if (lookup?.release_week) {
      trackReleaseWeek.set(track, lookup.release_week);
      return;
    }
    // Fallback: first week with streams > 0
    const dates = trackLookup.get(track);
    if (!dates) return;
    for (const date of sortedDates) {
      const val = dates.get(date);
      if (val && val > 0) {
        trackReleaseWeek.set(track, date);
        break;
      }
    }
  });

  // 10. Build unified data points
  const result: UnifiedChartDataPoint[] = sortedDates.map((date) => {
    const metric = metricsLookup.get(date);
    const point: UnifiedChartDataPoint = {
      date,
      total_streams: metric?.streams ?? 0,
      physical_units: metric?.physical ?? 0,
      events: eventsByDate.get(date) || [],
    };

    // Add track data — NULL before release week, actual value after
    selectedTracks.forEach((track) => {
      const releaseWeek = trackReleaseWeek.get(track);
      if (!releaseWeek || date < releaseWeek) {
        // Before release: null (not zero) so line doesn't render
        point[track] = null;
      } else {
        const val = trackLookup.get(track)?.get(date);
        point[track] = val ?? 0;
      }
    });

    return point;
  });

  // 11. Add orphan event dates as ghost points
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

// ——— Legacy buildChartData (kept for compatibility) ——————————

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

// ——— Filter events for event list ———————————————————————————

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

// ——— Track List (enriched with tracks_lookup) ————————————————

export function getTrackList(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): TrackInfo[] {
  const trackMetrics = data.trackMetrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );

  if (trackMetrics.length === 0) return [];

  // Build tracks_lookup index
  const lookupMap = new Map<string, TrackLookupEntry>();
  (data.tracksLookup || []).forEach((entry) => {
    lookupMap.set(entry.track_name, entry);
  });

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

    const lookup = lookupMap.get(trackName);

    tracks.push({
      track_name: trackName,
      first_active_week:
        firstActive?.week_ending || sorted[0].week_ending,
      total_streams: totalStreams,
      peak_week: peakWeek.week_ending,
      peak_streams: peakWeek.total_streams,
      // Enriched from tracks_lookup
      release_week: lookup?.release_week,
      track_role: lookup?.track_role,
      default_on: lookup?.default_on,
      sort_order: lookup?.sort_order,
    });
  });

  // Sort: if tracks_lookup provides sort_order, use it; else by total streams
  const hasLookup = tracks.some((t) => t.sort_order !== undefined);
  if (hasLookup) {
    tracks.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  } else {
    tracks.sort((a, b) => b.total_streams - a.total_streams);
  }

  return tracks;
}

// ——— Default track selection ————————————————————————————————
// Uses tracks_lookup.default_on if available, else top 2 by streams

export function getDefaultTracks(trackList: TrackInfo[]): string[] {
  // If any tracks have default_on set, use those
  const withDefault = trackList.filter((t) => t.default_on === true);
  if (withDefault.length > 0) {
    return withDefault.map((t) => t.track_name);
  }
  // Fallback: top 2 by total streams
  return trackList.slice(0, 2).map((t) => t.track_name);
}

// ——— Peak Week stats (for KPI cards) ————————————————————————

export interface PeakWeekStats {
  peakWeekStreams: number;
  peakWeekDate: string;
  topTrackName: string;
  topTrackStreams: number;
}

export function getPeakWeekStats(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): PeakWeekStats {
  const metrics = data.metrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );
  const sorted = [...metrics].sort((a, b) =>
    a.week_ending.localeCompare(b.week_ending)
  );

  // Peak week streams
  let peakWeekStreams = 0;
  let peakWeekDate = "";
  for (const m of sorted) {
    if (m.total_streams > peakWeekStreams) {
      peakWeekStreams = m.total_streams;
      peakWeekDate = m.week_ending;
    }
  }

  // Top track by total streams
  const trackMetrics = data.trackMetrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );
  const trackTotals = new Map<string, number>();
  trackMetrics.forEach((m) => {
    trackTotals.set(
      m.track_name,
      (trackTotals.get(m.track_name) || 0) + m.total_streams
    );
  });

  let topTrackName = "";
  let topTrackStreams = 0;
  trackTotals.forEach((total, name) => {
    if (total > topTrackStreams) {
      topTrackStreams = total;
      topTrackName = name;
    }
  });

  return { peakWeekStreams, peakWeekDate, topTrackName, topTrackStreams };
}

// ——— Extract top learnings from major events —————————————————

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
