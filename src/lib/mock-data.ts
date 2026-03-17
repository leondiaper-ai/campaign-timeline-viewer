import { Campaign, WeeklyMetric, CampaignEvent, TrackWeeklyMetric, TrackLookupEntry } from "@/types";

// âââ Campaigns ââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Helper to generate weekly dates ââââââââââââââââââââââââââââ

function weeklyDates(start: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

// âââ Weekly Metrics âââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Track Weekly Metrics âââââââââââââââââââââââââââââââââââââââ

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

// âââ Campaign Events ââââââââââââââââââââââââââââââââââââââââââââ

export const mockEvents: CampaignEvent[] = [
  // ââ Arlo Parks ââââââââââââââââââââââââââââââââ
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-01-12",
    event_title: "Deluxe edition announced",
    event_type: "music",
    territory: "global",
    notes: "Social reveal + pre-save link",
    is_major: true,
    observed_impact: "+12K pre-saves in first 48 hours",
    what_we_learned:
      "Announcing with a pre-save CTA converts better than teaser-first. Direct link in bio outperformed link tree.",
    confidence: "high",
    event_subtype: "album_announcement",
    source_platform: "instagram",
    is_core_moment: true,
    show_on_chart: true,
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-01-19",
    event_title: "Lead single released",
    event_type: "music",
    territory: "global",
    notes: "New single across all DSPs",
    is_major: true,
    observed_impact: "+38% streams week-on-week globally",
    what_we_learned:
      "Tuesday release with Thursday playlist pitch window gave us two momentum peaks in one week.",
    confidence: "high",
    event_subtype: "single_release",
    is_core_moment: true,
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-01-26",
    event_title: "NME feature published",
    event_type: "editorial",
    territory: "UK",
    notes: "Full cover story interview",
    is_major: false,
    observed_impact: "Modest UK stream uplift, strong social engagement",
    what_we_learned:
      "Print editorial drives awareness but not direct streaming. Better as a credibility signal for playlist pitches.",
    confidence: "medium",
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-02-02",
    event_title: "Spotify playlist placement",
    event_type: "editorial",
    territory: "global",
    notes: "New Music Friday cover + Today's Top Hits add",
    is_major: true,
    observed_impact: "+1.2M additional streams in placement week",
    what_we_learned:
      "Playlist placement drove more volume than any paid campaign. Timing the pitch 10 days post-single was ideal.",
    confidence: "high",
    event_subtype: "playlist_add",
    source_platform: "spotify",
    is_core_moment: true,
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-02-09",
    event_title: "Limited vinyl drop",
    event_type: "product",
    territory: "global",
    notes: "D2C exclusive colour vinyl, 2000 units",
    is_major: true,
    observed_impact: "Sold out in 6 hours. \u00a334K D2C revenue spike.",
    what_we_learned:
      "Scarcity messaging (countdown + unit count) drove urgency. Email converted 4x better than social for D2C.",
    confidence: "high",
    event_subtype: "vinyl_drop",
    is_core_moment: true,
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-02-17",
    event_title: "Pre-save push launched",
    event_type: "marketing",
    territory: "global",
    notes: "CRM + socials campaign",
    is_major: true,
    observed_impact: "+22K pre-saves over two weeks",
    what_we_learned:
      "CRM open rate was 41% \u2014 well above benchmark. Subject line referencing the vinyl sellout created FOMO.",
    confidence: "medium",
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-02-23",
    event_title: "Album release",
    event_type: "music",
    territory: "global",
    notes: "Deluxe edition worldwide release",
    is_major: true,
    observed_impact: "2.4M streams in release week. D2C peaked at \u00a318.2K.",
    what_we_learned:
      "Stacking vinyl drop + pre-save push in the two weeks before release built the strongest first-week we've had for this artist.",
    confidence: "high",
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-03-02",
    event_title: "Radio 1 interview aired",
    event_type: "live",
    territory: "UK",
    notes: "National radio moment",
    is_major: false,
    observed_impact: "UK streams held flat vs. usual post-release decline",
    what_we_learned:
      "Radio sustains rather than spikes. Useful as a retention tool in week 2, not a launch driver.",
    confidence: "medium",
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-03-09",
    event_title: "KOKO London headline",
    event_type: "live",
    territory: "UK",
    notes: "2,000 cap sold out",
    is_major: false,
    observed_impact: "Merch sales at venue exceeded online for the week",
    what_we_learned:
      "Live shows are strong merch conversion moments. Should pre-stock venue-exclusive items next time.",
    confidence: "low",
  },
  {
    campaign_id: "arlo_parks_deluxe",
    date: "2026-03-16",
    event_title: "Retargeting ad campaign",
    event_type: "marketing",
    territory: "global",
    notes: "Meta + TikTok paid push for merch bundle",
    is_major: false,
    observed_impact: "ROAS 2.1x on Meta, 0.8x on TikTok",
    what_we_learned:
      "Meta retargeting worked well for merch bundles. TikTok underperformed \u2014 audience skewed too young for D2C conversion.",
    confidence: "medium",
    event_subtype: "paid_social",
    source_platform: "meta",
  },

  // ââ James Blake âââââââââââââââââââââââââââââââ
  {
    campaign_id: "james_blake_album",
    date: "2026-02-09",
    event_title: "Album pre-order live",
    event_type: "product",
    territory: "global",
    notes: "D2C store + retailer links",
    is_major: true,
    observed_impact: "1,400 pre-orders in first week",
    what_we_learned:
      "Pre-order conversion was strongest from the newsletter. Retailer links underperformed vs. D2C.",
    confidence: "high",
  },
  {
    campaign_id: "james_blake_album",
    date: "2026-02-16",
    event_title: "First single released",
    event_type: "music",
    territory: "global",
    notes: "Lead single + music video",
    is_major: true,
    observed_impact: "+45% streams vs. previous single debut",
    what_we_learned:
      "Music video premiere on YouTube drove a discovery spike that carried into Spotify. Worth investing in visual for lead singles.",
    confidence: "high",
    event_subtype: "single_release",
    source_platform: "youtube",
    is_core_moment: true,
  },
  {
    campaign_id: "james_blake_album",
    date: "2026-02-23",
    event_title: "Pitchfork Best New Track",
    event_type: "editorial",
    territory: "global",
    notes: "8.4 rating",
    is_major: true,
    observed_impact: "+18% streams in the 72 hours after publication",
    what_we_learned:
      "Pitchfork still moves the needle for this audience. Should prioritise their review cycle in future release timelines.",
    confidence: "high",
  },
  {
    campaign_id: "james_blake_album",
    date: "2026-03-02",
    event_title: "Album out now",
    event_type: "music",
    territory: "global",
    notes: "Full album release",
    is_major: true,
    observed_impact: "1.8M first-week streams, ahead of target",
    what_we_learned:
      "Building editorial credibility before release week (Pitchfork, playlisting) set a higher floor for organic discovery.",
    confidence: "high",
  },
  {
    campaign_id: "james_blake_album",
    date: "2026-03-09",
    event_title: "Jools Holland performance",
    event_type: "live",
    territory: "UK",
    notes: "BBC Two broadcast",
    is_major: false,
    observed_impact: "UK streams +11% week-on-week",
    what_we_learned:
      "Broadcast TV still reaches an older demographic that then searches on streaming. Good for catalogue depth.",
    confidence: "medium",
  },
  {
    campaign_id: "james_blake_album",
    date: "2026-03-16",
    event_title: "TikTok creator campaign",
    event_type: "marketing",
    territory: "global",
    notes: "20 creators seeded",
    is_major: false,
    observed_impact: "Mixed \u2014 3 of 20 posts went viral, rest underperformed",
    what_we_learned:
      "Creator seeding is high-variance. Fewer creators with stronger briefs would be a better use of budget.",
    confidence: "low",
    event_subtype: "creator_seeding",
    source_platform: "tiktok",
  },

  // ââ Billie Marten âââââââââââââââââââââââââââââ
  {
    campaign_id: "billie_marten_album",
    date: "2026-01-26",
    event_title: "Album announcement",
    event_type: "music",
    territory: "global",
    notes: "Social + press reveal",
    is_major: true,
    observed_impact: "8K pre-saves in announcement week",
    what_we_learned:
      "Announcing early (6 weeks out) gave us a longer runway to build pre-saves. Right call for this audience size.",
    confidence: "medium",
  },
  {
    campaign_id: "billie_marten_album",
    date: "2026-02-09",
    event_title: "First single + video",
    event_type: "music",
    territory: "global",
    notes: "Released across DSPs",
    is_major: true,
    observed_impact: "+28% streams vs. previous campaign lead single",
    what_we_learned:
      "Pairing single with a visual narrative (short film style) resonated with this artist's audience. Outperformed lyric video approach.",
    confidence: "high",
    event_subtype: "single_release",
    is_core_moment: true,
  },
  {
    campaign_id: "billie_marten_album",
    date: "2026-02-16",
    event_title: "Guardian interview",
    event_type: "editorial",
    territory: "UK",
    notes: "Arts section feature",
    is_major: false,
    observed_impact: "Moderate \u2014 social shares high, stream lift small",
    what_we_learned:
      "Guardian audience overlaps well with Billie's demo. Good for brand building, not direct conversion.",
    confidence: "medium",
  },
  {
    campaign_id: "billie_marten_album",
    date: "2026-02-23",
    event_title: "Signed CD bundle",
    event_type: "product",
    territory: "UK",
    notes: "Limited signed copies on D2C",
    is_major: true,
    observed_impact: "680 units sold, \u00a39.5K D2C revenue in 48 hours",
    what_we_learned:
      "Signed product is the strongest D2C lever for this artist. Should do two drops (announcement + release week) next time.",
    confidence: "high",
  },
  {
    campaign_id: "billie_marten_album",
    date: "2026-03-02",
    event_title: "Album release",
    event_type: "music",
    territory: "global",
    notes: "Worldwide release",
    is_major: true,
    observed_impact: "900K first-week streams, on target",
    what_we_learned:
      "Consistent audience \u2014 release week performed as expected. Growth opportunity is in expanding reach beyond core fans.",
    confidence: "high",
  },
  {
    campaign_id: "billie_marten_album",
    date: "2026-03-09",
    event_title: "Email fan campaign",
    event_type: "marketing",
    territory: "global",
    notes: "CRM blast to mailing list",
    is_major: false,
    observed_impact: "Open rate 38%, click-through 6.2%",
    what_we_learned:
      "Post-release CRM works better as a merch/tour push than a streaming push. Fans already streaming by this point.",
    confidence: "medium",
  },
  {
    campaign_id: "billie_marten_album",
    date: "2026-03-16",
    event_title: "UK tour kickoff",
    event_type: "live",
    territory: "UK",
    notes: "10-date headline tour begins",
    is_major: false,
  },
];

