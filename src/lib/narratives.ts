import {
  CampaignData,
  CampaignNarrative,
  Territory,
  TrackInfo,
  WeeklyMetric,
} from "@/types";
import { getTrackList } from "./transforms";

// ─── Campaign Narrative Generator ───────────────────────────────
// Produces plain-English summaries from campaign data.
// Language is factual and concise — for non-technical readers.

export function generateCampaignNarrative(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): CampaignNarrative {
  const campaign = data.campaigns.find((c) => c.campaign_id === campaignId);
  const metrics = data.metrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );

  if (!campaign || metrics.length === 0) {
    return {
      headline: "No data available",
      summary: "Not enough metric data to generate a summary for this campaign.",
      highlights: [],
    };
  }

  const sorted = [...metrics].sort((a, b) =>
    a.week_ending.localeCompare(b.week_ending)
  );

  const weekCount = sorted.length;
  const totalStreams = sorted.reduce((s, m) => s + m.total_streams, 0);
  const totalPhysical = sorted.reduce(
    (s, m) => s + m.retail_units + m.d2c_units,
    0
  );

  const peakWeek = sorted.reduce(
    (best, m) => (m.total_streams > best.total_streams ? m : best),
    sorted[0]
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const streamGrowthPct =
    first.total_streams > 0
      ? Math.round(
          ((last.total_streams - first.total_streams) / first.total_streams) *
            100
        )
      : null;

  const recentTrend = getRecentTrend(sorted);
  const headline = buildHeadline(streamGrowthPct, recentTrend, peakWeek, sorted);

  const territoryLabel = territory === "global" ? "globally" : `in the ${territory}`;
  const summary = `Over ${weekCount} weeks, ${campaign.artist} accumulated ${fmtBig(totalStreams)} streams and ${fmtBig(totalPhysical)} physical units ${territoryLabel}. Peak streaming week was ${fmtDate(peakWeek.week_ending)} with ${fmtBig(peakWeek.total_streams)} streams.`;

  const highlights: string[] = [];

  if (streamGrowthPct !== null) {
    if (streamGrowthPct > 0) {
      highlights.push(`Streams grew ${streamGrowthPct}% from first to last week tracked`);
    } else if (streamGrowthPct < -10) {
      highlights.push(`Streams declined ${Math.abs(streamGrowthPct)}% from first to last week — typical post-release tail`);
    }
  }

  if (totalPhysical > 0) {
    highlights.push(`${fmtBig(totalPhysical)} total physical units (retail + D2C)`);
  }

  if (recentTrend === "rising") {
    highlights.push("Momentum is still building — streams trending upward in recent weeks");
  } else if (recentTrend === "falling") {
    highlights.push("Streams are in natural decline — consider sustain activity");
  }

  const tracks = getTrackList(data, campaignId, territory);
  if (tracks.length > 0) {
    const topTrack = tracks[0];
    highlights.push(`Top track: ${topTrack.track_name} (${fmtBig(topTrack.total_streams)} streams)`);
  }

  if (territory !== "global") {
    const globalMetrics = data.metrics.filter(
      (m) => m.campaign_id === campaignId && m.territory === "global"
    );
    const globalTotal = globalMetrics.reduce((s, m) => s + m.total_streams, 0);
    if (globalTotal > 0) {
      const share = Math.round((totalStreams / globalTotal) * 100);
      highlights.push(`${territory} represents ${share}% of global streams`);
    }
  }

  return { headline, summary, highlights };
}

export function generateTrackNarrative(tracks: TrackInfo[], territory: Territory): string {
  if (tracks.length === 0) return "No track-level data available.";
  const territoryLabel = territory === "global" ? "globally" : `in the ${territory}`;
  if (tracks.length === 1) {
    const t = tracks[0];
    return `${t.track_name} has accumulated ${fmtBig(t.total_streams)} streams ${territoryLabel}, peaking in the week of ${fmtDate(t.peak_week)}.`;
  }
  const top = tracks[0];
  const second = tracks[1];
  const ratio = second.total_streams > 0 ? (top.total_streams / second.total_streams).toFixed(1) : "many";
  let text = `${top.track_name} leads with ${fmtBig(top.total_streams)} streams ${territoryLabel}, ${ratio}x ahead of ${second.track_name}.`;
  if (tracks.length > 2) {
    const others = tracks.slice(2).map((t) => t.track_name);
    text += ` Also tracked: ${others.join(", ")}.`;
  }
  return text;
}

type Trend = "rising" | "falling" | "flat";
function getRecentTrend(sorted: WeeklyMetric[]): Trend {
  if (sorted.length < 3) return "flat";
  const recent = sorted.slice(-3);
  const diffs = [];
  for (let i = 1; i < recent.length; i++) { diffs.push(recent[i].total_streams - recent[i - 1].total_streams); }
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const threshold = sorted[sorted.length - 1].total_streams * 0.05;
  if (avgDiff > threshold) return "rising";
  if (avgDiff < -threshold) return "falling";
  return "flat";
}
function buildHeadline(growthPct: number | null, trend: Trend, peakWeek: WeeklyMetric, sorted: WeeklyMetric[]): string {
  const peakIdx = sorted.findIndex((m) => m.week_ending === peakWeek.week_ending);
  const peakNearEnd = peakIdx >= sorted.length - 3;
  if (growthPct !== null && growthPct > 50 && trend === "rising") return "Strong growth trajectory — streams still climbing";
  if (growthPct !== null && growthPct > 20) return "Solid streaming growth across the campaign";
  if (peakNearEnd && trend === "rising") return "Campaign momentum building — peak not yet reached";
  if (trend === "falling" && !peakNearEnd) return "Post-peak phase — streams in natural decline";
  if (growthPct !== null && growthPct < -30) return "Significant post-release drop-off in streams";
  return "Campaign tracking steadily";
}
function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
function fmtDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}