/**
 * Demo Campaigns — two scenarios with identical structure, different outcomes.
 *
 * SHARED 5-ACT STRUCTURE:
 *   Act 1 — Pre-release build (lead single drops, organic discovery)
 *   Act 2 — Lead single impact (spike, editorial, playlist)
 *   Act 3 — Second single moment (shift in track dominance)
 *   Act 4 — Album release spike (peak activity)
 *   Act 5 — Post-release behaviour (sustain, decay, or plateau)
 *
 * SHARED TRACK ROLES (3 default_on per campaign):
 *   lead_single  — first to market, spikes early, fades mid-campaign
 *   second_single — takes over mid-campaign, sustains through release
 *   focus_track   — album-era track, rises at release, defines post-release
 *
 * CAMPAIGNS:
 *   1. K Trap — New Album 2026 (strong) → singles drove build, album overdelivered
 *   2. James Blake — Trying Times (mixed) → strong singles, album underdelivered, plateau
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

function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}

function weeklyDates(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i * 7));
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

/** Build weekly + track data from a shape + share matrix */
function buildWeeklyAndTrackData(
  weekDates: string[],
  globalShape: number[],
  ukShareByWeek: number[],
  tracks: Track[],
  trackSharesByWeek: number[][],
  noisePct: number = 0.12,
): { weeklyData: WeeklyRow[]; dailyTrackData: DailyTrackRow[] } {
  const weeklyData: WeeklyRow[] = weekDates.map((d, i) => ({
    week_start_date: d,
    track_name: "TOTAL",
    streams_global: sNoise(globalShape[i], noisePct),
    streams_uk: sNoise(Math.round(globalShape[i] * ukShareByWeek[i]), noisePct),
  }));

  const dailyTrackData: DailyTrackRow[] = [];
  for (let idx = 0; idx < weekDates.length; idx++) {
    const total = globalShape[idx];
    const shares = trackSharesByWeek[idx];
    tracks.forEach((t, ti) => {
      dailyTrackData.push({
        date: weekDates[idx],
        track_name: t.track_name,
        global_streams: sNoise(Math.round(total * shares[ti]), noisePct + 0.03),
      });
    });
  }

  return { weeklyData, dailyTrackData };
}


// ══════════════════════════════════════════════════════════════════
// CAMPAIGN 1: K Trap — New Album 2026 (Strong)
// Primary driver: singles → album multiplied
// ══════════════════════════════════════════════════════════════════

