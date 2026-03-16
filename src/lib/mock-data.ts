import { Campaign, WeeklyMetric, CampaignEvent, TrackWeeklyMetric } from "@/types";

// ─── Campaigns ──────────────────────────────────────────────────

export const mockCampaigns: Campaign[] = [
  {
    campaign_id: "arlo_parks_deluxe",
    artist: "Arlo Parks",
    campaign_name: "Deluxe Campaign",
    release_date: "2026-02-23",
  },
  {
    campaign_id: "james_blake_album",
    artist: "James Blake",
    campaign_name: "Album Launch",
    release_date: "2026-03-02",
  },
  {
    campaign_id: "billie_marten_album",
    artist: "Billie Marten",
    campaign_name: "Album Campaign",
    release_date: "2026-03-02",
  },
];

// ─── Helper to generate weekly dates ────────────────────────────

function weeklyDates(start: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

// ─── Weekly Metrics ─────────────────────────────────────────────

function generateMetrics(
  campaignId: string,
  startDate: string,
  weeks: number,
  baseStreams: number,
  baseRetailUnits: number,
  baseD2cUnits: number
): WeeklyMetric[] {
  const dates = weeklyDates(startDate, weeks);
  const metrics: WeeklyMetric[] = [];

  dates.forEach((date, i) => {
    const peakFactor = Math.exp(-0.5 * Math.pow((i - 7) / 3, 2));
    const noise = () => 0.9 + Math.random() * 0.2;

    const globalStreams = Math.round(
      baseStreams * (0.4 + peakFactor * 0.8) * noise()
    );
    const globalRetail = Math.round(
      baseRetailUnits * (0.3 + peakFactor * 1.0) * noise()
    );
    const globalD2c = Math.round(
      baseD2cUnits * (0.25 + peakFactor * 1.2) * noise()
    );

    const ukStreams = Math.round(globalStreams * (0.15 + Math.random() * 0.05));
    const ukRetail = Math.round(globalRetail * (0.22 + Math.random() * 0.06));
    const ukD2c = Math.round(globalD2c * (0.18 + Math.random() * 0.06));

    metrics.push(
      {
        campaign_id: campaignId,
        week_ending: date,
        territory: "global",
        total_streams: globalStreams,
        retail_units: globalRetail,
        d2c_units: globalD2c,
      },
      {
        campaign_id: campaignId,
        week_ending: date,
        territory: "UK",
        total_streams: ukStreams,
        retail_units: ukRetail,
        d2c_units: ukD2c,
      }
    );
  });

  return metrics;
}

export const mockMetrics: WeeklyMetric[] = [
  ...generateMetrics("arlo_parks_deluxe", "2026-01-05", 14, 2400000, 3200, 1800),
  ...generateMetrics("james_blake_album", "2026-02-02", 12, 1800000, 2400, 1200),
  ...generateMetrics("billie_marten_album", "2026-01-19", 13, 900000, 1400, 800),
];

// ─── Track Weekly Metrics ───────────────────────────────────────

function generateTrackMetrics(
  campaignId: string,
  startDate: string,
  weeks: number,
  tracks: Array<{ name: string; share: number; peakOffset: number }>
): TrackWeeklyMetric[] {
  const dates = weeklyDates(startDate, weeks);
  const metrics: TrackWeeklyMetric[] = [];

  // Get campaign total streams for each week to derive track shares
  const campaignMetrics = mockMetrics.filter(
    (m) => m.campaign_id === campaignId && m.territory === "global"
  );

  dates.forEach((date, i) => {
    const campaignWeek = campaignMetrics.find((m) => m.week_ending === date);
    const totalStreams = campaignWeek?.total_streams || 0;

    tracks.forEach((track) => {
      // Each track peaks at different times
      const trackPeak = Math.exp(
        -0.5 * Math.pow((i - (7 + track.peakOffset)) / 3, 2)
      );
      const noise = 0.85 + Math.random() * 0.3;
      const trackStreams = Math.round(
        totalStreams * track.share * trackPeak * noise
      );

      const globalStreams = trackStreams;
      const ukStreams = Math.round(globalStreams * (0.15 + Math.random() * 0.05));

      metrics.push(
        {
          campaign_id: campaignId,
          week_ending: date,
          track_name: track.name,
          territory: "global",
          total_streams: globalStreams,
        },
        {
          campaign_id: campaignId,
          week_ending: date,
          track_name: track.name,
          territory: "UK",
          total_streams: ukStreams,
        }
      );
    });
  });

  return metrics;
}

export const mockTrackMetrics: TrackWeeklyMetric[] = [
  ...generateTrackMetrics("arlo_parks_deluxe", "2026-01-05", 14, [
    { name: "Devotion (Deluxe)", share: 0.35, peakOffset: 0 },
    { name: "Weightless", share: 0.25, peakOffset: -1 },
    { name: "Softly", share: 0.2, peakOffset: 1 },
    { name: "Impurities", share: 0.12, peakOffset: 2 },
    { name: "Blades", share: 0.08, peakOffset: -2 },
  ]),
  ...generateTrackMetrics("james_blake_album", "2026-02-02", 12, [
    { name: "Death Of Love", share: 0.3, peakOffset: 0 },
    { name: "I Had A Dream", share: 0.25, peakOffset: -1 },
    { name: "Trying Times", share: 0.22, peakOffset: 1 },
    { name: "Loading", share: 0.13, peakOffset: 2 },
    { name: "Say What You Will", share: 0.1, peakOffset: -1 },
  ]),
  ...generateTrackMetrics("billie_marten_album", "2026-01-19", 13, [
    { name: "Willow", share: 0.32, peakOffset: 0 },
    { name: "Garden Song", share: 0.28, peakOffset: -1 },
    { name: "Ribbon", share: 0.22, peakOffset: 1 },
    { name: "Human Replacement", share: 0.18, peakOffset: 2 },
  ]),
];
