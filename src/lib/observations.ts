import {
  CampaignEvent,
  WeeklyMetric,
  AutoObservation,
  Territory,
} from "@/types";

// ─── Observation Engine ─────────────────────────────────────────
// Generates cautious, data-driven observations for campaign moments
// by comparing weekly metrics before and after each event.
//
// Important: these are OBSERVATIONS, not causal claims.
// The language must remain neutral and hedged.

/**
 * Generate auto-observations for a set of events against weekly metrics.
 * Returns a Map keyed by event date string.
 */
export function generateObservations(
  events: CampaignEvent[],
  metrics: WeeklyMetric[],
  campaignId: string,
  territory: Territory
): Map<string, AutoObservation> {
  const observations = new Map<string, AutoObservation>();

  // Filter and sort metrics for this campaign + territory
  const sorted = metrics
    .filter((m) => m.campaign_id === campaignId && m.territory === territory)
    .sort((a, b) => a.week_ending.localeCompare(b.week_ending));

  if (sorted.length < 2) return observations;

  // Find peak week index
  const peakIdx = sorted.reduce(
    (best, m, i) => (m.total_streams > sorted[best].total_streams ? i : best),
    0
  );

  // Filter events for this campaign and territory
  const relevantEvents = events.filter(
    (e) =>
      e.campaign_id === campaignId &&
      (e.territory === "global" || e.territory === territory)
  );

  for (const event of relevantEvents) {
    const obs = buildObservation(event, sorted, peakIdx);
    observations.set(event.date, obs);
  }

  return observations;
}

// ─── Internal Helpers ───────────────────────────────────────────

/**
 * Find the index of the metric week that contains or is closest after
 * the event date. Metrics are weekly buckets ending on week_ending.
 */
function findContainingWeekIdx(
  eventDate: string,
  sorted: WeeklyMetric[]
): number {
  // Find the first week_ending that is >= eventDate
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].week_ending >= eventDate) return i;
  }
  return sorted.length - 1; // event is after all metrics
}

function pctChange(before: number, after: number): number | null {
  if (before === 0) return null;
  return Math.round(((after - before) / before) * 100);
}

function buildObservation(
  event: CampaignEvent,
  sorted: WeeklyMetric[],
  peakIdx: number
): AutoObservation {
  const weekIdx = findContainingWeekIdx(event.date, sorted);

  // The week containing the event, the week before, and the week after
  const weekBefore = weekIdx > 0 ? sorted[weekIdx - 1] : null;
  const weekAfter =
    weekIdx < sorted.length - 1 ? sorted[weekIdx + 1] : null;

  // For uplift: compare week BEFORE the moment to week AFTER
  const streamsBefore = weekBefore?.total_streams ?? null;
  const streamsAfter = weekAfter?.total_streams ?? null;
  const streamsChangePct =
    streamsBefore !== null && streamsAfter !== null
      ? pctChange(streamsBefore, streamsAfter)
      : null;

  const unitsBefore =
    weekBefore !== null
      ? weekBefore.retail_units + weekBefore.d2c_units
      : null;
  const unitsAfter =
    weekAfter !== null
      ? weekAfter.retail_units + weekAfter.d2c_units
      : null;
  const unitsChangePct =
    unitsBefore !== null && unitsAfter !== null
      ? pctChange(unitsBefore, unitsAfter)
      : null;

  // Was momentum already rising? Check 2-week trend before the event
  let wasMomentumRising = false;
  if (weekIdx >= 2) {
    const twoWeeksBefore = sorted[weekIdx - 2];
    const oneWeekBefore = sorted[weekIdx - 1];
    wasMomentumRising =
      oneWeekBefore.total_streams > twoWeeksBefore.total_streams;
  }

  // Is this near the campaign peak? (within ±1 week)
  const nearCampaignPeak = Math.abs(weekIdx - peakIdx) <= 1;

  const summary = buildSummaryText({
    streamsChangePct,
    unitsChangePct,
    wasMomentumRising,
    nearCampaignPeak,
    hasBeforeData: streamsBefore !== null,
    hasAfterData: streamsAfter !== null,
  });

  return {
    streams_before: streamsBefore,
    streams_after: streamsAfter,
    streams_change_pct: streamsChangePct,
    units_before: unitsBefore,
    units_after: unitsAfter,
    units_change_pct: unitsChangePct,
    was_momentum_rising: wasMomentumRising,
    near_campaign_peak: nearCampaignPeak,
    summary,
  };
}

// ─── Summary Text Generation ────────────────────────────────────
// Language is deliberately cautious and observational.

interface SummaryParams {
  streamsChangePct: number | null;
  unitsChangePct: number | null;
  wasMomentumRising: boolean;
  nearCampaignPeak: boolean;
  hasBeforeData: boolean;
  hasAfterData: boolean;
}

function buildSummaryText(p: SummaryParams): string {
  // Not enough data
  if (!p.hasBeforeData || !p.hasAfterData) {
    return "Not enough metric data around this moment to assess impact.";
  }

  if (p.streamsChangePct === null) {
    return "Not enough metric data around this moment to assess impact.";
  }

  const parts: string[] = [];

  // Streams observation
  const absPct = Math.abs(p.streamsChangePct);

  if (absPct <= 10) {
    // Flat
    parts.push(
      "No significant change in streams observed around this moment."
    );
  } else if (p.streamsChangePct > 10) {
    // Uplift
    if (p.wasMomentumRising) {
      parts.push(
        `Streams rose ~${absPct}% week-on-week, though momentum was already building before this moment.`
      );
    } else {
      parts.push(
        `Streams rose ~${absPct}% in the week following this moment.`
      );
    }
  } else {
    // Decline
    parts.push(
      `Streams were declining (~${absPct}% drop) around this period — consistent with the campaign's natural arc.`
    );
  }

  // Peak proximity
  if (p.nearCampaignPeak && absPct > 10) {
    parts.push(
      "This moment coincided with the campaign's peak streaming period."
    );
  }

  // Physical units (only add if notable)
  if (p.unitsChangePct !== null && Math.abs(p.unitsChangePct) > 10) {
    const dir = p.unitsChangePct > 0 ? "rose" : "fell";
    parts.push(
      `Physical units also ${dir} ~${Math.abs(p.unitsChangePct)}%.`
    );
  }

  return parts.join(" ");
}
