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

// Fallback role-based colors (used when a track has no fixed color)
const ROLE_COLORS: Record<TrackNarrativeRole, string> = {
  POST_RELEASE_BREAKOUT: "#FBBF24", // bright amber — stands out
  ALBUM_DRIVER: "#A78BFA",          // purple — prominent but not dominant
  PRE_RELEASE: "#6B7280",           // grey — faded
  SUPPORTING: "#4B5563",            // dark grey — minimal
};

// ——— Fixed per-track colour map for key tracks ——————————————
// These are always used regardless of inferred role or territory.
const KEY_TRACK_COLORS: Record<string, string> = {
  "Death Of Love":        "#F87171", // red — lead single
  "I Had a Dream":        "#60A5FA", // blue — second single
  "Trying Times":         "#34D399", // emerald — focus track
  "Doesn't Just Happen":  "#FBBF24", // amber — breakout
};
const MUTED_COLOR = "#4B5563";       // neutral grey for all other tracks
const KEY_TRACK_STROKE = 2.5;
const KEY_TRACK_OPACITY = 0.9;
const MUTED_STROKE = 1;
const MUTED_OPACITY = 0.2;

/** Apply fixed key-track colours; mute everything else. */
function applyFixedColors(roles: TrackWithRole[]): TrackWithRole[] {
  return roles.map(r => {
    const fixed = KEY_TRACK_COLORS[r.track_name];
    if (fixed) {
      return { ...r, color: fixed, strokeWidth: KEY_TRACK_STROKE, opacity: KEY_TRACK_OPACITY };
    }
    return { ...r, color: MUTED_COLOR, strokeWidth: MUTED_STROKE, opacity: MUTED_OPACITY };
  });
}

