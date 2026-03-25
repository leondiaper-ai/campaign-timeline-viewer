/**
 * Territory Import — Pipeline v2.2
 *
 * Two import flows:
 *
 * 1. TRACK-LEVEL (existing):
 *    raw_import_territory → track_daily_import_territory
 *    Columns: date | track_name | territory | streams
 *
 * 2. RELEASE-LEVEL (new):
 *    raw_import_release_territory → release_daily_import_territory
 *    Columns: date | release_name | territory | streams
 *
 * Both tabs share the same layout:
 *   A1: label   B1: [dropdown]
 *   A2: "TERRITORY:"   B2: [dropdown]
 *   A3: instructions
 *   A4: date | streams  (headers)
 *   A5+: pasted data
 *
 * Re-import safe: replaces existing rows for same name+territory.
 *
 * v2.2 changes:
 *   - Dropdown data validation on B1 (release name) and B2 (territory)
 *     for raw_import_release_territory
 *   - Default values: B1 = "Trying Times", B2 = "UK"
 *   - Stricter import-time validation: B1 must match VALID_RELEASES
 *   - VALID_TERRITORIES constant shared across both flows
 */

// ——— Constants ————————————————————————————————————————————

var VALID_RELEASES = ['Trying Times'];
var VALID_TERRITORIES = ['UK', 'US', 'DE', 'FR', 'AU', 'JP', 'BR', 'CA'];

// ——— Menu ————————————————————————————————————————————————

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Territory Data')
    .addItem('Import Track Data', 'importTerritoryData')
    .addItem('Import Release Data', 'importReleaseTerritoryData')
    .addSeparator()
    .addItem('View Import Summary', 'viewImportSummary')
    .addItem('Setup Tabs (first time)', 'setupTerritoryTabs')
    .addToUi();
}

// ——— Setup ———————————————————————————————————————————————

function setupTerritoryTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // --- Track-level tabs ---
  var raw = ss.getSheetByName('raw_import_territory');
  if (!raw) {
    raw = ss.insertSheet('raw_import_territory');
    raw.getRange('A1').setValue('TRACK NAME:');
    raw.getRange('A2').setValue('TERRITORY:');
    raw.getRange('A3').setValue('Paste date + streams data below the headers (row 5+). Then run Territory Data > Import Track Data.');
    raw.getRange('A4').setValue('date');
    raw.getRange('B4').setValue('streams');
    raw.getRange('A1:A2').setFontWeight('bold');
    raw.getRange('A4:B4').setFontWeight('bold').setBackground('#f3f3f3');
    raw.setColumnWidth(1, 140);
    raw.setColumnWidth(2, 140);
  }

  var trackMaster = ss.getSheetByName('track_daily_import_territory');
  if (!trackMaster) {
    trackMaster = ss.insertSheet('track_daily_import_territory');
    trackMaster.getRange('A1:D1').setValues([['date', 'track_name', 'territory', 'streams']]);
    trackMaster.getRange('A1:D1').setFontWeight('bold').setBackground('#f3f3f3');
    trackMaster.setColumnWidth(1, 120);
    trackMaster.setColumnWidth(2, 200);
    trackMaster.setColumnWidth(3, 100);
    trackMaster.setColumnWidth(4, 120);
  }

  // --- Release-level tabs ---
  var rawRelease = ss.getSheetByName('raw_import_release_territory');
  if (!rawRelease) {
    rawRelease = ss.insertSheet('raw_import_release_territory');
    rawRelease.getRange('A1').setValue('RELEASE NAME:');
    rawRelease.getRange('A2').setValue('TERRITORY:');
    rawRelease.getRange('A3').setValue('Paste date + streams data below the headers (row 5+). Then run Territory Data > Import Release Data.');
    rawRelease.getRange('A4').setValue('date');
    rawRelease.getRange('B4').setValue('streams');
    rawRelease.getRange('A1:A2').setFontWeight('bold');
    rawRelease.getRange('A4:B4').setFontWeight('bold').setBackground('#f3f3f3');
    rawRelease.setColumnWidth(1, 140);
    rawRelease.setColumnWidth(2, 140);
  }

  // Apply dropdown validation + defaults to release import tab (always, even if tab existed)
  var releaseNameRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_RELEASES, true)
    .setAllowInvalid(false)
    .setHelpText('Select a valid release name. Current options: ' + VALID_RELEASES.join(', '))
    .build();
  rawRelease.getRange('B1').setDataValidation(releaseNameRule);

  var territoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_TERRITORIES, true)
    .setAllowInvalid(false)
    .setHelpText('Select a territory. Options: ' + VALID_TERRITORIES.join(', '))
    .build();
  rawRelease.getRange('B2').setDataValidation(territoryRule);

  // Set defaults if cells are empty
  if (!String(rawRelease.getRange('B1').getValue()).trim()) {
    rawRelease.getRange('B1').setValue(VALID_RELEASES[0]);
  }
  if (!String(rawRelease.getRange('B2').getValue()).trim()) {
    rawRelease.getRange('B2').setValue('UK');
  }

  var releaseMaster = ss.getSheetByName('release_daily_import_territory');
  if (!releaseMaster) {
    releaseMaster = ss.insertSheet('release_daily_import_territory');
    releaseMaster.getRange('A1:D1').setValues([['date', 'release_name', 'territory', 'streams']]);
    releaseMaster.getRange('A1:D1').setFontWeight('bold').setBackground('#f3f3f3');
    releaseMaster.setColumnWidth(1, 120);
    releaseMaster.setColumnWidth(2, 200);
    releaseMaster.setColumnWidth(3, 100);
    releaseMaster.setColumnWidth(4, 120);
  }

  ui.alert('Setup Complete',
    'All tabs ready!\n\n' +
    'TRACK import:\n' +
    '  raw_import_territory > Import Track Data\n\n' +
    'RELEASE import:\n' +
    '  raw_import_release_territory > Import Release Data\n' +
    '  B1 dropdown: ' + VALID_RELEASES.join(', ') + '\n' +
    '  B2 dropdown: ' + VALID_TERRITORIES.join(', '),
    ui.ButtonSet.OK);
}

