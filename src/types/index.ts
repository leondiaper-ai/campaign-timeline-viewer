// ——— Google Sheet Schema Types ————————————————————————————————
// These types map 1:1 to the 5 tabs in a campaign sheet.
// This is the FINAL locked schema — do not add ad-hoc columns.

export type CampaignType = "single" | "album";

export type TrackRole =
  | "lead_single"
  | "second_single"
  | "third_single"
  | "promo_single"
  | "focus_track"
  | "album_track"
  | "title_track";

export type Territory = "global" | "UK";

// Display category for chart markers and tooltips
export type EventCategory =
  | "music"
  | "marketing"
  | "editorial"
  | "product"
  | "live";

// ——— Tab 1: campaign_setup (single row) ———————————————————
export interface CampaignSetup {
  campaign_name: string;
  artist_name: string;
  campaign_type: CampaignType;
  release_date: string; // ISO YYYY-MM-DD
  default_territory: Territory;
}

// ——— Tab 2: tracks (one row per track) ———————————————————
export interface Track {
  track_name: string;
  track_role: TrackRole;
  release_date: string; // ISO YYYY-MM-DD
  default_on: boolean;
  sort_order: number;
}

// ——— Tab 3: weekly_data —————————————————————————————————
// One row per week per track. track_name = "TOTAL" for campaign aggregate.
export interface WeeklyRow {
  week_start_date: string; // ISO YYYY-MM-DD
  track_name: string; // "TOTAL" or actual track name
  streams_global: number;
  streams_uk: number;
}

// ——— Tab 4: physical_data (optional) ——————————————————————
export interface PhysicalRow {
  week_start_date: string;
  units: number;
}

// ——— Tab 5: moments ————————————————————————————————————
export interface Moment {
  date: string; // ISO YYYY-MM-DD
  moment_title: string;
  moment_type: string; // e.g. "single_release", "editorial", "marketing", "live"
  is_key: boolean; // true = show on chart by default
}

// ——— Track Weekly Metrics (for By Track chart view) ———————
export interface TrackWeeklyMetric {
  campaign_id: string;
  track_id: string;
  track_name: string;
  week_ending: string;
  territory: Territory;
  total_streams: number;
}

// ——— Parsed Campaign Sheet ————————————————————————————————
export interface CampaignSheetData {
  setup: CampaignSetup;
  tracks: Track[];
  weeklyData: WeeklyRow[];
  physicalData: PhysicalRow[];
  moments: Moment[];
}

// ——— Registry ————————————————————————————————————————————
export type CampaignStatus = "active" | "archived" | "draft";

export interface RegistryEntry {
  campaign_id: string;
  artist_name: string;
  campaign_name: string;
  sheet_url: string;
  sheet_id: string;
  status: CampaignStatus;
  campaign_owner: string;
}

// ——— App Data (API response) ——————————————————————————————
export interface LoadedCampaign {
  campaign_id: string;
  sheet: CampaignSheetData;
  trackWeeklyMetrics: TrackWeeklyMetric[];
}

export interface AppData {
  campaigns: LoadedCampaign[];
}

// ——— Chart Data (transformed for Recharts) ————————————————
export interface ChartDataPoint {
  date: string;
  total_streams: number;
  physical_units: number;
  cumulative_streams: number;
  prev_week_streams: number | null;
  events: Moment[];
  // Dynamic track keys: [trackName]: number | null
  [key: string]: number | string | null | Moment[];
}

// ——— Validation ————————————————————————————————————————
export interface ValidationWarning {
  tab: string;
  message: string;
}

// ——— Backward Compatibility Stubs ————————————————————————
// Retained so legacy components compile. Will be removed when
// those files are cleaned up.
export interface WeeklyMetric {
  campaign_id: string;
  week_ending: string;
  territory: Territory;
  total_streams: number;
  [key: string]: unknown;
}

export interface CampaignEvent {
  date: string;
  title: string;
  type: string;
  is_key?: boolean;
  [key: string]: unknown;
}

export interface AutoObservation {
  event_date: string;
  observation: string;
  [key: string]: unknown;
}

export type VerdictLevel = "strong" | "moderate" | "weak";
export type MomentumDirection = "accelerating" | "steady" | "decelerating";

export interface CampaignInsight {
  verdict: string;
  verdict_level: VerdictLevel;
  momentum: MomentumDirection;
  [key: string]: unknown;
}

export interface CampaignNarrative {
  summary: string;
  highlights: string[];
  [key: string]: unknown;
}

export interface TrackInfo {
  track_name: string;
  track_role?: string;
  [key: string]: unknown;
}

export interface CampaignData {
  campaigns: LoadedCampaign[];
  [key: string]: unknown;
}

export interface TrackPerformance {
  track_name: string;
  total_streams: number;
  [key: string]: unknown;
}

export interface TrackChartDataPoint {
  date: string;
  streams: number;
  [key: string]: unknown;
}

export type TrackDisplayMode = "streams" | "growth";
