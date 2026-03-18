import {
  CampaignSheetData, ChartDataPoint, Moment, Territory, Track, TrackWeeklyMetric,
} from "@/types";

// ——— Track Narrative Roles (inferred from data, not schema) ————
export type TrackNarrativeRole = "PRE_RELEASE" | "ALBUM_DRIVER" | "POST_RELEASE_BREAKOUT" | "SUPPORTING";

export interface TrackWithRole {
  track_name: string;
  role: TrackNarrativeRole;
  color: string;
  strokeWidth: number;
  opacity: number;
}

const ROLE_STYLES: Record<TrackNarrativeRole, { strokeWidth: number; opacity: number }> = {
  POST_RELEASE_BREAKOUT: { strokeWidth: 3.5, opacity: 1 },
  ALBUM_DRIVER: { strokeWidth: 2.5, opacity: 0.85 },
  PRE_RELEASE: { strokeWidth: 1.2, opacity: 0.35 },
  SUPPORTING: { strokeWidth: 1, opacity: 0.25 },
};

// Color assignments: breakout gets brightest
const ROLE_COLORS: Record<TrackNarrativeRole, string> = {
  POST_RELEASE_BREAKOUT: "#FBBF24", // bright amber — stands out
  ALBUM_DRIVER: "#A78BFA",          // purple — prominent but not dominant
  PRE_RELEASE: "#6B7280",           // grey — faded
  SUPPORTING: "#4B5563",            // dark grey — minimal
};

export function inferTrackRoles(sheet: CampaignSheetData, territory: Territory): TrackWithRole[] {
  const albumDate = sheet.setup.release_date;
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  if (!albumDate) {
    // No album date — all tracks equal
    return sheet.tracks.map((t) => ({
      track_name: t.track_name, role: "SUPPORTING" as TrackNarrativeRole,
      color: ROLE_COLORS.SUPPORTING, ...ROLE_STYLES.SUPPORTING,
    }));
  }

  const trackNames = [...new Set(sheet.weeklyData.filter(r => r.track_name !== "TOTAL").map(r => r.track_name))];
  const analysis = new Map<string, { preTotal: number; postTotal: number; firstWeek: string; postWeeks: number }>();

  for (const tn of trackNames) {
    const rows = sheet.weeklyData.filter(r => r.track_name === tn).sort((a,b) => a.week_start_date.localeCompare(b.week_start_date));
    const preRows = rows.filter(r => r.week_start_date < albumDate);
    const postRows = rows.filter(r => r.week_start_date >= albumDate);
    analysis.set(tn, {
      preTotal: preRows.reduce((s,r) => s + r.streams, 0),
      postTotal: postRows.reduce((s,r) => s + r.streams, 0),
      firstWeek: rows[0]?.week_start_date || "",
      postWeeks: postRows.length,
    });
  }

  // Find album driver: track with highest post-release total that was active at album date
  let albumDriver = "";
  let albumDriverPost = 0;
  // Find post-release breakout: track that FIRST appears at or after album date
  let breakout = "";
  let breakoutPost = 0;

  for (const [tn, a] of analysis) {
    if (a.firstWeek >= albumDate && a.postTotal > breakoutPost) {
      // Track that only appears post-release
      breakoutPost = a.postTotal;
      breakout = tn;
    } else if (a.postTotal > albumDriverPost && a.firstWeek < albumDate) {
      // Has pre-release data but strongest post-release
      albumDriverPost = a.postTotal;
      albumDriver = tn;
    }
  }

  // If no breakout found from timing, find track with best post-peak retention
  if (!breakout) {
    // Fallback: track with highest post/pre ratio
    for (const [tn, a] of analysis) {
      if (tn !== albumDriver && a.postTotal > 0 && a.firstWeek >= albumDate) {
        if (a.postTotal > breakoutPost) { breakoutPost = a.postTotal; breakout = tn; }
      }
    }
  }

  return trackNames.map((tn) => {
    let role: TrackNarrativeRole;
    if (tn === breakout) role = "POST_RELEASE_BREAKOUT";
    else if (tn === albumDriver) role = "ALBUM_DRIVER";
    else if (analysis.get(tn)!.preTotal > 0) role = "PRE_RELEASE";
    else role = "SUPPORTING";

    return {
      track_name: tn,
      role,
      color: ROLE_COLORS[role],
      ...ROLE_STYLES[role],
    };
  });
}

