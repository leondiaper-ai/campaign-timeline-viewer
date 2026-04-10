// Pre-authored Campaign Reads used by the DemoIntake flow.
// These are NOT derived from the live sheet — they exist so the user can
// step through 3 realistic campaign states and see what the read looks like
// for each, mirroring the Artist / Track Lens demo pattern.

export type VerdictLabel = "PUSH" | "SUSTAIN" | "RE-IGNITE";
export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface SampleDriver {
  title: string;
  context: string;
}

export interface SampleCampaign {
  id: string;
  filename: string;
  label: string;
  source: string;
  includes: string;
  verdict: VerdictLabel;
  verdictColor: string;
  verdictLine: string;
  supporting: string;
  confidence: ConfidenceLevel;
  why: string[];
  drivers: SampleDriver[];
  actions: string[];
}

export const SAMPLE_CAMPAIGNS: SampleCampaign[] = [
  {
    id: "album-peak",
    filename: "campaign_timeline_export_album_peak.csv",
    label: "Album peak week",
    source: "Spotify / campaign export · Last 90 days",
    includes: "Includes: streams, release moments, paid, editorial, D2C",
    verdict: "PUSH",
    verdictColor: "#FF4A1C",
    verdictLine: "At peak — extend reach now",
    supporting: "1.8M Global weekly — album-week peak",
    confidence: "High",
    why: [
      "Release week spike is the largest of the campaign so far",
      "Paid + editorial stacked into the same 10-day window",
    ],
    drivers: [
      { title: "Album release", context: "Primary lift — release-week spike" },
      { title: "Marquee push (DE + UK)", context: "Drove release window uplift — $15K" },
      { title: "New Music Friday add", context: "Expanded reach into new listeners" },
    ],
    actions: [
      "Push all channels now — maximise album-week reach",
      "Capture audience data for retargeting within 48 hrs",
      "Line up the next moment before the curve softens",
    ],
  },
  {
    id: "cooling",
    filename: "campaign_timeline_export_cooling_post_release.csv",
    label: "Cooling post-release",
    source: "Spotify / campaign export · Last 90 days",
    includes: "Includes: streams, release moments, paid, editorial, D2C",
    verdict: "SUSTAIN",
    verdictColor: "#1FBE7A",
    verdictLine: "Momentum cooling post-peak",
    supporting: "592K UK weekly — cooling at ~52% of peak",
    confidence: "Medium",
    why: [
      "Peak was driven by album release — no strong secondary spike since",
      "Paid spend tailed off once playlist adds settled",
    ],
    drivers: [
      { title: "Album release", context: "Primary lift — release spike" },
      { title: "Marquee (DE) — Album Push", context: "Short-term support — $3K" },
      { title: "No follow-up content moment", context: "Gap in release cadence" },
    ],
    actions: [
      "Re-trigger momentum with a new content drop",
      "Focus spend on strongest territory",
      "Avoid broad scaling without a fresh audience signal",
    ],
  },
  {
    id: "paid-no-followthrough",
    filename: "campaign_timeline_export_paid_without_followthrough.csv",
    label: "Paid without follow-through",
    source: "Spotify / campaign export · Last 90 days",
    includes: "Includes: streams, release moments, paid, editorial, D2C",
    verdict: "RE-IGNITE",
    verdictColor: "#FF4A1C",
    verdictLine: "Paid lifted, organic didn't follow",
    supporting: "210K Global weekly — down 38% from peak, paid spend flat",
    confidence: "Low",
    why: [
      "Paid drove short lifts but no organic retention after each push",
      "No release moment between paid windows to anchor the audience",
    ],
    drivers: [
      { title: "Marquee UK", context: "Short-lived uplift — $8K" },
      { title: "Display + social push", context: "Surface-level reach, weak retention" },
      { title: "No content drop", context: "Nothing for new listeners to land on" },
    ],
    actions: [
      "Pause broad spend — it's not converting",
      "Prioritise a fresh content moment before re-starting paid",
      "Test retention on the strongest catalogue track first",
    ],
  },
];