export function inferTrackRoles(sheet: CampaignSheetData, territory: Territory): TrackWithRole[] {
  // Use daily data if weekly data is unavailable
  if ((!sheet.weeklyData || sheet.weeklyData.length === 0) && sheet.dailyTrackData && sheet.dailyTrackData.length > 0) {
    const albumDate = sheet.setup.release_date;
    const trackNames = [...new Set(sheet.dailyTrackData.map(r => r.track_name))];
    if (!albumDate || trackNames.length === 0) {
      return applyFixedColors(trackNames.map(tn => ({ track_name: tn, role: "SUPPORTING" as TrackNarrativeRole, color: ROLE_COLORS.SUPPORTING, ...ROLE_STYLES.SUPPORTING })));
    }
    const analysis = new Map<string, { preTotal: number; postTotal: number; firstDate: string }>();
    for (const tn of trackNames) {
      const rows = sheet.dailyTrackData.filter(r => r.track_name === tn);
      const pre = rows.filter(r => r.date < albumDate).reduce((s, r) => s + r.global_streams, 0);
      const post = rows.filter(r => r.date >= albumDate).reduce((s, r) => s + r.global_streams, 0);
      const first = rows.sort((a, b) => a.date.localeCompare(b.date))[0];
      analysis.set(tn, { preTotal: pre, postTotal: post, firstDate: first?.date || "" });
    }
    let albumDriver = "", adPost = 0, breakout = "", bPost = 0;
    for (const [tn, a] of analysis) {
      if (a.firstDate >= albumDate && a.postTotal > bPost) { bPost = a.postTotal; breakout = tn; }
      else if (a.postTotal > adPost && a.firstDate < albumDate) { adPost = a.postTotal; albumDriver = tn; }
    }
    return applyFixedColors(trackNames.map(tn => {
      let role: TrackNarrativeRole;
      if (tn === breakout) role = "POST_RELEASE_BREAKOUT";
      else if (tn === albumDriver) role = "ALBUM_DRIVER";
      else if ((analysis.get(tn)?.preTotal || 0) > 0) role = "PRE_RELEASE";
      else role = "SUPPORTING";
      return { track_name: tn, role, color: ROLE_COLORS[role], ...ROLE_STYLES[role] };
    }));
  }
  const albumDate = sheet.setup.release_date;
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  if (!albumDate) {
    // No album date — all tracks equal
    return applyFixedColors(sheet.tracks.map((t) => ({
      track_name: t.track_name, role: "SUPPORTING" as TrackNarrativeRole,
      color: ROLE_COLORS.SUPPORTING, ...ROLE_STYLES.SUPPORTING,
    })));
  }

  const trackNames = [...new Set(sheet.weeklyData.filter(r => r.track_name !== "TOTAL").map(r => r.track_name))];
  const analysis = new Map<string, { preTotal: number; postTotal: number; firstWeek: string; postWeeks: number }>();

  for (const tn of trackNames) {
    const rows = sheet.weeklyData.filter(r => r.track_name === tn).sort((a,b) => a.week_start_date.localeCompare(b.week_start_date));
    const preRows = rows.filter(r => r.week_start_date < albumDate);
    const postRows = rows.filter(r => r.week_start_date >= albumDate);
    analysis.set(tn, {
      preTotal: preRows.reduce((s,r) => s + r[streamKey], 0),
      postTotal: postRows.reduce((s,r) => s + r[streamKey], 0),
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

  return applyFixedColors(trackNames.map((tn) => {
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
  }));
}

// ——— Detect handover moment (album decline → breakout emerges) ——
export interface HandoverMoment {
  date: string;
  trackName: string;
  label: string;
}

export function detectHandoverMoment(sheet: CampaignSheetData, territory: Territory): HandoverMoment | null {
  const _wd = sheet.weeklyData || [];
  if (_wd.length === 0 && (!sheet.dailyTrackData || sheet.dailyTrackData.length === 0)) return null;
  const roles = inferTrackRoles(sheet, territory);
  const breakout = roles.find(r => r.role === "POST_RELEASE_BREAKOUT");
  if (!breakout) return null;

  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const breakoutRows = sheet.weeklyData
    .filter(r => r.track_name === breakout.track_name && r[streamKey] > 0)
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
    return buildChartFromDailyData(sheet, territory, selectedTracks);
  }

  // Fallback: old weekly data path
  return buildChartFromWeeklyData(sheet, territory, selectedTracks);
}

// ——— Daily data chart builder (preferred) ————————————————
function buildChartFromDailyData(
  sheet: CampaignSheetData, territory: Territory, selectedTracks: string[]
): ChartDataPoint[] {
  // When territory is not global AND we have territory daily data, use that
  const hasTerrData = territory !== "global"
    && sheet.dailyTerritoryData
    && sheet.dailyTerritoryData.length > 0;

  // Build track data: track -> date -> streams
  const trackByDate = new Map<string, Map<string, number>>();

  if (hasTerrData) {
    // Step 1: seed with global daily data so pre-release dates are present
    sheet.dailyTrackData.forEach(r => {
      if (!selectedTracks.includes(r.track_name)) return;
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.date, r.global_streams);
    });

    // Step 2: overwrite with territory-specific data where it exists
    // (post-release territory rows replace the global values)
    sheet.dailyTerritoryData
      .filter(r => r.territory === territory)
      .forEach(r => {
        if (!selectedTracks.includes(r.track_name)) return;
        if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
        trackByDate.get(r.track_name)!.set(r.date, r.streams);
      });
  } else {
    // Use global daily data
    sheet.dailyTrackData.forEach(r => {
      if (!selectedTracks.includes(r.track_name)) return;
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.date, r.global_streams);
    });
  }

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
  // Add moment dates as ghost points — but only when we have enough real data
  // to avoid drowning sparse territory data in null-filled dates
  if (!hasTerrData || allDates.size >= 3) {
    sheet.moments.forEach(m => allDates.add(m.date));
  }

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
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) return [];
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  const totalByDate = new Map<string, number>();
  sheet.weeklyData.filter(r => r.track_name === "TOTAL")
    .forEach(r => totalByDate.set(r.week_start_date, r[streamKey]));

  const trackByDate = new Map<string, Map<string, number>>();
  sheet.weeklyData.filter(r => r.track_name !== "TOTAL" && selectedTracks.includes(r.track_name))
    .forEach(r => {
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.week_start_date, r[streamKey]);
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
  if (sheet.dailyTrackData && sheet.dailyTrackData.length > 0)
    return [...new Set(sheet.dailyTrackData.map(r => r.track_name))];
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) return [];
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
export interface PeakWeekStats { totalStreams: number; totalPhysical: number; peakWeekStreams: number; peakWeekDate: string; }

