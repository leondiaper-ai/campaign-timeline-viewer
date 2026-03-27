/**
 * Airtable → CampaignSheetData adapter.
 *
 * This is the single translation layer between the new Airtable-shaped
 * data model and the existing UI. No component changes needed.
 *
 * Direction: AirtableCampaignData → CampaignSheetData
 *
 * The UI continues to consume CampaignSheetData exactly as before.
 * When we eventually wire a real Airtable backend, we just change
 * how AirtableCampaignData is fetched — the adapter stays the same.
 */

import type {
  CampaignSheetData,
  CampaignSetup,
  Track,
  WeeklyRow,
  PhysicalRow,
  Moment,
  DailyTrackRow,
  DailyTerritoryRow,
  DailyReleaseTerritoryRow,
  UKContextRow,
  PaidCampaignRow,
  ManualLearning,
  D2CSalesRow,
  Territory,
} from "@/types";

import type {
  AirtableCampaignData,
  AirtableCampaign,
  AirtableEvent,
  AirtableDailyMetric,
  AirtableTrackMetric,
} from "./airtable-schema";

// ═══════════════════════════════════════════════════════════════
// MAIN ADAPTER: Airtable → CampaignSheetData
// ═══════════════════════════════════════════════════════════════

export function airtableToCampaignSheet(data: AirtableCampaignData): CampaignSheetData {
  const { campaign, events, dailyMetrics, trackMetrics } = data;

  return {
    setup: campaignToSetup(campaign),
    tracks: campaignToTracks(campaign),
    weeklyData: dailyMetricsToWeeklyData(dailyMetrics),
    physicalData: dailyMetricsToPhysicalData(dailyMetrics),
    moments: eventsToMoments(events),
    dailyTrackData: trackMetricsToDailyTrackData(trackMetrics),
    dailyTerritoryData: trackMetricsToDailyTerritoryData(trackMetrics),
    dailyReleaseTerritoryData: dailyMetricsToReleaseTerritoryData(dailyMetrics),
    ukContext: [], // Derived from track metrics at query time; no longer a separate tab
    paidCampaigns: eventsToPaidCampaigns(events),
    learnings: campaignToLearnings(campaign),
    d2cSales: dailyMetricsToD2CSales(dailyMetrics),
  };
}

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL CONVERTERS
// ═══════════════════════════════════════════════════════════════

/** Campaign → CampaignSetup */
function campaignToSetup(c: AirtableCampaign): CampaignSetup {
  return {
    campaign_name: c.campaign_name,
    artist_name: c.artist_name,
    campaign_type: c.campaign_type,
    release_date: c.release_date,
    default_territory: c.territory_focus as Territory,
    chart_result: c.chart_result,
    chart_forecast: c.chart_forecast,
    outcome_driver: c.outcome_driver,
    team_push_push: c.team_push,
    team_push_support: c.team_support,
    team_push_next: c.team_next,
  };
}

/** Campaign.tracks → Track[] */
function campaignToTracks(c: AirtableCampaign): Track[] {
  return (c.tracks || []).map((t) => ({
    track_name: t.track_name,
    track_role: t.role,
    release_date: t.release_date,
    default_on: t.show_by_default,
    sort_order: t.sort_order,
  }));
}

/** Campaign.learnings → ManualLearning[] */
function campaignToLearnings(c: AirtableCampaign): ManualLearning[] {
  return (c.learnings || []).map((l) => ({
    type: l.type,
    text: l.text,
    order: l.order,
  }));
}

/**
 * Events → Moments
 * Maps all events into the Moment[] format the chart expects.
 */
function eventsToMoments(events: AirtableEvent[]): Moment[] {
  return events.map((e) => ({
    date: e.date,
    moment_title: e.title,
    moment_type: e.event_type,
    is_key: e.priority === "key",
  }));
}

/**
 * Events → PaidCampaignRow[]
 * Extracts events that have spend > 0 or a platform set.
 */
function eventsToPaidCampaigns(events: AirtableEvent[]): PaidCampaignRow[] {
  return events
    .filter((e) => e.spend > 0 || e.platform)
    .map((e) => ({
      campaign_name: e.title,
      platform: e.platform || "",
      territory: e.territory || "",
      start_date: e.date,
      spend: e.spend || 0,
      spend_planned: e.spend_planned || 0,
      intent_total: e.intent_total || 0,
      intent_super: 0,
      intent_moderate: 0,
      best_segment: e.best_segment || "",
      top_track: e.top_track || "",
      campaign_objective: "",
      notes: e.impact_note || "",
    }));
}

/**
 * Daily Metrics → WeeklyRow[]
 * Aggregates daily rows into 7-day buckets (Monday start).
 * Produces one "TOTAL" row per week with global + UK streams.
 */
