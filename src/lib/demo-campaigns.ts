/**
 * Demo Campaigns — curated semi-mock data for 3 distinct campaign shapes.
 *
 * 1. K Trap — New Album 2026 (strong campaign)
 *    Clear build → spikes → strong release → post-release lift
 *
 * 2. James Blake — Trying Times (mixed signals)
 *    Uneven → inconsistent spikes → plateau
 *
 * 3. Trapo 2 — Underperforming (weak campaign)
 *    Weak build → low spikes → drop-off
 */

import type {
  AppData, LoadedCampaign, CampaignSheetData, CampaignSetup,
  Track, WeeklyRow, PhysicalRow, Moment, DailyTrackRow,
  DailyTerritoryRow, DailyReleaseTerritoryRow, UKContextRow,
  PaidCampaignRow, ManualLearning, D2CSalesRow,
} from "@/types";

// ── Helpers ──

function date(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add days to a date string */
function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}

/** Generate weekly dates from start for N weeks */
function weeklyDates(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i * 7));
}

/** Add noise to a value (±pct) */
function noise(v: number, pct: number = 0.12): number {
  const jitter = 1 + (Math.random() - 0.5) * 2 * pct;
  return Math.round(v * jitter);
}

/** Seed-based pseudo-random (deterministic across runs) */
let _seed = 42;
function seedRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function sNoise(v: number, pct: number = 0.12): number {
  const jitter = 1 + (seedRandom() - 0.5) * 2 * pct;
  return Math.round(v * jitter);
}

// ══════════════════════════════════════════════════════════════════
// CAMPAIGN 1: K Trap — New Album 2026 (Strong)
// ══════════════════════════════════════════════════════════════════

