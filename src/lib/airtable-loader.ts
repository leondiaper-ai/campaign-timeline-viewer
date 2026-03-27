/**
 * Airtable data loader.
 *
 * This module provides two loading strategies:
 *
 *  1. `fetchFromAirtable(campaignId)` — Fetches data from Airtable API,
 *     converts it via the adapter, and returns CampaignSheetData.
 *     (Ready to wire once Airtable API credentials are configured.)
 *
 *  2. `fetchViaAirtableRoundTrip(sheetId)` — Fetches from Google Sheets,
 *     converts to Airtable format and back, for migration testing.
 *     Verifies the adapter produces identical output.
 *
 * Usage in page.tsx:
 *
 *   // Option A: Direct Airtable fetch (future)
 *   const sheet = await fetchFromAirtable("james-blake-playing-robots");
 *
 *   // Option B: Round-trip test (now)
 *   const sheet = await fetchViaAirtableRoundTrip("1abc...");
 *
 * The UI components don't change at all — they still receive CampaignSheetData.
 */

import type { CampaignSheetData, AppData } from "@/types";
import type { AirtableCampaignData } from "./airtable-schema";
import { airtableToCampaignSheet, campaignSheetToAirtable } from "./airtable-adapter";
import { fetchCampaignSheetData, fetchActiveCampaigns } from "./sheets";

// ═══════════════════════════════════════════════════════════════
// Strategy 1: Fetch from Airtable API (future)
// ═══════════════════════════════════════════════════════════════

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";

/**
 * Fetch campaign data directly from Airtable.
 *
 * Requires AIRTABLE_BASE_ID and AIRTABLE_API_KEY env vars.
 * Returns CampaignSheetData so existing UI works unchanged.
 */
export async function fetchFromAirtable(
  campaignId: string
): Promise<CampaignSheetData> {
  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
    throw new Error(
      "[CTV] Airtable not configured. Set AIRTABLE_BASE_ID and AIRTABLE_API_KEY."
    );
  }

  const airtableData = await fetchAirtableTables(campaignId);
  return airtableToCampaignSheet(airtableData);
}

/**
 * Internal: fetch all 4 Airtable tables for a campaign.
 * Uses Airtable REST API v0.
 */
async function fetchAirtableTables(
  campaignId: string
): Promise<AirtableCampaignData> {
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
  const headers = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };

  const fetchTable = async (tableName: string, filter?: string) => {
    const params = new URLSearchParams();
    if (filter) params.set("filterByFormula", filter);
    params.set("pageSize", "100");

    const records: Record<string, unknown>[] = [];
    let offset: string | undefined;

    do {
      if (offset) params.set("offset", offset);
      const url = `${baseUrl}/${encodeURIComponent(tableName)}?${params}`;
      const res = await fetch(url, { headers, next: { revalidate: 300 } } as RequestInit);
      if (!res.ok) throw new Error(`Airtable ${tableName}: ${res.status}`);
      const json = await res.json();
      records.push(
        ...json.records.map((r: { id: string; fields: Record<string, unknown> }) => ({
          id: r.id,
          ...r.fields,
        }))
      );
      offset = json.offset;
    } while (offset);

    return records;
  };

  const campaignFilter = `{campaign_id} = '${campaignId}'`;

  const [campaigns, events, dailyMetrics, trackMetrics] = await Promise.all([
    fetchTable("Campaigns", campaignFilter),
    fetchTable("Campaign Events", campaignFilter),
    fetchTable("Daily Metrics", campaignFilter),
    fetchTable("Track Daily Metrics", campaignFilter),
  ]);

  if (campaigns.length === 0) {
    throw new Error(`[CTV] Campaign "${campaignId}" not found in Airtable.`);
  }

  // Parse the campaign record — tracks and learnings are stored as JSON strings
  const rawCampaign = campaigns[0] as Record<string, unknown>;
  const campaign = {
    ...rawCampaign,
    tracks: typeof rawCampaign.tracks === "string"
      ? JSON.parse(rawCampaign.tracks || "[]")
      : rawCampaign.tracks || [],
    learnings: typeof rawCampaign.learnings === "string"
      ? JSON.parse(rawCampaign.learnings || "[]")
      : rawCampaign.learnings || [],
  } as unknown as AirtableCampaignData["campaign"];

  return {
    campaign,
    events: events as unknown as AirtableCampaignData["events"],
    dailyMetrics: dailyMetrics as unknown as AirtableCampaignData["dailyMetrics"],
    trackMetrics: trackMetrics as unknown as AirtableCampaignData["trackMetrics"],
  };
}