function dailyMetricsToWeeklyData(metrics: AirtableDailyMetric[]): WeeklyRow[] {
  if (metrics.length === 0) return [];

  // Group by week start (Monday)
  const weekMap = new Map<string, { global: number; uk: number }>();

  for (const m of metrics) {
    const d = new Date(m.date + "T00:00:00");
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const weekKey = monday.toISOString().slice(0, 10);

    const bucket = weekMap.get(weekKey) || { global: 0, uk: 0 };
    if (m.territory === "global") {
      bucket.global += m.release_streams;
    } else {
      bucket.uk += m.release_streams;
    }
    weekMap.set(weekKey, bucket);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, totals]) => ({
      week_start_date: weekStart,
      track_name: "TOTAL",
      streams_global: totals.global,
      streams_uk: totals.uk,
    }));
}

/**
 * Daily Metrics → PhysicalRow[]
 * Extracts rows that have uk_physical > 0, aggregated by week.
 */
function dailyMetricsToPhysicalData(metrics: AirtableDailyMetric[]): PhysicalRow[] {
  const weekMap = new Map<string, number>();

  for (const m of metrics) {
    if (m.uk_physical <= 0 && m.global_physical <= 0) continue;
    const d = new Date(m.date + "T00:00:00");
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const weekKey = monday.toISOString().slice(0, 10);

    const current = weekMap.get(weekKey) || 0;
    weekMap.set(weekKey, current + m.uk_physical + m.global_physical);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, units]) => ({
      week_start_date: weekStart,
      units,
    }));
}

/**
 * Daily Metrics → DailyReleaseTerritoryRow[]
 * Direct 1:1 mapping — each daily metric with streams becomes a release territory row.
 */
function dailyMetricsToReleaseTerritoryData(
  metrics: AirtableDailyMetric[]
): DailyReleaseTerritoryRow[] {
  return metrics
    .filter((m) => m.release_streams > 0)
    .map((m) => ({
      date: m.date,
      release_name: "", // release-level, no name needed
      territory: m.territory as Territory,
      streams: m.release_streams,
    }));
}

/**
 * Daily Metrics → D2CSalesRow[]
 * Extracts rows with D2C data, grouped by date (latest territory wins).
 */
function dailyMetricsToD2CSales(metrics: AirtableDailyMetric[]): D2CSalesRow[] {
  const dateMap = new Map<string, { global: number; uk: number }>();

  for (const m of metrics) {
    if (m.uk_d2c <= 0 && m.global_d2c <= 0) continue;
    const existing = dateMap.get(m.date) || { global: 0, uk: 0 };
    existing.global += m.global_d2c;
    existing.uk += m.uk_d2c;
    dateMap.set(m.date, existing);
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d2c]) => ({
      date,
      global_d2c_sales: d2c.global,
      uk_d2c_sales: d2c.uk,
    }));
}

/**
 * Track Metrics → DailyTrackRow[]
 * Extracts global track-level rows.
 */
function trackMetricsToDailyTrackData(metrics: AirtableTrackMetric[]): DailyTrackRow[] {
  return metrics
    .filter((m) => m.territory === "global")
    .map((m) => ({
      date: m.date,
      track_name: m.track_name,
      global_streams: m.streams,
    }));
}

/**
 * Track Metrics → DailyTerritoryRow[]
 * All track metrics (both territories).
 */
function trackMetricsToDailyTerritoryData(metrics: AirtableTrackMetric[]): DailyTerritoryRow[] {
  return metrics.map((m) => ({
    date: m.date,
    track_name: m.track_name,
    territory: m.territory as Territory,
    streams: m.streams,
  }));
}

// ═══════════════════════════════════════════════════════════════
// REVERSE ADAPTER: CampaignSheetData → AirtableCampaignData
// Used for migrating existing Google Sheets data into Airtable format.
// ═══════════════════════════════════════════════════════════════

