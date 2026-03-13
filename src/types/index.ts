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
  event_subtype?: string;
  source_platform?: string;
  is_core_moment?: boolean;
  show_on_chart?: boolean;
}

export type Territory = "global" | "UK";
export type EventCategory = "music" | "marketing" | "editorial" | "product" | "live";
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

export interface SingleCampaignData {
  campaign: Campaign;
  metrics: WeeklyMetric[];
  events: CampaignEvent[];
}

export interface CampaignData {
  campaigns: Campaign[];
  metrics: WeeklyMetric[];
  events: CampaignEvent[];
}

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

export interface ChartDataPoint {
  date: string;
  total_streams: number;
  physical_units: number;
  events: CampaignEvent[];
}