function buildKTrap(): CampaignSheetData {
  const releaseDate = date(2026, 3, 13);
  const weekStart = date(2026, 1, 5); // ~10 weeks pre-release

  const setup: CampaignSetup = {
    campaign_name: "New Album 2026",
    artist_name: "K Trap",
    campaign_type: "album",
    release_date: releaseDate,
    default_territory: "UK",
    chart_result: "Top 5",
    chart_forecast: "Top 10",
    outcome_driver: "streaming + physical",
    team_push_push: "Lead single UK push — radio + playlist",
    team_push_support: "Marquee UK + DE targeting 18–24",
    team_push_next: "Album pre-save → release week blitz",
  };

  const tracks: Track[] = [
    { track_name: "No More Games", track_role: "lead_single", release_date: date(2026, 1, 10), default_on: true, sort_order: 1 },
    { track_name: "Southside", track_role: "second_single", release_date: date(2026, 2, 14), default_on: true, sort_order: 2 },
    { track_name: "Different Breed", track_role: "focus_track", release_date: releaseDate, default_on: true, sort_order: 3 },
    { track_name: "Late Nights", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 4 },
    { track_name: "Trap Life", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 5 },
  ];

  // Weekly streams shape: build → spike at S1 → grow → big release spike → sustain
  const weekDates = weeklyDates(weekStart, 16);
  const globalShape = [
    180000, 220000, 310000, 480000, // S1 drops W3-ish
    520000, 490000, 650000, 820000, // S2 drop W7
    900000, 1050000, 2800000, 3400000, // Release W11
    2600000, 2100000, 1800000, 1650000, // Post-release sustain
  ];
  const ukShare = 0.38;

  const weeklyData: WeeklyRow[] = weekDates.map((d, i) => ({
    week_start_date: d,
    track_name: "TOTAL",
    streams_global: sNoise(globalShape[i]),
    streams_uk: sNoise(Math.round(globalShape[i] * ukShare)),
  }));

  // Track-level daily data (simplified — one entry per week per track)
  const dailyTrackData: DailyTrackRow[] = [];
  const trackShares = [0.35, 0.25, 0.20, 0.12, 0.08];
  for (const wd of weekDates) {
    const idx = weekDates.indexOf(wd);
    const total = globalShape[idx];
    tracks.forEach((t, ti) => {
      dailyTrackData.push({ date: wd, track_name: t.track_name, global_streams: sNoise(Math.round(total * trackShares[ti])) });
    });
  }

  const physicalData: PhysicalRow[] = [
    { week_start_date: weekDates[10], units: sNoise(8200) },
    { week_start_date: weekDates[11], units: sNoise(4600) },
    { week_start_date: weekDates[12], units: sNoise(2100) },
    { week_start_date: weekDates[13], units: sNoise(1400) },
  ];

  const moments: Moment[] = [
    { date: date(2026, 1, 10), moment_title: "Lead Single — No More Games", moment_type: "music", is_key: true },
    { date: date(2026, 1, 17), moment_title: "Playlist adds — Rap UK, New Music Friday", moment_type: "editorial", is_key: false },
    { date: date(2026, 2, 14), moment_title: "Second Single — Southside", moment_type: "music", is_key: true },
    { date: date(2026, 2, 21), moment_title: "Marquee UK — Southside push", moment_type: "marquee", is_key: true },
    { date: date(2026, 3, 1), moment_title: "Album pre-save campaign launches", moment_type: "marketing", is_key: false },
    { date: releaseDate, moment_title: "Album Release — New Album 2026", moment_type: "music", is_key: true },
    { date: date(2026, 3, 15), moment_title: "BBC Radio 1Xtra interview", moment_type: "media", is_key: false },
    { date: date(2026, 3, 20), moment_title: "UK Tour announced", moment_type: "live", is_key: true },
    { date: date(2026, 3, 27), moment_title: "Marquee DE — Different Breed", moment_type: "marquee", is_key: false },
  ];

  const paidCampaigns: PaidCampaignRow[] = [
    { campaign_name: "Southside Launch", platform: "Marquee", territory: "UK", start_date: date(2026, 2, 21), spend: 8000, spend_planned: 10000, intent_total: 32, intent_super: 14, intent_moderate: 18, best_segment: "18–24 Hip-Hop", top_track: "Southside", campaign_objective: "Awareness", notes: "" },
    { campaign_name: "Album Push DE", platform: "Marquee", territory: "DE", start_date: date(2026, 3, 27), spend: 2500, spend_planned: 3000, intent_total: 22, intent_super: 8, intent_moderate: 14, best_segment: "18–29 Rap", top_track: "Different Breed", campaign_objective: "Conversion", notes: "" },
  ];

  const learnings: ManualLearning[] = [
    { type: "worked", text: "Lead single built genuine momentum — 480K streams in week 3 before any paid push", order: 1 },
    { type: "worked", text: "UK Marquee intent rate 32% — well above benchmark, strong audience–track fit", order: 2 },
    { type: "didnt", text: "DE push underperformed — 22% intent, audience not yet primed for this market", order: 3 },
    { type: "next", text: "Tour announcement should sustain post-release. Monitor if streams hold above 1.5M/wk", order: 4 },
  ];

  return {
    setup, tracks, weeklyData, physicalData, moments,
    dailyTrackData,
    dailyTerritoryData: [],
    dailyReleaseTerritoryData: [],
    ukContext: [],
    paidCampaigns,
    learnings,
    d2cSales: [],
  };
}


// ══════════════════════════════════════════════════════════════════
// CAMPAIGN 2: James Blake — Trying Times (Mixed Signals)
// ══════════════════════════════════════════════════════════════════