// ——— Tracks Lookup (metadata for track toggles) ————————————————

export const mockTracksLookup: TrackLookupEntry[] = [
  // K Trap tracks
  { track_name: "Impurities", release_week: "2025-01-17", track_role: "lead_single", default_on: true, sort_order: 1 },
  { track_name: "Different Cloth", release_week: "2025-02-14", track_role: "second_single", default_on: true, sort_order: 2 },
  { track_name: "Warm", release_week: "2025-03-07", track_role: "focus_track", default_on: false, sort_order: 3 },
  { track_name: "Glorious", release_week: "2025-03-07", track_role: "album_track", default_on: false, sort_order: 4 },
  { track_name: "Paper Plans", release_week: "2025-03-07", track_role: "album_track", default_on: false, sort_order: 5 },
  // Keshi tracks
  { track_name: "blue", release_week: "2024-11-01", track_role: "lead_single", default_on: true, sort_order: 1 },
  { track_name: "limbo", release_week: "2024-11-15", track_role: "second_single", default_on: true, sort_order: 2 },
  { track_name: "mango", release_week: "2024-12-06", track_role: "album_track", default_on: false, sort_order: 3 },
  // Central Cee tracks
  { track_name: "Band4Band", release_week: "2025-02-07", track_role: "lead_single", default_on: true, sort_order: 1 },
  { track_name: "Limitless", release_week: "2025-02-21", track_role: "second_single", default_on: true, sort_order: 2 },
  { track_name: "One By One", release_week: "2025-03-14", track_role: "focus_track", default_on: false, sort_order: 3 },
];
