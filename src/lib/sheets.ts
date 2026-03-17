import { google } from "googleapis";
import {
  Campaign,
  WeeklyMetric,
  CampaignEvent,
  TrackWeeklyMetric,
  TrackLookupEntry,
  TrackRole,
  SingleCampaignData,
  Territory,
  EventCategory,
  Confidence,
  RegistryEntry,
  CampaignStatus,
} from "@/types";
import { inferIsMajor } from "./event-categories";

// ——— Google Sheets Client ————————————————————————————————

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

// ——— Fetch Helpers —————————————————————————————————————————

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
 * Safe fetch that returns empty array if the tab doesn't exist.
 * Used for optional tabs like track_metrics, tracks_lookup.
 */
async function fetchRowsSafe(
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  try {
    return await fetchRows(spreadsheetId, tabName);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Tab doesn't exist or is inaccessible — that's fine
    if (msg.includes("Unable to parse range") || msg.includes("not found")) {
      console.log(`Tab "${tabName}" not found — skipping.`);
      return [];
    }
    throw err;
  }
}

// ——— Validation Helpers ——————————————————————————————————————

const VALID_TERRITORIES = new Set(["global", "UK"]);
const VALID_EVENT_TYPES = new Set([
  "music",
  "marketing",
  "editorial",
  "product",
  "live",
]);
const VALID_TRACK_ROLES = new Set([
  "lead_single",
  "second_single",
  "focus_track",
  "album_track",
]);

function cleanTerritory(raw: string | undefined): Territory | "global" {
  const val = (raw || "global").trim().toLowerCase();
  if (val === "uk") return "UK";
  if (VALID_TERRITORIES.has(val)) return val as Territory;
  return "global";
}

function cleanEventType(raw: string | undefined): EventCategory {
  const val = (raw || "music").trim().toLowerCase();
  // Map common aliases
  if (val === "release" || val === "single" || val === "album") return "music";
  if (val === "press" || val === "pr" || val === "review") return "editorial";
  if (val === "merch" || val === "vinyl" || val === "physical")
    return "product";
  if (
    val === "tour" ||
    val === "gig" ||
    val === "concert" ||
    val === "festival"
  )
    return "live";
  if (
    val === "ad" ||
    val === "paid" ||
    val === "social" ||
    val === "promo"
  )
    return "marketing";
  if (VALID_EVENT_TYPES.has(val)) return val as EventCategory;
  return "music"; // safe fallback
}

function cleanTrackRole(raw: string | undefined): TrackRole {
  const val = (raw || "album_track").trim().toLowerCase().replace(/\s+/g, "_");
  if (VALID_TRACK_ROLES.has(val)) return val as TrackRole;
  return "album_track";
}

function safeNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function isValidDate(val: string | undefined): boolean {
  if (!val) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

function parseBool(val: string | undefined, fallback: boolean): boolean {
  if (!val) return fallback;
  const v = val.trim().toLowerCase();
  if (v === "true" || v === "yes" || v === "1") return true;
  if (v === "false" || v === "no" || v === "0") return false;
  return fallback;
}

// ——— Registry ———————————————————————————————————————————————

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

// ——— Campaign Sheet Parsers ——————————————————————————————————
// Each campaign lives in its own spreadsheet with required tabs:
//   campaign_setup · campaign_moments · weekly_metrics
// And optional tabs:
//   track_metrics · tracks_lookup

export async function fetchCampaignSetup(
  sheetId: string
): Promise<Campaign> {
  const rows = await fetchRows(sheetId, "campaign_setup");
  const row = rows[0] || [];
  return {
    campaign_id: row[0] || "unknown",
    artist: row[1] || "Unknown Artist",
    campaign_name: row[2] || "Untitled Campaign",
    start_date: isValidDate(row[3]) ? row[3].trim() : undefined,
    release_date: isValidDate(row[4]) ? row[4].trim() : undefined,
    default_territory: row[5]
      ? (cleanTerritory(row[5]) as Territory)
      : undefined,
  };
}

export async function fetchCampaignMoments(
  sheetId: string,
  campaignId: string
): Promise<CampaignEvent[]> {
  const rows = await fetchRows(sheetId, "campaign_moments");
  return rows
    .filter((row) => row[0] && isValidDate(row[0])) // skip rows without a valid date
    .map((row) => {
      const title = (row[1] || "Untitled moment").trim();

      // is_core_moment (col G, index 6)
      const rawCoreMoment = row[6]?.toLowerCase().trim();
      const isCoreMoment =
        rawCoreMoment === "true"
          ? true
          : rawCoreMoment === "false"
            ? false
            : undefined;

      // show_on_chart (col H, index 7)
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
        date: row[0].trim(),
        event_title: title,
        event_type: cleanEventType(row[2]),
        territory: cleanTerritory(row[4]),
        notes: (row[5] || "").trim(),
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
  return rows
    .filter((row) => row[0] && isValidDate(row[0])) // skip rows without a valid date
    .map((row) => ({
      campaign_id: campaignId,
      week_ending: row[0].trim(),
      territory: cleanTerritory(row[1]) as Territory,
      total_streams: safeNumber(row[2]),
      retail_units: safeNumber(row[3]),
      d2c_units: safeNumber(row[4]),
    }));
}

export async function fetchTrackMetrics(
  sheetId: string,
  campaignId: string
): Promise<TrackWeeklyMetric[]> {
  const rows = await fetchRowsSafe(sheetId, "track_metrics");
  if (rows.length === 0) return [];

  return rows
    .filter((row) => row[0] && isValidDate(row[0]) && row[1]) // need date + track name
    .map((row) => ({
      campaign_id: campaignId,
      week_ending: row[0].trim(),
      track_name: row[1].trim(),
      territory: cleanTerritory(row[2]) as Territory,
      total_streams: safeNumber(row[3]),
    }));
}

// ——— Tracks Lookup (new) ————————————————————————————————————
// Optional tab: tracks_lookup
// Columns: track_name | release_week | track_role | default_on | sort_order

export async function fetchTracksLookup(
  sheetId: string
): Promise<TrackLookupEntry[]> {
  const rows = await fetchRowsSafe(sheetId, "tracks_lookup");
  if (rows.length === 0) return [];

  return rows
    .filter((row) => row[0]?.trim()) // need at least a track name
    .map((row, index) => ({
      track_name: row[0].trim(),
      release_week: isValidDate(row[1]) ? row[1].trim() : "",
      track_role: cleanTrackRole(row[2]),
      default_on: parseBool(row[3], false),
      sort_order: safeNumber(row[4]) || index + 1,
    }));
}

// ——— Full Campaign Loader ——————————————————————————————————

export async function fetchCampaignSheetData(
  sheetId: string,
  campaignId: string
): Promise<SingleCampaignData> {
  const [campaign, events, metrics, trackMetrics, tracksLookup] =
    await Promise.all([
      fetchCampaignSetup(sheetId),
      fetchCampaignMoments(sheetId, campaignId),
      fetchCampaignMetrics(sheetId, campaignId),
      fetchTrackMetrics(sheetId, campaignId),
      fetchTracksLookup(sheetId),
    ]);
  return { campaign, events, metrics, trackMetrics, tracksLookup };
}
