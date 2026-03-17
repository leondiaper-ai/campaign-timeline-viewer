// ——— Google Sheet Schema Types ——————————————————————————————
// These types map 1:1 to the 5 tabs in a campaign sheet.
// This is the FINAL locked schema — do not add ad-hoc columns.

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

// ——— Tab 1: campaign_setup (single row) —————————————————————
export interface CampaignSetup {
  campaign_name: string;
  artist_name: string;
  campaign_type: CampaignType;
  release_date: string; // ISO YYYY-MM-DD
  default_territory: Territory;
}

// ——— Tab 2: tracks (one row per track) —————————————————————‒
export interface Track {
  track_name: string;
  track_role: TrackRole;
  release_date: string; // ISO YYYY-MM-DD
  default_on: boolean;
  sort_order: number;
}

// ——— Tab 3: weekly_data ————————————————————————————————————‗
// One row per week per track. track_name = "TOTAL" for campaign aggregate.
export interface WeeklyRow {
  week_start_date: string; // ISO YYYY-MM-DD
  track_name: string; // "TOTAL" or actual track name
  streams_global: number;
  streams_uk: number;
}

// ——— Tab 4: physical_data (optional) ————————————————————————
export interface PhysicalRow {
  week_start_date: string;
  units: number;
}

// ——— Tab 5: moments ————————————————————————————————————————‑
export interface Moment {
  date: string; // ISO YYYY-MM-DD
  moment_title: string;
  moment_type: string; // e.g. "single_release", "editorial", "marketing", "live"
  is_key: boolean; // true = show on chart by default
}

// ——— Parsed Campaign Sheet ——————————————————————————————————
export interface CampaignSheetData {
  setup: CampaignSetup;
  tracks: Track[];
  weeklyData: WeeklyRow[];
  physicalData: PhysicalRow[];
  moments: Moment[];
}

// ——— Registry ——————————————————————————————————————————————‗
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

// ——— App Data (API response) ————————————————————————————————
export interface LoadedCampaign {
  campaign_id: string;
  sheet: CampaignSheetData;
}

export interface AppData {
  campaigns: LoadedCampaign[];
}

// ——— Chart Data (transformed for Recharts) —————————————————‘
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

// ——— Validation —————————————————————————————————————————————‖
export interface ValidationWarning {
  tab: string;
  message: string;
}