// ——— Shared import logic ————————————————————————————————

function _doImport(sourceTab, destTab, nameLabel, nameCol) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var raw = ss.getSheetByName(sourceTab);
  if (!raw) {
    ui.alert('Error', 'No "' + sourceTab + '" tab found.\n\nRun Territory Data > Setup Tabs first.', ui.ButtonSet.OK);
    return;
  }

  var itemName = String(raw.getRange('B1').getValue()).trim();
  if (!itemName) {
    ui.alert('Error', 'Pick a ' + nameLabel + ' from the dropdown in B1.', ui.ButtonSet.OK);
    return;
  }

  var territory = String(raw.getRange('B2').getValue()).trim();
  if (!territory) {
    ui.alert('Error', 'Pick a territory from the dropdown in B2.', ui.ButtonSet.OK);
    return;
  }

  var lastRow = raw.getLastRow();
  if (lastRow < 5) {
    ui.alert('Error',
      'No data found.\n\nPaste date + streams starting at row 5 (below headers in row 4).',
      ui.ButtonSet.OK);
    return;
  }

  var rawData = raw.getRange(5, 1, lastRow - 4, 2).getValues();
  var validRows = [];
  var skipped = 0;

  for (var i = 0; i < rawData.length; i++) {
    var dateVal = rawData[i][0];
    var streamsVal = rawData[i][1];

    if (!dateVal && (streamsVal === '' || streamsVal === null || streamsVal === undefined)) continue;

    var dateStr = '';
    if (dateVal instanceof Date) {
      dateStr = Utilities.formatDate(dateVal, 'UTC', 'yyyy-MM-dd');
    } else {
      dateStr = String(dateVal).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        skipped++;
        continue;
      }
    }

    var streams = Number(String(streamsVal).replace(/,/g, ''));
    if (isNaN(streams)) {
      skipped++;
      continue;
    }

    validRows.push([dateStr, itemName, territory, streams]);
  }

  if (validRows.length === 0) {
    ui.alert('Error',
      'No valid rows found.\n\n' +
      'Check that:\n' +
      '- Dates are in YYYY-MM-DD format\n' +
      '- Streams column has numbers\n' +
      '- Data starts at row 5' +
      (skipped > 0 ? '\n\n(' + skipped + ' rows skipped)' : ''),
      ui.ButtonSet.OK);
    return;
  }

  // Destination tab (auto-create if missing)
  var master = ss.getSheetByName(destTab);
  if (!master) {
    master = ss.insertSheet(destTab);
    master.getRange('A1:D1').setValues([['date', nameCol, 'territory', 'streams']]);
    master.getRange('A1:D1').setFontWeight('bold').setBackground('#f3f3f3');
  }

  // Upsert: remove existing rows for this name+territory, then append
  var existing = master.getDataRange().getValues();
  var keepRows = [existing[0]];

  for (var j = 1; j < existing.length; j++) {
    var rowName = String(existing[j][1]).trim();
    var rowTerritory = String(existing[j][2]).trim();
    if (rowName === itemName && rowTerritory === territory) continue;
    keepRows.push(existing[j]);
  }

  for (var k = 0; k < validRows.length; k++) {
    keepRows.push(validRows[k]);
  }

  master.clearContents();
  if (keepRows.length > 0) {
    master.getRange(1, 1, keepRows.length, keepRows[0].length).setValues(keepRows);
  }

  // Clear paste area
  if (lastRow >= 5) {
    raw.getRange(5, 1, lastRow - 4, 2).clearContent();
  }

  var dates = validRows.map(function(r) { return r[0]; }).sort();
  ui.alert('Import Complete',
    validRows.length + ' rows imported for "' + itemName + '" (' + territory + ').\n\n' +
    'Date range: ' + dates[0] + ' to ' + dates[dates.length - 1] +
    (skipped > 0 ? '\n(' + skipped + ' rows skipped)' : '') +
    '\n\nPaste area cleared. Ready for next import.',
    ui.ButtonSet.OK);
}

