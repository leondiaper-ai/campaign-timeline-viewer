/**
 * Airtable-friendly schema for Campaign Timeline Viewer.
 *
 * This file defines 4 lean tables that replace the 13 Google Sheet tabs.
 * The schema is designed so it can be:
 *   1. Used as in-memory TypeScript types right now
 *   2. Imported directly into Airtable as 4 tables
 *   3. Connected via Airtable API later with minimal changes
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  TABLE A: Campaigns           (1 row per campaign)          │
 * │  TABLE B: Campaign Events     (1 row per moment/event)      │
 * │  TABLE C: Daily Metrics       (1 row per date × territory)  │
 * │  TABLE D: Track Daily Metrics (1 row per date × track × territory) │
 * └─────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════
// TABLE A: Campaigns
// Replaces: campaign_setup + tracks + campaign_learnings tabs
// ═══════════════════════════════════════════════════════════════
export interface AirtableCampaign {
  // Identity
  id: string;                      // e.g. "james-blake-trying-times"
  artist_name: string;
  campaign_name: string;
  release_name: string;            // album / single title (= campaign_name usually)

  // Config
  campaign_type: "single" | "album";
  territory_focus: "global" | "UK";
  release_date: string;            // ISO YYYY-MM-DD
  campaign_state: "pre_release" | "live" | "post_release" | "archived";

  // Chart context
  chart_result: string;            // e.g. "#1", "Top 3"
  chart_forecast: string;          // e.g. "Top 10"
  outcome_driver: string;          // e.g. "physical sales"

  // Team push (operational)
  team_push: string;               // primary push
  team_support: string;            // supporting action
  team_next: string;               // next planned action

  // Track roster (denormalized for simplicity)
  tracks: AirtableTrack[];

  // Learnings (denormalized — few rows, tightly coupled)
  learnings: AirtableLearning[];

  // Notes / owner
  notes: string;
  owner: string;
}

export interface AirtableTrack {
  track_name: string;
  role: "lead_single" | "second_single" | "third_single" | "promo_single" | "focus_track" | "album_track" | "title_track";
  release_date: string;
  show_by_default: boolean;
  sort_order: number;
}

export interface AirtableLearning {
  type: "worked" | "didnt" | "next";
  text: string;
  order: number;
}

// ═══════════════════════════════════════════════════════════════
// TABLE B: Campaign Events / Moments
// Replaces: moments + paid_campaigns tabs
// ═══════════════════════════════════════════════════════════════
export interface AirtableEvent {
  id: string;                       // unique event ID
  campaign_id: string;              // FK → Campaigns.id
  date: string;                     // ISO YYYY-MM-DD
  title: string;
  description: string;

  // Classification
  event_type: string;               // "single_release" | "editorial" | "marketing" | "live" | "product" | "media"
  channel: string;                  // "spotify" | "apple" | "tiktok" | "radio" | "press" | "d2c" | "retail" | ""
  planned_or_live: "planned" | "live";
  priority: "key" | "supporting" | "background";

  // Paid campaign data (when event_type involves spend)
  platform: string;                 // "Marquee" | "Showcase" | ""
  territory: string;                // "UK" | "US" | "global" | ""
  spend: number;                    // actual spend (0 if organic)
  spend_planned: number;            // planned budget
  intent_total: number;             // intent metric %
  best_segment: string;
  top_track: string;

  // Impact
  impact_note: string;
}

// ═══════════════════════════════════════════════════════════════
// TABLE C: Daily Metrics (release-level)
// Replaces: weekly_data + physical_data + d2c_sales +
//           release_daily_import_territory tabs
// One row per date × territory.
// ═══════════════════════════════════════════════════════════════
export interface AirtableDailyMetric {
  id: string;                       // unique row ID
  campaign_id: string;              // FK → Campaigns.id
  date: string;                     // ISO YYYY-MM-DD
  territory: "global" | "UK";

  // Streams (release-level)
  release_streams: number;

  // Physical + D2C
  uk_physical: number;
  global_physical: number;
  uk_d2c: number;
  global_d2c: number;

  // Spend (campaign-level daily spend, optional)
  campaign_spend: number;
}

// ═══════════════════════════════════════════════════════════════
// TABLE D: Track Daily Metrics
// Replaces: track_daily_import + track_daily_import_territory +
//           track_uk_context tabs
// One row per date × track × territory.
// ═══════════════════════════════════════════════════════════════
export interface AirtableTrackMetric {
  id: string;                       // unique row ID
  campaign_id: string;              // FK → Campaigns.id
  date: string;                     // ISO YYYY-MM-DD
  track_name: string;
  territory: "global" | "UK";
  streams: number;
}

// ═══════════════════════════════════════════════════════════════
// Full Airtable dataset for a campaign
// ═══════════════════════════════════════════════════════════════
export interface AirtableCampaignData {
  campaign: AirtableCampaign;
  events: AirtableEvent[];
  dailyMetrics: AirtableDailyMetric[];
  trackMetrics: AirtableTrackMetric[];
}
