import {
  CampaignData,
  SingleCampaignData,
  RegistryEntry,
  TrackWeeklyMetric,
  WeeklyMetric,
} from "@/types";
import { mockCampaigns, mockMetrics, mockEvents } from "./mock-data";

// ─── Mock Track Data for K Trap ─────────────────────────────────

const MOCK_K_TRAP_TRACKS = [
  {
    id: "no_discussion",
    name: "No Discussion",
    sharePeak: 0.38,
    shareBase: 0.28,
  },
  {
    id: "background_headie_one",
    name: "Background ft Headie One",
    sharePeak: 0.22,
    shareBase: 0.18,
  },
  {
    id: "no_feelings",
    name: "No Feelings",
    sharePeak: 0.12,
    shareBase: 0.08,
  },
];

/**
 * Generate deterministic mock track weekly data for a campaign.
 * Uses campaign metrics dates/values to produce realistic track curves
 * that are portions of the total campaign streams.
 */
function generateMockTrackWeeklyMetrics(
  campaignId: string,
  metrics: WeeklyMetric[]
): TrackWeeklyMetric[] {
  const campaignMetrics = metrics
    .filter((m) => m.campaign_id === campaignId)
    .sort((a, b) => a.week_ending.localeCompare(b.week_ending));

  if (campaignMetrics.length === 0) return [];

  const result: TrackWeeklyMetric[] = [];

  // Group by territory to handle global and UK separately
  const territories = Array.from(new Set(campaignMetrics.map((m) => m.territory)));

  for (const terr of territories) {
    const terrMetrics = campaignMetrics.filter((m) => m.territory === terr);
    const weekCount = terrMetrics.length;

    for (let weekIdx = 0; weekIdx < weekCount; weekIdx++) {
      const m = terrMetrics[weekIdx];

      // Calculate position in campaign (0 = start, 1 = end)
      const progress = weekCount > 1 ? weekIdx / (weekCount - 1) : 0;

      for (let t = 0; t < MOCK_K_TRAP_TRACKS.length; t++) {
        const track = MOCK_K_TRAP_TRACKS[t];

        // Interpolate share based on campaign progress
        // Lead single peaks earlier, album tracks peak later
        const peakAt = 0.4 + t * 0.1;
        const peakProximity =
          1 - Math.abs(progress - peakAt) / Math.max(peakAt, 1 - peakAt);
        const share =
          track.shareBase +
          (track.sharePeak - track.shareBase) * peakProximity;

        // Deterministic per-week variance (no Math.random)
        // Uses week index and track index for repeatable jitter
        const jitter = 1 + ((weekIdx * 7 + t * 3) % 10 - 5) / 100;

        result.push({
          campaign_id: campaignId,
          track_id: track.id,
          track_name: track.name,
          week_ending: m.week_ending,
          territory: m.territory,
          total_streams: Math.round(m.total_streams * share * jitter),
        });
      }
    }
  }

  return result;
}

/**
 * Inject mock track data for campaigns that match K Trap
 * and don't already have track weekly metrics.
 */
function injectMockTrackData(data: CampaignData): CampaignData {
  const kTrap = data.campaigns.find((c) =>
    c.artist.toLowerCase().includes("k trap")
  );

  if (!kTrap) return data;

  // Check if K Trap already has real track weekly data
  const existing = data.trackWeeklyMetrics.filter(
    (m) => m.campaign_id === kTrap.campaign_id
  );
  if (existing.length > 0) return data;

  // Generate and inject mock data
  const mockTrackData = generateMockTrackWeeklyMetrics(
    kTrap.campaign_id,
    data.metrics
  );

  return {
    ...data,
    trackWeeklyMetrics: [...data.trackWeeklyMetrics, ...mockTrackData],
  };
}
