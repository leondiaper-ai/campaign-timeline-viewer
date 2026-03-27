#!/usr/bin/env npx tsx
/**
 * Migration script: Google Sheets → Airtable
 *
 * Reads campaign data from existing Google Sheets, converts it
 * to Airtable format using the adapter, and pushes to the Airtable base.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-airtable.ts
 *
 * Required env vars (loaded from .env.local):
 *   - AIRTABLE_API_KEY: Personal Access Token from https://airtable.com/create/tokens
 *   - AIRTABLE_BASE_ID: Airtable base ID (default: app8JJy12pMmD26Nt)
 *   - GOOGLE_SERVICE_ACCOUNT_EMAIL: (existing — for reading sheets)
 *   - GOOGLE_PRIVATE_KEY: (existing — for reading sheets)
 *   - REGISTRY_SPREADSHEET_ID: (existing — for reading registry)
 *
 * Optional:
 *   - CAMPAIGN_ID: migrate only one campaign (e.g. "james-blake-trying-times")
 *   - DRY_RUN=true: just convert and print stats, don't push to Airtable
 */

// Load .env.local (try dotenv first, fall back to manual parsing)
try {
  require("dotenv").config({ path: ".env.local" });
} catch {
  // Manual .env.local parser if dotenv isn't installed
  const fs = require("fs");
  const envPath = require("path").resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split("\n");
    let key = "", val = "", inMultiline = false;
    for (const line of lines) {
      if (inMultiline) {
        val += "\n" + line;
        if (line.includes('"') && !line.endsWith('\\"')) {
          process.env[key] = val.replace(/^"/, "").replace(/"$/, "").replace(/\\n/g, "\n");
          inMultiline = false;
        }
        continue;
      }
      if (line.startsWith("#") || !line.trim()) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      key = line.substring(0, eq).trim();
      val = line.substring(eq + 1).trim();
      if (val.startsWith('"') && !val.endsWith('"')) {
        inMultiline = true;
        continue;
      }
      process.env[key] = val.replace(/^"/, "").replace(/"$/, "").replace(/\\n/g, "\n");
    }
  }
}

import { fetchActiveCampaigns, fetchCampaignSheetData } from "../src/lib/sheets";
import { campaignSheetToAirtable } from "../src/lib/airtable-adapter";
import type {
  AirtableCampaignData,
  AirtableCampaign,
  AirtableEvent,
  AirtableDailyMetric,
  AirtableTrackMetric,
} from "../src/lib/airtable-schema";

// ═══════════════════════════════════════════════════════════════
// CONFIG — Real Airtable base + table IDs
// ═══════════════════════════════════════════════════════════════
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app8JJy12pMmD26Nt";

const TABLE_IDS = {
  campaigns: "tblU05Yt1y65lvAM7",
  campaignEvents: "tblpYMwUi5oCM8c7X",
  dailyMetrics: "tbloshvu0pHIBg4dR",
  trackDailyMetrics: "tblAz51PtOyVucnrJ",
};

const API_KEY = process.env.AIRTABLE_API_KEY;
if (!API_KEY) {
  console.error("❌ AIRTABLE_API_KEY is required. Create one at https://airtable.com/create/tokens");
  process.exit(1);
}

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// ═══════════════════════════════════════════════════════════════
// Airtable API helpers
// ═══════════════════════════════════════════════════════════════

