// âââ Google Sheet Schema Types ââââââââââââââââââââââââââââââ
// These types map 1:1 to the 5 tabs in a campaign sheet.
// This is the FINAL locked schema â do not add ad-hoc columns.

export type CampaignType = "single" | "album";
export type TrackRole =
  | "lead_single"
  | "second_single"
  | "focus_track"
  | "album_track";
export type Territory = "global" | "UK";

// Display category for chart markers and tooltips
export type EventCategory =
  | "music"
  | "marketing"
  | "editorial"
  | "product"
  | "live";

// âââ Tab 1: campaign_setup (single row) âââââââââââââââââââââ
export interface CampaignSetup {
  campaign_name: string;
  artist_name: string;
  campaign_type: CampaignType;
  release_date: string; // ISO YYYY-MM-DD
  default_territory: Territory;
}

// âââ Tab 2: tracks (one row per track) ââââââââââââââââââââââ
export interface Track {
  track_name: string;
  track_role: TrackRole;
  release_date: string; // ISO YYYY-MM-DD
  default_on: boolean;
  sort_order: number;
}

// âââ Tab 3: weekly_data âââââââââââââââââââââââââââââââââââââ
// One row per week per track. track_name = "TOTAL" for campaign aggregate.
export interface WeeklyRow {
  week_start_date: string; // ISO YYYY-MM-DD
  track_name: string; // "TOTAL" or actual track name
  streams_global: number;
  streams_uk: number;
}

// âââ Tab 4: physical_data (optional) ââââââââââââââââââââââââ
export interface PhysicalRow {
  week_start_date: string;
  units: number;
}

// âââ Tab 5: moments âââââââââââââââââââââââââââââââââââââââââ
export interface Moment {
  date: string; // ISO YYYY-MM-DD
  moment_title: string;
  moment_type: string; // e.g. "single_release", "editorial", "marketing", "live"
  is_key: boolean; // true = show on chart by default
}

// âââ Parsed Campaign Sheet ââââââââââââââââââââââââââââââââââ
export interface CampaignSheetData {
  setup: CampaignSetup;
  tracks: Track[];
  weeklyData: WeeklyRow[];
  physicalData: PhysicalRow[];
  moments: Moment[];
}

// âââ Registry âââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ App Data (API response) ââââââââââââââââââââââââââââââââ
export interface LoadedCampaign {
  campaign_id: string;
  sheet: CampaignSheetData;
}

export interface AppData {
  campaigns: LoadedCampaign[];
}

// âââ Chart Data (transformed for Recharts) ââââââââââââââââââ
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

// âââ Validation ââââââââââââââââââââââââââââââââââââââââââââââ
export interface ValidationWarning {
  tab: string;
  message: string;
}


// ——— Backward Compatibility Stubs ————————————————————————————
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