export function getPeakWeekStats(sheet: CampaignSheetData, territory: Territory): PeakWeekStats {
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) {
    if (sheet.dailyTrackData && sheet.dailyTrackData.length > 0) {
      const ts = sheet.dailyTrackData.reduce((s: number, r: any) => s + r.global_streams, 0);
      const tp = sheet.physicalData.reduce((s: number, r: any) => s + r.units, 0);
      const bd = new Map<string, number>();
      sheet.dailyTrackData.forEach((r: any) => bd.set(r.date, (bd.get(r.date) || 0) + r.global_streams));
      let ps = 0, pd = "";
      bd.forEach((v, k) => { if (v > ps) { ps = v; pd = k; } });
      return { totalStreams: ts, totalPhysical: tp, peakWeekStreams: ps, peakWeekDate: pd };
    }
    return { totalStreams: 0, totalPhysical: 0, peakWeekStreams: 0, peakWeekDate: "" };
  }
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL");
  const totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);
  let peakWeekStreams = 0, peakWeekDate = "";
  for (const r of totalRows) { if (r[streamKey] > peakWeekStreams) { peakWeekStreams = r[streamKey]; peakWeekDate = r.week_start_date; } }
  const totalPhysical = sheet.physicalData.reduce((sum, r) => sum + r.units, 0);
  return { totalStreams, totalPhysical, peakWeekStreams, peakWeekDate };
}

// ——— Moment Helpers ——————————————————————————————————————————
export function getKeyMoments(sheet: CampaignSheetData): Moment[] {
  return sheet.moments.filter((m) => m.is_key).sort((a, b) => a.date.localeCompare(b.date));
}
export function getAllMoments(sheet: CampaignSheetData): Moment[] {
  return [...sheet.moments].sort((a, b) => a.date.localeCompare(b.date));
}

// ——— Campaign Verdict ————————————————————————————————————————
export type VerdictLevel = "strong" | "building" | "early";
export interface CampaignVerdict { level: VerdictLevel; label: string; summary: string; }

export function getCampaignVerdict(sheet: CampaignSheetData, territory: Territory): CampaignVerdict {
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) {
    return { level: "early", label: "Early Phase", summary: "Awaiting weekly data." };
  }
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
  if (totalRows.length < 2) return { level: "early", label: "Early Days", summary: "Not enough data to assess." };
  const totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);
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
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) {
    return { direction: "stable", label: "Holding", detail: "Awaiting weekly data." };
  }
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
  if (totalRows.length < 3) return { direction: "stable", label: "Holding", detail: "Not enough data for trend." };
  const recent = totalRows.slice(-3).map((r) => r[streamKey]);
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
  const _wd = sheet.weeklyData || [];
  if (_wd.length === 0) return { title: "No data", date: "", impact: "Awaiting data." };
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const keyMoments = sheet.moments.filter((m) => m.is_key).sort((a, b) => a.date.localeCompare(b.date));
  if (keyMoments.length === 0) return { title: "No key moments", date: "", impact: "No key moments logged." };
  const totalByDate = new Map<string, number>();
  sheet.weeklyData.filter((r) => r.track_name === "TOTAL").forEach((r) => totalByDate.set(r.week_start_date, r[streamKey]));
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


// ——— Campaign Learnings (flat, outcome-first) ——————————————
export interface LearningItem {
  text: string;
  sentiment: "positive" | "neutral" | "negative";
}

// Legacy types kept for backward compat
export type LearningGroup = "music" | "campaign" | "commercial" | "takeaway";
export interface GroupedLearnings { music: LearningItem[]; campaign: LearningItem[]; commercial: LearningItem[]; takeaway: LearningItem[]; }
export interface CampaignLearning { dateLabel: string; eventType: string; text: string; phase: "pre" | "peak" | "post"; }
export function getCampaignLearnings(): CampaignLearning[] { return []; }

// ——— Shared campaign analysis data ———
interface CampaignAnalysis {
  peakStreams: number;
  peakDate: string;
  dropPct: number;
  crashed: boolean;   // >30% drop
  held: boolean;      // ≤30% drop
  hadPaid: boolean;
  totalSpend: number;
  fmtSpend: string;
  physicalTotal: number;
  topTrackName: string;
  topTrackShare: number;
  concentrated: boolean;  // top track ≥55%
  fmtPeak: string;
  // Real moment references
  paidTerritories: string;     // e.g. "UK + DE"
  paidPlatforms: string;       // e.g. "Marquee"
  keyEditorial: string;        // e.g. "Hot Hits UK"
  releaseWeekStreams: string;   // e.g. "2.6M"
}

