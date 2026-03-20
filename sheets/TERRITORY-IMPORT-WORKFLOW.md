# Territory Data Import Workflow

## Overview

This document covers the operational workflow for importing territory-specific track data (e.g. UK) into campaign Google Sheets, so it can power the territory toggle in the Campaign Timeline Viewer alongside the existing global data.

The app reads one tab: `weekly_metrics`. Everything in this workflow exists to get clean, validated data into that tab.

---

## Sheet Tab Structure (per campaign)

Each campaign Google Sheet should contain these tabs:

### Existing tabs (unchanged)

| Tab | Purpose |
|-----|---------|
| `campaign_setup` | Campaign metadata (1 row) |
| `campaign_moments` | Campaign events/timeline |
| `weekly_metrics` | **App reads this.** Weekly aggregated metrics by territory |

### New tabs (added by this workflow)

| Tab | Purpose |
|-----|---------|
| `tracks` | Track definitions — ISRC lookup table |
| `raw_daily_global` | Raw paste target for global Spotify daily CSV |
| `raw_daily_UK` | Raw paste target for UK Spotify daily CSV |
| `import_log` | Audit trail of import/aggregation operations |

---

## Tab Schemas

### `tracks`

One row per track in the campaign. This is the source of truth for which ISRCs belong to this campaign.

| Column | Type | Required | Example |
|--------|------|----------|---------|
| track_name | text | yes | Weightless |
| isrc | text | yes | GBUM72600001 |
| role | text | yes | lead_single / album_track / promo_single |
| release_date | YYYY-MM-DD | yes | 2026-01-19 |
| spotify_uri | text | no | spotify:track:abc123 |

The `role` values are freeform but these are the suggested conventions:
- `lead_single` — first single released
- `promo_single` — promotional single (not the lead)
- `album_track` — standard album track
- `focus_track` — chosen for playlist pitching but not a formal single
- `bonus_track` — deluxe/bonus content

### `raw_daily_global` and `raw_daily_UK`

One row per track per day. This is where you paste raw Spotify data.

| Column | Type | Required | Example |
|--------|------|----------|---------|
| date | YYYY-MM-DD | yes | 2026-01-19 |
| isrc | text | yes | GBUM72600001 |
| track_name | text | yes | Weightless |
| streams | number | yes | 84200 |

**Important notes:**
- `track_name` is for human readability — the script uses `isrc` as the join key
- Dates must be in YYYY-MM-DD format
- Each ISRC should appear exactly once per date (no duplicates)
- It's fine if UK data has fewer tracks or dates than global — the system handles gaps

### `weekly_metrics` (existing — no changes)

This is what the app reads. The aggregation script writes here.

| Column | Type | Example |
|--------|------|---------|
| week_ending | YYYY-MM-DD | 2026-01-24 |
| territory | text | global / UK |
| total_streams | number | 524300 |
| retail_units | number | 1200 |
| d2c_units | number | 680 |

### `import_log`

Automatic audit trail. You don't edit this manually.

| Column | Type | Example |
|--------|------|---------|
| timestamp | ISO datetime | 2026-03-20T14:30:00.000Z |
| territory | text | UK |
| action | text | aggregate |
| rows | number | 280 |
| date_range | text | 2026-01-19 → 2026-03-13 |
| notes | text | 8 weeks written |

---

## Setup (one-time per campaign sheet)

1. Open the campaign Google Sheet
2. Go to **Extensions > Apps Script**
3. Delete any existing code in the editor
4. Paste the contents of `territory-import.gs`
5. Click **Save** (floppy disk icon)
6. Close the Apps Script editor
7. Reload the Google Sheet — you should see a **Territory Import** menu in the toolbar
8. Click **Territory Import > Setup > Create territory tabs (first-time)**
9. Fill in the `tracks` tab with your track definitions (ISRC, role, etc.)

---

## Import Workflow

### Importing global data

1. Export daily track-level data from Spotify for Artists (global)
2. Open the campaign Google Sheet
3. Go to the `raw_daily_global` tab
4. **Clear the existing data** (select all data rows, delete — leave the header)
5. Paste the new CSV data starting from row 2
6. Click **Territory Import > Validate raw data (Global)**
7. Fix any issues the validator flags
8. Click **Territory Import > Aggregate to weekly (Global)**
9. Check `weekly_metrics` — global rows should be updated

### Importing UK data

Identical process, using the UK tab:

