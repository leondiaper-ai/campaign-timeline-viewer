/**
 * Territory Import Pipeline — Apps Script
 *
 * Lives inside each campaign sheet. Adds:
 *   - "territory_staging" tab: paste raw CSV data here
 *   - "territory_master" tab: normalized, deduplicated master dataset
 *   - "import_log" tab: audit trail of every import
 *   - Custom menu: "Territory Data → Import Staged Data"
 *
 * INSTALL: Extensions → Apps Script → paste this → Save → Reload sheet
 */

// ——— Menu Setup ———————————————————————————————————————————

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Territory Data")
    .addItem("Import Staged Data", "importStagedData")
    .addItem("Validate Master Data", "validateMasterData")
    .addItem("Setup Tabs (first time)", "setupTabs")
    .addItem("Re-seed Master from Existing Data", "seedMasterData")
    .addToUi();
}

// ——— Tab Setup ————————————————————————————————————————————

function setupTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // territory_staging
  let staging = ss.getSheetByName("territory_staging");
  if (!staging) {
    staging = ss.insertSheet("territory_staging");
    staging.getRange("A1:E1").setValues([["date", "track_name", "territory", "streams", "source"]]);
    staging.getRange("A1:E1").setFontWeight("bold").setBackground("#f3f3f3");
    staging.setColumnWidth(1, 120);
    staging.setColumnWidth(2, 200);
    staging.setColumnWidth(3, 100);
    staging.setColumnWidth(4, 120);
    staging.setColumnWidth(5, 150);
    staging.getRange("A2").setNote(
      "Paste bulk CSV data here.\n" +
      "Columns: date, track_name, territory, streams, source (optional)\n" +
      "Then use Territory Data → Import Staged Data"
    );
  }

  // territory_master
  let master = ss.getSheetByName("territory_master");
  if (!master) {
    master = ss.insertSheet("territory_master");
    master.getRange("A1:F1").setValues([["date", "track_name", "territory", "streams", "source", "updated_at"]]);
    master.getRange("A1:F1").setFontWeight("bold").setBackground("#f3f3f3");
    master.setColumnWidth(1, 120);
    master.setColumnWidth(2, 200);
    master.setColumnWidth(3, 100);
    master.setColumnWidth(4, 120);
    master.setColumnWidth(5, 150);
    master.setColumnWidth(6, 180);
  }

  // import_log
  let log = ss.getSheetByName("import_log");
  if (!log) {
    log = ss.insertSheet("import_log");
    log.getRange("A1:H1").setValues([["timestamp", "territory", "rows_inserted", "rows_updated", "total_rows", "date_range", "tracks", "notes"]]);
    log.getRange("A1:H1").setFontWeight("bold").setBackground("#f3f3f3");
  }

  // Seed territory_master from existing track_metrics if it exists and master is empty
  const masterData = master.getDataRange().getValues();
  if (masterData.length <= 1) {
    seedFromTrackMetrics_(ss, master);
  }

  SpreadsheetApp.getUi().alert("Setup complete! Tabs created.\n\nUse Territory Data → Import Staged Data after pasting data into territory_staging.");
}

// ——— Seed master from existing track_metrics ——————————————

