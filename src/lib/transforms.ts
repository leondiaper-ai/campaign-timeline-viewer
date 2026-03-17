import {
  CampaignSheetData,
  ChartDataPoint,
  Moment,
  Territory,
  Track,
  TrackWeeklyMetric,
} from "@/types";

// ——— Build Chart Data ———————————————————————————————————————
export function buildChartData(
  sheet: CampaignSheetData,
  territory: Territory,
  selectedTracks: string[]
): ChartDataPoint[] {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  const totalByDate = new Map<string, number>();
  sheet.weeklyData
    .filter((r) => r.track_name === "TOTAL")
    .forEach((r) => totalByDate.set(r.week_start_date, r[streamKey]));

  const trackByDate = new Map<string, Map<string, number>>();
  sheet.weeklyData
    .filter((r) => r.track_name !== "TOTAL" && selectedTracks.includes(r.track_name))
    .forEach((r) => {
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.week_start_date, r[streamKey]);
    });

  const physicalByDate = new Map<string, number>();
  sheet.physicalData.forEach((r) => physicalByDate.set(r.week_start_date, r.units));

  const trackReleaseDates = new Map<string, string>();
  sheet.tracks.forEach((t) => {
    if (t.release_date) trackReleaseDates.set(t.track_name, t.release_date);
  });

  const momentsByDate = new Map<string, Moment[]>();
  sheet.moments.forEach((m) => {
    const existing = momentsByDate.get(m.date) || [];
    existing.push(m);
    momentsByDate.set(m.date, existing);
  });

  const allDates = new Set<string>();
  totalByDate.forEach((_, d) => allDates.add(d));
  trackByDate.forEach((dates) => dates.forEach((_, d) => allDates.add(d)));
  physicalByDate.forEach((_, d) => allDates.add(d));

  const sortedDates = [...allDates].sort();

  const result: ChartDataPoint[] = sortedDates.map((date) => {
    const point: ChartDataPoint = {
      date,
      total_streams: totalByDate.get(date) ?? 0,
      physical_units: physicalByDate.get(date) ?? 0,
      cumulative_streams: 0,
      prev_week_streams: null,
      events: momentsByDate.get(date) || [],
    };
    selectedTracks.forEach((track) => {
      const releaseDate = trackReleaseDates.get(track);
      if (releaseDate && date < releaseDate) {
        point[track] = null;
      } else {
        point[track] = trackByDate.get(track)?.get(date) ?? 0;
      }
    });
    return point;
  });

  // Add moment-only ghost dates
  const dataDates = new Set(sortedDates);
  sheet.moments.forEach((m) => {
    if (!dataDates.has(m.date)) {
      const point: ChartDataPoint = {
        date: m.date, total_streams: 0, physical_units: 0,
        cumulative_streams: 0, prev_week_streams: null,
        events: momentsByDate.get(m.date) || [],
      };
      selectedTracks.forEach((track) => { point[track] = null; });
      result.push(point);
    }
  });

  result.sort((a, b) => a.date.localeCompare(b.date));
  let runningTotal = 0;
  for (let i = 0; i < result.length; i++) {
    runningTotal += result[i].total_streams;
    result[i].cumulative_streams = runningTotal;
    result[i].prev_week_streams = i > 0 ? result[i - 1].total_streams : null;
  }
  return result;
}


