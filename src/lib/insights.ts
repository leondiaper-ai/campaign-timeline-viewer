import {
  WeeklyMetric,
  CampaignEvent,
  AutoObservation,
  CampaignInsight,
  VerdictLevel,
  MomentumDirection,
  Territory,
} from "@/types";

// ─── Campaign Insights Engine ─────────────────────────────────────
// Generates structured campaign intelligence from metrics, events,
// and observations. Provides verdict, top moment, and momentum.

/**
 * Generate a CampaignInsight for a given campaign and territory.
 *
 * Works entirely from metrics + observations — no track_performance
 * data required, so it functions even before that tab is populated.
 */
export function generateCampaignInsight(
  metrics: WeeklyMetric[],
  events: CampaignEvent[],
  observations: Map<string, AutoObservation>,
  campaignId: string,
  territory: Territory
): CampaignInsight {
  const sorted = metrics
    .filter((m) => m.campaign_id === campaignId && m.territory === territory)
    .sort((a, b) => a.week_ending.localeCompare(b.week_ending));

  const verdict = computeVerdict(sorted);
  const topMoment = findTopMoment(events, observations, campaignId, territory);
  const momentum = computeMomentum(sorted);

  return {
    ...verdict,
    top_moment: topMoment,
    ...momentum,
  };
}

// ─── Verdict ──────────────────────────────────────────────────────

function computeVerdict(sorted: WeeklyMetric[]): {
  verdict: VerdictLevel;
  verdict_explanation: string;
} {
  if (sorted.length < 4) {
    return {
      verdict: "MODERATE",
      verdict_explanation:
        "Not enough weekly data to assess campaign strength — fewer than 4 weeks recorded.",
    };
  }

  // Compare first-quarter average vs last-quarter average
  const quarter = Math.max(1, Math.floor(sorted.length / 4));
  const firstSlice = sorted.slice(0, quarter);
  const lastSlice = sorted.slice(-quarter);

  const avgFirst =
    firstSlice.reduce((s, m) => s + m.total_streams, 0) / firstSlice.length;
  const avgLast =
    lastSlice.reduce((s, m) => s + m.total_streams, 0) / lastSlice.length;

  if (avgFirst === 0) {
    return {
      verdict: "MODERATE",
      verdict_explanation:
        "Early campaign data shows zero streams — likely a data gap.",
    };
  }

  const growthPct = Math.round(((avgLast - avgFirst) / avgFirst) * 100);

  // Also check: did we hit a significant peak?
  const peak = Math.max(...sorted.map((m) => m.total_streams));
  const peakRatio = avgFirst > 0 ? peak / avgFirst : 0;

  if (growthPct > 20 || peakRatio > 3) {
    return {
      verdict: "STRONG",
      verdict_explanation:
        growthPct > 20
          ? `Streams grew ~${growthPct}% from early to recent weeks, indicating strong campaign traction.`
          : `Campaign reached a peak ${peakRatio.toFixed(1)}x above its early average, showing strong impact.`,
    };
  }

  if (growthPct < -10) {
    return {
      verdict: "WEAK",
      verdict_explanation: `Streams declined ~${Math.abs(growthPct)}% from early to recent weeks. The campaign may be in its natural wind-down.`,
    };
  }

  return {
    verdict: "MODERATE",
    verdict_explanation:
      growthPct >= 0
        ? `Streams remained relatively stable with ~${growthPct}% growth across the campaign.`
        : `Streams dipped ~${Math.abs(growthPct)}% overall — mixed signals across the campaign period.`,
  };
}

// ─── Top Impact Moment ────────────────────────────────────────────

function findTopMoment(
  events: CampaignEvent[],
  observations: Map<string, AutoObservation>,
  campaignId: string,
  territory: Territory
): CampaignInsight["top_moment"] {
  const relevant = events.filter(
    (e) =>
      e.campaign_id === campaignId &&
      (e.territory === "global" || e.territory === territory)
  );

  let bestEvent: CampaignEvent | null = null;
  let bestObs: AutoObservation | null = null;
  let bestAbsPct = 0;

  for (const event of relevant) {
    const obs = observations.get(event.date);
    if (!obs || obs.streams_change_pct === null) continue;

    const absPct = Math.abs(obs.streams_change_pct);
    // Prefer positive uplift, then largest absolute change
    const score =
      obs.streams_change_pct > 0 ? absPct + 100 : absPct;

    if (score > bestAbsPct) {
      bestAbsPct = score;
      bestEvent = event;
      bestObs = obs;
    }
  }

  if (!bestEvent || !bestObs) return null;

  return {
    event_title: bestEvent.event_title,
    date: bestEvent.date,
    streams_delta_pct: bestObs.streams_change_pct,
    sales_delta_pct: bestObs.units_change_pct,
  };
}

// ─── Momentum ─────────────────────────────────────────────────────

function computeMomentum(sorted: WeeklyMetric[]): {
  momentum: MomentumDirection;
  momentum_context: string;
} {
  if (sorted.length < 3) {
    return {
      momentum: "STABLE",
      momentum_context:
        "Not enough data points to determine momentum — fewer than 3 weeks.",
    };
  }

  // Look at last 3 data points
  const last3 = sorted.slice(-3);
  const [a, b, c] = last3.map((m) => m.total_streams);

  // Check if current is the campaign peak
  const peak = Math.max(...sorted.map((m) => m.total_streams));
  const isAtPeak = c === peak;

  // Variance check for STABLE
  const mean = (a + b + c) / 3;
  const maxDev = Math.max(
    Math.abs(a - mean),
    Math.abs(b - mean),
    Math.abs(c - mean)
  );
  const variancePct = mean > 0 ? (maxDev / mean) * 100 : 0;

  if (variancePct < 5) {
    return {
      momentum: "STABLE",
      momentum_context:
        "Streams have been consistent over the last 3 weeks with minimal variance.",
    };
  }

  if (c > b && b > a) {
    return {
      momentum: "RISING",
      momentum_context:
        "Streams have increased each of the last 3 weeks — campaign is building momentum.",
    };
  }

  if (c < b && b < a) {
    return {
      momentum: "DECLINING",
      momentum_context:
        "Streams have decreased each of the last 3 weeks — campaign may be in its natural wind-down.",
    };
  }

  if (isAtPeak && c > a) {
    return {
      momentum: "PEAKING",
      momentum_context:
        "The campaign is at or near its streaming peak — this is the highest performance period.",
    };
  }

  // Mixed signals — check overall direction
  if (c > a) {
    return {
      momentum: "RISING",
      momentum_context:
        "Overall upward trend over the last 3 weeks, though not consistently increasing.",
    };
  }

  if (c < a) {
    return {
      momentum: "DECLINING",
      momentum_context:
        "Overall downward trend over the last 3 weeks, though not consistently decreasing.",
    };
  }

  return {
    momentum: "STABLE",
    momentum_context:
      "Streams have been relatively flat over the last 3 weeks.",
  };
}