// ——— Detect handover moment (album decline → breakout emerges) ——
export interface HandoverMoment {
  date: string;
  trackName: string;
  label: string;
}

export function detectHandoverMoment(sheet: CampaignSheetData, territory: Territory): HandoverMoment | null {
  const roles = inferTrackRoles(sheet, territory);
  const breakout = roles.find(r => r.role === "POST_RELEASE_BREAKOUT");
  if (!breakout) return null;

  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const breakoutRows = sheet.weeklyData
    .filter(r => r.track_name === breakout.track_name && r.streams > 0)
    .sort((a,b) => a.week_start_date.localeCompare(b.week_start_date));

  if (breakoutRows.length === 0) return null;

  return {
    date: breakoutRows[0].week_start_date,
    trackName: breakout.track_name,
    label: `Post-release single — ${breakout.track_name}`,
  };
}


// ——— Build Chart Data ———————————————————————————————————————
export function buildChartData(
  sheet: CampaignSheetData, territory: Territory, selectedTracks: string[]
): ChartDataPoint[] {
  const hasDailyData = sheet.dailyTrackData && sheet.dailyTrackData.length > 0;

  if (hasDailyData) {
    return buildChartFromDailyData(sheet, selectedTracks);
  }

  // Fallback: old weekly data path
  return buildChartFromWeeklyData(sheet, territory, selectedTracks);
}

// ——— Daily data chart builder (preferred) ————————————————
function buildChartFromDailyData(
  sheet: CampaignSheetData, selectedTracks: string[]
): ChartDataPoint[] {
  const daily = sheet.dailyTrackData;

  // Build track data: track -> date -> streams
  const trackByDate = new Map<string, Map<string, number>>();
  daily.forEach(r => {
    if (!selectedTracks.includes(r.track_name)) return;
    if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
    trackByDate.get(r.track_name)!.set(r.date, r.global_streams);
  });

  // Build moments lookup
  const momentsByDate = new Map<string, Moment[]>();
  sheet.moments.forEach(m => {
    const existing = momentsByDate.get(m.date) || [];
    existing.push(m);
    momentsByDate.set(m.date, existing);
  });

  // Physical data
  const physicalByDate = new Map<string, number>();
  sheet.physicalData.forEach(r => physicalByDate.set(r.week_start_date, r.units));

  // All dates across all tracks
  const allDates = new Set<string>();
  trackByDate.forEach(dates => dates.forEach((_, d) => allDates.add(d)));
  // Add moment dates as ghost points
  sheet.moments.forEach(m => allDates.add(m.date));

  const sorted = [...allDates].sort();

  const result: ChartDataPoint[] = sorted.map(date => {
    // Total = sum of all track streams on this date
    let total = 0;
    selectedTracks.forEach(tn => {
      const val = trackByDate.get(tn)?.get(date);
      if (val) total += val;
    });

    const point: ChartDataPoint = {
      date,
      total_streams: total,
      physical_units: physicalByDate.get(date) ?? 0,
      cumulative_streams: 0,
      prev_week_streams: null,
      events: momentsByDate.get(date) || [],
    };

    // Track values: null if no data for that date
    selectedTracks.forEach(tn => {
      const val = trackByDate.get(tn)?.get(date);
      point[tn] = val ?? null;
    });

    return point;
  });

  // Cumulative + prev day
  let runningTotal = 0;
  for (let i = 0; i < result.length; i++) {
    runningTotal += result[i].total_streams;
    result[i].cumulative_streams = runningTotal;
    if (i > 0 && result[i].total_streams > 0) {
      for (let j = i - 1; j >= 0; j--) {
        if (result[j].total_streams > 0) {
          result[i].prev_week_streams = result[j].total_streams;
          break;
        }
      }
    }
  }

  return result;
}

