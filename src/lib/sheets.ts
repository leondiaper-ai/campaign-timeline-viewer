import { google } from "googleapis";
import {
  CampaignSetup,
  CampaignType,
  Track,
  TrackRole,
  WeeklyRow,
  PhysicalRow,
  Moment,
  CampaignSheetData,
  Territory,
  RegistryEntry,
  CampaignStatus,
  ValidationWarning,
} from "@/types";

// ——— Google Sheets Client ——————————————————————————————————
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

// ——— Fetch Helpers ——————————————————————————————————————————
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

async function fetchRowsSafe(
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  try {
    return await fetchRows(spreadsheetId, tabName);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("Unable to parse range") ||
      msg.includes("not found")
    ) {
      console.log(`[CTV] Tab "${tabName}" not found — skipping.`);
      return [];
    }
    throw err;
  }
}

// ——— Parse Helpers ——————————————————————————————————————————
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

const VALID_TRACK_ROLES = new Set([
  "lead_single",
  "second_single",
  "focus_track",
  "album_track",
]);

function cleanTrackRole(raw: string | undefined): TrackRole {
  const val = (raw || "album_track").trim().toLowerCase().replace(/\s+/g, "_");
  if (VALID_TRACK_ROLES.has(val)) return val as TrackRole;
  return "album_track";
}

function cleanTerritory(raw: string | undefined): Territory {
  const val = (raw || "global").trim().toLowerCase();
  if (val === "uk") return "UK";
  return "global";
}

function cleanCampaignType(raw: string | undefined): CampaignType {
  const val = (raw || "album").trim().toLowerCase();
  if (val === "single") return "single";
  return "album";
}

/**
 * Check if a row is a metadata/template instruction row.
 * These are notes left in the Google Sheet template that should not be parsed.
 */
function isMetadataRow(firstCell: string): boolean {
  if (!firstCell) return true;
  const val = firstCell.trim().toLowerCase();
  if (val.startsWith("notes")) return true;
  if (val.startsWith("track_role")) return true;
  if (val.startsWith("default_on")) return true;
  if (val.startsWith("sort_order")) return true;
  if (val.startsWith("week_start_date")) return true;
  if (val.startsWith("track_name")) return true;
  if (val.startsWith("streams_")) return true;
  if (val.startsWith("moment_")) return true;
  if (val.startsWith("is_key")) return true;
  if (val.startsWith("units")) return true;
  // Long rows with colons are likely instructions
  if (val.includes(":") && val.length > 40) return true;
  return false;
}

// ——— Tab Parsers ———————————————————————————————————————————
async function fetchCampaignSetup(sheetId: string): Promise<CampaignSetup> {
  const rows = await fetchRows(sheetId, "campaign_setup");
  if (rows.length === 0) {
    console.warn("[CTV] campaign_setup tab is empty — using defaults.");
    return {
      campaign_name: "Untitled Campaign",
      artist_name: "Unknown Artist",
      campaign_type: "album",
      release_date: "",
      default_territory: "global",
    };
  }
  const r = rows[0];
  return {
    campaign_name: (r[0] || "Untitled Campaign").trim(),
    artist_name: (r[1] || "Unknown Artist").trim(),
    campaign_type: cleanCampaignType(r[2]),
    release_date: isValidDate(r[3]) ? r[3].trim() : "",
    default_territory: cleanTerritory(r[4]),
  };
}

async function fetchTracks(sheetId: string): Promise<Track[]> {
  const rows = await fetchRows(sheetId, "tracks");
  if (rows.length === 0) {
    console.warn("[CTV] tracks tab is empty — no track data.");
    return [];
  }
  return rows
    .filter((r) => r[0]?.trim() && !isMetadataRow(r[0]))
    .map((r, i) => ({
      track_name: r[0].trim(),
      track_role: cleanTrackRole(r[1]),
      release_date: isValidDate(r[2]) ? r[2].trim() : "",
      default_on: parseBool(r[3], false),
      sort_order: safeNumber(r[4]) || i + 1,
    }));
}

async function fetchWeeklyData(sheetId: string): Promise<WeeklyRow[]> {
  const rows = await fetchRows(sheetId, "weekly_data");
  if (rows.length === 0) {
    console.warn("[CTV] weekly_data tab is empty — no streaming data.");
    return [];
  }
  return rows
    .filter(
      (r) =>
        r[0] &&
        isValidDate(r[0]) &&
        r[1]?.trim() &&
        !isMetadataRow(r[0]) &&
        !isMetadataRow(r[1])
    )
    .map((r) => ({
      week_start_date: r[0].trim(),
      track_name: r[1].trim(),
      streams_global: safeNumber(r[2]),
      streams_uk: safeNumber(r[3]),
    }));
}