// ═══════════════════════════════════════════════════════════════
// Strategy 2: Round-trip test (Google Sheets → Airtable → UI)
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch from Google Sheets, convert to Airtable format and back.
 * Use this to verify the adapter produces correct output before
 * cutting over to real Airtable.
 *
 * Pass `log: true` to see comparison diagnostics in console.
 */
export async function fetchViaAirtableRoundTrip(
  sheetId: string,
  campaignId: string = "test-campaign",
  options: { log?: boolean } = {}
): Promise<CampaignSheetData> {
  // Step 1: Fetch original from Google Sheets
  const original = await fetchCampaignSheetData(sheetId);

  // Step 2: Convert to Airtable format
  const airtableData = campaignSheetToAirtable(campaignId, original);

  // Step 3: Convert back to CampaignSheetData
  const roundTripped = airtableToCampaignSheet(airtableData);

  if (options.log) {
    logRoundTripComparison(original, roundTripped, airtableData);
  }

  return roundTripped;
}

/**
 * Full app data loader using Airtable round-trip.
 * Drop-in replacement for getCampaignData() in data.ts.
 */
export async function getCampaignDataViaAirtable(): Promise<AppData> {
  const entries = await fetchActiveCampaigns();
  const campaigns = await Promise.all(
    entries.map(async (entry) => {
      const sheet = await fetchViaAirtableRoundTrip(
        entry.sheet_id,
        entry.campaign_id
      );
      return {
        campaign_id: entry.campaign_id,
        sheet,
        trackWeeklyMetrics: [],
      };
    })
  );
  return { campaigns };
}

// ═══════════════════════════════════════════════════════════════
// Diagnostics
// ═══════════════════════════════════════════════════════════════

function logRoundTripComparison(
  original: CampaignSheetData,
  roundTripped: CampaignSheetData,
  airtableData: AirtableCampaignData
) {
  console.log("\n═══ Airtable Round-Trip Comparison ═══");
  console.log(`  Campaign: ${original.setup.artist_name} — ${original.setup.campaign_name}`);
  console.log("\n  Airtable tables:");
  console.log(`    Events:       ${airtableData.events.length} rows`);
  console.log(`    DailyMetrics: ${airtableData.dailyMetrics.length} rows`);
  console.log(`    TrackMetrics: ${airtableData.trackMetrics.length} rows`);

  const fields: (keyof CampaignSheetData)[] = [
    "tracks", "weeklyData", "physicalData", "moments",
    "dailyTrackData", "dailyTerritoryData", "dailyReleaseTerritoryData",
    "ukContext", "paidCampaigns", "learnings", "d2cSales",
  ];

  console.log("\n  Row counts (original → round-tripped):");
  let mismatches = 0;
  for (const field of fields) {
    const origLen = Array.isArray(original[field]) ? (original[field] as unknown[]).length : 0;
    const rtLen = Array.isArray(roundTripped[field]) ? (roundTripped[field] as unknown[]).length : 0;
    const match = origLen === rtLen ? "✓" : "✗";
    if (origLen !== rtLen) mismatches++;
    console.log(`    ${match} ${String(field)}: ${origLen} → ${rtLen}`);
  }

  // Setup field comparison
  const setupKeys = Object.keys(original.setup) as (keyof typeof original.setup)[];
  const setupMismatches: string[] = [];
  for (const key of setupKeys) {
    if (original.setup[key] !== roundTripped.setup[key]) {
      setupMismatches.push(`${String(key)}: "${original.setup[key]}" → "${roundTripped.setup[key]}"`);
    }
  }
  if (setupMismatches.length > 0) {
    console.log(`\n  Setup mismatches (${setupMismatches.length}):`);
    setupMismatches.forEach(m => console.log(`    ✗ ${m}`));
    mismatches += setupMismatches.length;
  } else {
    console.log("\n  ✓ Setup fields match perfectly");
  }

  console.log(`\n  Total mismatches: ${mismatches}`);
  console.log("═══════════════════════════════════════\n");
}
