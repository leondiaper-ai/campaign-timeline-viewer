// ═══════════════════════════════════════════════════════════════════
// Territory Data Import Pipeline — Google Apps Script
// ═══════════════════════════════════════════════════════════════════
//
// Paste this into Extensions > Apps Script in each campaign sheet.
// It adds a "Territory Import" menu to the sheet toolbar.
//
// Tab contract:
//   raw_daily_global  → paste raw Spotify daily CSV (global)
//   raw_daily_UK      → paste raw Spotify daily CSV (UK)
//   tracks            → track definitions (ISRC lookup)
//   weekly_metrics    → aggregated output (app reads this)
//   import_log        → operational audit trail
//
// The app only ever reads weekly_metrics. Everything else is
// operational scaffolding to get data there cleanly.
// ═══════════════════════════════════════════════════════════════════

// ─── CONFIG ─────────────────────────────────────────────────────

const TERRITORIES = ["global", "UK"];

// Which day of the week does week_ending fall on?
// 0 = Sunday, 1 = Monday, ... 5 = Friday, 6 = Saturday
// Default: Friday (common music industry reporting day).
// Change this to match your existing weekly_metrics dates.
const WEEK_ENDING_DAY = 5; // Friday

// ─── MENU SETUP ─────────────────────────────────────────────────

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Territory Import")
    .addItem("Validate raw data (Global)", "validateGlobal")
    .addItem("Validate raw data (UK)", "validateUK")
    .addSeparator()
    .addItem("Aggregate to weekly (Global)", "aggregateGlobal")
    .addItem("Aggregate to weekly (UK)", "aggregateUK")
    .addSeparator()
    .addItem("Import status", "showImportStatus")
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Setup")
        .addItem("Create territory tabs (first-time)", "createTerritoryTabs")
    )
    .addToUi();
}

// ─── MENU HANDLERS ──────────────────────────────────────────────

function validateGlobal() { validateTerritory("global"); }
function validateUK() { validateTerritory("UK"); }
function aggregateGlobal() { aggregateTerritory("global"); }
function aggregateUK() { aggregateTerritory("UK"); }

// ─── TAB CREATION ───────────────────────────────────────────────
// Run once per campaign sheet to set up the territory import tabs.

function createTerritoryTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // tracks tab
  if (!ss.getSheetByName("tracks")) {
    const s = ss.insertSheet("tracks");
    s.getRange("A1:E1").setValues([["track_name", "isrc", "role", "release_date", "spotify_uri"]]);
    s.getRange("A1:E1").setFontWeight("bold");
    s.setFrozenRows(1);
    s.setColumnWidth(1, 200);
    s.setColumnWidth(2, 140);
    s.setColumnWidth(3, 120);
    s.setColumnWidth(4, 110);
    s.setColumnWidth(5, 240);
  }

  // raw_daily tabs
  for (const territory of TERRITORIES) {
    const tabName = "raw_daily_" + territory;
    if (!ss.getSheetByName(tabName)) {
      const s = ss.insertSheet(tabName);
      s.getRange("A1:D1").setValues([["date", "isrc", "track_name", "streams"]]);
      s.getRange("A1:D1").setFontWeight("bold");
      s.setFrozenRows(1);
      s.setColumnWidth(1, 110);
      s.setColumnWidth(2, 140);
      s.setColumnWidth(3, 200);
      s.setColumnWidth(4, 100);

      // Add a note on A1 explaining the format
      s.getRange("A1").setNote(
        "Paste Spotify daily data here.\n" +
        "Format: YYYY-MM-DD\n" +
        "One row per track per day.\n" +
        "Clear this tab before re-importing."
      );
    }
  }

  // import_log tab
  if (!ss.getSheetByName("import_log")) {
    const s = ss.insertSheet("import_log");
    s.getRange("A1:F1").setValues([["timestamp", "territory", "action", "rows", "date_range", "notes"]]);
    s.getRange("A1:F1").setFontWeight("bold");
    s.setFrozenRows(1);
    s.setColumnWidth(1, 170);
    s.setColumnWidth(2, 80);
    s.setColumnWidth(3, 130);
    s.setColumnWidth(4, 60);
    s.setColumnWidth(5, 200);
    s.setColumnWidth(6, 300);
  }

  ui.alert(
    "Setup complete",
    "Created tabs: tracks, raw_daily_global, raw_daily_UK, import_log.\n\n" +
    "Next steps:\n" +
    "1. Fill in the tracks tab with your track definitions\n" +
    "2. Paste raw Spotify daily CSV into the appropriate raw_daily tab\n" +
    "3. Run Validate, then Aggregate from the Territory Import menu",
    ui.ButtonSet.OK
  );
}