// ——— Track Import (existing) ————————————————————————————

function importTerritoryData() {
  _doImport('raw_import_territory', 'track_daily_import_territory', 'track name', 'track_name');
}

// ——— Release Import (with strict validation) ————————————

function importReleaseTerritoryData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var raw = ss.getSheetByName('raw_import_release_territory');
  if (!raw) {
    ui.alert('Error', 'No "raw_import_release_territory" tab found.\n\nRun Territory Data > Setup Tabs first.', ui.ButtonSet.OK);
    return;
  }

  // Strict validation: release name must be in VALID_RELEASES
  var releaseName = String(raw.getRange('B1').getValue()).trim();
  if (!releaseName) {
    ui.alert('Error', 'B1 is empty.\n\nSelect a release name from the dropdown.', ui.ButtonSet.OK);
    return;
  }

  var isValidRelease = false;
  for (var i = 0; i < VALID_RELEASES.length; i++) {
    if (VALID_RELEASES[i] === releaseName) { isValidRelease = true; break; }
  }
  if (!isValidRelease) {
    ui.alert('Error',
      'Invalid release name: "' + releaseName + '"\n\n' +
      'Valid releases:\n' + VALID_RELEASES.join('\n') + '\n\n' +
      'Select a valid release from the B1 dropdown.',
      ui.ButtonSet.OK);
    return;
  }

  // Strict validation: territory must be in VALID_TERRITORIES
  var territory = String(raw.getRange('B2').getValue()).trim();
  if (!territory) {
    ui.alert('Error', 'B2 is empty.\n\nSelect a territory from the dropdown.', ui.ButtonSet.OK);
    return;
  }

  var isValidTerritory = false;
  for (var j = 0; j < VALID_TERRITORIES.length; j++) {
    if (VALID_TERRITORIES[j] === territory) { isValidTerritory = true; break; }
  }
  if (!isValidTerritory) {
    ui.alert('Error',
      'Invalid territory: "' + territory + '"\n\n' +
      'Valid territories: ' + VALID_TERRITORIES.join(', ') + '\n\n' +
      'Select a valid territory from the B2 dropdown.',
      ui.ButtonSet.OK);
    return;
  }

  // All pre-checks passed — delegate to shared import logic
  _doImport('raw_import_release_territory', 'release_daily_import_territory', 'release name', 'release_name');
}

// ——— View Summary ————————————————————————————————————————

function viewImportSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var lines = ['Territory Import Summary', '==========================='];

  // Track data
  var trackMaster = ss.getSheetByName('track_daily_import_territory');
  if (trackMaster && trackMaster.getLastRow() > 1) {
    lines.push('', '--- TRACK-LEVEL DATA ---');
    var trackData = trackMaster.getDataRange().getValues().slice(1);
    var byCombo = _summarize(trackData);
    var keys = Object.keys(byCombo).sort();
    for (var i = 0; i < keys.length; i++) {
      var info = byCombo[keys[i]];
      var sorted = info.dates.sort();
      lines.push(keys[i] + '  (' + info.count + ' rows, ' + sorted[0] + ' to ' + sorted[sorted.length - 1] + ')');
    }
    lines.push('Total track rows: ' + trackData.length);
  }

  // Release data
  var releaseMaster = ss.getSheetByName('release_daily_import_territory');
  if (releaseMaster && releaseMaster.getLastRow() > 1) {
    lines.push('', '--- RELEASE-LEVEL DATA ---');
    var releaseData = releaseMaster.getDataRange().getValues().slice(1);
    var byCombo2 = _summarize(releaseData);
    var keys2 = Object.keys(byCombo2).sort();
    for (var j = 0; j < keys2.length; j++) {
      var info2 = byCombo2[keys2[j]];
      var sorted2 = info2.dates.sort();
      lines.push(keys2[j] + '  (' + info2.count + ' rows, ' + sorted2[0] + ' to ' + sorted2[sorted2.length - 1] + ')');
    }
    lines.push('Total release rows: ' + releaseData.length);
  }

  if (lines.length <= 2) {
    lines.push('', 'No data imported yet.');
  }

  ui.alert('Import Summary', lines.join('\n'), ui.ButtonSet.OK);
}

function _summarize(data) {
  var byCombo = {};
  for (var i = 0; i < data.length; i++) {
    var name = String(data[i][1]).trim();
    var terr = String(data[i][2]).trim();
    var key = name + ' | ' + terr;
    if (!byCombo[key]) byCombo[key] = { count: 0, dates: [] };
    byCombo[key].count++;
    byCombo[key].dates.push(String(data[i][0]));
  }
  return byCombo;
}
