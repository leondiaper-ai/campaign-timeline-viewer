# Territory Import Pipeline — Setup Guide

## What This Does

Adds a normalized territory data pipeline to each campaign sheet. Instead of editing `track_metrics` directly, you paste raw territory data into a **staging tab**, run an import, and the system normalizes, deduplicates, and upserts it into a **master tab** that the app reads from.

The pipeline: `territory_staging` → (import) → `territory_master` → (app reads)

## Install (one time per campaign sheet)

1. Open the campaign sheet (e.g. James Blake)
2. Go to **Extensions → Apps Script**
3. Delete any existing code in the editor
4. Paste the entire contents of `scripts/territory-import.gs`
5. Click **Save** (💾)
6. Close the Apps Script editor
7. **Reload** the Google Sheet (Cmd+R / F5)
8. You should see a new **"Territory Data"** menu in the menu bar
9. Click **Territory Data → Setup Tabs (first time)**

This creates three tabs:
- `territory_staging` — paste raw CSV data here
- `territory_master` — normalized, deduplicated master (app reads from this)
- `import_log` — audit trail of every import

If `track_metrics` already has territory data, it will be auto-seeded into `territory_master`.

## Importing New Data

1. Paste your raw CSV data into `territory_staging` (starting at row 2, under the headers)
   - Required columns: `date`, `streams`
   - Recommended: `track_name`, `territory`, `source`
   - Flexible headers — it detects common aliases like `week_ending`, `plays`, `country`, etc.
2. Click **Territory Data → Import Staged Data**
3. Review the summary (inserted vs updated counts, any warnings)
4. Choose whether to clear staging

The import uses **upsert logic** — key is `date|track_name|territory`. If a row already exists in the master, it updates the streams value. Otherwise it inserts a new row.

## Data Formats Accepted

**Dates**: `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, or Google Sheets date objects

**Territories**: `UK`, `GB`, `United Kingdom`, `US`, `USA`, `DE`, `FR`, `global`, `WW`, or blank (defaults to global)

**Track names**: Smart quotes are normalized automatically. Extra whitespace is trimmed.

**Streams**: Numbers with commas, percentage signs, or currency symbols are cleaned automatically.

## Validation

Click **Territory Data → Validate Master Data** at any time to see:
- Row counts per territory
- Date ranges and gaps
- Cross-territory completeness checks (e.g. "UK missing data for these dates")

## How the App Uses This

The app (`sheets.ts`) reads territory data in this priority order:

1. **`territory_master`** — preferred source (normalized, deduplicated)
2. **`track_daily_import_territory`** — legacy tab (backward compat)
3. **`track_metrics`** — fallback (extracts non-global rows)

Once you've set up `territory_master` and imported your data, the app will automatically use it. No code changes needed.
