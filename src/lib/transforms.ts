import {
  CampaignData,
  ChartDataPoint,
  CampaignEvent,
  AutoObservation,
  Territory,
} from "@/types";

// ─── Transform data for chart ───────────────────────────────────

export function buildChartData(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): ChartDataPoint[] {
  const filteredMetrics = data.metrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === territory
  );

  const filteredEvents = data.events.filter(
    (e) =>
      e.campaign_id === campaignId &&
      (e.territory === "global" || e.territory === territory)
  );

  const eventsByDate = new Map<string, CampaignEvent[]>();
  filteredEvents.forEach((e) => {
    const existing = eventsByDate.get(e.date) || [];
    existing.push(e);
    eventsByDate.set(e.date, existing);
  });

  // Build chart points from metric data only — no zero-value placeholders
  const chartPoints: ChartDataPoint[] = filteredMetrics
    .sort((a, b) => a.week_ending.localeCompare(b.week_ending))
    .map((m) => ({
      date: m.week_ending,
      total_streams: m.total_streams,
      physical_units: m.retail_units + m.d2c_units,
      events: eventsByDate.get(m.week_ending) || [],
    }));

  // For events that fall on dates without metrics, snap them to the
  // nearest metric week instead of creating zero-value chart points.
  // This prevents the chart lines from dipping to zero between data weeks.
  const metricDates = new Set(chartPoints.map((p) => p.date));
  filteredEvents.forEach((e) => {
    if (!metricDates.has(e.date)) {
      let nearestPoint: ChartDataPoint | null = null;
      let nearestDist = Infinity;
      const eventTime = new Date(e.date + "T00:00:00").getTime();

      for (const point of chartPoints) {
        const dist = Math.abs(
          new Date(point.date + "T00:00:00").getTime() - eventTime
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPoint = point;
        }
      }

      if (nearestPoint) {
        // Avoid duplicates — only add if not already attached
        if (!nearestPoint.events.some((ev) => ev.date === e.date && ev.event_title === e.event_title)) {
          nearestPoint.events.push(e);
        }
      }
    }
  });

  return chartPoints.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Filter events for event list ───────────────────────────────

export function getFilteredEvents(
  data: CampaignData,
  campaignId: string,
  territory: Territory
): CampaignEvent[] {
  return data.events
    .filter(
      (e) =>
        e.campaign_id === campaignId &&
        (e.territory === "global" || e.territory === territory)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Extract top learnings from major events ────────────────────

export interface CampaignLearning {
  event_title: string;
  event_type: CampaignEvent["event_type"];
  what_we_learned: string;
  observed_impact: string;
  confidence: CampaignEvent["confidence"];
  date: string;
  source: "manual" | "auto";
}

/**
 * Returns the top learnings for a campaign, prioritising:
 * 1. Manual team insights (high-confidence major events first)
 * 2. Auto-generated observations as fallback (for major events without manual notes)
 */
export function getTopLearnings(
  events: CampaignEvent[],
  observations: Map<string, AutoObservation>,
  limit = 3
): CampaignLearning[] {
  const results: Array<{ learning: CampaignLearning; score: number }> = [];

  // 1. Manual learnings — events with what_we_learned
  const withManual = events.filter(
    (e) => e.what_we_learned && e.observed_impact
  );

  for (const e of withManual) {
    let score = 20; // manual always ranks above auto
    if (e.is_major) score += 10;
    if (e.confidence === "high") score += 6;
    else if (e.confidence === "medium") score += 3;
    else if (e.confidence === "low") score += 1;

    results.push({
      learning: {
        event_title: e.event_title,
        event_type: e.event_type,
        what_we_learned: e.what_we_learned!,
        observed_impact: e.observed_impact!,
        confidence: e.confidence,
        date: e.date,
        source: "manual",
      },
      score,
    });
  }

  // 2. Auto-observations — for major events that DON'T have manual learnings
  const manualDates = new Set(withManual.map((e) => e.date));
  const majorWithoutManual = events.filter(
    (e) => e.is_major && !manualDates.has(e.date)
  );

  for (const e of majorWithoutManual) {
    const obs = observations.get(e.date);
    if (!obs || obs.summary.startsWith("Not enough")) continue;

    results.push({
      learning: {
        event_title: e.event_title,
        event_type: e.event_type,
        what_we_learned: obs.summary,
        observed_impact:
          obs.streams_change_pct !== null
            ? `${obs.streams_change_pct > 0 ? "+" : ""}${obs.streams_change_pct}% streams week-on-week`
            : "Insufficient data",
        confidence: undefined,
        date: e.date,
        source: "auto",
      },
      score: 5, // below all manual learnings
    });
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit).map((r) => r.learning);
}