function buildKTrap(): CampaignSheetData {
  const releaseDate = date(2026, 3, 13);
  const weekStart = date(2026, 1, 5);

  const setup: CampaignSetup = {
    campaign_name: "Album Campaign",
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

  // 3 KEY TRACKS (all default_on) + 2 album tracks
  const tracks: Track[] = [
    { track_name: "No More Games", track_role: "lead_single", release_date: date(2026, 1, 10), default_on: true, sort_order: 1 },
    { track_name: "Southside", track_role: "second_single", release_date: date(2026, 2, 14), default_on: true, sort_order: 2 },
    { track_name: "Different Breed", track_role: "focus_track", release_date: releaseDate, default_on: true, sort_order: 3 },
    { track_name: "Late Nights", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 4 },
    { track_name: "Trap Life", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 5 },
  ];

  // 5-ACT STREAM SHAPE (16 weeks):
  // Act 1 (W1–2):  Pre-release baseline, lead single drops end of W1
  // Act 2 (W3–5):  Lead single impact — spikes W3, editorial lift W4, natural dip W5
  // Act 3 (W6–8):  Second single — Southside spikes W7, dips W8 (no follow-up)
  // Act 4 (W9–11): Pre-release build → massive release spike W11
  // Act 5 (W12–16): Post-release — sharp initial drop, tour buzz creates W15 second wind
  const weekDates = weeklyDates(weekStart, 16);
  const globalShape = [
    145000,  // W1:  baseline before S1
    260000,  // W2:  S1 initial buzz, playlist adds
    420000,  // W3:  S1 peak — editorial + organic discovery
    350000,  // W4:  natural decay from S1 spike
    290000,  // W5:  S1 fading, gap before S2
    340000,  // W6:  pre-S2 anticipation
    710000,  // W7:  S2 drops — Southside spikes hard
    560000,  // W8:  S2 dip (no immediate follow-up)
    680000,  // W9:  pre-release buildup, pre-save campaign
    980000,  // W10: album announce week, momentum building
    3200000, // W11: ALBUM RELEASE — massive spike
    2350000, // W12: release week 2 — sharp 27% drop (normal)
    1650000, // W13: continued decline
    1420000, // W14: settling into post-release baseline
    1850000, // W15: TOUR ANNOUNCE — second wind spike (+30%)
    1720000, // W16: sustaining above pre-release peak
  ];

  // UK share fluctuates with UK-specific activity
  const ukShareByWeek = [
    0.44, 0.42, 0.40, 0.38,  // Act 1–2: UK-heavy (UK artist)
    0.36, 0.37, 0.42, 0.39,  // Act 3: Marquee UK lifts share
    0.37, 0.35, 0.33, 0.31,  // Act 4: release goes global, UK share dips
    0.32, 0.34, 0.41, 0.39,  // Act 5: tour announce pulls UK back up
  ];

  // TRACK DOMINANCE SHIFTS across acts:
  // [No More Games, Southside, Different Breed, Late Nights, Trap Life]
  const trackSharesByWeek = [
    [0.68, 0.04, 0.03, 0.14, 0.11], // W1:  NMG is everything
    [0.72, 0.05, 0.03, 0.11, 0.09], // W2:  NMG peak dominance
    [0.64, 0.06, 0.04, 0.15, 0.11], // W3:  NMG still leading, slight bleed
    [0.52, 0.09, 0.06, 0.19, 0.14], // W4:  NMG fading, catalogue discovery
    [0.40, 0.13, 0.08, 0.22, 0.17], // W5:  between singles — everything spreads
    [0.32, 0.16, 0.10, 0.24, 0.18], // W6:  pre-S2
    [0.20, 0.50, 0.08, 0.12, 0.10], // W7:  S2 SPIKE — Southside takes over
    [0.24, 0.41, 0.12, 0.13, 0.10], // W8:  Southside holding but not growing
    [0.20, 0.33, 0.20, 0.15, 0.12], // W9:  focus track rising pre-release
    [0.17, 0.26, 0.28, 0.16, 0.13], // W10: Different Breed overtaking
    [0.14, 0.17, 0.34, 0.20, 0.15], // W11: RELEASE — album tracks explode
    [0.13, 0.15, 0.31, 0.23, 0.18], // W12: post-release settling
    [0.15, 0.14, 0.28, 0.24, 0.19], // W13: catalogue levelling
    [0.17, 0.13, 0.27, 0.24, 0.19], // W14: long-tail behaviour
    [0.19, 0.15, 0.26, 0.22, 0.18], // W15: tour buzz lifts everything
    [0.18, 0.14, 0.27, 0.23, 0.18], // W16: sustaining
  ];

  const { weeklyData, dailyTrackData } = buildWeeklyAndTrackData(
    weekDates, globalShape, ukShareByWeek, tracks, trackSharesByWeek
  );

  const physicalData: PhysicalRow[] = [
    { week_start_date: weekDates[7], units: sNoise(420) },   // W8:  pre-orders open — trickle
    { week_start_date: weekDates[8], units: sNoise(680) },   // W9:  pre-order build
    { week_start_date: weekDates[9], units: sNoise(1500) },  // W10: pre-release push, pre-orders spike
    { week_start_date: weekDates[10], units: sNoise(8400) }, // W11: RELEASE — big physical week
    { week_start_date: weekDates[11], units: sNoise(4300) }, // W12: post-release
    { week_start_date: weekDates[12], units: sNoise(1900) }, // W13: tailing off
    { week_start_date: weekDates[13], units: sNoise(1100) }, // W14: long tail
  ];

  // MOMENTS — tied to the 5-act structure
  const moments: Moment[] = [
    // Act 1–2: Lead single impact
    { date: date(2026, 1, 10), moment_title: "Lead Single — No More Games", moment_type: "music", is_key: true },
    { date: date(2026, 1, 12), moment_title: "Mailer — new single announcement to fanbase", moment_type: "marketing", is_key: false },
    { date: date(2026, 1, 17), moment_title: "Playlist adds — Rap UK, New Music Friday", moment_type: "editorial", is_key: false },
    { date: date(2026, 1, 24), moment_title: "Radio 1Xtra A-list rotation", moment_type: "media", is_key: false },
    // Act 3: Second single
    { date: date(2026, 2, 14), moment_title: "Second Single — Southside", moment_type: "music", is_key: true },
    { date: date(2026, 2, 21), moment_title: "Marquee UK — Southside push", moment_type: "marquee", is_key: true },
    // Act 4: Album release
    { date: date(2026, 3, 1), moment_title: "Album pre-save campaign launches", moment_type: "marketing", is_key: false },
    { date: date(2026, 3, 6), moment_title: "Mailer — pre-order + exclusive vinyl bundle", moment_type: "marketing", is_key: false },
    { date: releaseDate, moment_title: "Album Release — New Album 2026", moment_type: "music", is_key: true },
    { date: date(2026, 3, 14), moment_title: "Mailer — album out now + tour pre-sale", moment_type: "marketing", is_key: false },
    // Act 5: Post-release
    { date: date(2026, 3, 20), moment_title: "UK Tour announced", moment_type: "live", is_key: true },
    { date: date(2026, 3, 27), moment_title: "Marquee DE — Different Breed", moment_type: "marquee", is_key: false },
  ];

  const paidCampaigns: PaidCampaignRow[] = [
    { campaign_name: "Southside Launch", platform: "Marquee", territory: "UK", start_date: date(2026, 2, 21), spend: 8000, spend_planned: 10000, intent_total: 32, intent_super: 14, intent_moderate: 18, best_segment: "18–24 Hip-Hop", top_track: "Southside", campaign_objective: "Awareness", notes: "" },
    { campaign_name: "Album Push DE", platform: "Marquee", territory: "DE", start_date: date(2026, 3, 27), spend: 2500, spend_planned: 3000, intent_total: 22, intent_super: 8, intent_moderate: 14, best_segment: "18–29 Rap", top_track: "Different Breed", campaign_objective: "Conversion", notes: "" },
  ];

  const learnings: ManualLearning[] = [
    { type: "worked", text: "Lead single built genuine momentum — 420K streams in week 3 before any paid push", order: 1 },
    { type: "worked", text: "UK Marquee intent rate 32% — well above 20% benchmark, strong audience–track fit", order: 2 },
    { type: "worked", text: "Album release multiplied singles audience — 3.2M release week, 3x the pre-release peak", order: 3 },
    { type: "didnt", text: "DE push underperformed — 22% intent vs 32% UK. Audience not yet primed for that market", order: 4 },
    { type: "next", text: "Tour announcement created post-release second wind. Monitor if streams hold above 1.5M/wk through Q2", order: 5 },
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
// Primary driver: lead single (album underdelivered)
// ══════════════════════════════════════════════════════════════════

function buildJamesBlake(): CampaignSheetData {
  const releaseDate = date(2026, 2, 20);
  const weekStart = date(2025, 12, 15);

  const setup: CampaignSetup = {
    campaign_name: "Album Campaign",
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

  // 3 KEY TRACKS (all default_on) + 2 album tracks
  const tracks: Track[] = [
    { track_name: "I Had a Dream", track_role: "lead_single", release_date: date(2025, 12, 20), default_on: true, sort_order: 1 },
    { track_name: "Death Of Love", track_role: "second_single", release_date: date(2026, 1, 24), default_on: true, sort_order: 2 },
    { track_name: "Doesn't Just Happen", track_role: "focus_track", release_date: releaseDate, default_on: true, sort_order: 3 },
    { track_name: "Trying Times", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 4 },
    { track_name: "Night Sky", track_role: "album_track", release_date: releaseDate, default_on: false, sort_order: 5 },
  ];

  // 5-ACT STREAM SHAPE (16 weeks):
  // Act 1 (W1–2):  Pre-release baseline, lead single drops end of W1
  // Act 2 (W3–5):  Lead single impact — massive spike W2 (editorial), sharp drop W3–4, dead air W5
  // Act 3 (W6–8):  Second single — Death Of Love spikes W6 but lower ceiling than S1
  // Act 4 (W9–11): Pre-release build → release peaks W11 but misses forecast
  // Act 5 (W12–16): Flat plateau — not dying but not growing. Festival barely moves needle.
  const weekDates = weeklyDates(weekStart, 16);
  const globalShape = [
    85000,   // W1:  baseline before S1
    395000,  // W2:  S1 SPIKE — 4.6x (editorial, Chill Vibes, NMF)
    270000,  // W3:  -32% from spike (normal decay)
    155000,  // W4:  -43% — attention evaporating fast
    125000,  // W5:  dead air — no content, no follow-up, sags to near-baseline
    460000,  // W6:  S2 drops — Death Of Love spikes, but 17% below S1 peak
    340000,  // W7:  S2 decay begins
    385000,  // W8:  slight recovery — Showcase US paid push
    420000,  // W9:  pre-release build starts
    490000,  // W10: building but slowly
    1180000, // W11: ALBUM RELEASE — peaks but undershoots 1.5M forecast
    960000,  // W12: -19% — faster decay than expected
    880000,  // W13: plateau begins
    865000,  // W14: flat
    850000,  // W15: flat — Glastonbury announced but barely registers
    875000,  // W16: +3% — marginal festival anticipation lift
  ];

  // UK share — lower baseline (Blake is global-first, US/EU heavy)
  const ukShareByWeek = [
    0.18, 0.25, 0.22, 0.19,  // Act 1–2: Radio 6 premiere lifts UK W2
    0.16, 0.21, 0.20, 0.22,  // Act 3: Showcase US dilutes UK share
    0.19, 0.18, 0.20, 0.21,  // Act 4: release is global push
    0.22, 0.23, 0.24, 0.25,  // Act 5: UK festival buzz slowly lifts share
  ];

  // TRACK DOMINANCE SHIFTS across acts:
  // [I Had a Dream, Death Of Love, Doesn't Just Happen, Trying Times, Night Sky]
  const trackSharesByWeek = [
    [0.65, 0.04, 0.04, 0.16, 0.11], // W1:  S1 baseline
    [0.74, 0.03, 0.03, 0.12, 0.08], // W2:  S1 SPIKE — IHAD dominates
    [0.60, 0.07, 0.05, 0.16, 0.12], // W3:  S1 fading
    [0.44, 0.11, 0.08, 0.22, 0.15], // W4:  S1 losing grip
    [0.34, 0.14, 0.10, 0.25, 0.17], // W5:  dead air — everything sags
    [0.18, 0.54, 0.08, 0.12, 0.08], // W6:  S2 SPIKE — DOL takes over
    [0.21, 0.43, 0.12, 0.14, 0.10], // W7:  DOL holding
    [0.23, 0.36, 0.17, 0.14, 0.10], // W8:  levelling, focus track rising
    [0.21, 0.30, 0.23, 0.15, 0.11], // W9:  pre-release, DJH gaining
    [0.19, 0.25, 0.28, 0.16, 0.12], // W10: DJH overtaking
    [0.15, 0.19, 0.30, 0.22, 0.14], // W11: RELEASE — album tracks spread
    [0.14, 0.17, 0.27, 0.25, 0.17], // W12: post-release
    [0.15, 0.16, 0.25, 0.26, 0.18], // W13: title track emerging as sleeper
    [0.16, 0.15, 0.24, 0.27, 0.18], // W14: Trying Times overtakes DJH
    [0.15, 0.14, 0.23, 0.29, 0.19], // W15: title track now #1 in catalogue
    [0.16, 0.14, 0.22, 0.29, 0.19], // W16: sustaining
  ];

  const { weeklyData, dailyTrackData } = buildWeeklyAndTrackData(
    weekDates, globalShape, ukShareByWeek, tracks, trackSharesByWeek, 0.15
  );

  // MOMENTS — same 5-act structure
  const moments: Moment[] = [
    // Act 1–2: Lead single impact
    { date: date(2025, 12, 20), moment_title: "Lead Single — I Had a Dream", moment_type: "music", is_key: true },
    { date: date(2025, 12, 22), moment_title: "Mailer — new single to mailing list", moment_type: "marketing", is_key: false },
    { date: date(2026, 1, 3), moment_title: "Playlist adds — Chill Vibes, New Music Friday", moment_type: "editorial", is_key: false },
    { date: date(2026, 1, 10), moment_title: "BBC Radio 6 premiere", moment_type: "media", is_key: false },
    // Act 3: Second single + vinyl pre-order
    { date: date(2026, 1, 24), moment_title: "Second Single — Death Of Love", moment_type: "music", is_key: true },
    { date: date(2026, 1, 26), moment_title: "Mailer — S2 + limited vinyl pre-order open", moment_type: "marketing", is_key: false },
    { date: date(2026, 2, 7), moment_title: "Showcase US — I Had a Dream", moment_type: "marquee", is_key: true },
    // Act 4: Album release
    { date: date(2026, 2, 14), moment_title: "Mailer — album pre-save + tracklist reveal", moment_type: "marketing", is_key: false },
    { date: releaseDate, moment_title: "Album Release — Trying Times", moment_type: "music", is_key: true },
    { date: date(2026, 2, 22), moment_title: "Mailer — album out now + signed vinyl last chance", moment_type: "marketing", is_key: false },
    // Act 5: Post-release
    { date: date(2026, 3, 1), moment_title: "NME feature interview", moment_type: "media", is_key: false },
    { date: date(2026, 3, 14), moment_title: "Festival announcement (Glastonbury)", moment_type: "live", is_key: true },
  ];

  const paidCampaigns: PaidCampaignRow[] = [
    { campaign_name: "Dream Launch", platform: "Showcase", territory: "US", start_date: date(2026, 2, 7), spend: 5000, spend_planned: 5000, intent_total: 26, intent_super: 10, intent_moderate: 16, best_segment: "25–34 Electronic", top_track: "I Had a Dream", campaign_objective: "Awareness", notes: "" },
  ];

  const learnings: ManualLearning[] = [
    { type: "worked", text: "Lead single generated strong initial spike — 395K in week 2 off editorial alone", order: 1 },
    { type: "worked", text: "Second single recovered momentum after dead air — Death Of Love hit 460K at peak", order: 2 },
    { type: "didnt", text: "Momentum collapsed between singles — 68% drop from S1 peak to W5 trough. No content bridge", order: 3 },
    { type: "didnt", text: "Album release missed forecast — peaked at 1.18M vs 1.5M+ target. Singles didn't compound", order: 4 },
    { type: "next", text: "Post-release plateau is stable at ~870K but flat. Glastonbury slot is the best lever — needs activation plan", order: 5 },
  ];

  // Physical — Blake is streaming-first but has a vinyl-collector fanbase
  // Pre-orders start earlier (limited edition vinyl announced with S2)
  const physicalData: PhysicalRow[] = [
    { week_start_date: weekDates[5], units: sNoise(350) },   // W6:  S2 drops, vinyl pre-order announced
    { week_start_date: weekDates[6], units: sNoise(520) },   // W7:  steady pre-orders
    { week_start_date: weekDates[7], units: sNoise(480) },   // W8:  Showcase US doesn't move physical
    { week_start_date: weekDates[8], units: sNoise(710) },   // W9:  pre-release build
    { week_start_date: weekDates[9], units: sNoise(1100) },  // W10: final pre-order push
    { week_start_date: weekDates[10], units: sNoise(3200) }, // W11: RELEASE — physical spike
    { week_start_date: weekDates[11], units: sNoise(1800) }, // W12: post-release
    { week_start_date: weekDates[12], units: sNoise(900) },  // W13: tailing off
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
// EXPORT
// ══════════════════════════════════════════════════════════════════

export function getDemoCampaigns(): AppData {
  // Reset seed for deterministic output
  _seed = 42;
  const campaigns: LoadedCampaign[] = [
    { campaign_id: "k-trap-album-2026", sheet: buildKTrap(), trackWeeklyMetrics: [] },
    { campaign_id: "james-blake-trying-times", sheet: buildJamesBlake(), trackWeeklyMetrics: [] },
  ];
  return { campaigns };
}

/** Check if we should use demo data (no API keys configured) */
export function shouldUseDemoData(): boolean {
  return !process.env.GOOGLE_SHEETS_PRIVATE_KEY && !process.env.AIRTABLE_API_KEY;
}