// ─── VALIDATION ─────────────────────────────────────────────────
// Pre-flight check before aggregation. Catches common problems.

function validateTerritory(territory) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const tabName = "raw_daily_" + territory;
  const sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    ui.alert("Missing tab", "Tab '" + tabName + "' not found. Run Setup first.", ui.ButtonSet.OK);
    return;
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    ui.alert("No data", "Tab '" + tabName + "' has no data rows. Paste your CSV first.", ui.ButtonSet.OK);
    return;
  }

  const issues = [];
  const seenKeys = new Set();
  let validRows = 0;

  // Check header
  const header = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  const expectedHeader = ["date", "isrc", "track_name", "streams"];
  for (let i = 0; i < expectedHeader.length; i++) {
    if (header[i] !== expectedHeader[i]) {
      issues.push("Column " + (i + 1) + " header: expected '" + expectedHeader[i] + "', got '" + header[i] + "'");
    }
  }

  // Check data rows
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNum = r + 1;

    // Skip fully empty rows
    if (!row[0] && !row[1] && !row[2] && !row[3]) continue;

    // Date format
    const dateStr = String(row[0]).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      issues.push("Row " + rowNum + ": invalid date format '" + dateStr + "' (expected YYYY-MM-DD)");
      if (issues.length > 20) break;
      continue;
    }

    // ISRC present
    const isrc = String(row[1]).trim();
    if (!isrc || isrc === "undefined") {
      issues.push("Row " + rowNum + ": missing ISRC");
    }

    // Streams is a number
    const streams = Number(row[3]);
    if (isNaN(streams) || streams < 0) {
      issues.push("Row " + rowNum + ": invalid streams value '" + row[3] + "'");
    }

    // Duplicate check (date + ISRC)
    const key = dateStr + "|" + isrc;
    if (seenKeys.has(key)) {
      issues.push("Row " + rowNum + ": duplicate entry for " + isrc + " on " + dateStr);
    }
    seenKeys.add(key);

    validRows++;
  }

  // Cross-check ISRCs against tracks tab
  const tracksSheet = ss.getSheetByName("tracks");
  if (tracksSheet) {
    const tracksData = tracksSheet.getDataRange().getValues();
    const knownISRCs = new Set();
    for (let r = 1; r < tracksData.length; r++) {
      const isrc = String(tracksData[r][1]).trim();
      if (isrc) knownISRCs.add(isrc);
    }

    if (knownISRCs.size > 0) {
      const rawISRCs = new Set();
      for (let r = 1; r < data.length; r++) {
        const isrc = String(data[r][1]).trim();
        if (isrc) rawISRCs.add(isrc);
      }

      rawISRCs.forEach(function(isrc) {
        if (!knownISRCs.has(isrc)) {
          issues.push("ISRC '" + isrc + "' in raw data but not in tracks tab");
        }
      });

      knownISRCs.forEach(function(isrc) {
        if (!rawISRCs.has(isrc)) {
          issues.push("ISRC '" + isrc + "' in tracks tab but missing from raw data");
        }
      });
    }
  } else {
    issues.push("No 'tracks' tab found — cannot cross-check ISRCs");
  }

  // Date coverage
  const dates = [];
  for (let r = 1; r < data.length; r++) {
    const d = String(data[r][0]).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dates.push(d);
  }
  dates.sort();

  if (dates.length > 0) {
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    // Check for date gaps
    const dateSet = new Set(dates);
    const cursor = new Date(minDate);
    const end = new Date(maxDate);
    const missingDates = [];
    while (cursor <= end) {
      const ds = cursor.toISOString().split("T")[0];
      if (!dateSet.has(ds)) {
        missingDates.push(ds);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (missingDates.length > 0 && missingDates.length <= 10) {
      issues.push("Missing dates: " + missingDates.join(", "));
    } else if (missingDates.length > 10) {
      issues.push(missingDates.length + " missing dates between " + minDate + " and " + maxDate);
    }
  }

  // Report
  if (issues.length === 0) {
    ui.alert(
      "Validation passed ✓",
      territory + " raw data looks good.\n\n" +
      validRows + " data rows\n" +
      "Date range: " + (dates[0] || "?") + " → " + (dates[dates.length - 1] || "?") + "\n\n" +
      "Ready to aggregate.",
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      "Validation issues (" + issues.length + ")",
      issues.slice(0, 15).join("\n") +
      (issues.length > 15 ? "\n\n... and " + (issues.length - 15) + " more" : ""),
      ui.ButtonSet.OK
    );
  }
}

// ─── AGGREGATION ────────────────────────────────────────────────
// Reads raw daily data → groups by week → writes to weekly_metrics.
//
// Key behaviour:
// - Only overwrites rows for the specified territory
// - Preserves physical units (retail_units, d2c_units) if already
//   entered manually — streams are replaced, physicals are kept
// - Logs the operation to import_log

function aggregateTerritory(territory) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const tabName = "raw_daily_" + territory;
  const rawSheet = ss.getSheetByName(tabName);

  if (!rawSheet) {
    ui.alert("Missing tab", "Tab '" + tabName + "' not found. Run Setup first.", ui.ButtonSet.OK);
    return;
  }

  const rawData = rawSheet.getDataRange().getValues();
  if (rawData.length <= 1) {
    ui.alert("No data", "Tab '" + tabName + "' has no data rows.", ui.ButtonSet.OK);
    return;
  }

  // ── Step 1: Read raw daily data and sum streams per week ──

  // Map: weekEnding → totalStreams
  const weeklyStreams = {};

  for (let r = 1; r < rawData.length; r++) {
    const dateStr = String(rawData[r][0]).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const streams = Number(rawData[r][3]) || 0;
    const weekEnd = getWeekEnding(dateStr);

    if (!weeklyStreams[weekEnd]) {
      weeklyStreams[weekEnd] = 0;
    }
    weeklyStreams[weekEnd] += streams;
  }

  const weekEndings = Object.keys(weeklyStreams).sort();

  if (weekEndings.length === 0) {
    ui.alert("No valid data", "Could not aggregate any rows. Check date formats.", ui.ButtonSet.OK);
    return;
  }

  // ── Step 2: Read existing weekly_metrics to preserve physical units ──

  const metricsSheet = ss.getSheetByName("weekly_metrics");
  if (!metricsSheet) {
    ui.alert("Missing tab", "'weekly_metrics' tab not found.", ui.ButtonSet.OK);
    return;
  }

  const metricsData = metricsSheet.getDataRange().getValues();

  // Build lookup of existing physical units: weekEnding|territory → {retail, d2c}
  const existingPhysicals = {};
  for (let r = 1; r < metricsData.length; r++) {
    const we = String(metricsData[r][0]).trim();
    const terr = String(metricsData[r][1]).trim();
    if (terr === territory) {
      existingPhysicals[we] = {
        retail: Number(metricsData[r][3]) || 0,
        d2c: Number(metricsData[r][4]) || 0,
      };
    }
  }

  // ── Step 3: Build new weekly_metrics rows ──

  // Keep all rows that are NOT this territory
  const headerRow = metricsData[0];
  const otherRows = [];
  for (let r = 1; r < metricsData.length; r++) {
    const terr = String(metricsData[r][1]).trim();
    if (terr !== territory) {
      otherRows.push(metricsData[r]);
    }
  }

  // Build new rows for this territory
  const newRows = [];
  for (let i = 0; i < weekEndings.length; i++) {
    const we = weekEndings[i];
    const phys = existingPhysicals[we] || { retail: 0, d2c: 0 };

    newRows.push([
      we,                     // week_ending
      territory,              // territory
      weeklyStreams[we],      // total_streams (from aggregation)
      phys.retail,            // retail_units (preserved)
      phys.d2c,              // d2c_units (preserved)
    ]);
  }

  // Combine: header + other territory rows + new territory rows, sorted
  const allDataRows = otherRows.concat(newRows);
  allDataRows.sort(function(a, b) {
    // Sort by week_ending, then by territory
    const dateComp = String(a[0]).localeCompare(String(b[0]));
    if (dateComp !== 0) return dateComp;
    return String(a[1]).localeCompare(String(b[1]));
  });

  // ── Step 4: Write back to weekly_metrics ──

  metricsSheet.clearContents();
  metricsSheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);

  if (allDataRows.length > 0) {
    metricsSheet.getRange(2, 1, allDataRows.length, allDataRows[0].length).setValues(allDataRows);
  }

  // ── Step 5: Log the operation ──

  logOperation(territory, "aggregate", rawData.length - 1, weekEndings[0] + " → " + weekEndings[weekEndings.length - 1], weekEndings.length + " weeks written");

  // ── Step 6: Confirm ──

  // Calculate some stats for the dates
  const rawDates = [];
  for (let r = 1; r < rawData.length; r++) {
    const d = String(rawData[r][0]).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) rawDates.push(d);
  }
  rawDates.sort();

  ui.alert(
    "Aggregation complete ✓",
    territory + " data aggregated successfully.\n\n" +
    "Raw rows processed: " + (rawData.length - 1) + "\n" +
    "Daily date range: " + rawDates[0] + " → " + rawDates[rawDates.length - 1] + "\n" +
    "Weeks written: " + weekEndings.length + "\n" +
    "Physical units: preserved from existing data\n\n" +
    "The weekly_metrics tab is updated. The app will pick this up on next load.",
    ui.ButtonSet.OK
  );
}

