import { google } from "googleapis";
import {
  Campaign,
  WeeklyMetric,
  CampaignEvent,
  TrackWeeklyMetric,
  SingleCampaignData,
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
 * Safe fetch that returns empty array if the tab doesn't exist.
 * Used for optional tabs like track_metrics.
 */
async function fetchRowsSafe(
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  try {
    return await fetchRows(spreadsheetId, tabName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Tab doesn't exist or is inaccessible — that's fine
    if (msg.includes("Unable to parse range") || msg.includes("not found")) {
      console.log(`Tab "${tabName}" not found — skipping.`);
      return [];
    }
    throw err;
  }
}

// ─── Validation Helpers ─────────────────────────────────────────

const VALID_TERRITORIES = new Set(["global", "UK"]);
const VALID_EVENT_TYPES = new Set(["music", "marketing", "editorial", "product", "live"]);

function cleanTerritory(raw) {
  const val = (raw || "global").trim().toLowerCase();
  if (val === "uk") return "UK";
  if (VALID_TERRITORIES.has(val)) return val;
  return "global";
}

function cleanEventType(raw) {
  const val = (raw || "music").trim().toLowerCase();
  // Map common aliases
  if (val === "release" || val === "single" || val === "album") return "music";
  if (val === "press" || val === "pr" || val === "review") return "editorial";
  if (val === "merch" || val === "vinyl" || val === "physical") return "product";
  if (val === "tour" || val === "gig" || val === "concert" || val === "festival") return "live";
  if (val === "ad" || val === "paid" || val === "social" || val === "promo") return "marketing";
  if (VALID_EVENT_TYPES.has(val)) return val;
  return "music"; // safe fallback
}

function safeNumber(val) {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function isValidDate(val) {
  if (!val) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}