function seedFromTrackMetrics_(ss, master) {
  const now = new Date().toISOString();
  const rows = [];

  // Try track_metrics first (new format)
  const tm = ss.getSheetByName("track_metrics");
  if (tm) {
    const data = tm.getDataRange().getValues();
    if (data.length > 1) {
      const header = data[0].map(h => String(h).trim().toLowerCase());
      const dateCol = header.indexOf("week_ending");
      const terrCol = header.indexOf("territory");
      const trackCol = header.indexOf("track_name");
      const streamsCol = header.indexOf("streams");
      if (dateCol >= 0 && streamsCol >= 0) {
        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          const date = normalizeDate_(r[dateCol]);
          const track = normalizeName_(String(r[trackCol] || "").trim());
          const territory = normalizeTerritory_(String(r[terrCol] || "global"));
          const streams = parseStreams_(r[streamsCol]);
          if (date && track && streams > 0) {
            rows.push([date, track, territory, streams, "seed:track_metrics", now]);
          }
        }
      }
    }
  }

  // Also try legacy tabs: track_daily_import (global) + track_daily_import_territory (UK etc)
  if (rows.length === 0) {
    // Global data from track_daily_import (date, track_name, streams)
    const tdi = ss.getSheetByName("track_daily_import");
    if (tdi) {
      const data = tdi.getDataRange().getValues();
      if (data.length > 1) {
        const header = data[0].map(h => String(h).trim().toLowerCase());
        const dateCol = Math.max(0, header.indexOf("date"));
        const trackCol = Math.max(0, header.indexOf("track_name"));
        const streamsCol = header.indexOf("streams");
        const sCol = streamsCol >= 0 ? streamsCol : header.indexOf("global_streams");
        if (sCol >= 0) {
          for (let i = 1; i < data.length; i++) {
            const r = data[i];
            const date = normalizeDate_(r[dateCol]);
            const track = normalizeName_(String(r[trackCol] || "").trim());
            const streams = parseStreams_(r[sCol >= 0 ? sCol : 2]);
            if (date && track && streams > 0) {
              rows.push([date, track, "global", streams, "seed:track_daily_import", now]);
            }
          }
        }
      }
    }
    // Territory data from track_daily_import_territory (date, track_name, territory, streams)
    const tdit = ss.getSheetByName("track_daily_import_territory");
    if (tdit) {
      const data = tdit.getDataRange().getValues();
      if (data.length > 1) {
        const header = data[0].map(h => String(h).trim().toLowerCase());
        const dateCol = Math.max(0, header.indexOf("date"));
        const trackCol = Math.max(0, header.indexOf("track_name"));
        const terrCol = header.indexOf("territory");
        const streamsCol = Math.max(0, header.indexOf("streams"));
        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          const date = normalizeDate_(r[dateCol]);
          const track = normalizeName_(String(r[trackCol] || "").trim());
          const territory = terrCol >= 0 ? normalizeTerritory_(String(r[terrCol] || "global")) : "global";
          const streams = parseStreams_(r[streamsCol]);
          if (date && track && streams > 0) {
            rows.push([date, track, territory, streams, "seed:track_daily_import_territory", now]);
          }
        }
      }
    }
  }

  if (rows.length > 0) {
    master.getRange(2, 1, rows.length, 6).setValues(rows);
    Logger.log("Seeded territory_master with " + rows.length + " rows");
  }
}

// ——— Manual Seed ————————————————————————————————————————

function seedMasterData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  let master = ss.getSheetByName("territory_master");
  if (!master) {
    ui.alert("Error", "No territory_master tab. Run Setup Tabs first.", ui.ButtonSet.OK);
    return;
  }
  // Clear existing data (keep header)
  if (master.getLastRow() > 1) {
    master.getRange(2, 1, master.getLastRow() - 1, 6).clearContent();
  }
  seedFromTrackMetrics_(ss, master);
  const rowCount = master.getLastRow() - 1;
  ui.alert("Seed Complete", "Seeded " + rowCount + " rows into territory_master.", ui.ButtonSet.OK);
}

// ——— Import Staged Data ——————————————————————————————————