// ─── IMPORT STATUS ──────────────────────────────────────────────

function showImportStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const lines = [];

  for (let t = 0; t < TERRITORIES.length; t++) {
    const territory = TERRITORIES[t];
    const tabName = "raw_daily_" + territory;
    const sheet = ss.getSheetByName(tabName);

    lines.push("── " + territory.toUpperCase() + " ──");

    if (!sheet) {
      lines.push("  Tab: not created");
      lines.push("");
      continue;
    }

    const data = sheet.getDataRange().getValues();
    const rowCount = data.length - 1; // minus header

    if (rowCount <= 0) {
      lines.push("  Tab: exists but empty");
      lines.push("");
      continue;
    }

    // Date range
    const dates = [];
    for (let r = 1; r < data.length; r++) {
      const d = String(data[r][0]).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dates.push(d);
    }
    dates.sort();

    // Unique tracks
    const isrcs = new Set();
    for (let r = 1; r < data.length; r++) {
      var isrc = String(data[r][1]).trim();
      if (isrc) isrcs.add(isrc);
    }

    lines.push("  Raw rows: " + rowCount);
    lines.push("  Tracks: " + isrcs.size);
    lines.push("  Date range: " + (dates[0] || "?") + " → " + (dates[dates.length - 1] || "?"));
    lines.push("");
  }

  // Check weekly_metrics coverage
  const metricsSheet = ss.getSheetByName("weekly_metrics");
  if (metricsSheet) {
    var metricsData = metricsSheet.getDataRange().getValues();
    lines.push("── WEEKLY METRICS ──");

    for (let t = 0; t < TERRITORIES.length; t++) {
      const territory = TERRITORIES[t];
      const terrRows = [];
      for (let r = 1; r < metricsData.length; r++) {
        if (String(metricsData[r][1]).trim() === territory) {
          terrRows.push(String(metricsData[r][0]).trim());
        }
      }
      terrRows.sort();
      if (terrRows.length > 0) {
        lines.push("  " + territory + ": " + terrRows.length + " weeks (" + terrRows[0] + " → " + terrRows[terrRows.length - 1] + ")");
      } else {
        lines.push("  " + territory + ": no data");
      }
    }
  }

  // Last import log entry
  const logSheet = ss.getSheetByName("import_log");
  if (logSheet) {
    const logData = logSheet.getDataRange().getValues();
    if (logData.length > 1) {
      const last = logData[logData.length - 1];
      lines.push("");
      lines.push("── LAST OPERATION ──");
      lines.push("  " + last[0] + " | " + last[1] + " | " + last[2]);
    }
  }

  ui.alert("Import Status", lines.join("\n"), ui.ButtonSet.OK);
}