function buildJamesBlake(): CampaignSheetData {
  const releaseDate = date(2026, 2, 20);
  const weekStart = date(2025, 12, 15);

  const setup: CampaignSetup = {
    campaign_name: "Trying Times",
    artist_name: "James Blake",
    campaign_type: "album",
    release_date: releaseDate,
    default_territory: "global",
    chart_result: "Top 20",
    chart_forecast: "Top 15",
    outcome_driver: "streaming",
    team_push_push: "I Had a Dream — global playlist focus",
    team_push_support: "Showcase US + UK fan base activation",
    team_push_next: "Festival season — build into summer",
  };

  const tracks: Track[] = [
    { track_name: "I Had a Dream", track_role: "lead_single", release_date: date(2025, 12, 20), default_on: true, sort_order: 1 },
    { track_name: "Death Of Love", track_role: "second_single", release_date: date(2026, 1, 24), default_on: true, sort_order: 2 },
    { track_name: "Doesn't Just Happen", track_role: "focus_track", release_date: releaseDate, default_on: true, sort_order: 3 },
    { track_name: "Trying Times", track_role: "title_track", release_date: releaseDate, default_on: true, sort_order: 4 },
    { track_name: "Night Sky", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 5 },
  ];

  // Mixed shape: spiky start, inconsistent, plateau after release
  const weekDates = weeklyDates(weekStart, 16);
  const globalShape = [
    120000, 350000, 280000, 190000, // S1 spike then dip
    420000, 310000, 380000, 460000, // S2 uneven lift
    500000, 550000, 1200000, 1050000, // Release — decent but not explosive
    920000, 880000, 850000, 820000, // Plateau — not growing, not dying
  ];

  const weeklyData: WeeklyRow[] = weekDates.map((d, i) => ({
    week_start_date: d,
    track_name: "TOTAL",
    streams_global: sNoise(globalShape[i], 0.15),
    streams_uk: sNoise(Math.round(globalShape[i] * 0.22), 0.15),
  }));

  const dailyTrackData: DailyTrackRow[] = [];
  const trackShares = [0.30, 0.28, 0.22, 0.12, 0.08];
  for (const wd of weekDates) {
    const idx = weekDates.indexOf(wd);
    tracks.forEach((t, ti) => {
      dailyTrackData.push({ date: wd, track_name: t.track_name, global_streams: sNoise(Math.round(globalShape[idx] * trackShares[ti]), 0.18) });
    });
  }

  const moments: Moment[] = [
    { date: date(2025, 12, 20), moment_title: "Lead Single — I Had a Dream", moment_type: "music", is_key: true },
    { date: date(2026, 1, 3), moment_title: "Playlist adds — Chill Vibes, New Music Friday", moment_type: "editorial", is_key: false },
    { date: date(2026, 1, 10), moment_title: "BBC Radio 6 premiere", moment_type: "media", is_key: false },
    { date: date(2026, 1, 24), moment_title: "Second Single — Death Of Love", moment_type: "music", is_key: true },
    { date: date(2026, 2, 7), moment_title: "Showcase US — I Had a Dream", moment_type: "marquee", is_key: true },
    { date: releaseDate, moment_title: "Album Release — Trying Times", moment_type: "music", is_key: true },
    { date: date(2026, 3, 1), moment_title: "NME feature interview", moment_type: "media", is_key: false },
    { date: date(2026, 3, 14), moment_title: "Festival announcement (Glastonbury)", moment_type: "live", is_key: true },
  ];

  const paidCampaigns: PaidCampaignRow[] = [
    { campaign_name: "Dream Launch", platform: "Showcase", territory: "US", start_date: date(2026, 2, 7), spend: 5000, spend_planned: 5000, intent_total: 26, intent_super: 10, intent_moderate: 16, best_segment: "25–34 Electronic", top_track: "I Had a Dream", campaign_objective: "Awareness", notes: "" },
  ];

  const learnings: ManualLearning[] = [
    { type: "worked", text: "Lead single generated strong initial spike — 350K in week 2 off editorial alone", order: 1 },
    { type: "didnt", text: "Momentum didn't sustain between singles — 40% drop after initial spike before S2 picked it back up", order: 2 },
    { type: "didnt", text: "Album release didn't generate the multiplier expected — peaked at 1.2M vs forecast 1.5M+", order: 3 },
    { type: "next", text: "Post-release plateau is stable but flat. Festival slot may inject new growth — monitor closely", order: 4 },
  ];

  return {
    setup, tracks, weeklyData, physicalData: [], moments,
    dailyTrackData,
    dailyTerritoryData: [],
    dailyReleaseTerritoryData: [],
    ukContext: [],
    paidCampaigns,
    learnings,
    d2cSales: [],
  };
}


// ══════════════════════════════════════════════════════════════════
// CAMPAIGN 3: Trapo 2 — Underperforming (Weak)
// ══════════════════════════════════════════════════════════════════