function importStagedData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const staging = ss.getSheetByName("territory_staging");
  if (!staging) {
    ui.alert("Error", "No 'territory_staging' tab found. Run Setup Tabs first.", ui.ButtonSet.OK);
    return;
  }

  const master = ss.getSheetByName("territory_master");
  if (!master) {
    ui.alert("Error", "No 'territory_master' tab found. Run Setup Tabs first.", ui.ButtonSet.OK);
    return;
  }

  // Read staging data
  const stagingData = staging.getDataRange().getValues();
  if (stagingData.length <= 1) {
    ui.alert("Nothing to import", "The territory_staging tab is empty.", ui.ButtonSet.OK);
    return;
  }

  // Parse staging header
  const sHeader = stagingData[0].map(h => String(h).trim().toLowerCase());
  const sDateCol = findCol_(sHeader, ["date", "week_ending", "week"]);
  const sTrackCol = findCol_(sHeader, ["track_name", "track", "song"]);
  const sTerrCol = findCol_(sHeader, ["territory", "country", "market"]);
  const sStreamsCol = findCol_(sHeader, ["streams", "stream_count", "plays"]);
  const sSourceCol = findCol_(sHeader, ["source", "import_source"]);

  if (sDateCol < 0 || sStreamsCol < 0) {
    ui.alert("Error", "Staging tab must have at least 'date' and 'streams' columns.\nFound headers: " + sHeader.join(", "), ui.ButtonSet.OK);
    return;
  }

  // Parse incoming rows
  const now = new Date().toISOString();
  const incoming = [];
  const warnings = [];

  for (let i = 1; i < stagingData.length; i++) {
    const r = stagingData[i];
    const date = normalizeDate_(r[sDateCol]);
    const track = sTrackCol >= 0 ? normalizeName_(String(r[sTrackCol] || "").trim()) : "";
    const territory = sTerrCol >= 0 ? normalizeTerritory_(String(r[sTerrCol] || "global")) : "global";
    const streams = parseStreams_(r[sStreamsCol]);
    const source = sSourceCol >= 0 ? String(r[sSourceCol] || "").trim() : "manual_import";

    if (!date) {
      if (String(r[sDateCol] || "").trim()) warnings.push("Row " + (i + 1) + ": invalid date '" + r[sDateCol] + "'");
      continue;
    }
    if (!track) {
      warnings.push("Row " + (i + 1) + ": missing track name");
      continue;
    }
    if (streams <= 0) continue; // skip zero-stream rows silently

    incoming.push({
      date: date,
      track: track,
      territory: territory,
      streams: streams,
      source: source || "manual_import",
      key: date + "|" + track + "|" + territory,
    });
  }

  if (incoming.length === 0) {
    ui.alert("Nothing to import", "No valid rows found in staging data.\n\nWarnings:\n" + (warnings.slice(0, 10).join("\n") || "none"), ui.ButtonSet.OK);
    return;
  }

  // Read existing master data into a Map keyed by date|track|territory
  const masterData = master.getDataRange().getValues();
  const masterMap = new Map(); // key → row index (1-based, for sheet)
  for (let i = 1; i < masterData.length; i++) {
    const r = masterData[i];
    const key = String(r[0]).trim() + "|" + normalizeName_(String(r[1] || "")) + "|" + normalizeTerritory_(String(r[2] || ""));
    masterMap.set(key, i + 1); // sheet row (1-indexed, +1 for header)
  }

  // Upsert
  let inserted = 0, updated = 0;
  const toAppend = [];

  for (const row of incoming) {
    if (masterMap.has(row.key)) {
      // Update existing row
      const sheetRow = masterMap.get(row.key);
      master.getRange(sheetRow, 4).setValue(row.streams); // update streams
      master.getRange(sheetRow, 5).setValue(row.source);   // update source
      master.getRange(sheetRow, 6).setValue(now);           // update timestamp
      updated++;
    } else {
      // Append new row
      toAppend.push([row.date, row.track, row.territory, row.streams, row.source, now]);
      masterMap.set(row.key, -1); // mark as seen to avoid duplicate appends
      inserted++;
    }
  }

  if (toAppend.length > 0) {
    const lastRow = master.getLastRow();
    master.getRange(lastRow + 1, 1, toAppend.length, 6).setValues(toAppend);
  }

  // Sort master by date, territory, track
  const finalRows = master.getLastRow();
  if (finalRows > 1) {
    master.getRange(2, 1, finalRows - 1, 6).sort([
      { column: 1, ascending: true },  // date
      { column: 3, ascending: true },  // territory
      { column: 2, ascending: true },  // track_name
    ]);
  }

  // Validation warnings
  const validationNotes = runValidation_(ss, incoming);

  // Log the import
  logImport_(ss, incoming, inserted, updated, validationNotes);

  // Summary
  const territories = [...new Set(incoming.map(r => r.territory))];
  const tracks = [...new Set(incoming.map(r => r.track))];
  const dates = incoming.map(r => r.date).sort();

  const summary = [
    "✅ Import complete!",
    "",
    "Rows inserted: " + inserted,
    "Rows updated: " + updated,
    "Total incoming: " + incoming.length,
    "",
    "Territories: " + territories.join(", "),
    "Tracks: " + tracks.join(", "),
    "Date range: " + dates[0] + " → " + dates[dates.length - 1],
  ];

  if (validationNotes.length > 0) {
    summary.push("", "⚠️ Warnings:", ...validationNotes);
  }
  if (warnings.length > 0) {
    summary.push("", "Parse warnings:", ...warnings.slice(0, 5));
  }

  // Ask to clear staging
  const response = ui.alert(
    "Import Complete",
    summary.join("\n") + "\n\nClear staging tab?",
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    if (staging.getLastRow() > 1) {
      staging.getRange(2, 1, staging.getLastRow() - 1, staging.getLastColumn()).clearContent();
    }
  }
}

