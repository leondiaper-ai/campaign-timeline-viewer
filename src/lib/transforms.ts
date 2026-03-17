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
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalByDate = new Map<string, number>();
  sheet.weeklyData.filter((r) => r.track_name === "TOTAL")
    .forEach((r) => totalByDate.set(r.week_start_date, r[streamKey]));

  const trackByDate = new Map<string, Map<string, number>>();
  sheet.weeklyData.filter((r) => r.track_name !== "TOTAL" && selectedTracks.includes(r.track_name))
    .forEach((r) => {
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name)!.set(r.week_start_date, r[streamKey]);
    });

  const physicalByDate = new Map<string, number>();
  sheet.physicalData.forEach((r) => physicalByDate.set(r.week_start_date, r.units));

  const trackReleaseDates = new Map<string, string>();
  sheet.tracks.forEach((t) => { if (t.release_date) trackReleaseDates.set(t.track_name, t.release_date); });

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
      date, total_streams: totalByDate.get(date) ?? 0, physical_units: physicalByDate.get(date) ?? 0,
      cumulative_streams: 0, prev_week_streams: null, events: momentsByDate.get(date) || [],
    };
    selectedTracks.forEach((track) => {
      const trackDates = trackByDate.get(track);
      if (!trackDates || !trackDates.has(date)) {
        // Track has no data for this week — null (skip, don't plot)
        point[track] = null;
      } else {
        point[track] = trackDates.get(date)!;
      }
    });
    return point;
  });

  // Ghost dates for moments without data
  const dataDates = new Set(sortedDates);
  sheet.moments.forEach((m) => {
    if (!dataDates.has(m.date)) {
      const point: ChartDataPoint = {
        date: m.date, total_streams: 0, physical_units: 0,
        cumulative_streams: 0, prev_week_streams: null, events: momentsByDate.get(m.date) || [],
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
    result[i].prev_week_streams = (i > 0 && result[i].total_streams > 0)
      ? (() => { for (let j = i - 1; j >= 0; j--) { if (result[j].total_streams > 0) return result[j].total_streams; } return null; })()
      : null;
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


// ——— Phase-based Campaign Learnings ——————————————————————————
export interface CampaignLearning {
  dateLabel: string;
  eventType: string;
  text: string;
  phase: "pre" | "peak" | "post";
}

export function getCampaignLearnings(sheet: CampaignSheetData, territory: Territory): CampaignLearning[] {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const learnings: CampaignLearning[] = [];
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);
  const fmtDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const albumDate = sheet.setup.release_date;
  if (!albumDate) return learnings;

  const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
  if (totalRows.length < 2) return learnings;

  // Peak week
  const peakRow = totalRows.reduce((best, r) => r[streamKey] > best[streamKey] ? r : best, totalRows[0]);
  const peakDate = peakRow.week_start_date;

  // 1. Album release peak
  learnings.push({
    dateLabel: fmtDate(peakDate),
    eventType: "ALBUM RELEASE",
    text: `Peak week (~${fmtNum(peakRow[streamKey])} streams), primary campaign driver`,
    phase: "peak",
  });

  // 2. Post-release drop
  const postPeakRows = totalRows.filter(r => r.week_start_date > peakDate);
  if (postPeakRows.length > 0) {
    const nextWeek = postPeakRows[0];
    const dropPct = Math.round((1 - nextWeek[streamKey] / peakRow[streamKey]) * 100);
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
      .filter(r => r.track_name === breakout.track_name && r[streamKey] > 0)
      .sort((a,b) => a.week_start_date.localeCompare(b.week_start_date));
    const avgPost = bRows.length > 0
      ? bRows.reduce((s,r) => s + r[streamKey], 0) / bRows.length : 0;
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


// ——— Single Campaign Summary (replaces 3 vague cards) ————————
export function getCampaignSummary(sheet: CampaignSheetData, territory: Territory): string {
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