// ——— Build Track Chart Data (By Track view) ————————————————
export function buildTrackChartData(
  sheet: CampaignSheetData,
  territory: Territory,
  trackWeeklyMetrics: TrackWeeklyMetric[],
  trackId: string
): ChartDataPoint[] {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalByDate = new Map<string, number>();
  sheet.weeklyData.filter((r) => r.track_name === "TOTAL")
    .forEach((r) => totalByDate.set(r.week_start_date, r[streamKey]));
  const trackByDate = new Map<string, number>();
  trackWeeklyMetrics.filter((m) => m.track_id === trackId && m.territory === territory)
    .forEach((m) => trackByDate.set(m.week_ending, m.total_streams));
  const physicalByDate = new Map<string, number>();
  sheet.physicalData.forEach((r) => physicalByDate.set(r.week_start_date, r.units));
  const momentsByDate = new Map<string, Moment[]>();
  sheet.moments.forEach((m) => {
    const existing = momentsByDate.get(m.date) || [];
    existing.push(m);
    momentsByDate.set(m.date, existing);
  });
  const allDates = new Set<string>();
  totalByDate.forEach((_, d) => allDates.add(d));
  trackByDate.forEach((_, d) => allDates.add(d));
  physicalByDate.forEach((_, d) => allDates.add(d));
  const sortedDates = [...allDates].sort();
  const result: ChartDataPoint[] = sortedDates.map((date) => ({
    date,
    total_streams: totalByDate.get(date) ?? 0,
    track_streams: trackByDate.get(date) ?? 0,
    physical_units: physicalByDate.get(date) ?? 0,
    cumulative_streams: 0, prev_week_streams: null,
    events: momentsByDate.get(date) || [],
  }));
  let runningTotal = 0;
  for (let i = 0; i < result.length; i++) {
    runningTotal += (result[i].track_streams as number) || 0;
    result[i].cumulative_streams = runningTotal;
    result[i].prev_week_streams = i > 0 ? ((result[i - 1].track_streams as number) || 0) : null;
  }
  return result;
}

// ——— Track Helpers ——————————————————————————————————————————
export function getTrackListForChart(
  trackWeeklyMetrics: TrackWeeklyMetric[], territory: Territory
): Array<{ track_id: string; track_name: string }> {
  const seen = new Map<string, string>();
  trackWeeklyMetrics.filter((m) => m.territory === territory)
    .forEach((m) => { if (!seen.has(m.track_id)) seen.set(m.track_id, m.track_name); });
  return Array.from(seen.entries()).map(([track_id, track_name]) => ({ track_id, track_name }));
}

export function getTrackList(sheet: CampaignSheetData): Track[] {
  return [...sheet.tracks].sort((a, b) => a.sort_order - b.sort_order);
}

export function getDefaultTracks(tracks: Track[]): string[] {
  const withDefault = tracks.filter((t) => t.default_on);
  if (withDefault.length > 0) return withDefault.map((t) => t.track_name);
  const NARRATIVE_ROLES = ["lead_single", "second_single", "third_single", "promo_single", "focus_track"];
  const singles = tracks.filter((t) => NARRATIVE_ROLES.includes(t.track_role));
  if (singles.length > 0) return singles.map((t) => t.track_name);
  const nonAlbum = tracks.filter((t) => t.track_role !== "album_track" && t.track_role !== "title_track");
  if (nonAlbum.length > 0) return nonAlbum.slice(0, 2).map((t) => t.track_name);
  return tracks.slice(0, 2).map((t) => t.track_name);
}


// ——— Peak Week Stats ————————————————————————————————————————
export interface PeakWeekStats {
  totalStreams: number;
  totalPhysical: number;
  peakWeekStreams: number;
  peakWeekDate: string;
  topTrackName: string;
  topTrackStreams: number;
}

export function getPeakWeekStats(sheet: CampaignSheetData, territory: Territory): PeakWeekStats {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL");
  const totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);
  let peakWeekStreams = 0, peakWeekDate = "";
  for (const r of totalRows) {
    if (r[streamKey] > peakWeekStreams) { peakWeekStreams = r[streamKey]; peakWeekDate = r.week_start_date; }
  }
  const totalPhysical = sheet.physicalData.reduce((sum, r) => sum + r.units, 0);
  const trackTotals = new Map<string, number>();
  sheet.weeklyData.filter((r) => r.track_name !== "TOTAL")
    .forEach((r) => { trackTotals.set(r.track_name, (trackTotals.get(r.track_name) || 0) + r[streamKey]); });
  let topTrackName = "No track data", topTrackStreams = 0;
  trackTotals.forEach((total, name) => { if (total > topTrackStreams) { topTrackStreams = total; topTrackName = name; } });
  return { totalStreams, totalPhysical, peakWeekStreams, peakWeekDate, topTrackName, topTrackStreams };
}

// ——— Moment Helpers ——————————————————————————————————————————
export function getKeyMoments(sheet: CampaignSheetData): Moment[] {
  return sheet.moments.filter((m) => m.is_key).sort((a, b) => a.date.localeCompare(b.date));
}

export function getAllMoments(sheet: CampaignSheetData): Moment[] {
  return [...sheet.moments].sort((a, b) => a.date.localeCompare(b.date));
}

// ——— Campaign Verdict (data-driven) ————————————————————————
export type VerdictLevel = "strong" | "building" | "early";