// ——— Weekly data chart builder (fallback) ————————————————
function buildChartFromWeeklyData(
  sheet: CampaignSheetData, territory: Territory, selectedTracks: string[]
): ChartDataPoint[] {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  const totalByDate = new Map<string, number>();
  sheet.weeklyData.filter(r => r.track_name === "TOTAL")
    .forEach(r => totalByDate.set(r.week_start_date, r.streams));

  const trackByDate = new Map<string, Map<string, number>>();
  sheet.weeklyData.filter(r => r.track_name !== "TOTAL" && selectedTracks.includes(r.track_name))
    .forEach(r => {
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.week_start_date, r.streams);
    });

  const physicalByDate = new Map<string, number>();
  sheet.physicalData.forEach(r => physicalByDate.set(r.week_start_date, r.units));

  const momentsByDate = new Map<string, Moment[]>();
  sheet.moments.forEach(m => {
    const existing = momentsByDate.get(m.date) || [];
    existing.push(m);
    momentsByDate.set(m.date, existing);
  });

  const allDates = new Set<string>();
  totalByDate.forEach((_, d) => allDates.add(d));
  trackByDate.forEach(dates => dates.forEach((_, d) => allDates.add(d)));
  physicalByDate.forEach((_, d) => allDates.add(d));
  sheet.moments.forEach(m => allDates.add(m.date));
  const sorted = [...allDates].sort();

  const result: ChartDataPoint[] = sorted.map(date => {
    const point: ChartDataPoint = {
      date,
      total_streams: totalByDate.get(date) ?? 0,
      physical_units: physicalByDate.get(date) ?? 0,
      cumulative_streams: 0,
      prev_week_streams: null,
      events: momentsByDate.get(date) || [],
    };
    selectedTracks.forEach(tn => {
      const trackDates = trackByDate.get(tn);
      point[tn] = trackDates?.has(date) ? trackDates.get(date)! : null;
    });
    return point;
  });

  result.sort((a, b) => a.date.localeCompare(b.date));
  let runningTotal = 0;
  for (let i = 0; i < result.length; i++) {
    runningTotal += result[i].total_streams;
    result[i].cumulative_streams = runningTotal;
    if (i > 0 && result[i].total_streams > 0) {
      for (let j = i - 1; j >= 0; j--) {
        if (result[j].total_streams > 0) { result[i].prev_week_streams = result[j].total_streams; break; }
      }
    }
  }
  return result;
}
// ——— Stub for By Track (kept for compatibility) ————————————
export function buildTrackChartData(
  sheet: CampaignSheetData, territory: Territory, trackWeeklyMetrics: TrackWeeklyMetric[], trackId: string
): ChartDataPoint[] { return []; }

export function getTrackListForChart(
  trackWeeklyMetrics: TrackWeeklyMetric[], territory: Territory
): Array<{ track_id: string; track_name: string }> { return []; }

// ——— Track Helpers ——————————————————————————————————————————
export function getTrackList(sheet: CampaignSheetData): Track[] {
  return [...sheet.tracks].sort((a, b) => a.sort_order - b.sort_order);
}

export function getAllTrackNames(sheet: CampaignSheetData): string[] {
  // Prefer daily data track names if available
  if (sheet.dailyTrackData && sheet.dailyTrackData.length > 0) {
    return [...new Set(sheet.dailyTrackData.map(r => r.track_name))];
  }
  return [...new Set(sheet.weeklyData.filter(r => r.track_name !== "TOTAL").map(r => r.track_name))];
}
export function getDefaultTracks(tracks: Track[]): string[] {
  const withDefault = tracks.filter((t) => t.default_on);
  if (withDefault.length > 0) return withDefault.map((t) => t.track_name);
  const NARRATIVE_ROLES = ["lead_single", "second_single", "third_single", "promo_single", "focus_track"];
  const singles = tracks.filter((t) => NARRATIVE_ROLES.includes(t.track_role));
  if (singles.length > 0) return singles.map((t) => t.track_name);
  return tracks.slice(0, 2).map((t) => t.track_name);
}