async function createRecords(tableId: string, records: Record<string, unknown>[]): Promise<void> {
  // Airtable API allows max 10 records per request
  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10));
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const body = {
      records: batch.map((fields) => ({ fields })),
      typecast: true, // Auto-convert strings to selects etc
    };

    const res = await fetch(`${BASE_URL}/${tableId}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable API error (${res.status}): ${err}`);
    }

    // Rate limit: max 5 requests/sec
    if (b < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Field mapping: AirtableSchema → Airtable field names
// ═══════════════════════════════════════════════════════════════

function campaignToFields(c: AirtableCampaign): Record<string, unknown> {
  return {
    campaign_id: c.id,
    artist_name: c.artist_name,
    campaign_name: c.campaign_name,
    release_name: c.release_name,
    campaign_type: c.campaign_type,
    territory_focus: c.territory_focus,
    release_date: c.release_date || null,
    campaign_state: c.campaign_state,
    chart_result: c.chart_result,
    chart_forecast: c.chart_forecast,
    outcome_driver: c.outcome_driver,
    team_push: c.team_push,
    team_support: c.team_support,
    team_next: c.team_next,
    tracks: JSON.stringify(c.tracks, null, 2),
    learnings: JSON.stringify(c.learnings, null, 2),
    notes: c.notes,
    owner: c.owner,
  };
}

function eventToFields(e: AirtableEvent): Record<string, unknown> {
  return {
    campaign_id: e.campaign_id,
    date: e.date || null,
    title: e.title,
    description: e.description,
    event_type: e.event_type,
    channel: e.channel,
    planned_or_live: e.planned_or_live,
    priority: e.priority,
    platform: e.platform,
    territory: e.territory,
    spend: e.spend,
    spend_planned: e.spend_planned,
    intent_total: e.intent_total,
    best_segment: e.best_segment,
    top_track: e.top_track,
    impact_note: e.impact_note,
  };
}

function dailyMetricToFields(m: AirtableDailyMetric): Record<string, unknown> {
  return {
    campaign_id: m.campaign_id,
    date: m.date || null,
    territory: m.territory,
    release_streams: m.release_streams,
    uk_physical: m.uk_physical,
    global_physical: m.global_physical,
    uk_d2c: m.uk_d2c,
    global_d2c: m.global_d2c,
    campaign_spend: m.campaign_spend,
  };
}

function trackMetricToFields(t: AirtableTrackMetric): Record<string, unknown> {
  return {
    campaign_id: t.campaign_id,
    date: t.date || null,
    track_name: t.track_name,
    territory: t.territory,
    streams: t.streams,
  };
}

// ═══════════════════════════════════════════════════════════════
// Main migration
// ═══════════════════════════════════════════════════════════════

/**
 * Delete all records in a table matching a campaign_id filter.
 * Used to clear previous data before re-syncing.
 */
async function clearCampaignRecords(tableId: string, campaignId: string): Promise<number> {
  // First, list records matching the campaign
  const params = new URLSearchParams({
    filterByFormula: `{campaign_id} = '${campaignId}'`,
    pageSize: "100",
  });

  const allIds: string[] = [];
  let offset: string | undefined;

  do {
    if (offset) params.set("offset", offset);
    const res = await fetch(`${BASE_URL}/${tableId}?${params}`, { headers: HEADERS });
    if (!res.ok) break;
    const json = await res.json();
    allIds.push(...json.records.map((r: { id: string }) => r.id));
    offset = json.offset;
  } while (offset);

  // Delete in batches of 10
  for (let i = 0; i < allIds.length; i += 10) {
    const batch = allIds.slice(i, i + 10);
    const params = batch.map((id) => `records[]=${id}`).join("&");
    const res = await fetch(`${BASE_URL}/${tableId}?${params}`, {
      method: "DELETE",
      headers: HEADERS,
    });
    if (!res.ok) {
      console.warn(`      ⚠ Delete batch failed: ${res.status}`);
    }
    if (i + 10 < allIds.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return allIds.length;
}

async function migrate() {
  const targetCampaignId = process.env.CAMPAIGN_ID;
  const clearFirst = process.argv.includes("--clear");
  const dryRun = process.env.DRY_RUN === "true";

  console.log("═══ Airtable Migration ═══\n");
  console.log(`Base: ${AIRTABLE_BASE_ID}`);
  console.log(`Target: ${targetCampaignId || "all campaigns"}`);
  if (clearFirst) console.log(`Mode: CLEAR existing records first`);
  if (dryRun) console.log(`Mode: DRY RUN (no writes)`);
  console.log();

  // Step 1: Fetch registry
  console.log("📋 Fetching campaign registry...");
  const entries = await fetchActiveCampaigns();
  console.log(`   Found ${entries.length} active campaigns.\n`);

  for (const entry of entries) {
    if (targetCampaignId && entry.campaign_id !== targetCampaignId) {
      console.log(`⏭  Skipping ${entry.campaign_id}`);
      continue;
    }

    console.log(`\n🔄 Migrating: ${entry.artist_name} — ${entry.campaign_name}`);
    console.log(`   Sheet ID: ${entry.sheet_id}`);

    // Step 2: Fetch from Google Sheets
    console.log("   📥 Fetching from Google Sheets...");
    const sheet = await fetchCampaignSheetData(entry.sheet_id);

    // Step 3: Convert to Airtable format
    console.log("   🔀 Converting to Airtable format...");
    const data: AirtableCampaignData = campaignSheetToAirtable(entry.campaign_id, sheet);

    console.log(`      Campaign:    1 row`);
    console.log(`      Events:      ${data.events.length} rows`);
    console.log(`      DailyMetrics: ${data.dailyMetrics.length} rows`);
    console.log(`      TrackMetrics: ${data.trackMetrics.length} rows`);

    if (dryRun) {
      console.log("   🏁 DRY RUN — skipping Airtable push.");
      continue;
    }

    // Step 4: Clear existing data if requested
    if (clearFirst) {
      console.log("   🗑  Clearing existing records...");
      for (const [name, tableId] of Object.entries(TABLE_IDS)) {
        const count = await clearCampaignRecords(tableId, entry.campaign_id);
        if (count > 0) console.log(`      ${name}: cleared ${count} records`);
      }
    }

    // Step 5: Push to Airtable
    console.log("   📤 Pushing to Airtable...");

    // Campaign
    console.log("      → Campaigns table...");
    await createRecords(TABLE_IDS.campaigns, [campaignToFields(data.campaign)]);

    // Events
    if (data.events.length > 0) {
      console.log("      → Campaign Events table...");
      await createRecords(
        TABLE_IDS.campaignEvents,
        data.events.map(eventToFields)
      );
    }

    // Daily Metrics
    if (data.dailyMetrics.length > 0) {
      console.log("      → Daily Metrics table...");
      await createRecords(
        TABLE_IDS.dailyMetrics,
        data.dailyMetrics.map(dailyMetricToFields)
      );
    }

    // Track Metrics
    if (data.trackMetrics.length > 0) {
      console.log("      → Track Daily Metrics table...");
      await createRecords(
        TABLE_IDS.trackDailyMetrics,
        data.trackMetrics.map(trackMetricToFields)
      );
    }

    console.log(`   ✅ ${entry.campaign_id} migrated!`);
  }

  console.log("\n═══ Migration Complete ═══");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