// ——— Validation ———————————————————————————————————————————

function runValidation_(ss, incoming) {
  const notes = [];

  // Check against campaign setup
  const setup = ss.getSheetByName("campaign_setup");
  if (setup) {
    const setupData = setup.getDataRange().getValues();
    if (setupData.length > 1) {
      // Try to find start_date column
      const header = setupData[0].map(h => String(h).trim().toLowerCase());
      const startIdx = header.indexOf("start_date");
      const releaseIdx = header.indexOf("release_date");

      const startDate = startIdx >= 0 ? normalizeDate_(setupData[1][startIdx]) : "";
      const releaseDate = releaseIdx >= 0 ? normalizeDate_(setupData[1][releaseIdx]) : "";

      const incomingDates = incoming.map(r => r.date).sort();
      const minIncoming = incomingDates[0];

      if (startDate && minIncoming > startDate) {
        notes.push("Import starts at " + minIncoming + " but campaign starts " + startDate + " — pre-campaign history may be missing");
      }
      if (releaseDate && minIncoming > releaseDate) {
        notes.push("Import starts AFTER release date (" + releaseDate + ") — pre-release data is missing");
      }
    }
  }

  // Check against expected tracks
  const trackMetrics = ss.getSheetByName("track_metrics");
  if (trackMetrics) {
    const tmData = trackMetrics.getDataRange().getValues();
    const tmHeader = tmData[0].map(h => String(h).trim().toLowerCase());
    const tmTrackCol = tmHeader.indexOf("track_name");
    if (tmTrackCol >= 0) {
      const expectedTracks = [...new Set(tmData.slice(1).map(r => normalizeName_(String(r[tmTrackCol] || ""))))].filter(Boolean);
      const importedTracks = [...new Set(incoming.map(r => r.track))];
      const missing = expectedTracks.filter(t => !importedTracks.includes(t));
      if (missing.length > 0) {
        notes.push("Missing tracks in import: " + missing.join(", "));
      }
    }
  }

  // Check territory completeness
  const territories = [...new Set(incoming.map(r => r.territory))];
  if (territories.length === 1 && territories[0] === "global") {
    notes.push("Only global data imported — no UK territory rows");
  }

  return notes;
}