// ——— Peak Week Stats ————————————————————————————————————————
function getTotalStreamRows(sheet: CampaignSheetData, territory: Territory): Array<{ week_start_date: string; streams: number }> {
  if (sheet.dailyTrackData && sheet.dailyTrackData.length > 0) {
    const byDate = new Map<string, number>();
    sheet.dailyTrackData.forEach(r => byDate.set(r.date, (byDate.get(r.date) || 0) + r.global_streams));
    return [...byDate.entries()].map(([d, s]) => ({ week_start_date: d, streams: s })).sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
  }
  const sk = territory === "UK" ? "streams_uk" : "streams_global";
  return sheet.weeklyData.filter(r => r.track_name === "TOTAL").map(r => ({ week_start_date: r.week_start_date, streams: r[sk] })).sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
}

export interface PeakWeekStats { totalStreams: number; totalPhysical: number; peakWeekStreams: number; peakWeekDate: string; }

export function getPeakWeekStats(sheet: CampaignSheetData, territory: Territory): PeakWeekStats {
  const totalRows = getTotalStreamRows(sheet, territory);
  if (totalRows.length < 2) return { level: "early", label: "Early Days", summary: "Not enough data to assess." };
  const totalStreams = totalRows.reduce((sum, r) => sum + r.streams, 0);
  const keyMoments = sheet.moments.filter((m) => m.is_key).length;
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);
  const hasPhysical = sheet.physicalData.some((r) => r.units > 0);
  let score = 0;
  if (totalStreams > 500_000) score += 2;
  if (totalStreams > 1_000_000) score += 1;
  if (keyMoments >= 5) score += 1;
  if (hasPhysical) score += 1;
  // Check post-release breakout
  const roles = inferTrackRoles(sheet, territory);
  if (roles.some(r => r.role === "POST_RELEASE_BREAKOUT")) score += 1;
  if (score >= 5) return { level: "strong", label: "Strong Campaign", summary: `${fmtNum(totalStreams)} total streams — album peaked with post-release single holding.` };
  if (score >= 3) return { level: "building", label: "Building", summary: `${fmtNum(totalStreams)} streams across ${totalRows.length} weeks — campaign still developing.` };
  return { level: "early", label: "Early Phase", summary: `Campaign at ${fmtNum(totalStreams)} streams — building toward key activations.` };
}

// ——— Momentum Status ————————————————————————————————————————
export type MomentumDirection = "rising" | "stable" | "declining";
export interface MomentumStatus { direction: MomentumDirection; label: string; detail: string; }

export function getMomentumStatus(sheet: CampaignSheetData, territory: Territory): MomentumStatus {
  const totalRows = getTotalStreamRows(sheet, territory);
  if (totalRows.length < 3) return { direction: "stable", label: "Holding", detail: "Not enough data for trend." };
  const recent = totalRows.slice(-3).map((r) => r.streams);
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);
  if (recent[2] > recent[1] && recent[2] > recent[0]) {
    return { direction: "rising", label: "Rising", detail: `Last week ${fmtNum(recent[2])} — trending up.` };
  } else if (recent[2] < recent[1] && recent[1] < recent[0]) {
    return { direction: "declining", label: "Declining", detail: `Down to ${fmtNum(recent[2])} — 2-week decline.` };
  }
  return { direction: "stable", label: "Holding", detail: `Around ${fmtNum(recent[2])} — no clear trend.` };
}

// ——— Top Impact Moment ——————————————————————————————————————
export interface TopMoment { title: string; date: string; impact: string; }

