// Run: node debug-tracks.js
// Simulates the full data pipeline to find where UK track data is lost
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
function normalizeQuotes(text) {
  return text
    .replace(/[\u2018\u2019\u201A\uFF07]/g, "'")
    .replace(/[\u201C\u201D\u201E\uFF02]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
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
  const entry = entries[0]; // James Blake
  const sheetId = entry[4];

  console.log(`\n========== ${entry[2]} ==========`);

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'track_metrics'!A1:Z",
  });
  const all = resp.data.values || [];
  const header = (all[0] || []).map(h => (h || "").trim().toLowerCase());
  const rows = all.slice(1);

  const dateCol = 0, terrCol = 1, trackCol = 2, streamsCol = 3;

  // Step 1: Simulate fetchTrackDailyImport (global rows → dailyTrackData)
  const dailyTrackData = rows
    .filter(r => cleanTerritory(r[terrCol]) === "global" && safeNumber(r[streamsCol]) > 0)
    .map(r => ({
      date: r[dateCol].trim(),
      track_name: normalizeQuotes(r[trackCol].trim()),
      global_streams: safeNumber(r[streamsCol]),
    }));
  console.log("\n--- dailyTrackData (global) ---");
  console.log("Count:", dailyTrackData.length);
  console.log("Tracks:", [...new Set(dailyTrackData.map(r => r.track_name))]);

  // Step 2: Simulate fetchTrackDailyImportTerritory (UK rows → dailyTerritoryData)
  const dailyTerritoryData = rows
    .filter(r => cleanTerritory(r[terrCol]) !== "global" && safeNumber(r[streamsCol]) > 0)
    .map(r => ({
      date: r[dateCol].trim(),
      track_name: normalizeQuotes(r[trackCol].trim()),
      territory: cleanTerritory(r[terrCol]),
      streams: safeNumber(r[streamsCol]),
    }));
  console.log("\n--- dailyTerritoryData (UK) ---");
  console.log("Count:", dailyTerritoryData.length);
  console.log("Tracks:", [...new Set(dailyTerritoryData.map(r => r.track_name))]);
  console.log("Dates:", [...new Set(dailyTerritoryData.map(r => r.date))].sort());
  console.log("Territories:", [...new Set(dailyTerritoryData.map(r => r.territory))]);

  // Step 3: Simulate getAllTrackNames (from dailyTrackData)
  const allTrackNames = [...new Set(dailyTrackData.map(r => r.track_name))];
  console.log("\n--- allTrackNames (selectedTracks) ---");
  console.log(allTrackNames);

  // Step 4: Simulate buildChartFromDailyData with territory = "UK"
  const territory = "UK";
  const selectedTracks = allTrackNames;
  const hasTerrData = true; // dailyTerritoryData.length > 0

  const trackByDate = new Map();
  let matchCount = 0, skipCount = 0;

  dailyTerritoryData
    .filter(r => r.territory === territory)
    .forEach(r => {
      if (!selectedTracks.includes(r.track_name)) {
        skipCount++;
        console.log(`  SKIP: "${r.track_name}" not in selectedTracks`);
        return;
      }
      matchCount++;
      if (!trackByDate.has(r.track_name)) trackByDate.set(r.track_name, new Map());
      trackByDate.get(r.track_name).set(r.date, r.streams);
    });

  console.log("\n--- buildChartFromDailyData UK ---");
  console.log("Matched rows:", matchCount, "| Skipped:", skipCount);
  console.log("Tracks in trackByDate:", [...trackByDate.keys()]);
  trackByDate.forEach((dates, track) => {
    const sortedDates = [...dates.keys()].sort();
    console.log(`  ${track}: ${sortedDates.length} dates, range: ${sortedDates[0]} -> ${sortedDates[sortedDates.length - 1]}`);
    console.log(`    Values:`, sortedDates.map(d => `${d}=${dates.get(d)}`).join(", "));
  });

  // Step 5: Check allDates
  const allDates = new Set();
  trackByDate.forEach(dates => dates.forEach((_, d) => allDates.add(d)));
  const sorted = [...allDates].sort();
  console.log("\n--- Chart date range ---");
  console.log("Total dates:", sorted.length);
  console.log("Range:", sorted[0], "->", sorted[sorted.length - 1]);
  console.log("All dates:", sorted);

  // Step 6: Check each track's values in the chart
  console.log("\n--- Final chart data per track ---");
  for (const track of selectedTracks) {
    const vals = sorted.map(date => {
      const val = trackByDate.get(track)?.get(date);
      return val ?? null;
    });
    const nonNull = vals.filter(v => v !== null);
    const firstNonNull = vals.findIndex(v => v !== null);
    const lastNonNull = vals.length - 1 - [...vals].reverse().findIndex(v => v !== null);
    console.log(`  ${track}: ${nonNull.length}/${vals.length} non-null, first data at index ${firstNonNull} (${sorted[firstNonNull]}), last at ${lastNonNull} (${sorted[lastNonNull]})`);
  }
}

main().catch(console.error);
