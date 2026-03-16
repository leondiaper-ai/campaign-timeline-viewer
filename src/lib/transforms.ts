import {
  CampaignData,
  ChartDataPoint,
  TrackChartDataPoint,
  CampaignEvent,
  AutoObservation,
  Territory,
  TrackWeeklyMetric,
  TrackInfo,
  TrackDisplayMode,
} from "@/types";

// ─── Transform data for campaign chart ──────────────────────────

export function buildChartData(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): ChartDataPoint[] {
  const filteredMetrics = data.metrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );

  const filteredEvents = data.events.filter(
    (e) =>
      e.campaign_id === campaignId &&
      (e.territory === "global" || e.territory === territory)
  );

  const eventsByDate = new Map<string, CampaignEvent[]>();
  filteredEvents.forEach((e) => {
    const existing = eventsByDate.get(e.date) || [];
    existing.push(e);
    eventsByDate.set(e.date, existing);
  });

  const chartPoints: ChartDataPoint[] = filteredMetrics
    .sort((a, b) => a.week_ending.localeCompare(b.week_ending))
    .map((m) => ({
      date: m.week_ending,
      total_streams: m.total_streams,
      physical_units: m.retail_units + m.d2c_units,
      events: eventsByDate.get(m.week_ending) || [],
    }));

  // Add orphan event dates as ghost points
  const metricDates = new Set(chartPoints.map((p) => p.date));
  filteredEvents.forEach((e) => {
    if (!metricDates.has(e.date)) {
      const existing = chartPoints.find((p) => p.date === e.date);
      if (!existing) {
        chartPoints.push({
          date: e.date,
          total_streams: 0,
          physical_units: 0,
          events: eventsByDate.get(e.date) || [],
        });
      }
    }
  });

  return chartPoints.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Filter events for event list ───────────────────────────────

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

// ─── Track List ─────────────────────────────────────────────────

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

    // First week where streams > 0
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

// ─── Track Comparison Chart Data ────────────────────────────────

export function buildTrackChartData(
  data: CampaignData,
  campaignId: string,
  territory: Territory,
  selectedTracks: string[],
  displayMode: TrackDisplayMode
): TrackChartDataPoint[] {
  const trackMetrics = data.trackMetrics.filter(
    (m) =>
      m.campaign_id === campaignId &&
      m.territory === territory &&
      selectedTracks.includes(m.track_name)
  );

  if (trackMetrics.length === 0) return [];

  // Collect all dates across selected tracks
  const dateSet = new Set();
  trackMetrics.forEach((m) => dateSet.add(m.week_ending));
  const allDates = [...dateSet].sort();

  // Build lookup: trackName → date → streams
  const lookup = new Map();
  trackMetrics.forEach((m) => {
    if (!lookup.has(m.track_name)) lookup.set(m.track_name, new Map());
    lookup.get(m.track_name).set(m.week_ending, m.total_streams);
  });

  // For indexed mode, find the first non-zero value per track
  const firstValues = new Map();
  if (displayMode === "indexed") {
    selectedTracks.forEach((track) => {
      const trackDates = lookup.get(track);
      if (!trackDates) return;
      for (const date of allDates) {
        const val = trackDates.get(date) || 0;
        if (val > 0) {
          firstValues.set(track, val);
          break;
        }
      }
    });
  }

  return allDates.map((date) => {
    const point = { date };
    selectedTracks.forEach((track) => {
      const raw = lookup.get(track)?.get(date) || 0;
      if (displayMode === "indexed") {
        const base = firstValues.get(track) || 1;
        point[track] = raw > 0 ? Math.round((raw / base) * 100) : 0;
      } else {
        point[track] = raw;
      }
    });
    return point;
  });
}