export function getTopImpactMoment(sheet: CampaignSheetData, territory: Territory): TopMoment {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const keyMoments = sheet.moments.filter((m) => m.is_key).sort((a, b) => a.date.localeCompare(b.date));
  if (keyMoments.length === 0) return { title: "No key moments", date: "", impact: "No key moments logged." };
  const totalByDate = new Map<string, number>();
  sheet.weeklyData.filter((r) => r.track_name === "TOTAL").forEach((r) => totalByDate.set(r.week_start_date, r.streams));
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);
  let bestMoment = keyMoments[0], bestStreams = 0;
  for (const m of keyMoments) {
    let closestDate = "", closestDiff = Infinity;
    totalByDate.forEach((_, weekDate) => {
      const diff = Math.abs(new Date(m.date).getTime() - new Date(weekDate).getTime());
      if (diff < closestDiff) { closestDiff = diff; closestDate = weekDate; }
    });
    const weekStreams = totalByDate.get(closestDate) || 0;
    if (weekStreams > bestStreams) { bestStreams = weekStreams; bestMoment = m; }
  }
  return { title: bestMoment.moment_title, date: bestMoment.date, impact: `Peak week (${fmtNum(bestStreams)}) aligned with this moment.` };
}


// ——— Phase-based Campaign Learnings ——————————————————————————
export interface CampaignLearning {
  dateLabel: string;
  eventType: string;
  text: string;
  phase: "pre" | "peak" | "post";
}

export function getCampaignLearnings(sheet: CampaignSheetData, territory: Territory): CampaignLearning[] {
  const learnings: CampaignLearning[] = [];
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);
  const fmtDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const albumDate = sheet.setup.release_date;
  if (!albumDate) return learnings;

  const totalRows = getTotalStreamRows(sheet, territory);
  if (totalRows.length < 2) return learnings;

  // Peak week
  const peakRow = totalRows.reduce((best, r) => r.streams > best.streams_global ? r : best, totalRows[0]);
  const peakDate = peakRow.week_start_date;

  // 1. Album release peak
  learnings.push({
    dateLabel: fmtDate(peakDate),
    eventType: "ALBUM RELEASE",
    text: `Peak week (~${fmtNum(peakRow.streams_global)} streams), primary campaign driver`,
    phase: "peak",
  });

  // 2. Post-release drop
  const postPeakRows = totalRows.filter(r => r.week_start_date > peakDate);
  if (postPeakRows.length > 0) {
    const nextWeek = postPeakRows[0];
    const dropPct = Math.round((1 - nextWeek.streams_global / peakRow.streams_global) * 100);
    if (dropPct > 5) {
      learnings.push({
        dateLabel: fmtDate(nextWeek.week_start_date),
        eventType: "POST-RELEASE DROP",
        text: `Streams declined ~${dropPct}% week-on-week`,
        phase: "post",
      });
    }
  }

  // 3. DJH hold (post-release breakout)
  const roles = inferTrackRoles(sheet, territory);
  const breakout = roles.find(r => r.role === "POST_RELEASE_BREAKOUT");
  if (breakout) {
    const bRows = sheet.weeklyData
      .filter(r => r.track_name === breakout.track_name && r.streams > 0)
      .sort((a,b) => a.week_start_date.localeCompare(b.week_start_date));
    const avgPost = bRows.length > 0
      ? bRows.reduce((s,r) => s + r.streams, 0) / bRows.length : 0;
    const firstDate = bRows[0]?.week_start_date || peakDate;
    learnings.push({
      dateLabel: fmtDate(firstDate) + "+",
      eventType: "DJH HOLD",
      text: `"\u200B${breakout.track_name}" stabilised ~${fmtNum(avgPost)}/week \u2014 only track sustaining momentum`,
      phase: "post",
    });
  }

  return learnings.slice(0, 3);
}

