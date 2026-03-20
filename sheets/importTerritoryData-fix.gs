// ═══════════════════════════════════════════════════════════════════
// FIXED importTerritoryData function
// ═══════════════════════════════════════════════════════════════════
//
// BUG: The original importTerritoryData was copy-pasted from
// importTrackData and still reads from 'raw_import' (wrong tab).
// Since raw_import has no data rows (lastRow=3), it always triggers
// "No data. Paste CSV starting at row 4."
//
// FIX: Three changes:
//   1. Read from 'raw_import_territory' instead of 'raw_import'
//   2. Adjust row offsets (data starts at row 5, not row 4)
//      because raw_import_territory has an extra TERRITORY row
//   3. Read territory from B2 and write 4 columns to
//      track_daily_import_territory (date, track_name, territory, streams)
//
// HOW TO APPLY:
//   Open Extensions > Apps Script in the James Blake USE sheet.
//   Find the existing importTerritoryData function.
//   Replace the ENTIRE function body with the code below.
//   Click Save (Ctrl+S).
// ═══════════════════════════════════════════════════════════════════

function importTerritoryData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // FIX #1: Read from raw_import_territory (was: raw_import)
  var raw = ss.getSheetByName('raw_import_territory');
  if (!raw) { ui.alert('Error', 'No raw_import_territory tab. Run setupTerritoryTabs first.', ui.ButtonSet.OK); return; }

  var trackName = String(raw.getRange('B1').getValue()).trim();
  if (!trackName) { ui.alert('Error', 'Pick a track name from the dropdown in B1.', ui.ButtonSet.OK); return; }

  // FIX #3a: Read territory from B2
  var territory = String(raw.getRange('B2').getValue()).trim();
  if (!territory) { ui.alert('Error', 'Pick a territory from the dropdown in B2.', ui.ButtonSet.OK); return; }

  var lastRow = raw.getLastRow();

  // FIX #2a: Data starts at row 5 (was: row 4)
  // Layout: row1=track, row2=territory, row3=instructions, row4=headers, row5+=data
  if (lastRow < 5) { ui.alert('Error', 'No data. Paste CSV below the headers (row 5+).', ui.ButtonSet.OK); return; }

  // FIX #2b: Read from row 5, count = lastRow - 4 (was: row 4, count = lastRow - 3)
  var rawData = raw.getRange(5, 1, lastRow - 4, 2).getValues();
  var validRows = [];

  for (var i = 0; i < rawData.length; i++) {
    var dateVal = rawData[i][0];
    var streamsVal = rawData[i][1];
    if (!dateVal && (streamsVal === '' || streamsVal === null || streamsVal === undefined)) continue;

    var dateStr = '';
    if (dateVal instanceof Date) { dateStr = Utilities.formatDate(dateVal, 'UTC', 'yyyy-MM-dd'); }
    else { dateStr = String(dateVal).trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue; }

    var streams = Number(String(streamsVal).replace(/,/g, ''));
    if (isNaN(streams)) continue;

    // FIX #3b: Build 4-column rows (was: 3-column)
    // Output: date | track_name | territory | streams
    validRows.push([dateStr, trackName, territory, streams]);
  }

  if (validRows.length === 0) { ui.alert('Error', 'No valid rows found. Check date format (YYYY-MM-DD) and streams.', ui.ButtonSet.OK); return; }

  // Write to track_daily_import_territory (was: track_daily_import)
  var master = ss.getSheetByName('track_daily_import_territory');
  if (!master) { ui.alert('Error', 'No track_daily_import_territory tab.', ui.ButtonSet.OK); return; }

  // Remove existing rows for this track + territory combo (re-import support)
  var existing = master.getDataRange().getValues();
  var keepRows = [existing[0]]; // keep header
  for (var j = 1; j < existing.length; j++) {
    if (String(existing[j][1]).trim() === trackName && String(existing[j][2]).trim() === territory) continue;
    keepRows.push(existing[j]);
  }

  // Append new rows
  for (var k = 0; k < validRows.length; k++) {
    keepRows.push(validRows[k]);
  }

  // Write back
  master.clearContents();
  if (keepRows.length > 0) {
    master.getRange(1, 1, keepRows.length, keepRows[0].length).setValues(keepRows);
  }

  // Clear the paste area (rows 5+) in raw_import_territory
  if (lastRow >= 5) {
    raw.getRange(5, 1, lastRow - 4, 2).clearContent();
  }

  ui.alert('Import Complete', validRows.length + ' rows imported for "' + trackName + '" (' + territory + ').', ui.ButtonSet.OK);
}