export interface CampaignVerdict {
  level: VerdictLevel;
  label: string;
  summary: string;
}

export function getCampaignVerdict(sheet: CampaignSheetData, territory: Territory): CampaignVerdict {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = sheet.weeklyData
    .filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));

  if (totalRows.length < 2) {
    return { level: "early", label: "Early Days", summary: "Not enough data to assess yet." };
  }

  const totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);
  const peakWeek = Math.max(...totalRows.map((r) => r[streamKey]));
  const lastWeek = totalRows[totalRows.length - 1][streamKey];
  const prevWeek = totalRows[totalRows.length - 2][streamKey];
  const keyMoments = sheet.moments.filter((m) => m.is_key).length;
  const hasPhysical = sheet.physicalData.some((r) => r.units > 0);

  // Score: stream volume + trend + moment density + physical
  let score = 0;
  if (totalStreams > 500_000) score += 2;
  if (totalStreams > 1_000_000) score += 1;
  if (lastWeek > prevWeek) score += 2;
  if (peakWeek > totalStreams * 0.3) score += 1; // strong peak
  if (keyMoments >= 5) score += 1;
  if (hasPhysical) score += 1;

  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);

  if (score >= 6) {
    return {
      level: "strong",
      label: "Strong Campaign",
      summary: `${fmtNum(totalStreams)} streams across ${totalRows.length} weeks with ${keyMoments} key moments driving activity.`,
    };
  } else if (score >= 3) {
    return {
      level: "building",
      label: "Building Momentum",
      summary: `${fmtNum(totalStreams)} streams so far — ${lastWeek > prevWeek ? "trending up" : "holding steady"} with ${keyMoments} key activations.`,
    };
  } else {
    return {
      level: "early",
      label: "Early Phase",
      summary: `Campaign at ${fmtNum(totalStreams)} streams — still building toward key moments.`,
    };
  }
}


// ——— Momentum Status (data-driven) ——————————————————————————
export type MomentumDirection = "rising" | "stable" | "declining";

export interface MomentumStatus {
  direction: MomentumDirection;
  label: string;
  detail: string;
}

export function getMomentumStatus(sheet: CampaignSheetData, territory: Territory): MomentumStatus {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = sheet.weeklyData
    .filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));

  if (totalRows.length < 3) {
    return { direction: "stable", label: "Stable", detail: "Too few data points to determine trend." };
  }

  // Compare last 3 weeks
  const recent = totalRows.slice(-3).map((r) => r[streamKey]);
  const trend1 = recent[1] - recent[0]; // week -2 to -1
  const trend2 = recent[2] - recent[1]; // week -1 to latest

  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);

  if (trend2 > 0 && recent[2] > recent[0]) {
    const pct = recent[1] > 0 ? Math.round(((recent[2] - recent[1]) / recent[1]) * 100) : 0;
    return {
      direction: "rising",
      label: "Rising",
      detail: `Last week hit ${fmtNum(recent[2])} (${pct > 0 ? "+" : ""}${pct}% WoW) — upward trajectory.`,
    };
  } else if (trend2 < 0 && trend1 < 0) {
    return {
      direction: "declining",
      label: "Cooling",
      detail: `Streams declined for 2 consecutive weeks — down to ${fmtNum(recent[2])} last week.`,
    };
  } else {
    return {
      direction: "stable",
      label: "Holding",
      detail: `Streams fluctuating around ${fmtNum(recent[2])} — no clear directional trend.`,
    };
  }
}

// ——— Top Impact Moment (data-driven) ————————————————————————
export interface TopMoment {
  title: string;
  date: string;
  impact: string;
}