// ——— Inline Chart Insight (1 sentence) ——————————————————————
export function getChartInsight(sheet: CampaignSheetData, territory: Territory): string | null {
  const roles = inferTrackRoles(sheet, territory);
  const breakout = roles.find(r => r.role === "POST_RELEASE_BREAKOUT");
  if (!breakout) return null;
  return `Post-album, "\u200B${breakout.track_name}" is the only track holding meaningful volume`;
}

// ——— Normalized Track Data (each track 0–100% of its peak) ——
export interface NormalizedPoint {
  date: string;
  [key: string]: number | string | null;
}

export function buildNormalizedTrackData(
  sheet: CampaignSheetData, territory: Territory, trackNames: string[]
): NormalizedPoint[] {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  // Build raw track data by date
  const trackByDate = new Map<string, Map<string, number>>();
  sheet.weeklyData.filter(r => r.track_name !== "TOTAL" && trackNames.includes(r.track_name))
    .forEach(r => {
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.week_start_date, r.streams);
    });

  // Find peak per track
  const peaks = new Map<string, number>();
  trackByDate.forEach((dates, tn) => {
    let peak = 0;
    dates.forEach(v => { if (v > peak) peak = v; });
    peaks.set(tn, peak || 1); // avoid /0
  });

  // Collect all dates
  const allDates = new Set<string>();
  trackByDate.forEach(dates => dates.forEach((_, d) => allDates.add(d)));
  const sorted = [...allDates].sort();

  return sorted.map(date => {
    const point: NormalizedPoint = { date };
    trackNames.forEach(tn => {
      const raw = trackByDate.get(tn)?.get(date);
      if (raw == null) {
        point[tn] = null;
      } else {
        point[tn] = Math.round((raw / peaks.get(tn)!) * 100);
      }
    });
    return point;
  });
}

// ——— Track Role Labels ——————————————————————————————————————
const ROLE_LABELS: Record<string, string> = {
  PRE_RELEASE: "Pre-release",
  ALBUM_DRIVER: "Album",
  POST_RELEASE_BREAKOUT: "Post-release",
  SUPPORTING: "Supporting",
};

export function getTrackRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

// ——— Tracks Mode Context Line ———————————————————————————————
export function getTrackModeContext(sheet: CampaignSheetData, territory: Territory): string {
  const roles = inferTrackRoles(sheet, territory);
  const breakout = roles.find(r => r.role === "POST_RELEASE_BREAKOUT");
  const preCount = roles.filter(r => r.role === "PRE_RELEASE").length;
  if (breakout) {
    return `Track view: ${preCount} pre-release single${preCount !== 1 ? "s" : ""} build lightly, album peaks, "\u200B${breakout.track_name}" sustains post-release`;
  }
  return "Track view: Individual track performance across campaign timeline";
}



// ——— Single Campaign Summary (replaces 3 vague cards) ————————
export function getCampaignSummary(sheet: CampaignSheetData, territory: Territory): string {
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);

  const totalRows = getTotalStreamRows(sheet, territory);

  const peakRow = totalRows.reduce((best, r) => r.streams > best.streams_global ? r : best, totalRows[0]);
  const peakDate = peakRow?.week_start_date || "";
  const peakDateFmt = peakDate ? new Date(peakDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

  const roles = inferTrackRoles(sheet, territory);
  const breakout = roles.find(r => r.role === "POST_RELEASE_BREAKOUT");

  if (breakout) {
    const bRows = sheet.weeklyData
      .filter(r => r.track_name === breakout.track_name && r.streams > 0);
    const avgPost = bRows.length > 0
      ? bRows.reduce((s,r) => s + r.streams, 0) / bRows.length : 0;
    return `Album peaked at ~${fmtNum(peakRow.streams_global)} streams (w/c ${peakDateFmt}). Post-release, "\u200B${breakout.track_name}" holds ~${fmtNum(avgPost)} weekly while others decline.`;
  }

  return `Album peaked at ~${fmtNum(peakRow.streams_global)} streams (w/c ${peakDateFmt}).`;
}


