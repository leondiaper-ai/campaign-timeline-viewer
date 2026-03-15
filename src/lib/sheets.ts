import { google } from "googleapis";
import {
  Campaign,
  WeeklyMetric,
  CampaignEvent,
  SingleCampaignData,
  TrackPerformance,
  TrackWeeklyMetric,
  Territory,
  EventCategory,
  Confidence,
  RegistryEntry,
  CampaignStatus,
} from "@/types";
import { inferIsMajor } from "./event-categories";

// ─── Google Sheets Client ───────────────────────────────────────

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// ─── Helpers ────────────────────────────────────────────────────

/** Parse a numeric cell that may contain commas (e.g. "1,250,000") */
function parseNum(value: string | undefined): number {
  if (!value) return 0;
  return Number(value.replace(/,/g, "")) || 0;
}

// ─── Fetch Helpers ──────────────────────────────────────────────

async function fetchRows(
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:Z`,
  });
  return (response.data.values as string[][]) || [];
}

/**
 * Safely fetch rows from a tab that may not exist yet.
 * Returns empty array if the tab is missing (404).
 */
async function fetchRowsSafe(
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  try {
    return await fetchRows(spreadsheetId, tabName);
  } catch (error: unknown) {
    const errObj = error as { code?: number; message?: string };
    if (
      errObj.code === 400 ||
      errObj.message?.includes("Unable to parse range")
    ) {
      console.log(
        `[CTV] Tab "${tabName}" not found in sheet — skipping (this is normal).`
      );
      return [];
    }
    throw error;
  }
}

// ─── Registry ───────────────────────────────────────────────────

const REGISTRY_SPREADSHEET_ID = process.env.REGISTRY_SPREADSHEET_ID!;

export async function fetchRegistry(): Promise<RegistryEntry[]> {
  const rows = await fetchRows(REGISTRY_SPREADSHEET_ID, "campaign_registry");
  return rows.map((row) => ({
    campaign_id: row[0],
    artist_name: row[1],
    campaign_name: row[2],
    sheet_url: row[3],
    sheet_id: row[4],
    status: (row[5] as CampaignStatus) || "draft",
    campaign_owner: row[6],
  }));
}

export async function fetchActiveCampaigns(): Promise<RegistryEntry[]> {
  const all = await fetchRegistry();
  return all.filter((e) => e.status === "active");
}

// ─── Campaign Sheet Parsers ─────────────────────────────────────

export async function fetchCampaignSetup(
  sheetId: string
): Promise<Campaign> {
  const rows = await fetchRows(sheetId, "campaign_setup");
  const row = rows[0];
  return {
    campaign_id: row[0],
    artist: row[1],
    campaign_name: row[2],
  };
}

export async function fetchCampaignMoments(
  sheetId: string,
  campaignId: string
): Promise<CampaignEvent[]> {
  const rows = await fetchRows(sheetId, "campaign_moments");
  return rows.map((row) => {
    const title = row[1];

    const rawCoreMoment = row[6]?.toLowerCase().trim();
    const isCoreMoment =
      rawCoreMoment === "true"
        ? true
        : rawCoreMoment === "false"
          ? false
          : undefined;

    const rawShowOnChart = row[7]?.toLowerCase().trim();
    const showOnChart =
      rawShowOnChart === "true"
        ? true
        : rawShowOnChart === "false"
          ? false
          : undefined;

    const observedImpact = row[8]?.trim() || undefined;
    const whatWeLearned = row[9]?.trim() || undefined;

    const rawConfidence = row[10]?.toLowerCase().trim();
    const confidence: Confidence | undefined =
      rawConfidence === "high" ||
      rawConfidence === "medium" ||
      rawConfidence === "low"
        ? rawConfidence
        : undefined;

    const isMajor = isCoreMoment ?? inferIsMajor(title);

    return {
      campaign_id: campaignId,
      date: row[0],
      event_title: title,
      event_type: row[2] as EventCategory,
      territory: row[4] as Territory | "global",
      notes: row[5],
      is_major: isMajor,
      observed_impact: observedImpact,
      what_we_learned: whatWeLearned,
      confidence,
      event_subtype: row[3]?.trim() || undefined,
      source_platform: undefined,
      is_core_moment: isCoreMoment,
      show_on_chart: showOnChart,
    };
  });
}

export async function fetchCampaignMetrics(
  sheetId: string,
  campaignId: string
): Promise<WeeklyMetric[]> {
  const rows = await fetchRows(sheetId, "weekly_metrics");
  return rows.map((row) => ({
    campaign_id: campaignId,
    week_ending: row[0],
    territory: row[1] as Territory,
    total_streams: parseNum(row[2]),
    retail_units: parseNum(row[3]),
    d2c_units: parseNum(row[4]),
  }));
}

// ─── Track Performance (optional tab) ───────────────────────────

export async function fetchTrackPerformance(
  sheetId: string,
  campaignId: string
): Promise<TrackPerformance[]> {
  const rows = await fetchRowsSafe(sheetId, "track_performance");
  return rows.map((row) => ({
    campaign_id: campaignId,
    track_id: row[1] || "",
    track_name: row[2] || "",
    release_type: (row[3] as TrackPerformance["release_type"]) || "single",
    release_date: row[4] || "",
    territory: (row[5] as Territory) || "global",
    streams_7d: parseNum(row[6]),
    streams_14d: parseNum(row[7]),
    streams_28d: parseNum(row[8]),
    saves_28d: parseNum(row[9]),
    playlist_adds_28d: parseNum(row[10]),
    editorial_adds_28d: parseNum(row[11]),
  }));
}

// ─── Track Weekly Metrics (optional tabs) ────────────────────────

/**
 * Fetch track-level weekly stream data.
 *
 * Supports two tab formats:
 *
 * 1. "track_metrics" (new simplified schema):
 *    Columns: week_ending | territory | track_name | streams
 *    track_id is auto-generated from track_name.
 *
 * 2. "track_weekly_streams" (original schema):
 *    Columns: campaign_id | track_id | track_name | week_ending | territory | total_streams
 *
 * Tries "track_metrics" first, falls back to "track_weekly_streams".
 * Returns empty array if neither tab exists.
 */
export async function fetchTrackWeeklyMetrics(
  sheetId: string,
  campaignId: string
): Promise<TrackWeeklyMetric[]> {
  // Try new simplified format first (track_metrics)
  const simpleRows = await fetchRowsSafe(sheetId, "track_metrics");
  if (simpleRows.length > 0) {
    return simpleRows.map((row) => {
      const trackName = row[2]?.trim() || "";
      return {
        campaign_id: campaignId,
        track_id: trackName
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, ""),
        track_name: trackName,
        week_ending: row[0] || "",
        territory: (row[1] as Territory) || "global",
        total_streams: parseNum(row[3]),
      };
    });
  }

  // Fall back to original format (track_weekly_streams)
  const rows = await fetchRowsSafe(sheetId, "track_weekly_streams");
  return rows.map((row) => ({
    campaign_id: campaignId,
    track_id: row[1] || "",
    track_name: row[2] || "",
    week_ending: row[3] || "",
    territory: (row[4] as Territory) || "global",
    total_streams: parseNum(row[5]),
  }));
}

// ─── Full Campaign Loader ───────────────────────────────────────

export async function fetchCampaignSheetData(
  sheetId: string,
  campaignId: string
): Promise<SingleCampaignData> {
  const [campaign, events, metrics, trackPerformance, trackWeeklyMetrics] =
    await Promise.all([
      fetchCampaignSetup(sheetId),
      fetchCampaignMoments(sheetId, campaignId),
      fetchCampaignMetrics(sheetId, campaignId),
      fetchTrackPerformance(sheetId, campaignId),
      fetchTrackWeeklyMetrics(sheetId, campaignId),
    ]);

  return { campaign, events, metrics, trackPerformance, trackWeeklyMetrics };
}