function fmtStreams(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

function analyseCampaign(sheet: CampaignSheetData, territory: Territory): CampaignAnalysis {
  const albumDate = sheet.setup.release_date || "";
  const hasDailyData = sheet.dailyTrackData && sheet.dailyTrackData.length > 0;
  const weeklyTrackRows = (sheet.weeklyData || []).filter(r => r.track_name !== "TOTAL");
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const pcs = sheet.paidCampaigns || [];
  const physicalTotal = (sheet.physicalData || []).reduce((s, r) => s + r.units, 0);
  const hadPaid = pcs.length > 0;
  const totalSpend = pcs.reduce((s, p) => s + p.spend, 0);
  const fmtSpend = totalSpend >= 1000 ? `£${(totalSpend / 1000).toFixed(0)}K` : `£${totalSpend}`;

  let peakStreams = 0, peakDate = "";
  const dailyTotals = new Map<string, number>();
  if (hasDailyData) {
    for (const r of sheet.dailyTrackData) dailyTotals.set(r.date, (dailyTotals.get(r.date) || 0) + r.global_streams);
    for (const [d, s] of dailyTotals) { if (s > peakStreams) { peakStreams = s; peakDate = d; } }
  } else {
    const totalRows = (sheet.weeklyData || []).filter(r => r.track_name === "TOTAL").sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
    if (totalRows.length >= 2) { const pk = totalRows.reduce((b, r) => r[streamKey] > b[streamKey] ? r : b, totalRows[0]); peakStreams = pk[streamKey]; peakDate = pk.week_start_date; }
  }

  let dropPct = 0;
  if (hasDailyData && peakDate) {
    const postDays = [...dailyTotals.entries()].filter(([d]) => d > peakDate).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 7);
    if (postDays.length >= 3) { dropPct = Math.round((1 - postDays.reduce((s, [, v]) => s + v, 0) / postDays.length / peakStreams) * 100); }
  } else {
    const totalRows = (sheet.weeklyData || []).filter(r => r.track_name === "TOTAL").sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
    const next = peakDate ? totalRows.find(r => r.week_start_date > peakDate) : null;
    if (next) dropPct = Math.round((1 - next[streamKey] / peakStreams) * 100);
  }

  const trackAnalysis = new Map<string, number>();
  if (hasDailyData) {
    for (const r of sheet.dailyTrackData) { if (r.date >= albumDate) trackAnalysis.set(r.track_name, (trackAnalysis.get(r.track_name) || 0) + r.global_streams); }
  } else if (weeklyTrackRows.length > 0) {
    for (const r of weeklyTrackRows) { if (r.week_start_date >= albumDate) trackAnalysis.set(r.track_name, (trackAnalysis.get(r.track_name) || 0) + r[streamKey]); }
  }
  let topTrackName = "", topTrackShare = 0;
  if (trackAnalysis.size >= 2) {
    const sorted = [...trackAnalysis.entries()].sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    topTrackShare = total > 0 ? Math.round((sorted[0][1] / total) * 100) : 0;
    topTrackName = sorted[0][0];
  }

  const fmtPeak = fmtStreams(peakStreams);

  // ——— Real moment references ———
  // Paid territories + platforms
  const paidTerrs = [...new Set(pcs.map(p => p.territory).filter(Boolean))];
  const paidTerritories = paidTerrs.join(" + ") || "";
  const paidPlats = [...new Set(pcs.map(p => p.platform).filter(Boolean))];
  const paidPlatforms = paidPlats.join(" + ") || "";

  // Key editorial moment (first editorial is_key moment)
  const editorialMoment = (sheet.moments || []).find(m =>
    m.is_key && (m.moment_type.toLowerCase() === "editorial" || m.moment_title.toLowerCase().includes("playlist") || m.moment_title.toLowerCase().includes("hot hits"))
  );
  const keyEditorial = editorialMoment ? editorialMoment.moment_title : "";

  // Release week total streams (7 days from album date)
  let releaseWeekTotal = 0;
  if (hasDailyData && albumDate) {
    const rwEnd = new Date(new Date(albumDate).getTime() + 7 * 86400000).toISOString().slice(0, 10);
    for (const [d, s] of dailyTotals) {
      if (d >= albumDate && d < rwEnd) releaseWeekTotal += s;
    }
  }
  const releaseWeekStreams = releaseWeekTotal > 0 ? fmtStreams(releaseWeekTotal) : "";

  return {
    peakStreams, peakDate, dropPct,
    crashed: dropPct > 30, held: dropPct > 0 && dropPct <= 30,
    hadPaid, totalSpend, fmtSpend, physicalTotal,
    topTrackName, topTrackShare, concentrated: topTrackShare >= 55,
    fmtPeak,
    paidTerritories, paidPlatforms, keyEditorial, releaseWeekStreams,
  };
}