// ——— UK Context Layer (supporting, not primary) —————————————
export interface UKTrackContext {
  track_name: string;
  uk_streams: number;
  global_streams: number;
  uk_share_pct: number;
  period_start: string;
  period_end: string;
  note: string;
}

export interface UKMilestone {
  date: string;
  track_name: string;
  uk_streams: number;
  label: string;
}

export function buildUKTrackContext(sheet: CampaignSheetData): UKTrackContext[] {
  const trackNames = [...new Set(sheet.weeklyData.filter(r => r.track_name !== "TOTAL").map(r => r.track_name))];
  const albumDate = sheet.setup.release_date;
  const roles = inferTrackRoles(sheet, "global");
  const roleMap = new Map(roles.map(r => [r.track_name, r.role]));

  return trackNames.map(tn => {
    const rows = sheet.weeklyData.filter(r => r.track_name === tn).sort((a,b) => a.week_start_date.localeCompare(b.week_start_date));
    const ukTotal = rows.reduce((s, r) => s + r.streams_uk, 0);
    const glTotal = rows.reduce((s, r) => s + r.streams_global, 0);
    const share = glTotal > 0 ? Math.round((ukTotal / glTotal) * 100) : 0;
    const first = rows[0]?.week_start_date || "";
    const last = rows[rows.length - 1]?.week_start_date || "";
    const role = roleMap.get(tn) || "SUPPORTING";

    let note = "";
    if (role === "POST_RELEASE_BREAKOUT") {
      note = share > 15 ? `Strong UK share (${share}%) — above avg for this campaign` : `UK share ${share}%`;
    } else if (role === "ALBUM_DRIVER") {
      note = `Album track — ${share}% UK share`;
    } else {
      note = `Pre-release — ${share}% UK share`;
    }

    return { track_name: tn, uk_streams: ukTotal, global_streams: glTotal, uk_share_pct: share, period_start: first, period_end: last, note };
  }).sort((a, b) => b.uk_streams - a.uk_streams);
}

export function buildUKMilestones(sheet: CampaignSheetData): UKMilestone[] {
  const trackNames = [...new Set(sheet.weeklyData.filter(r => r.track_name !== "TOTAL").map(r => r.track_name))];
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);
  const milestones: UKMilestone[] = [];

  for (const tn of trackNames) {
    const rows = sheet.weeklyData.filter(r => r.track_name === tn && r.streams_uk > 0)
      .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
    if (rows.length === 0) continue;

    // Launch week (first non-zero)
    const launch = rows[0];
    milestones.push({
      date: launch.week_start_date,
      track_name: tn,
      uk_streams: launch.streams_uk,
      label: `UK launch: ${fmtNum(launch.streams_uk)}`,
    });

    // Peak week (if different from launch)
    const peak = rows.reduce((best, r) => r.streams_uk > best.streams_uk ? r : best, rows[0]);
    if (peak.week_start_date !== launch.week_start_date) {
      milestones.push({
        date: peak.week_start_date,
        track_name: tn,
        uk_streams: peak.streams_uk,
        label: `UK peak: ${fmtNum(peak.streams_uk)}`,
      });
    }
  }

  return milestones.sort((a, b) => a.date.localeCompare(b.date));
}

// UK totals for KPI cards
export function getUKTotals(sheet: CampaignSheetData): { ukStreams: number; ukPhysical: number; ukShare: number } {
  const totalRows = sheet.weeklyData.filter(r => r.track_name === "TOTAL");
  const ukStreams = totalRows.reduce((s, r) => s + r.streams_uk, 0);
  const glStreams = totalRows.reduce((s, r) => s + r.streams_global, 0);
  const ukShare = glStreams > 0 ? Math.round((ukStreams / glStreams) * 100) : 0;
  // Physical doesn't have UK split in schema, so use total
  const ukPhysical = sheet.physicalData.reduce((s, r) => s + r.units, 0);
  return { ukStreams, ukPhysical, ukShare };
}