function validateMasterData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const master = ss.getSheetByName("territory_master");

  if (!master || master.getLastRow() <= 1) {
    ui.alert("No data", "territory_master is empty.", ui.ButtonSet.OK);
    return;
  }

  const data = master.getDataRange().getValues().slice(1);
  const byTerritory = {};

  for (const r of data) {
    const terr = String(r[2] || "global").trim();
    if (!byTerritory[terr]) byTerritory[terr] = { dates: new Set(), tracks: new Set(), count: 0 };
    byTerritory[terr].dates.add(String(r[0]));
    byTerritory[terr].tracks.add(String(r[1]));
    byTerritory[terr].count++;
  }

  const lines = ["Territory Master Data Summary", ""];
  for (const [terr, info] of Object.entries(byTerritory)) {
    const dates = [...info.dates].sort();
    lines.push(
      "═══ " + terr + " ═══",
      "  Rows: " + info.count,
      "  Tracks: " + [...info.tracks].join(", "),
      "  Date range: " + dates[0] + " → " + dates[dates.length - 1],
      "  Unique dates: " + dates.length,
      ""
    );
  }

  // Cross-check: do all territories have the same date range?
  const allTerrs = Object.keys(byTerritory);
  if (allTerrs.length > 1) {
    const globalDates = byTerritory["global"] ? [...byTerritory["global"].dates].sort() : [];
    const ukDates = byTerritory["UK"] ? [...byTerritory["UK"].dates].sort() : [];
    if (globalDates.length > 0 && ukDates.length > 0) {
      if (globalDates[0] < ukDates[0]) {
        lines.push("⚠️ UK data starts later than Global (" + ukDates[0] + " vs " + globalDates[0] + ")");
      }
      const globalDateSet = new Set(globalDates);
      const missingUK = globalDates.filter(d => !new Set(ukDates).has(d));
      if (missingUK.length > 0) {
        lines.push("⚠️ UK missing data for: " + missingUK.join(", "));
      }
    }
  }

  ui.alert("Validation", lines.join("\n"), ui.ButtonSet.OK);
}

// ——— Import Log ——————————————————————————————————————————

function logImport_(ss, incoming, inserted, updated, notes) {
  let log = ss.getSheetByName("import_log");
  if (!log) {
    log = ss.insertSheet("import_log");
    log.getRange("A1:H1").setValues([["timestamp", "territory", "rows_inserted", "rows_updated", "total_rows", "date_range", "tracks", "notes"]]);
    log.getRange("A1:H1").setFontWeight("bold");
  }

  const territories = [...new Set(incoming.map(r => r.territory))].join(", ");
  const tracks = [...new Set(incoming.map(r => r.track))].join(", ");
  const dates = incoming.map(r => r.date).sort();
  const dateRange = dates[0] + " → " + dates[dates.length - 1];

  log.appendRow([
    new Date().toISOString(),
    territories,
    inserted,
    updated,
    incoming.length,
    dateRange,
    tracks,
    notes.join("; ") || "OK",
  ]);
}

// ——— Normalization Helpers ————————————————————————————————

function normalizeTerritory_(raw) {
  const val = String(raw || "global").trim().toLowerCase();
  if (val === "uk" || val === "gb" || val === "united kingdom" || val === "great britain") return "UK";
  if (val === "us" || val === "usa" || val === "united states") return "US";
  if (val === "de" || val === "germany") return "DE";
  if (val === "fr" || val === "france") return "FR";
  if (val === "" || val === "global" || val === "ww" || val === "worldwide") return "global";
  return val.toUpperCase(); // fallback: uppercase the code
}

function normalizeDate_(raw) {
  if (!raw) return "";
  // Handle Date objects
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  const s = String(raw).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0");
  // MM/DD/YYYY (US format — assume if month <= 12)
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy && Number(mdy[1]) <= 12) return mdy[3] + "-" + mdy[1].padStart(2, "0") + "-" + mdy[2].padStart(2, "0");
  // Try native parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  return "";
}

function normalizeName_(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\u2018\u2019\u201A\uFF07]/g, "'")
    .replace(/[\u201C\u201D\u201E\uFF02]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ");
}

function parseStreams_(raw) {
  if (typeof raw === "number") return raw;
  const s = String(raw || "0").replace(/[,%$£€\s]/g, "").trim();
  const n = Number(s);
  return isNaN(n) ? 0 : Math.round(n);
}

function findCol_(header, names) {
  for (const name of names) {
    const idx = header.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}