// ——— Team Push: forward-looking action plan ———
export interface TeamPush {
  push: string;    // "PUSH → 'Track' (Market focus)"
  support: string; // "Support → next activation"
  next: string;    // "Next → upcoming moment"
}

function fmtWeekOf(d: string): string {
  const dt = new Date(d + "T00:00:00");
  const day = dt.getDate();
  const mon = dt.toLocaleDateString("en-GB", { month: "short" });
  return `W/C ${mon} ${day}`;
}

// Context tag for a moment based on its type
function momentTag(m: Moment): string {
  const t = m.moment_type.toLowerCase();
  const title = m.moment_title.toLowerCase();
  if (t === "live" || t === "tour" || title.includes("tour") || title.includes("concert") || title.includes("festival")) return "live driver";
  if (title.includes("outstore") || title.includes("signing") || title.includes("meet")) return "fan moment";
  if (t === "media" || t === "tv" || t === "radio" || title.includes("press") || title.includes("interview")) return "media window";
  if (t === "editorial" || title.includes("playlist")) return "editorial push";
  if (t === "music" || title.includes("single") || title.includes("release")) return "new music";
  if (t === "marketing" || t === "marquee" || t === "paid" || t === "showcase") return "digital push";
  if (t === "product" || title.includes("chart") || title.includes("merch") || title.includes("vinyl")) return "product moment";
  return "";
}

// Clean moment title for display: strip redundant prefixes, keep it short
function cleanTitle(m: Moment): string {
  let t = m.moment_title;
  // Paid campaigns are already formatted well
  if (m.moment_type.toLowerCase() === "paid") return t;
  // Truncate long titles
  if (t.length > 35) {
    const dash = t.indexOf(" - ");
    if (dash > 0 && dash < 30) t = t.slice(0, dash);
    else t = t.slice(0, 32) + "…";
  }
  return t;
}

export function getTeamPush(sheet: CampaignSheetData, territory: Territory): TeamPush | null {
  const albumDate = sheet.setup.release_date;
  if (!albumDate) return null;

  const a = analyseCampaign(sheet, territory);
  const today = new Date().toISOString().slice(0, 10);

  // ——— Lead track: strongest post-release performer ———
  const leadTrack = a.topTrackName || sheet.setup.campaign_name || "lead single";

  // ——— Market focus: use territory selection ———
  const market = territory === "UK" ? "UK" : "UK + Global";

  // ——— Gather future moments (deduplicated) ———
  const allMoments = [...(sheet.moments || [])];
  // Add paid campaigns but deduplicate by date+platform
  if (sheet.paidCampaigns) {
    const seenPaid = new Set<string>();
    for (const pc of sheet.paidCampaigns) {
      if (pc.start_date) {
        const key = `${pc.start_date}|${pc.platform}`;
        if (!seenPaid.has(key)) {
          seenPaid.add(key);
          allMoments.push({ date: pc.start_date, moment_title: `${pc.platform} (${pc.territory})`, moment_type: "paid", is_key: true });
        }
      }
    }
  }

  // Current + future key moments (includes today), sorted by date
  const futureMoments = allMoments
    .filter(m => m.date >= today && m.is_key)
    .sort((x, y) => x.date.localeCompare(y.date));

  // Deduplicate by date: keep highest-impact moment per date
  const futureByDate = new Map<string, Moment>();
  for (const m of futureMoments) {
    const ex = futureByDate.get(m.date);
    if (!ex) { futureByDate.set(m.date, m); continue; }
    // Prefer non-paid over paid, then by title length (more specific = better)
    const exIsPaid = ex.moment_type.toLowerCase() === "paid";
    const mIsPaid = m.moment_type.toLowerCase() === "paid";
    if (exIsPaid && !mIsPaid) futureByDate.set(m.date, m);
  }
  const uniqueFuture = [...futureByDate.values()].sort((x, y) => x.date.localeCompare(y.date));

  // Also scan all current + future (including non-key) for fallback
  const allFuture = allMoments
    .filter(m => m.date >= today)
    .sort((x, y) => x.date.localeCompare(y.date));

  const supportMoment = uniqueFuture[0] || allFuture[0] || null;
  const nextMoment = uniqueFuture.length > 1 ? uniqueFuture[1] : (allFuture.length > 1 ? allFuture[1] : null);

  // ——— Recent past key moments (fallback if no future) ———
  const recentPast = allMoments
    .filter(m => m.date <= today && m.date >= albumDate && m.is_key)
    .sort((x, y) => y.date.localeCompare(x.date));
  const latestPast = recentPast[0] || null;

  // ——— Build push line ———
  const push = `'${leadTrack}' (${market} focus)`;

  // ——— Build support line with context tag ———
  let support = "";
  if (supportMoment) {
    const tag = momentTag(supportMoment);
    const title = cleanTitle(supportMoment);
    support = `${title} (${fmtWeekOf(supportMoment.date)})${tag ? ` — ${tag}` : ""}`;
  } else if (latestPast) {
    const tag = momentTag(latestPast);
    support = `${cleanTitle(latestPast)} momentum${tag ? ` — ${tag}` : ""}`;
  } else if (a.hadPaid) {
    support = "extend digital campaign post-release — digital push";
  } else {
    support = "add editorial or paid activation — open window";
  }

  // ——— Build next line with context tag ———
  let next = "";
  if (nextMoment) {
    const tag = momentTag(nextMoment);
    const title = cleanTitle(nextMoment);
    next = `build into ${title} (${fmtWeekOf(nextMoment.date)})${tag ? ` — ${tag}` : ""}`;
  } else if (supportMoment && uniqueFuture.length <= 1) {
    next = "sustain post-moment with playlist + editorial push";
  } else {
    next = "identify next activation window";
  }

  return { push, support, next };
}

