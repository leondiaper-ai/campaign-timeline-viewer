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
  DailyTrackRow,
  DailyTerritoryRow,
  DailyReleaseTerritoryRow,
  UKContextRow,
  PaidCampaignRow,
  ManualLearning,
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

/** Fetch including header row (A1:Z) — returns { header, rows } */
async function fetchWithHeader(
  spreadsheetId: string,
  tabName: string
): Promise<{ header: string[]; rows: string[][] }> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A1:Z`,
  });
  const all = (response.data.values as string[][]) || [];
  return { header: (all[0] || []).map(h => (h || "").trim().toLowerCase()), rows: all.slice(1) };
}

async function fetchWithHeaderSafe(
  spreadsheetId: string,
  tabName: string
): Promise<{ header: string[]; rows: string[][] } | null> {
  try {
    return await fetchWithHeader(spreadsheetId, tabName);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unable to parse range") || msg.includes("not found")) {
      return null;
    }
    throw err;
  }
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
  const cleaned = val.replace(/[,%]/g, "").trim();
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
  if (val === "uk" || val === "gb" || val === "united kingdom" || val === "great britain") return "UK";
  return "global";
}

function cleanCampaignType(raw: string | undefined): CampaignType {
  const val = (raw || "album").trim().toLowerCase();
  if (val === "single") return "single";
  return "album";
}

/**
 * Normalize smart/curly quotes to straight ASCII quotes.
 * Google Sheets often uses Unicode quotation marks which cause mismatches.
 */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\uFF07]/g, "'")   // smart single quotes → '
    .replace(/[\u201C\u201D\u201E\uFF02]/g, '"')   // smart double quotes → "
    .replace(/[\u2013\u2014]/g, "-");                 // em/en dashes → -
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
  const data = await fetchWithHeaderSafe(sheetId, "campaign_setup");
  if (!data || data.rows.length === 0) {
    console.warn("[CTV] campaign_setup tab is empty — using defaults.");
    return {
      campaign_name: "Untitled Campaign",
      artist_name: "Unknown Artist",
      campaign_type: "album",
      release_date: "",
      default_territory: "global",
      chart_result: "",
      chart_forecast: "",
      outcome_driver: "",
      team_push_push: "",
      team_push_support: "",
      team_push_next: "",
    };
  }
  const h = data.header;
  const r = data.rows[0];

  // Column-name lookup (handles both old positional and new named formats)
  const col = (name: string): string => {
    const i = h.findIndex(c => c === name || c.replace(/[_\s]/g, "") === name.replace(/[_\s]/g, ""));
    return i >= 0 ? (r[i] || "").trim() : "";
  };

  // Detect format: new sheets have "campaign_id" in col 0
  const isNewFormat = h[0] === "campaign_id";

  if (isNewFormat) {
    // New format: campaign_id, artist_name, campaign_name, start_date, release_date, default_territory, (blank), track_list
    return {
      campaign_name: normalizeQuotes(col("campaign_name") || "Untitled Campaign"),
      artist_name: col("artist_name") || "Unknown Artist",
      campaign_type: cleanCampaignType(col("campaign_type")),
      release_date: isValidDate(col("release_date")) ? col("release_date") : (isValidDate(col("start_date")) ? col("start_date") : ""),
      default_territory: cleanTerritory(col("default_territory")),
      chart_result: col("chart_result"),
      chart_forecast: col("chart_forecast"),
      outcome_driver: col("outcome_driver"),
      team_push_push: col("team_push_push"),
      team_push_support: col("team_push_support"),
      team_push_next: col("team_push_next"),
    };
  }

  // Legacy positional format (use col() for newer fields that may exist as named headers)
  return {
    campaign_name: normalizeQuotes((r[0] || "Untitled Campaign").trim()),
    artist_name: (r[1] || "Unknown Artist").trim(),
    campaign_type: cleanCampaignType(r[2]),
    release_date: isValidDate(r[3]) ? r[3].trim() : "",
    default_territory: cleanTerritory(r[4]),
    chart_result: (r[5] || "").trim(),
    chart_forecast: (r[6] || "").trim(),
    outcome_driver: (r[7] || "").trim(),
    team_push_push: col("team_push_push"),
    team_push_support: col("team_push_support"),
    team_push_next: col("team_push_next"),
  };
}

async function fetchTracks(sheetId: string): Promise<Track[]> {
  // Try legacy tab first
  const rows = await fetchRowsSafe(sheetId, "tracks");
  if (rows.length > 0) {
    return rows
      .filter((r) => r[0]?.trim() && !isMetadataRow(r[0]))
      .map((r, i) => ({
        track_name: normalizeQuotes(r[0].trim()),
        track_role: cleanTrackRole(r[1]),
        release_date: isValidDate(r[2]) ? r[2].trim() : "",
        default_on: parseBool(r[3], false),
        sort_order: safeNumber(r[4]) || i + 1,
      }));
  }

  // New format: infer tracks from track_metrics tab (unique track names)
  const tmData = await fetchWithHeaderSafe(sheetId, "track_metrics");
  if (tmData && tmData.rows.length > 0) {
    const trackCol = Math.max(0, tmData.header.findIndex(c => c.includes("track")));
    const seen = new Set<string>();
    const tracks: Track[] = [];
    for (const r of tmData.rows) {
      const name = normalizeQuotes((r[trackCol] || "").trim());
      if (name && !seen.has(name)) {
        seen.add(name);
        tracks.push({
          track_name: name,
          track_role: "album_track",
          release_date: "",
          default_on: true,
          sort_order: tracks.length + 1,
        });
      }
    }
    if (tracks.length > 0) return tracks;
  }

  console.warn("[CTV] No track data found.");
  return [];
}

async function fetchWeeklyData(sheetId: string): Promise<WeeklyRow[]> {
  // Try legacy tabs first
  for (const tab of ["weekly_data_compat", "weekly_data"]) {
    const rows = await fetchRowsSafe(sheetId, tab);
    if (rows.length > 0) {
      return rows
        .filter((r) => r[0] && isValidDate(r[0]) && r[1]?.trim() && !isMetadataRow(r[0]) && !isMetadataRow(r[1]))
        .map((r) => ({
          week_start_date: r[0].trim(),
          track_name: normalizeQuotes(r[1].trim()),
          streams_global: safeNumber(r[2]),
          streams_uk: safeNumber(r[3]),
        }));
    }
  }

  // New format: weekly_metrics — territory as rows, need to pivot
  // Headers: week_ending, territory, total_streams, retail_units, d2c_units
  const data = await fetchWithHeaderSafe(sheetId, "weekly_metrics");
  if (!data || data.rows.length === 0) {
    console.warn("[CTV] No weekly data found.");
    return [];
  }

  const h = data.header;
  const dateCol = h.findIndex(c => c.includes("week"));
  const terrCol = h.findIndex(c => c.includes("territory"));
  const streamsCol = h.findIndex(c => c.includes("total_streams") || c.includes("streams"));

  if (dateCol < 0 || streamsCol < 0) {
    console.warn("[CTV] weekly_metrics missing required columns.");
    return [];
  }

  // Group by date, pivot territory into columns
  const byDate = new Map<string, { global: number; uk: number }>();
  for (const r of data.rows) {
    const date = (r[dateCol] || "").trim();
    if (!isValidDate(date)) continue;
    const terr = terrCol >= 0 ? cleanTerritory(r[terrCol]) : "global";
    const streams = safeNumber(r[streamsCol]);
    if (!byDate.has(date)) byDate.set(date, { global: 0, uk: 0 });
    const entry = byDate.get(date)!;
    if (terr === "UK") entry.uk = streams;
    else entry.global = streams;
  }

  return [...byDate.entries()].map(([date, v]) => ({
    week_start_date: date,
    track_name: "TOTAL",
    streams_global: v.global,
    streams_uk: v.uk,
  }));
}

async function fetchPhysicalData(sheetId: string): Promise<PhysicalRow[]> {
  // Try legacy tab first
  const rows = await fetchRowsSafe(sheetId, "physical_data");
  if (rows.length > 0) {
    return rows
      .filter((r) => r[0] && isValidDate(r[0]))
      .map((r) => ({
        week_start_date: r[0].trim(),
        units: safeNumber(r[1]),
      }));
  }

  // New format: extract retail_units + d2c_units from weekly_metrics (UK rows only)
  const data = await fetchWithHeaderSafe(sheetId, "weekly_metrics");
  if (!data || data.rows.length === 0) return [];

  const h = data.header;
  const dateCol = h.findIndex(c => c.includes("week"));
  const terrCol = h.findIndex(c => c.includes("territory"));
  const retailCol = h.findIndex(c => c.includes("retail"));
  const d2cCol = h.findIndex(c => c.includes("d2c"));

  if (dateCol < 0 || (retailCol < 0 && d2cCol < 0)) return [];

  const result: PhysicalRow[] = [];
  for (const r of data.rows) {
    const date = (r[dateCol] || "").trim();
    if (!isValidDate(date)) continue;
    // Use UK rows for physical (UK chart position)
    const terr = terrCol >= 0 ? cleanTerritory(r[terrCol]) : "global";
    if (terr !== "UK") continue;
    const retail = retailCol >= 0 ? safeNumber(r[retailCol]) : 0;
    const d2c = d2cCol >= 0 ? safeNumber(r[d2cCol]) : 0;
    const units = retail + d2c;
    if (units > 0) result.push({ week_start_date: date, units });
  }
  return result;
}

async function fetchMoments(sheetId: string): Promise<Moment[]> {
  // Try new format first (header-based), then legacy
  for (const tab of ["campaign_moments", "moments"]) {
    const data = await fetchWithHeaderSafe(sheetId, tab);
    if (!data || data.rows.length === 0) continue;

    const h = data.header;
    // Detect new format by checking for known column names
    const hasNamedCols = h.includes("date") || h.includes("event_title") || h.includes("is_core_moment");

    if (hasNamedCols) {
      const dateCol = Math.max(0, h.findIndex(c => c === "date"));
      const titleCol = Math.max(0, h.findIndex(c => c.includes("title") || c.includes("event_title") || c.includes("moment_title")));
      const typeCol = h.findIndex(c => c === "event_type" || c === "moment_type");
      // is_key: prefer is_core_moment, fall back to show_on_chart, then is_key
      const keyCol = h.findIndex(c => c === "is_core_moment" || c === "show_on_chart" || c === "is_key");

      return data.rows
        .filter((r) => r[dateCol] && isValidDate(r[dateCol]) && !isMetadataRow(r[dateCol]))
        .map((r) => ({
          date: r[dateCol].trim(),
          moment_title: normalizeQuotes((r[titleCol >= 0 ? titleCol : 1] || "Untitled moment").trim()),
          moment_type: (r[typeCol >= 0 ? typeCol : 2] || "music").trim().toLowerCase(),
          is_key: parseBool(r[keyCol >= 0 ? keyCol : 3], false),
        }));
    }

    // Legacy positional format
    return data.rows
      .filter((r) => r[0] && isValidDate(r[0]) && !isMetadataRow(r[0]))
      .map((r) => ({
        date: r[0].trim(),
        moment_title: normalizeQuotes((r[1] || "Untitled moment").trim()),
        moment_type: (r[2] || "music").trim().toLowerCase(),
        is_key: parseBool(r[3], false),
      }));
  }

  console.warn("[CTV] No moments tab found.");
  return [];
}

/** Tab: track_daily_import — per-track global streams (columns: date, track_name, streams) */
async function fetchTrackDailyImport(sheetId: string): Promise<DailyTrackRow[]> {
  const rows = await fetchRowsSafe(sheetId, "track_daily_import");
  if (rows.length > 0) {
    return rows
      .filter((r) => r[0] && isValidDate(r[0]) && r[1]?.trim() && !isMetadataRow(r[0]))
      .map((r) => ({
        date: r[0].trim(),
        track_name: normalizeQuotes(r[1].trim()),
        global_streams: safeNumber(r[2]),
      }))
      .filter((r) => r.global_streams > 0);
  }

  // Fallback: track_metrics — extract global rows
  const data = await fetchWithHeaderSafe(sheetId, "track_metrics");
  if (!data || data.rows.length === 0) return [];

  const h = data.header;
  const dateCol = Math.max(0, h.findIndex(c => c.includes("week") || c === "date"));
  const terrCol = h.findIndex(c => c.includes("territory"));
  const trackCol = Math.max(0, h.findIndex(c => c.includes("track")));
  const streamsCol = Math.max(0, h.findIndex(c => c.includes("streams")));

  return data.rows
    .filter((r) => {
      const date = (r[dateCol] || "").trim();
      const terr = terrCol >= 0 ? cleanTerritory(r[terrCol]) : "global";
      return isValidDate(date) && terr === "global" && safeNumber(r[streamsCol]) > 0;
    })
    .map((r) => ({
      date: r[dateCol].trim(),
      track_name: normalizeQuotes((r[trackCol] || "").trim()),
      global_streams: safeNumber(r[streamsCol]),
    }))
    .filter((r) => r.track_name.length > 0);
}

/** Tab: track_daily_import_territory — per-track territory streams (columns: date, track_name, territory, streams) */
async function fetchTrackDailyImportTerritory(sheetId: string): Promise<DailyTerritoryRow[]> {
  const rows = await fetchRowsSafe(sheetId, "track_daily_import_territory");
  if (rows.length > 0) {
    return rows
      .filter((r) => r[0] && isValidDate(r[0]) && r[1]?.trim() && !isMetadataRow(r[0]))
      .map((r) => ({
        date: r[0].trim(),
        track_name: normalizeQuotes(r[1].trim()),
        territory: cleanTerritory(r[2]),
        streams: safeNumber(r[3]),
      }))
      .filter((r) => r.streams > 0);
  }

  // Fallback: track_metrics — extract non-global rows as territory data
  const data = await fetchWithHeaderSafe(sheetId, "track_metrics");
  if (!data || data.rows.length === 0) return [];

  const h = data.header;
  const dateCol = Math.max(0, h.findIndex(c => c.includes("week") || c === "date"));
  const terrCol = h.findIndex(c => c.includes("territory"));
  const trackCol = Math.max(0, h.findIndex(c => c.includes("track")));
  const streamsCol = Math.max(0, h.findIndex(c => c.includes("streams")));

  if (terrCol < 0) return []; // No territory column = no territory data

  return data.rows
    .filter((r) => {
      const date = (r[dateCol] || "").trim();
      const terr = cleanTerritory(r[terrCol]);
      return isValidDate(date) && terr !== "global" && safeNumber(r[streamsCol]) > 0;
    })
    .map((r) => ({
      date: r[dateCol].trim(),
      track_name: normalizeQuotes((r[trackCol] || "").trim()),
      territory: cleanTerritory(r[terrCol]),
      streams: safeNumber(r[streamsCol]),
    }))
    .filter((r) => r.track_name.length > 0);
}

/** Tab: release_daily_import_territory — release-level territory streams (columns: date, release_name, territory, streams) */
async function fetchReleaseDailyImportTerritory(sheetId: string): Promise<DailyReleaseTerritoryRow[]> {
  const rows = await fetchRowsSafe(sheetId, "release_daily_import_territory");
  if (rows.length === 0) return [];
  return rows
    .filter((r) => r[0] && isValidDate(r[0]) && r[1]?.trim() && !isMetadataRow(r[0]))
    .map((r) => ({
      date: r[0].trim(),
      release_name: normalizeQuotes(r[1].trim()),
      territory: cleanTerritory(r[2]),
      streams: safeNumber(r[3]),
    }))
    .filter((r) => r.streams > 0);
}

/** Tab: track_uk_context — manual UK context */
async function fetchTrackUKContext(sheetId: string): Promise<UKContextRow[]> {
  const rows = await fetchRowsSafe(sheetId, "track_uk_context");
  if (rows.length === 0) return [];
  return rows
    .filter((r) => r[0]?.trim() && !isMetadataRow(r[0]))
    .map((r) => ({
      track_name: normalizeQuotes(r[0].trim()),
      period_start: isValidDate(r[1]) ? r[1].trim() : "",
      period_end: isValidDate(r[2]) ? r[2].trim() : "",
      uk_streams: safeNumber(r[3]),
      uk_share: (r[4] || "").trim(),
      note: (r[5] || "").trim(),
    }));
}

/** Tab: paid_campaigns — paid campaign performance (Marquee / Showcase) */
async function fetchPaidCampaigns(sheetId: string): Promise<PaidCampaignRow[]> {
  const rows = await fetchRowsSafe(sheetId, "paid_campaigns");
  if (rows.length === 0) return [];
  return rows
    .filter((r) => r[0]?.trim() && r[1]?.trim() && !isMetadataRow(r[0]))
    .map((r) => ({
      campaign_name: normalizeQuotes(r[0].trim()),
      platform: (r[1] || "").trim(),
      territory: (r[2] || "").trim(),
      start_date: isValidDate(r[3]) ? r[3].trim() : "",
      spend: safeNumber(r[4]),
      spend_planned: safeNumber(r[5]),
      intent_total: safeNumber(r[6]),
      intent_super: safeNumber(r[7]),
      intent_moderate: safeNumber(r[8]),
      best_segment: (r[9] || "").trim(),
      top_track: normalizeQuotes((r[10] || "").trim()),
      campaign_objective: (r[11] || "").trim(),
      notes: (r[12] || "").trim(),
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

/** Tab: campaign_learnings — manual editorial learnings (columns: campaign, type, text, order) */
async function fetchLearnings(sheetId: string): Promise<ManualLearning[]> {
  const data = await fetchWithHeaderSafe(sheetId, "campaign_learnings");
  if (!data || data.rows.length === 0) return [];

  const h = data.header;
  const typeCol = Math.max(0, h.findIndex(c => c === "type"));
  const textCol = Math.max(0, h.findIndex(c => c === "text"));
  const orderCol = h.findIndex(c => c === "order");

  return data.rows
    .filter(r => r[textCol]?.trim())
    .map(r => {
      const rawType = (r[typeCol] || "").trim().toLowerCase();
      const type: ManualLearning["type"] =
        rawType === "worked" ? "worked" :
        rawType === "didnt" || rawType === "didn't" ? "didnt" :
        "next";
      return {
        type,
        text: r[textCol].trim(),
        order: orderCol >= 0 ? safeNumber(r[orderCol]) : 0,
      };
    })
    .sort((a, b) => a.order - b.order);
}

// ——— Full Campaign Loader ——————————————————————————————————
export async function fetchCampaignSheetData(
  sheetId: string
): Promise<CampaignSheetData> {
  const [setup, tracks, weeklyData, physicalData, moments, dailyTrackData, dailyTerritoryData, dailyReleaseTerritoryData, ukContext, paidCampaigns, learnings] =
    await Promise.all([
      fetchCampaignSetup(sheetId),
      fetchTracks(sheetId),
      fetchWeeklyData(sheetId),
      fetchPhysicalData(sheetId),
      fetchMoments(sheetId),
      fetchTrackDailyImport(sheetId),
      fetchTrackDailyImportTerritory(sheetId),
      fetchReleaseDailyImportTerritory(sheetId),
      fetchTrackUKContext(sheetId),
      fetchPaidCampaigns(sheetId),
      fetchLearnings(sheetId),
    ]);

  const data: CampaignSheetData = { setup, tracks, weeklyData, physicalData, moments, dailyTrackData, dailyTerritoryData, dailyReleaseTerritoryData, ukContext, paidCampaigns, learnings };

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