export function getTopImpactMoment(sheet: CampaignSheetData, territory: Territory): TopMoment {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const keyMoments = sheet.moments.filter((m) => m.is_key).sort((a, b) => a.date.localeCompare(b.date));

  if (keyMoments.length === 0) {
    return { title: "No key moments", date: "", impact: "No key moments logged yet." };
  }

  // Find which key moment date had the biggest stream week
  const totalByDate = new Map<string, number>();
  sheet.weeklyData.filter((r) => r.track_name === "TOTAL")
    .forEach((r) => totalByDate.set(r.week_start_date, r[streamKey]));

  let bestMoment = keyMoments[0];
  let bestStreams = 0;

  for (const m of keyMoments) {
    // Find the closest week to this moment date
    let closestDate = "";
    let closestDiff = Infinity;
    totalByDate.forEach((streams, weekDate) => {
      const diff = Math.abs(new Date(m.date).getTime() - new Date(weekDate).getTime());
      if (diff < closestDiff) { closestDiff = diff; closestDate = weekDate; }
    });
    const weekStreams = totalByDate.get(closestDate) || 0;
    if (weekStreams > bestStreams) {
      bestStreams = weekStreams;
      bestMoment = m;
    }
  }

  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);

  return {
    title: bestMoment.moment_title,
    date: bestMoment.date,
    impact: `Biggest stream week (${fmtNum(bestStreams)}) aligned with this moment.`,
  };
}

// ——— Campaign Learnings (data-driven, max 3) ————————————————
export interface CampaignLearning {
  icon: string;
  text: string;
}

export function getCampaignLearnings(sheet: CampaignSheetData, territory: Territory): CampaignLearning[] {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const learnings: CampaignLearning[] = [];
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);

  const totalRows = sheet.weeklyData
    .filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));

  if (totalRows.length < 2) return learnings;

  // 1. Biggest WoW spike and what moment caused it
  let biggestSpikePct = 0, spikeWeekIdx = -1;
  for (let i = 1; i < totalRows.length; i++) {
    const prev = totalRows[i - 1][streamKey];
    if (prev > 0) {
      const pct = ((totalRows[i][streamKey] - prev) / prev) * 100;
      if (pct > biggestSpikePct) { biggestSpikePct = pct; spikeWeekIdx = i; }
    }
  }

  if (spikeWeekIdx > 0 && biggestSpikePct > 20) {
    const spikeDate = totalRows[spikeWeekIdx].week_start_date;
    // Find nearest moment
    const nearMoment = sheet.moments
      .filter((m) => m.is_key)
      .find((m) => Math.abs(new Date(m.date).getTime() - new Date(spikeDate).getTime()) < 8 * 86400000);
    if (nearMoment) {
      learnings.push({
        icon: "\u2191",
        text: `+${Math.round(biggestSpikePct)}% spike w/c ${spikeDate.slice(5)} — driven by ${nearMoment.moment_title.length > 30 ? nearMoment.moment_title.slice(0, 28) + "\u2026" : nearMoment.moment_title}.`,
      });
    } else {
      learnings.push({
        icon: "\u2191",
        text: `Biggest week-on-week jump was +${Math.round(biggestSpikePct)}% (w/c ${spikeDate.slice(5)}).`,
      });
    }
  }

  // 2. Physical correlation if physical exists
  const totalPhysical = sheet.physicalData.reduce((sum, r) => sum + r.units, 0);
  if (totalPhysical > 0) {
    const peakPhysical = Math.max(...sheet.physicalData.map((r) => r.units));
    const peakPhysDate = sheet.physicalData.find((r) => r.units === peakPhysical)?.week_start_date || "";
    learnings.push({
      icon: "\u25A0",
      text: `Physical peaked at ${fmtNum(peakPhysical)} units (w/c ${peakPhysDate.slice(5)}) — ${fmtNum(totalPhysical)} total.`,
    });
  }

  // 3. Post-peak decline or sustained interest
  if (totalRows.length >= 4) {
    const peak = Math.max(...totalRows.map((r) => r[streamKey]));
    const peakIdx = totalRows.findIndex((r) => r[streamKey] === peak);
    if (peakIdx < totalRows.length - 2) {
      const afterPeak = totalRows.slice(peakIdx + 1);
      const avgAfterPeak = afterPeak.reduce((s, r) => s + r[streamKey], 0) / afterPeak.length;
      const retentionPct = Math.round((avgAfterPeak / peak) * 100);
      if (retentionPct > 40) {
        learnings.push({ icon: "\u2192", text: `Strong retention: ${retentionPct}% avg streams maintained after peak week.` });
      } else if (retentionPct < 20) {
        learnings.push({ icon: "\u2193", text: `Sharp drop-off: only ${retentionPct}% streams retained after peak — typical spike pattern.` });
      } else {
        learnings.push({ icon: "\u2192", text: `Moderate tail: ${retentionPct}% of peak-week streams sustained on average.` });
      }
    }
  }

  return learnings.slice(0, 3);
}