// 3 bullets: success → cause → gap (with tension). Punchy, repeatable in a meeting.
export function getCampaignLearningsFlat(sheet: CampaignSheetData, territory: Territory): LearningItem[] {
  const items: LearningItem[] = [];
  const albumDate = sheet.setup.release_date;
  if (!albumDate) return items;

  const a = analyseCampaign(sheet, territory);
  const { chart_result, chart_forecast, outcome_driver } = sheet.setup;
  const fmtPhys = a.physicalTotal >= 1000 ? `${(a.physicalTotal / 1000).toFixed(1)}K` : `${a.physicalTotal}`;

  // Compact paid ref: "£16K Marquee (UK + DE)"
  const paidRef = a.hadPaid
    ? `${a.fmtSpend} ${a.paidPlatforms || "paid"}${a.paidTerritories ? ` (${a.paidTerritories})` : ""}`
    : "";

  // ——— 1. SUCCESS — what drove the result ———
  if (chart_result && chart_forecast) {
    const resNum = Number(chart_result.replace(/[^0-9]/g, ""));
    const foreNum = Number(chart_forecast.replace(/[^0-9]/g, ""));
    const beat = resNum && foreNum && resNum < foreNum;
    const missed = resNum && foreNum && resNum > foreNum;

    if (beat && a.physicalTotal > 0) {
      items.push({ text: `${chart_result} vs ${chart_forecast} forecast — physical (${fmtPhys} units) drove the overperformance`, sentiment: "positive" });
    } else if (beat) {
      items.push({ text: `${chart_result} vs ${chart_forecast} forecast — ${outcome_driver || "release-week momentum"} drove the beat`, sentiment: "positive" });
    } else if (missed) {
      items.push({ text: `${chart_result} vs ${chart_forecast} forecast — release week wasn't enough to close the gap`, sentiment: "negative" });
    } else {
      items.push({ text: `${chart_result} as forecast — campaign delivered to target`, sentiment: "neutral" });
    }
  } else if (a.releaseWeekStreams) {
    const physBit = a.physicalTotal > 0 ? ` + ${fmtPhys} physical` : "";
    items.push({ text: `${a.releaseWeekStreams} release-week streams${physBit} — release week drove the campaign`, sentiment: "positive" });
  }

  // ——— 2. CAUSE — what created the peak ———
  if (a.hadPaid && a.keyEditorial) {
    items.push({ text: `${paidRef} + ${a.keyEditorial} created the peak`, sentiment: "positive" });
  } else if (a.hadPaid) {
    items.push({ text: `${paidRef} created the peak — paid was the primary driver`, sentiment: "positive" });
  } else if (a.keyEditorial) {
    items.push({ text: `${a.keyEditorial} drove the streaming window — editorial was the engine`, sentiment: "positive" });
  } else if (a.physicalTotal > 0) {
    items.push({ text: `Physical (${fmtPhys} units) drove the chart position — no digital peak behind it`, sentiment: "neutral" });
  }

  // ——— 3. GAP — tension, what didn't continue ———
  if (a.crashed && a.concentrated && items.length < 3) {
    items.push({ text: `But no second wave — ${a.topTrackName} carried ${a.topTrackShare}% and nothing else picked up`, sentiment: "negative" });
  } else if (a.crashed && items.length < 3) {
    items.push({ text: `But no second wave — streaming wasn't extended beyond release week`, sentiment: "negative" });
  } else if (a.concentrated && items.length < 3) {
    items.push({ text: `But ${a.topTrackName} carried ${a.topTrackShare}% post-release — the rest of the catalogue wasn't activated`, sentiment: "negative" });
  } else if (a.held && items.length < 3) {
    items.push({ text: `Post-release held, but no follow-through moment — a second push wasn't deployed`, sentiment: "neutral" });
  }

  return items.slice(0, 3);
}