async function fetchPhysicalData(sheetId: string): Promise<PhysicalRow[]> {
  const rows = await fetchRowsSafe(sheetId, "physical_data");
  if (rows.length === 0) return [];
  return rows
    .filter((r) => r[0] && isValidDate(r[0]))
    .map((r) => ({
      week_start_date: r[0].trim(),
      units: safeNumber(r[1]),
    }));
}

async function fetchMoments(sheetId: string): Promise<Moment[]> {
  const rows = await fetchRows(sheetId, "moments");
  if (rows.length === 0) {
    console.warn("[CTV] moments tab is empty — no campaign moments.");
    return [];
  }
  return rows
    .filter((r) => r[0] && isValidDate(r[0]) && !isMetadataRow(r[0]))
    .map((r) => ({
      date: r[0].trim(),
      moment_title: (r[1] || "Untitled moment").trim(),
      moment_type: (r[2] || "music").trim().toLowerCase(),
      is_key: parseBool(r[3], false),
    }));
}

// ——— Validation ————————————————————————————————————————————
function validateSheetData(data: CampaignSheetData): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const trackNames = new Set(data.tracks.map((t) => t.track_name));

  if (data.tracks.length === 0) {
    warnings.push({ tab: "tracks", message: "No tracks defined." });
  }

  if (data.weeklyData.length === 0) {
    warnings.push({ tab: "weekly_data", message: "No weekly data rows." });
  } else {
    const hasTotalRows = data.weeklyData.some((r) => r.track_name === "TOTAL");
    if (!hasTotalRows) {
      warnings.push({
        tab: "weekly_data",
        message: "No TOTAL rows found. Campaign totals will be missing.",
      });
    }

    const weeklyTrackNames = new Set(
      data.weeklyData
        .filter((r) => r.track_name !== "TOTAL")
        .map((r) => r.track_name)
    );
    for (const name of weeklyTrackNames) {
      if (trackNames.size > 0 && !trackNames.has(name)) {
        warnings.push({
          tab: "weekly_data",
          message: `Track "${name}" has weekly data but no entry in tracks tab.`,
        });
      }
    }

    for (const name of trackNames) {
      if (!weeklyTrackNames.has(name)) {
        warnings.push({
          tab: "tracks",
          message: `Track "${name}" is defined but has no weekly_data rows.`,
        });
      }
    }

    const totalDates = data.weeklyData
      .filter((r) => r.track_name === "TOTAL")
      .map((r) => r.week_start_date)
      .sort();
    if (totalDates.length >= 2) {
      for (let i = 1; i < totalDates.length; i++) {
        const prev = new Date(totalDates[i - 1]);
        const curr = new Date(totalDates[i]);
        const diffDays =
          (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 10) {
          warnings.push({
            tab: "weekly_data",
            message: `Possible missing week between ${totalDates[i - 1]} and ${totalDates[i]} (${Math.round(diffDays)} day gap).`,
          });
        }
      }
    }
  }

  for (const m of data.moments) {
    if (!isValidDate(m.date)) {
      warnings.push({
        tab: "moments",
        message: `Invalid date: "${m.date}"`,
      });
    }
  }

  return warnings;
}

// ——— Full Campaign Loader ——————————————————————————————————
export async function fetchCampaignSheetData(
  sheetId: string
): Promise<CampaignSheetData> {
  const [setup, tracks, weeklyData, physicalData, moments] =
    await Promise.all([
      fetchCampaignSetup(sheetId),
      fetchTracks(sheetId),
      fetchWeeklyData(sheetId),
      fetchPhysicalData(sheetId),
      fetchMoments(sheetId),
    ]);

  const data: CampaignSheetData = { setup, tracks, weeklyData, physicalData, moments };

  const warnings = validateSheetData(data);
  if (warnings.length > 0) {
    console.warn(
      `[CTV Validation] ${setup.campaign_name}:\n` +
        warnings.map((w) => `  [${w.tab}] ${w.message}`).join("\n")
    );
  }

  return data;
}

// ——— Registry ——————————————————————————————————————————————
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