1. Export daily track-level data from Spotify for Artists (UK territory)
2. Go to the `raw_daily_UK` tab
3. **Clear the existing data** (leave the header)
4. Paste the new CSV data
5. Click **Territory Import > Validate raw data (UK)**
6. Fix any issues
7. Click **Territory Import > Aggregate to weekly (UK)**
8. Check `weekly_metrics` — UK rows should appear alongside global

### Re-importing (updating data)

When you get updated or corrected data for a territory:

1. Go to the appropriate `raw_daily_*` tab
2. Clear all data rows (leave header)
3. Paste the new/corrected data
4. Validate, then Aggregate

**The aggregation script replaces stream data for that territory** but preserves any manually-entered physical units (retail_units, d2c_units). This means you can safely re-import streams without losing physical sales data you've entered by hand.

---

## How Aggregation Works

The script converts daily track-level data into weekly campaign-level totals:

1. **Reads** all rows from the `raw_daily_*` tab
2. **Buckets** each daily date into a week (based on the configured week-ending day — default Friday)
3. **Sums** streams across all tracks for each week
4. **Reads** existing `weekly_metrics` to find any manually-entered physical units for this territory
5. **Writes** new weekly rows: aggregated streams + preserved physical units
6. **Preserves** all rows for other territories (e.g. aggregating UK doesn't touch global rows)
7. **Logs** the operation to `import_log`

### Week-ending alignment

The script uses Friday as the default week-ending day (configurable via `WEEK_ENDING_DAY` in the script). If your existing `weekly_metrics` uses a different convention (e.g. Sunday or Monday), change this constant to match.

For reference: 0 = Sunday, 1 = Monday, 5 = Friday, 6 = Saturday.

---

## Handling Patchy Territory Data

Spotify territory data is often incomplete. This workflow handles that by design:

**Missing tracks**: If UK data only has 3 of 5 campaign tracks, the script aggregates what's there. The weekly total will be lower, which is correct — it reflects actual reported UK streams.

**Missing dates**: If UK data has gaps (e.g. missing a few days mid-campaign), the script still buckets available dates into weeks. A week with 4 days of data instead of 7 will show lower totals. The validator will flag gaps so you can decide whether to re-export.

**Missing weeks entirely**: If UK data only covers weeks 3–8 of a 14-week campaign, only those weeks get UK rows in `weekly_metrics`. The app handles this gracefully — the chart shows data where it exists and nothing where it doesn't.

**No territory data at all**: If `raw_daily_UK` is empty, no UK rows appear in `weekly_metrics`, and the global toggle continues to work normally. The UK toggle will show an empty chart (no crash, just no data).

---

## Connection to the App

The app's data path is:

```
Google Sheet: weekly_metrics tab
  → sheets.ts: fetchCampaignMetrics() reads columns A–E
  → transforms.ts: buildChartData() filters by territory
  → Dashboard: territory state selects "global" or "UK"
  → PerformanceChart: renders the filtered data
```

This workflow feeds clean data into the top of that chain. Nothing in the app code needs to change — it already reads the territory column and filters on it.

The only thing the app does NOT currently do is show a fallback message when territory data is missing. That's a future UI enhancement (showing "No UK data available for this period" instead of an empty chart), but it's cosmetic — the pipeline works without it.

---

## Checklist: Adding a New Territory

If you want to add a territory beyond UK (e.g. US, DE, AU):

1. Add the territory code to the `TERRITORIES` array in the Apps Script
2. Re-run **Create territory tabs** — it will create a `raw_daily_{territory}` tab
3. Add menu items for the new territory in `onOpen()` (validate + aggregate)
4. In the app: add the territory to the `Territory` type in `src/types/index.ts`
5. In the app: add the territory option in `TerritoryToggle.tsx`

That's it. The rest of the pipeline (aggregation, filtering, charting) works automatically for any territory value.

---

## Troubleshooting

**"Validation issues" after pasting**: Most common cause is date format. Spotify exports sometimes use DD/MM/YYYY or MM/DD/YYYY instead of YYYY-MM-DD. Reformat in the sheet or use a text-to-columns approach before validating.

**Streams look wrong after aggregation**: Check that the `WEEK_ENDING_DAY` matches your existing `weekly_metrics` convention. If they use different week boundaries, the same daily data will sum into different weekly buckets.

**Physical units disappeared**: They shouldn't — the script preserves them. But if you cleared `weekly_metrics` manually before aggregating, the physical data is gone. Re-enter it after aggregation.

**UK data shows in the app but looks low**: This is probably correct. UK is typically 15–20% of global streams. If it looks unexpectedly low, check whether the raw data is complete (run Import Status).