// ——— Paid Role: qualitative insight for spend card ———
export function getPaidRole(sheet: CampaignSheetData, territory: Territory): string {
  const albumDate = sheet.setup.release_date;
  if (!albumDate) return "";
  const a = analyseCampaign(sheet, territory);
  if (!a.hadPaid) return "";

  if (a.crashed) return "Paid created a moment, not momentum";
  if (a.held) return "Paid amplified and sustained post-release";
  return "Paid amplified the launch";
}

// Legacy wrapper — returns GroupedLearnings by distributing flat items
export function getGroupedLearnings(sheet: CampaignSheetData, territory: Territory): GroupedLearnings {
  const flat = getCampaignLearningsFlat(sheet, territory);
  const result: GroupedLearnings = { music: [], campaign: [], commercial: [], takeaway: [] };
  // Put all items in takeaway for backward compat
  result.takeaway = flat;
  return result;
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
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) return [];
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  // Build raw track data by date
  const trackByDate = new Map<string, Map<string, number>>();
  sheet.weeklyData.filter(r => r.track_name !== "TOTAL" && trackNames.includes(r.track_name))
    .forEach(r => {
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.week_start_date, r[streamKey]);
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
  const _wd = sheet.weeklyData || [];
  if (_wd.length === 0 && sheet.dailyTrackData && sheet.dailyTrackData.length > 0) {
    const fn = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? (n/1e3).toFixed(0)+"K" : String(n);
    const t = sheet.dailyTrackData.reduce((s: number, r: any) => s + r.global_streams, 0);
    const bd = new Map<string, number>();
    sheet.dailyTrackData.forEach((r: any) => bd.set(r.date, (bd.get(r.date) || 0) + r.global_streams));
    let ps = 0, pd = "";
    bd.forEach((v, k) => { if (v > ps) { ps = v; pd = k; } });
    const pf = pd ? new Date(pd+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : "";
    return fn(t) + " total streams. Peak: ~" + fn(ps) + " (" + pf + ").";
  }
  if (_wd.length === 0) return "Awaiting campaign data.";
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);

  const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));

  const peakRow = totalRows.reduce((best, r) => r[streamKey] > best[streamKey] ? r : best, totalRows[0]);
  const peakDate = peakRow?.week_start_date || "";
  const peakDateFmt = peakDate ? new Date(peakDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

  const roles = inferTrackRoles(sheet, territory);
  const breakout = roles.find(r => r.role === "POST_RELEASE_BREAKOUT");

  if (breakout) {
    const bRows = sheet.weeklyData
      .filter(r => r.track_name === breakout.track_name && r[streamKey] > 0);
    const avgPost = bRows.length > 0
      ? bRows.reduce((s,r) => s + r[streamKey], 0) / bRows.length : 0;
    return `Album peaked at ~${fmtNum(peakRow[streamKey])} streams (w/c ${peakDateFmt}). Post-release, "\u200B${breakout.track_name}" holds ~${fmtNum(avgPost)} weekly while others decline.`;
  }

  return `Album peaked at ~${fmtNum(peakRow[streamKey])} streams (w/c ${peakDateFmt}).`;
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
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) return [];
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
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) return [];
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
  if (!sheet.weeklyData || sheet.weeklyData.length === 0) return { ukStreams: 0, ukPhysical: 0, ukShare: 0 };
  const totalRows = sheet.weeklyData.filter(r => r.track_name === "TOTAL");
  const ukStreams = totalRows.reduce((s, r) => s + r.streams_uk, 0);
  const glStreams = totalRows.reduce((s, r) => s + r.streams_global, 0);
  const ukShare = glStreams > 0 ? Math.round((ukStreams / glStreams) * 100) : 0;
  // Physical doesn't have UK split in schema, so use total
  const ukPhysical = sheet.physicalData.reduce((s, r) => s + r.units, 0);
  return { ukStreams, ukPhysical, ukShare };
}

