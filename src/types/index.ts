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