export function campaignSheetToAirtable(
  campaignId: string,
  sheet: CampaignSheetData
): AirtableCampaignData {
  const s = sheet.setup;

  const campaign: AirtableCampaign = {
    id: campaignId,
    artist_name: s.artist_name,
    campaign_name: s.campaign_name,
    release_name: s.campaign_name,
    campaign_type: s.campaign_type,
    territory_focus: s.default_territory,
    release_date: s.release_date,
    campaign_state: determineCampaignState(s.release_date),
    chart_result: s.chart_result,
    chart_forecast: s.chart_forecast,
    outcome_driver: s.outcome_driver,
    team_push: s.team_push_push,
    team_support: s.team_push_support,
    team_next: s.team_push_next,
    tracks: sheet.tracks.map((t) => ({
      track_name: t.track_name,
      role: t.track_role,
      release_date: t.release_date,
      show_by_default: t.default_on,
      sort_order: t.sort_order,
    })),
    learnings: sheet.learnings.map((l) => ({
      type: l.type,
      text: l.text,
      order: l.order,
    })),
    notes: "",
    owner: "",
  };

  // Events: merge moments + paid campaigns
  let eventIdx = 0;
  const events: AirtableEvent[] = [
    ...sheet.moments.map((m) => ({
      id: `evt-${eventIdx++}`,
      campaign_id: campaignId,
      date: m.date,
      title: m.moment_title,
      description: "",
      event_type: m.moment_type,
      channel: "",
      planned_or_live: "live" as const,
      priority: m.is_key ? ("key" as const) : ("supporting" as const),
      platform: "",
      territory: "",
      spend: 0,
      spend_planned: 0,
      intent_total: 0,
      best_segment: "",
      top_track: "",
      impact_note: "",
    })),
    ...sheet.paidCampaigns.map((p) => ({
      id: `evt-${eventIdx++}`,
      campaign_id: campaignId,
      date: p.start_date,
      title: p.campaign_name,
      description: p.notes,
      event_type: "marketing",
      channel: p.platform.toLowerCase(),
      planned_or_live: "live" as const,
      priority: "supporting" as const,
      platform: p.platform,
      territory: p.territory,
      spend: p.spend,
      spend_planned: p.spend_planned,
      intent_total: p.intent_total,
      best_segment: p.best_segment,
      top_track: p.top_track,
      impact_note: p.notes,
    })),
  ];

  // Daily Metrics: merge release territory data + physical + d2c
  const dailyMap = new Map<string, AirtableDailyMetric>();
  const dmKey = (date: string, territory: string) => `${date}|${territory}`;
  let dmIdx = 0;

  const ensureRow = (date: string, territory: "global" | "UK"): AirtableDailyMetric => {
    const key = dmKey(date, territory);
    let row = dailyMap.get(key);
    if (!row) {
      row = {
        id: `dm-${dmIdx++}`,
        campaign_id: campaignId,
        date,
        territory,
        release_streams: 0,
        uk_physical: 0,
        global_physical: 0,
        uk_d2c: 0,
        global_d2c: 0,
        campaign_spend: 0,
      };
      dailyMap.set(key, row);
    }
    return row;
  };

  // Release-level territory streams
  for (const r of sheet.dailyReleaseTerritoryData) {
    const row = ensureRow(r.date, r.territory);
    row.release_streams += r.streams;
  }

  // If no release-level data, fall back to weekly data
  if (sheet.dailyReleaseTerritoryData.length === 0 && sheet.weeklyData.length > 0) {
    for (const w of sheet.weeklyData.filter((r) => r.track_name === "TOTAL")) {
      if (w.streams_global > 0) {
        const row = ensureRow(w.week_start_date, "global");
        row.release_streams += w.streams_global;
      }
      if (w.streams_uk > 0) {
        const row = ensureRow(w.week_start_date, "UK");
        row.release_streams += w.streams_uk;
      }
    }
  }

  // Physical data
  for (const p of sheet.physicalData) {
    const row = ensureRow(p.week_start_date, "UK");
    row.uk_physical += p.units;
  }

  // D2C data
  for (const d of sheet.d2cSales) {
    const rowUK = ensureRow(d.date, "UK");
    rowUK.uk_d2c = d.uk_d2c_sales;
    const rowGlobal = ensureRow(d.date, "global");
    rowGlobal.global_d2c = d.global_d2c_sales;
  }

  const dailyMetrics = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date) || a.territory.localeCompare(b.territory)
  );

  // Track metrics: merge daily track data + territory data
  let tmIdx = 0;
  const trackMetrics: AirtableTrackMetric[] = [];

  // Global track data
  for (const t of sheet.dailyTrackData) {
    trackMetrics.push({
      id: `tm-${tmIdx++}`,
      campaign_id: campaignId,
      date: t.date,
      track_name: t.track_name,
      territory: "global",
      streams: t.global_streams,
    });
  }

  // Territory track data (avoid duplicating global rows)
  const globalKeys = new Set(
    sheet.dailyTrackData.map((t) => `${t.date}|${t.track_name}|global`)
  );
  for (const t of sheet.dailyTerritoryData) {
    const key = `${t.date}|${t.track_name}|${t.territory}`;
    if (!globalKeys.has(key)) {
      trackMetrics.push({
        id: `tm-${tmIdx++}`,
        campaign_id: campaignId,
        date: t.date,
        track_name: t.track_name,
        territory: t.territory,
        streams: t.streams,
      });
    }
  }

  return { campaign, events, dailyMetrics, trackMetrics };
}

function determineCampaignState(
  releaseDate: string
): "pre_release" | "live" | "post_release" | "archived" {
  if (!releaseDate) return "pre_release";
  const release = new Date(releaseDate + "T00:00:00");
  const now = new Date();
  const daysSinceRelease = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceRelease < 0) return "pre_release";
  if (daysSinceRelease < 90) return "live";
  return "post_release";
}