// ——— Timeline Impact Classification ——————————————————————————
export type ImpactTier = "driver" | "supporting" | "background";

export interface ClassifiedMoment {
  moment: Moment;
  tier: ImpactTier;
  context: string; // short "why it matters" line
}

export function classifyMomentImpact(
  moments: Moment[],
  sheet: CampaignSheetData,
  territory: Territory,
): ClassifiedMoment[] {
  const albumDate = sheet.setup.release_date || "";
  const pcs = sheet.paidCampaigns || [];

  return moments.map(m => {
    const t = m.moment_title.toLowerCase();
    const type = m.moment_type.toLowerCase();

    // ——— DRIVERS: album release, key singles, paid campaigns on release ———
    // Album release
    if (type === "music" && (t.includes("album") || (t.includes("release") && !t.includes("single")))) {
      return { moment: m, tier: "driver" as ImpactTier, context: "Primary campaign driver" };
    }
    // Key singles
    if (type === "music" && m.is_key && (t.includes("single") || t.includes("lead"))) {
      const isPreRelease = m.date < albumDate;
      return { moment: m, tier: "driver" as ImpactTier, context: isPreRelease ? "Built pre-release awareness" : "Sustained post-release momentum" };
    }
    // Paid campaigns that align with release window (within 14 days)
    if ((type === "marquee" || type === "showcase" || type === "paid") && m.is_key) {
      const pc = pcs.find(p => p.start_date === m.date);
      const spendNote = pc && pc.spend > 0 ? ` — $${pc.spend >= 1000 ? (pc.spend/1000).toFixed(0) + "K" : pc.spend}` : "";
      const daysDiff = albumDate ? Math.abs(new Date(m.date).getTime() - new Date(albumDate).getTime()) / 86400000 : 999;
      if (daysDiff <= 14) {
        return { moment: m, tier: "driver" as ImpactTier, context: `Drove release window spike${spendNote}` };
      }
      return { moment: m, tier: "supporting" as ImpactTier, context: `Paid support${spendNote}` };
    }

    // ——— SUPPORTING: editorial, key moments, tour, TV, product milestones ———
    if (type === "editorial" && m.is_key) {
      return { moment: m, tier: "supporting" as ImpactTier, context: "Boosted reach and discovery" };
    }
    if (type === "editorial") {
      return { moment: m, tier: "supporting" as ImpactTier, context: "Editorial visibility" };
    }
    if ((type === "tour" || type === "live") && m.is_key) {
      return { moment: m, tier: "supporting" as ImpactTier, context: "Live event awareness" };
    }
    if ((type === "tv" || type === "radio" || type === "media") && m.is_key) {
      return { moment: m, tier: "supporting" as ImpactTier, context: "Media visibility" };
    }
    // Key product moments (chart positions, milestones) — treat as driver if near release, supporting otherwise
    if (type === "product" && m.is_key) {
      const daysDiff = albumDate ? Math.abs(new Date(m.date).getTime() - new Date(albumDate).getTime()) / 86400000 : 999;
      if (daysDiff <= 14) {
        return { moment: m, tier: "driver" as ImpactTier, context: "Campaign milestone" };
      }
      return { moment: m, tier: "supporting" as ImpactTier, context: "Campaign milestone" };
    }
    if (type === "marketing" && m.is_key) {
      return { moment: m, tier: "supporting" as ImpactTier, context: "Marketing moment" };
    }
    if (m.is_key && type === "music") {
      return { moment: m, tier: "supporting" as ImpactTier, context: "Music moment" };
    }

    // ——— BACKGROUND: everything else ———
    if (type === "marquee" || type === "showcase" || type === "paid") {
      const pc = pcs.find(p => p.start_date === m.date);
      const spendNote = pc && pc.spend > 0 ? ` — $${pc.spend >= 1000 ? (pc.spend/1000).toFixed(0) + "K" : pc.spend}` : "";
      return { moment: m, tier: "background" as ImpactTier, context: `Paid activity${spendNote}` };
    }
    if (type === "tour" || type === "live") {
      return { moment: m, tier: "background" as ImpactTier, context: "Tour / live" };
    }
    if (type === "marketing" || type === "product") {
      return { moment: m, tier: "background" as ImpactTier, context: "Campaign activity" };
    }
    return { moment: m, tier: "background" as ImpactTier, context: "" };
  });
}
