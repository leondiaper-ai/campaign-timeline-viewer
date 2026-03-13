// ─── Domain Types ───────────────────────────────────────────────

export interface Campaign {
  campaign_id: string;
  artist: string;
  campaign_name: string;
}

export interface WeeklyMetric {
  campaign_id: string;
  week_ending: string; // ISO date string YYYY-MM-DD
  territory: Territory;
  total_streams: number; // all DSPs combined
  retail_units: number;
  d2c_units: number;
}

export type Confidence = "high" | "medium" | "low";

export interface CampaignEvent {
  campaign_id: string;
  date: string; // ISO date string YYYY-MM-DD
  event_title: string;
  event_type: EventCategory;
  territory: Territory | "global";
  notes: string;
  is_major: boolean; // true = always visible on chart

  // Optional learning fields
  observed_impact?: string; // e.g. "+38% streams week-on-week"
  what_we_learned?: string; // e.g. "Playlist placement drove more than paid spend"
  confidence?: Confidence; // how confident we are in the attribution

  // Future-proof optional fields (not used in V1 UI)
  event_subtype?: string; // finer-grained category, e.g. "playlist_add", "vinyl_drop", "interview"
  source_platform?: string; // e.g. "spotify", "tiktok", "instagram", "bbc_radio"
  is_core_moment?: boolean; // true = a defining campaign beat (for future filtering)
  show_on_chart?: boolean; // explicit override for chart visibility (future use)
}

// ─── Enums & Literals ───────────────────────────────────────────

export type Territory = "global" | "UK";

export type EventCategory =
  | "music"
  | "marketing"
  | "editorial"
  | "product"
  | "live";

// ─── Registry Types ─────────────────────────────────────────────

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

// ─── Track Performance (single-level drill-down) ────────────────

export interface TrackPerformance {
  campaign_id: string;
  track_id: string;
  track_name: string;
  release_type: "single" | "album_track" | "deluxe_track";
  release_date: string;
  territory: Territory;
  streams_7d: number;
  streams_14d: number;
  streams_28d: number;
  saves_28d: number;
  playlist_adds_28d: number;
  editorial_adds_28d: number;
}

// ─── Campaign Insights (verdict / momentum / top moment) ────────

export type VerdictLevel = "STRONG" | "MODERATE" | "WEAK";
export type MomentumDirection = "RISING" | "PEAKING" | "DECLINING" | "STABLE";

export interface CampaignInsight {
  verdict: VerdictLevel;
  verdict_explanation: string;
  top_moment: {
    event_title: string;
    date: string;
    streams_delta_pct: number | null;
    sales_delta_pct: number | null;
  } | null;
  momentum: MomentumDirection;
  momentum_context: string;
}

// ─── API Response ───────────────────────────────────────────────

/** Data for a single campaign sheet (3 tabs + optional track perf) */
export interface SingleCampaignData {
  campaign: Campaign;
  metrics: WeeklyMetric[];
  events: CampaignEvent[];
  trackPerformance: TrackPerformance[];
}

/** Combined data for the Dashboard (all active campaigns merged) */
export interface CampaignData {
  campaigns: Campaign[];
  metrics: WeeklyMetric[];
  events: CampaignEvent[];
  trackPerformance: TrackPerformance[];
}

// ─── Auto-Observation (system-generated) ────────────────────────

export interface AutoObservation {
  streams_before: number | null;
  streams_after: number | null;
  streams_change_pct: number | null; // e.g. +38 or -12
  units_before: number | null;
  units_after: number | null;
  units_change_pct: number | null;
  was_momentum_rising: boolean; // 2-week trend before moment was positive
  near_campaign_peak: boolean; // within ±1 week of peak streaming week
  summary: string; // cautious human-readable observation
}

// ─── Chart Data (transformed for Recharts) ──────────────────────

export interface ChartDataPoint {
  date: string;
  total_streams: number;
  physical_units: number; // retail_units + d2c_units
  events: CampaignEvent[];
}
