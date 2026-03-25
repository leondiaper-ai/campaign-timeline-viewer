// Run: node debug-territory.js
const fs = require("fs");
const envFile = fs.readFileSync(".env.local", "utf8");
envFile.split("\n").forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]] = val;
  }
});
const { google } = require("googleapis");

function cleanTerritory(raw) {
  const val = (raw || "global").trim().toLowerCase();
  if (val === "uk" || val === "gb" || val === "united kingdom" || val === "great britain") return "UK";
  return "global";
}
function safeNumber(val) {
  if (!val) return 0;
  const cleaned = val.replace(/[,%]/g, "").trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const reg = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.REGISTRY_SPREADSHEET_ID,
    range: "campaign_registry!A2:G",
  });
  const entries = (reg.data.values || []).filter((r) => r[5] === "active");

  for (const entry of entries) {
    const sheetId = entry[4];
    console.log(`\n========== ${entry[2]} ==========`);

    // Simulate what the updated code would produce from track_metrics
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "'track_metrics'!A1:Z",
      });
      const all = resp.data.values || [];
      const header = (all[0] || []).map(h => (h || "").trim().toLowerCase());
      const rows = all.slice(1);

      console.log("[track_metrics] Headers:", header);
      console.log("[track_metrics] Total rows:", rows.length);

      const dateCol = Math.max(0, header.findIndex(c => c.includes("week") || c === "date"));
      const terrCol = header.findIndex(c => c.includes("territory"));
      const trackCol = Math.max(0, header.findIndex(c => c.includes("track")));
      const streamsCol = Math.max(0, header.findIndex(c => c.includes("streams")));

      console.log(`  Column indices: date=${dateCol} territory=${terrCol} track=${trackCol} streams=${streamsCol}`);

      // Simulate DailyTrackRow (global)
      const globalRows = rows.filter(r => {
        const terr = terrCol >= 0 ? cleanTerritory(r[terrCol]) : "global";
        return terr === "global" && safeNumber(r[streamsCol]) > 0;
      });
      const globalDates = [...new Set(globalRows.map(r => r[dateCol]))].sort();
      console.log(`\n  Global track rows: ${globalRows.length}`);
      console.log(`  Global date range: ${globalDates[0]} -> ${globalDates[globalDates.length - 1]} (${globalDates.length} dates)`);
      console.log(`  Global tracks: ${[...new Set(globalRows.map(r => r[trackCol]))]}`);

      // Simulate DailyTerritoryRow (UK)
      const ukRows = rows.filter(r => {
        const terr = terrCol >= 0 ? cleanTerritory(r[terrCol]) : "global";
        return terr === "UK" && safeNumber(r[streamsCol]) > 0;
      });
      const ukDates = [...new Set(ukRows.map(r => r[dateCol]))].sort();
      console.log(`\n  UK track rows: ${ukRows.length}`);
      console.log(`  UK date range: ${ukDates[0]} -> ${ukDates[ukDates.length - 1]} (${ukDates.length} dates)`);
      console.log(`  UK tracks: ${[...new Set(ukRows.map(r => r[trackCol]))]}`);

      // Show sample parsed data
      console.log(`\n  First 3 global:`, globalRows.slice(0, 3).map(r => ({ date: r[dateCol], track: r[trackCol], streams: r[streamsCol] })));
      console.log(`  First 3 UK:`, ukRows.slice(0, 3).map(r => ({ date: r[dateCol], track: r[trackCol], streams: r[streamsCol] })));

    } catch (e) {
      console.log("[track_metrics] Error:", e.message?.slice(0, 100));
    }

    // Also check weekly_metrics parsing
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "'weekly_metrics'!A1:Z",
      });
      const all = resp.data.values || [];
      const header = (all[0] || []).map(h => (h || "").trim().toLowerCase());
      const rows = all.slice(1);

      console.log(`\n[weekly_metrics] Headers: ${header}`);
      const dateCol = Math.max(0, header.findIndex(c => c.includes("week")));
      const terrCol = header.findIndex(c => c.includes("territory"));
      const streamsCol = Math.max(0, header.findIndex(c => c.includes("streams")));
      const retailCol = header.findIndex(c => c.includes("retail"));
      const d2cCol = header.findIndex(c => c.includes("d2c"));

      const ukWeekly = rows.filter(r => terrCol >= 0 && cleanTerritory(r[terrCol]) === "UK");
      console.log(`  UK weekly rows: ${ukWeekly.length}`);
      console.log(`  UK weekly dates: ${ukWeekly.map(r => r[dateCol]).sort()}`);
      console.log(`  UK physical (retail+d2c): ${ukWeekly.map(r => ({
        date: r[dateCol],
        retail: r[retailCol >= 0 ? retailCol : "?"],
        d2c: r[d2cCol >= 0 ? d2cCol : "?"],
      }))}`);

    } catch (e) {
      console.log("[weekly_metrics] Error:", e.message?.slice(0, 100));
    }
  }
}

main().catch(console.error);