// ─── HELPERS ────────────────────────────────────────────────────

/**
 * Given a date string (YYYY-MM-DD), returns the week_ending date
 * for that week, based on the configured WEEK_ENDING_DAY.
 *
 * Example: if WEEK_ENDING_DAY = 5 (Friday), then:
 *   2026-01-07 (Wednesday) → 2026-01-09 (Friday)
 *   2026-01-09 (Friday)    → 2026-01-09 (Friday)
 *   2026-01-10 (Saturday)  → 2026-01-16 (next Friday)
 */
function getWeekEnding(dateStr) {
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid timezone issues
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  let daysUntilEnd = WEEK_ENDING_DAY - dayOfWeek;
  if (daysUntilEnd < 0) {
    daysUntilEnd += 7;
  }
  const weekEnd = new Date(d);
  weekEnd.setDate(weekEnd.getDate() + daysUntilEnd);
  return weekEnd.toISOString().split("T")[0];
}

/**
 * Log an operation to the import_log tab.
 */
function logOperation(territory, action, rows, dateRange, notes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("import_log");

  if (!logSheet) {
    logSheet = ss.insertSheet("import_log");
    logSheet.getRange("A1:F1").setValues([["timestamp", "territory", "action", "rows", "date_range", "notes"]]);
    logSheet.getRange("A1:F1").setFontWeight("bold");
    logSheet.setFrozenRows(1);
  }

  const lastRow = logSheet.getLastRow();
  logSheet.getRange(lastRow + 1, 1, 1, 6).setValues([[
    new Date().toISOString(),
    territory,
    action,
    rows,
    dateRange,
    notes || "",
  ]]);
}
