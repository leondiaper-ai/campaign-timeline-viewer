#!/usr/bin/env node
/**
 * Provision a new campaign Google Sheet with all required tabs + headers,
 * then add it to the campaign registry.
 *
 * Usage: node scripts/provision-new-campaign.mjs
 *
 * Reads credentials from .env.local
 */

import { readFileSync } from "fs";
import { google } from "googleapis";

// ——— Load .env.local manually ———
const envText = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (!m) continue;
  let val = m[2].trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  env[m[1]] = val;
}

const SERVICE_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
const REGISTRY_ID = env.REGISTRY_SPREADSHEET_ID;
const EXTERNAL_REGISTRY_ID = "1U8IN-OK4kAXdFNSfoHq9KBqzIQTqPvGB0Wp7aCIFlvM";

if (!SERVICE_EMAIL || !PRIVATE_KEY || !REGISTRY_ID) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

// ——— Auth with write scope ———
const auth = new google.auth.GoogleAuth({
  credentials: { client_email: SERVICE_EMAIL, private_key: PRIVATE_KEY },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});
const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

// ——— Config ———
const CAMPAIGN_ID = "new-campaign-2026";
const SHEET_TITLE = "CTV - New Campaign - 2026";

// All tabs the app reads, with their header rows
const TABS = [
  {
    title: "campaign_setup",
    headers: [
      "campaign_id", "artist_name", "campaign_name", "campaign_type",
      "start_date", "release_date", "default_territory",
      "chart_result", "chart_forecast", "outcome_driver",
      "team_push_push", "team_push_support", "team_push_next",
    ],
    seedRow: [
      CAMPAIGN_ID, "[Artist]", "New Campaign", "album",
      "", "", "UK",
      "", "", "",
      "Lead Single", "Build early signals (save rate, D2C, listener growth)",
      "Scale if save rate + SPL thresholds are met",
    ],
  },
  {
    title: "tracks",
    headers: ["track_name", "track_number", "is_single", "single_order", "release_date"],
  },
  {
    title: "weekly_data",
    headers: [
      "week_start_date", "week_end_date", "track_name",
      "streams_global", "streams_uk", "streams_us",
      "listeners_global", "listeners_uk",
      "saves_global", "saves_uk",
    ],
  },
  {
    title: "physical_data",
    headers: ["week_start_date", "units", "format", "territory"],
  },
  {
    title: "moments",
    headers: ["date", "moment_title", "moment_type", "is_key"],
    seedRows: [
      ["2026-04-07", "Pre-save Launch", "marketing", "TRUE"],
      ["2026-04-21", "Lead Single Release", "music", "TRUE"],
      ["2026-05-05", "D2C Launch", "product", "TRUE"],
      ["2026-05-19", "Bundle / Offer Push", "marketing", "TRUE"],
      ["2026-06-02", "Second Single", "music", "TRUE"],
      ["2026-06-16", "Album Release", "music", "TRUE"],
    ],
  },
  {
    title: "track_daily_import",
    headers: ["date", "track_name", "global_streams", "global_listeners", "global_saves"],
  },
  {
    title: "track_daily_import_territory",
    headers: ["date", "track_name", "territory", "streams", "listeners", "saves"],
  },
  {
    title: "release_daily_import_territory",
    headers: ["date", "territory", "streams"],
  },
  {
    title: "track_uk_context",
    headers: [
      "track_name", "uk_playlist_adds", "uk_radio_spins",
      "uk_shazams", "uk_tiktok_creates", "notes",
    ],
  },
  {
    title: "paid_campaigns",
    headers: [
      "platform", "territory", "campaign_name", "start_date", "end_date",
      "spend", "spend_planned", "impressions", "clicks",
      "intent_total", "best_segment", "top_track",
    ],
  },
  {
    title: "d2c_sales",
    headers: ["date", "global_d2c_sales", "uk_d2c_sales"],
  },
  {
    title: "learnings",
    headers: ["date", "category", "learning", "source", "impact"],
  },
  {
    title: "raw_import_release_territory",
    headers: ["release_name", "territory", "date", "streams"],
  },
];

async function main() {
  console.log("Creating new Google Sheet:", SHEET_TITLE);

  // 1. Create the spreadsheet with all tabs
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SHEET_TITLE },
      sheets: TABS.map((tab, i) => ({
        properties: {
          title: tab.title,
          index: i,
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    },
  });

  const newSheetId = createRes.data.spreadsheetId;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;
  console.log("Created:", sheetUrl);

  // 2. Write headers (and seed data) to each tab
  const valueRanges = [];
  for (const tab of TABS) {
    const rows = [tab.headers];
    if (tab.seedRow) rows.push(tab.seedRow);
    if (tab.seedRows) rows.push(...tab.seedRows);
    valueRanges.push({
      range: `${tab.title}!A1`,
      values: rows,
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: newSheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: valueRanges,
    },
  });
  console.log("Headers + seed data written to all", TABS.length, "tabs");

  // 3. Make the sheet accessible (share with anyone who has the link as editor)
  await drive.permissions.create({
    fileId: newSheetId,
    requestBody: {
      role: "writer",
      type: "anyone",
    },
  });
  console.log("Sheet shared (anyone with link can edit)");

  // 4. Add to app's internal campaign registry
  const registryRow = [
    CAMPAIGN_ID,              // campaign_id
    "[Artist]",               // artist_name
    "New Campaign",           // campaign_name
    sheetUrl,                 // sheet_url
    newSheetId,               // sheet_id
    "draft",                  // status (draft until ready)
    "Leon",                   // campaign_owner
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: REGISTRY_ID,
    range: "campaign_registry!A:G",
    valueInputOption: "RAW",
    requestBody: { values: [registryRow] },
  });
  console.log("Added to app registry as 'draft'");

  // 5. Add to external CAMPAIGN REGISTRY sheet
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: EXTERNAL_REGISTRY_ID,
      range: "Sheet1!A:G",
      valueInputOption: "RAW",
      requestBody: { values: [registryRow] },
    });
    console.log("Added to external CAMPAIGN REGISTRY");
  } catch (err) {
    console.warn("Could not write to external registry (may need sharing):", err.message);
    console.log("External registry ID:", EXTERNAL_REGISTRY_ID);
    console.log("Please add manually if needed.");
  }

  console.log("\n✅ Done!");
  console.log("Sheet ID:", newSheetId);
  console.log("Sheet URL:", sheetUrl);
  console.log("\nTo activate: change status from 'draft' to 'active' in the registry.");
  console.log("The /campaign/new page will be updated to read from this sheet.");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
