import {
  CampaignSheetData,
  ChartDataPoint,
  Moment,
  Territory,
  Track,
} from "@/types";

// ——— Build Chart Data ———————————————————————————————————————
// Creates a continuous weekly dataset with campaign totals,
// per-track streams, physical units, and moments layered in.
// This is the ONLY chart-data builder — no legacy variants.

export function buildChartData(
  sheet: CampaignSheetData,
  territory: Territory,
  selectedTracks: string[]
): ChartDataPoint[] {
  // 1. Pick the right streams column based on territory
  const streamKey =
    territory === "UK" ? "streams_uk" : "streams_global";

  // 2. Build TOTAL series (campaign aggregate)
  const totalByDate = new Map<string, number>();
  sheet.weeklyData
    .filter((r) => r.track_name === "TOTAL")
    .forEach((r) => totalByDate.set(r.week_start_date, r[streamKey]));

  // 3. Build track series: track -> date -> streams
  const trackByDate = new Map<string, Map<string, number>>();
  sheet.weeklyData
    .filter(
      (r) =>
        r.track_name !== "TOTAL" &&
        selectedTracks.includes(r.track_name)
    )
    .forEach((r) => {
      if (!trackByDate.has(r.track_name))
        trackByDate.set(r.track_name, new Map());
      trackByDate
        .get(r.track_name)!
        .set(r.week_start_date, r[streamKey]);
    });

  // 4. Build physical data lookup
  const physicalByDate = new Map<string, number>();
  sheet.physicalData.forEach((r) =>
    physicalByDate.set(r.week_start_date, r.units)
  );

  // 5. Build track release dates from tracks tab
  const trackReleaseDates = new Map<string, string>();
  sheet.tracks.forEach((t) => {
    if (t.release_date) trackReleaseDates.set(t.track_name, t.release_date);
  });

  // 6. Build moments lookup
  const momentsByDate = new Map<string, Moment[]>();
  sheet.moments.forEach((m) => {
    const existing = momentsByDate.get(m.date) || [];
    existing.push(m);
    momentsByDate.set(m.date, existing);
  });

  // 7. Collect all unique dates from data
  const allDates = new Set<string>();
  totalByDate.forEach((_, d) => allDates.add(d));
  trackByDate.forEach((dates) =>
    dates.forEach((_, d) => allDates.add(d))
  );
  physicalByDate.forEach((_, d) => allDates.add(d));
  const sortedDates = [...allDates].sort();

  // 8. Build data points
  const result: ChartDataPoint[] = sortedDates.map((date) => {
    const point: ChartDataPoint = {
      date,
      total_streams: totalByDate.get(date) ?? 0,
      physical_units: physicalByDate.get(date) ?? 0,
      cumulative_streams: 0, // computed after sort
      prev_week_streams: null, // computed after sort
      events: momentsByDate.get(date) || [],
    };

    // Add track data — null before release date, value after
    selectedTracks.forEach((track) => {
      const releaseDate = trackReleaseDates.get(track);
      if (releaseDate && date < releaseDate) {
        point[track] = null; // suppress line before release
      } else {
        const val = trackByDate.get(track)?.get(date);
        point[track] = val ?? 0;
      }
    });

    return point;
  });

  // 9. Add moment-only ghost dates that don't overlap with data
  const dataDates = new Set(sortedDates);
  sheet.moments.forEach((m) => {
    if (!dataDates.has(m.date)) {
      const point: ChartDataPoint = {
        date: m.date,
        total_streams: 0,
        physical_units: 0,
        cumulative_streams: 0,
        prev_week_streams: null,
        events: momentsByDate.get(m.date) || [],
      };
      selectedTracks.forEach((track) => {
        point[track] = null;
      });
      result.push(point);
    }
  });

  // 10. Sort and compute cumulative + previous week
  result.sort((a, b) => a.date.localeCompare(b.date));
  let runningTotal = 0;
  for (let i = 0; i < result.length; i++) {
    runningTotal += result[i].total_streams;
    result[i].cumulative_streams = runningTotal;
    result[i].prev_week_streams =
      i > 0 ? result[i - 1].total_streams : null;
  }

  return result;
}

// ——— Track List (sorted by sort_order) —————————————————————‒
export function getTrackList(sheet: CampaignSheetData): Track[] {
  return [...sheet.tracks].sort((a, b) => a.sort_order - b.sort_order);
}

// ——— Default Track Selection ————————————————————————————————
export function getDefaultTracks(tracks: Track[]): string[] {
  // 1. Use explicit default_on if set
  const withDefault = tracks.filter((t) => t.default_on);
  if (withDefault.length > 0) return withDefault.map((t) => t.track_name);

  // 2. Fallback for album: lead_single + second_single
  const leads = tracks.filter(
    (t) =>
      t.track_role === "lead_single" || t.track_role === "second_single"
  );
  if (leads.length > 0) return leads.map((t) => t.track_name);

  // 3. Fallback: first 2 tracks by sort_order
  return tracks.slice(0, 2).map((t) => t.track_name);
}

// ——— Peak Week Stats (for KPI cards) ————————————————————————
export interface PeakWeekStats {
  totalStreams: number;
  totalPhysical: number;
  peakWeekStreams: number;
  peakWeekDate: string;
  topTrackName: string;
  topTrackStreams: number;
}

export function getPeakWeekStats(
  sheet: CampaignSheetData,
  territory: Territory
): PeakWeekStats {
  const streamKey =
    territory === "UK" ? "streams_uk" : "streams_global";

  // Total streams from TOTAL rows
  const totalRows = sheet.weeklyData.filter(
    (r) => r.track_name === "TOTAL"
  );
  const totalStreams = totalRows.reduce(
    (sum, r) => sum + r[streamKey],
    0
  );

  // Peak week
  let peakWeekStreams = 0;
  let peakWeekDate = "";
  for (const r of totalRows) {
    if (r[streamKey] > peakWeekStreams) {
      peakWeekStreams = r[streamKey];
      peakWeekDate = r.week_start_date;
    }
  }

  // Total physical
  const totalPhysical = sheet.physicalData.reduce(
    (sum, r) => sum + r.units,
    0
  );

  // Top track — sum streams per track (real tracks only, not TOTAL)
  const trackTotals = new Map<string, number>();
  sheet.weeklyData
    .filter((r) => r.track_name !== "TOTAL")
    .forEach((r) => {
      trackTotals.set(
        r.track_name,
        (trackTotals.get(r.track_name) || 0) + r[streamKey]
      );
    });

  let topTrackName = "No track data";
  let topTrackStreams = 0;
  trackTotals.forEach((total, name) => {
    if (total > topTrackStreams) {
      topTrackStreams = total;
      topTrackName = name;
    }
  });

  return {
    totalStreams,
    totalPhysical,
    peakWeekStreams,
    peakWeekDate,
    topTrackName,
    topTrackStreams,
  };
}

// ——— Moment Helpers ——————————————————————————————————————————
export function getKeyMoments(sheet: CampaignSheetData): Moment[] {
  return sheet.moments
    .filter((m) => m.is_key)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getAllMoments(sheet: CampaignSheetData): Moment[] {
  return [...sheet.moments].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
