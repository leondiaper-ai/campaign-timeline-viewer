// ─── Domain Types ───────────────────────────────────────────────

export interface Campaign {
  campaign_id: string;
  artist: string;
  campaign_name: string;
  start_date?: string; // ISO YYYY-MM-DD — first week of campaign activity
  release_date?: string; // ISO YYYY-MM-DD — album / single release date
  default_territory?: Territory;
}

export interface WeeklyMetric {
  campaign_id: string;
  week_ending: string; // ISO date string YYYY-MM-DD
  territory: Territory;
  total_streams: number; // all DSPs combined
  retail_units: number;
  d2c_units: number;
}

export interface TrackWeeklyMetric {
  campaign_id: string;
  week_ending: string;
  track_name: string;
  territory: Territory;
  total_streams: number;
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
  observed_impact?: string;
  what_we_learned?: string;
  confidence?: Confidence;

  // Future-proof optional fields
  event_subtype?: string;
  source_platform?: string;
  is_core_moment?: boolean;
  show_on_chart?: boolean;
}

// ─── Enums & Literals ───────────────────────────────────────────

export type Territory = "global" | "UK";

export type EventCategory =
  | "music"
  | "marketing"
  | "editorial"
  | "product"
  | "live";

export type ChartViewMode = "campaign" | "tracks";

export type TrackDisplayMode = "raw" | "indexed";

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

// ─── API Response ───────────────────────────────────────────────

/** Data for a single campaign sheet */
export interface SingleCampaignData {
  campaign: Campaign;
  metrics: WeeklyMetric[];
  events: CampaignEvent[];
  trackMetrics: TrackWeeklyMetric[];
}

/** Combined data for the Dashboard (all active campaigns merged) */
export interface CampaignData {
  campaigns: Campaign[];
  metrics: WeeklyMetric[];
  events: CampaignEvent[];
  trackMetrics: TrackWeeklyMetric[];
}

// ─── Auto-Observation (system-generated) ────────────────────────

export interface AutoObservation {
  streams_before: number | null;
  streams_after: number | null;
  streams_change_pct: number | null;
  units_before: number | null;
  units_after: number | null;
  units_change_pct: number | null;
  was_momentum_rising: boolean;
  near_campaign_peak: boolean;
  summary: string;
}

// ─── Chart Data (transformed for Recharts) ──────────────────────

export interface ChartDataPoint {
  date: string;
  total_streams: number;
  physical_units: number;
  events: CampaignEvent[];
}

export interface TrackChartDataPoint {
  date: string;
  [trackName: string]: number | string; // dynamic keys for each track
}

// ─── Narrative Types ────────────────────────────────────────────

export interface CampaignNarrative {
  headline: string;
  summary: string;
  highlights: string[];
}

export interface TrackInfo {
  track_name: string;
  first_active_week: string;
  total_streams: number;
  peak_week: string;
  peak_streams: number;
}

// ─── Campaign Insight (legacy, used by insights.ts) ─────────────

export type VerdictLevel = "STRONG" | "MODERATE" | "WEAK";

export type MomentumDirection = "RISING" | "FALLING" | "STABLE";

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

// ─── Track Performance (per-single snapshot) ──────────────────

export interface TrackPerformance {
  campaign_id: string;
  track_name: string;
  territory: Territory;
  release_type: string;
  release_date: string;
  streams_7d: number;
  streams_14d: number;
  streams_28d: number;
  saves_28d: number;
  playlist_adds_28d: number;
  editorial_adds_28d: number;
}