function buildTrapo2(): CampaignSheetData {
  const releaseDate = date(2026, 4, 3);
  const weekStart = date(2026, 2, 2);

  const setup: CampaignSetup = {
    campaign_name: "Trapo 2",
    artist_name: "K Trap",
    campaign_type: "album",
    release_date: releaseDate,
    default_territory: "UK",
    chart_result: "",
    chart_forecast: "Top 40",
    outcome_driver: "streaming",
    team_push_push: "Focus track — Cold Nights",
    team_push_support: "Organic socials + fan content",
    team_push_next: "Reassess — may need to shift budget to next cycle",
  };

  const tracks: Track[] = [
    { track_name: "Cold Nights", track_role: "lead_single", release_date: date(2026, 2, 7), default_on: true, sort_order: 1 },
    { track_name: "Back Then", track_role: "second_single", release_date: date(2026, 3, 7), default_on: true, sort_order: 2 },
    { track_name: "On My Own", track_role: "focus_track", release_date: releaseDate, default_on: true, sort_order: 3 },
    { track_name: "No Signal", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 4 },
  ];

  // Weak shape: low start, small bumps, release underdelivers, rapid decline
  const weekDates = weeklyDates(weekStart, 14);
  const globalShape = [
    45000, 62000, 88000, 75000, // S1 — modest, no breakout
    68000, 95000, 82000, 110000, // S2 — small lift
    130000, 380000, 320000, 210000, // Release — underwhelming spike
    145000, 98000, // Rapid drop
  ];
  const ukShare = 0.45;

  const weeklyData: WeeklyRow[] = weekDates.map((d, i) => ({
    week_start_date: d,
    track_name: "TOTAL",
    streams_global: sNoise(globalShape[i], 0.18),
    streams_uk: sNoise(Math.round(globalShape[i] * ukShare), 0.18),
  }));

  const dailyTrackData: DailyTrackRow[] = [];
  const trackShares = [0.38, 0.28, 0.20, 0.14];
  for (const wd of weekDates) {
    const idx = weekDates.indexOf(wd);
    tracks.forEach((t, ti) => {
      dailyTrackData.push({ date: wd, track_name: t.track_name, global_streams: sNoise(Math.round(globalShape[idx] * trackShares[ti]), 0.20) });
    });
  }

  const moments: Moment[] = [
    { date: date(2026, 2, 7), moment_title: "Lead Single — Cold Nights", moment_type: "music", is_key: true },
    { date: date(2026, 2, 14), moment_title: "Playlist adds — limited pickup", moment_type: "editorial", is_key: false },
    { date: date(2026, 3, 7), moment_title: "Second Single — Back Then", moment_type: "music", is_key: true },
    { date: date(2026, 3, 21), moment_title: "Marquee UK — Cold Nights", moment_type: "marquee", is_key: true },
    { date: releaseDate, moment_title: "Album Release — Trapo 2", moment_type: "music", is_key: true },
    { date: date(2026, 4, 10), moment_title: "Socials push — fan content week", moment_type: "marketing", is_key: false },
  ];

  const paidCampaigns: PaidCampaignRow[] = [
    { campaign_name: "Cold Nights Push", platform: "Marquee", territory: "UK", start_date: date(2026, 3, 21), spend: 3000, spend_planned: 5000, intent_total: 18, intent_super: 5, intent_moderate: 13, best_segment: "18–24 UK Rap", top_track: "Cold Nights", campaign_objective: "Awareness", notes: "Paused early — intent below benchmark" },
  ];

  const learnings: ManualLearning[] = [
    { type: "worked", text: "Core fanbase showed up — Cold Nights hit 88K in week 3 off organic alone", order: 1 },
    { type: "didnt", text: "No breakout moment — neither single crossed into wider discovery", order: 2 },
    { type: "didnt", text: "Marquee paused early at 18% intent — audience wasn't primed", order: 3 },
    { type: "didnt", text: "Release week peaked at 380K vs 800K+ target — significant underdelivery", order: 4 },
    { type: "next", text: "Consider shifting budget to next release cycle. Current trajectory doesn't justify further spend", order: 5 },
  ];

  return {
    setup, tracks, weeklyData, physicalData: [], moments,
    dailyTrackData,
    dailyTerritoryData: [],
    dailyReleaseTerritoryData: [],
    ukContext: [],
    paidCampaigns,
    learnings,
    d2cSales: [],
  };
}


// ══════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════

export function getDemoCampaigns(): AppData {
  const campaigns: LoadedCampaign[] = [
    { campaign_id: "k-trap-album-2026", sheet: buildKTrap(), trackWeeklyMetrics: [] },
    { campaign_id: "james-blake-trying-times", sheet: buildJamesBlake(), trackWeeklyMetrics: [] },
    { campaign_id: "k-trap-trapo-2", sheet: buildTrapo2(), trackWeeklyMetrics: [] },
  ];
  return { campaigns };
}

/** Check if we should use demo data (no API keys configured) */
export function shouldUseDemoData(): boolean {
  return !process.env.GOOGLE_SHEETS_PRIVATE_KEY && !process.env.AIRTABLE_API_KEY;
}
