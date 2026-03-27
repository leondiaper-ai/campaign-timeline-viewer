# Airtable Migration Guide

## Overview

This migration replaces the 13-tab Google Sheet data model with 4 lean Airtable tables, without changing any UI components. A bidirectional adapter layer translates between formats.

## Architecture

```
Current:  Google Sheets → sheets.ts → CampaignSheetData → UI
Future:   Airtable API  → airtable-loader.ts → airtable-adapter.ts → CampaignSheetData → UI
                                                      ↑
                                            (same interface — no UI changes)
```

## Table Mapping: 13 Tabs → 4 Tables

### TABLE A: Campaigns (1 row per campaign)
Replaces: `campaign_setup` + `tracks` + `campaign_learnings`

| Airtable Field | Source Tab | Source Column |
|---|---|---|
| `id` | campaign_setup | (derived from campaign_id) |
| `artist_name` | campaign_setup | artist_name |
| `campaign_name` | campaign_setup | campaign_name |
| `release_name` | campaign_setup | campaign_name |
| `campaign_type` | campaign_setup | campaign_type |
| `territory_focus` | campaign_setup | default_territory |
| `release_date` | campaign_setup | release_date |
| `campaign_state` | (computed) | pre_release / live / post_release |
| `chart_result` | campaign_setup | chart_result |
| `chart_forecast` | campaign_setup | chart_forecast |
| `outcome_driver` | campaign_setup | outcome_driver |
| `team_push` | campaign_setup | team_push_push |
| `team_support` | campaign_setup | team_push_support |
| `team_next` | campaign_setup | team_push_next |
| `tracks[]` | tracks | (denormalized array) |
| `learnings[]` | campaign_learnings | (denormalized array) |

### TABLE B: Campaign Events (1 row per moment/event)
Replaces: `moments` + `paid_campaigns`

| Airtable Field | Source Tab | Source Column |
|---|---|---|
| `id` | (generated) | - |
| `campaign_id` | (FK) | → Campaigns.id |
| `date` | moments | date |
| `title` | moments | moment_title |
| `event_type` | moments | moment_type |
| `priority` | moments | is_key → "key" / "supporting" |
| `platform` | paid_campaigns | platform |
| `territory` | paid_campaigns | territory |
| `spend` | paid_campaigns | spend |
| `spend_planned` | paid_campaigns | spend_planned |
| `intent_total` | paid_campaigns | intent_total |

### TABLE C: Daily Metrics (1 row per date × territory)
Replaces: `weekly_data` + `physical_data` + `d2c_sales` + `release_daily_import_territory`

| Airtable Field | Source Tab | Source Column |
|---|---|---|
| `id` | (generated) | - |
| `campaign_id` | (FK) | → Campaigns.id |
| `date` | various | date field |
| `territory` | various | territory |
| `release_streams` | release_daily_import_territory | streams |
| `uk_physical` | physical_data | units |
| `global_physical` | (new) | - |
| `uk_d2c` | d2c_sales | uk_d2c_sales |
| `global_d2c` | d2c_sales | global_d2c_sales |
| `campaign_spend` | (new) | - |

### TABLE D: Track Daily Metrics (1 row per date × track × territory)
Replaces: `track_daily_import` + `track_daily_import_territory` + `track_uk_context`

| Airtable Field | Source Tab | Source Column |
|---|---|---|
| `id` | (generated) | - |
| `campaign_id` | (FK) | → Campaigns.id |
| `date` | track_daily_import | date |
| `track_name` | track_daily_import | track_name |
| `territory` | track_daily_import_territory | territory |
| `streams` | various | streams field |

## File Structure

```
src/lib/
├── airtable-schema.ts     # TypeScript interfaces for 4 Airtable tables
├── airtable-adapter.ts    # Bidirectional converter: Airtable ↔ CampaignSheetData
├── airtable-loader.ts     # Data fetching: Airtable API + round-trip tester
├── sheets.ts              # Existing Google Sheets loader (unchanged)
├── data.ts                # Existing app data loader (unchanged)
└── AIRTABLE_MIGRATION.md  # This file
```

## Adapter Functions

### Forward: Airtable → UI
```typescript
import { airtableToCampaignSheet } from "./airtable-adapter";
const sheet: CampaignSheetData = airtableToCampaignSheet(airtableData);
```

### Reverse: UI → Airtable (for migration)
```typescript
import { campaignSheetToAirtable } from "./airtable-adapter";
const airtable: AirtableCampaignData = campaignSheetToAirtable("campaign-id", sheet);
```

## Migration Steps

### Phase 1: Validate (current)
1. Schema + adapter are built and committed
2. Round-trip testing available via `fetchViaAirtableRoundTrip()`
3. Run diagnostics to confirm adapter fidelity

### Phase 2: Create Airtable Base
1. Create an Airtable base with 4 tables matching `airtable-schema.ts`
2. Use `campaignSheetToAirtable()` to export existing campaigns
3. Import JSON into Airtable (via API or CSV upload)

### Phase 3: Wire Airtable API
1. Set env vars: `AIRTABLE_BASE_ID`, `AIRTABLE_API_KEY`
2. In `page.tsx`, switch from `fetchCampaignSheetData()` to `fetchFromAirtable()`
3. Test with one campaign first, then cut over all

### Phase 4: Deprecate Google Sheets
1. Remove Google Sheets credentials from env
2. Remove `sheets.ts` fetch functions (keep as archive)
3. Remove `googleapis` dependency

## Round-Trip Testing

To verify the adapter works correctly before cutting over:

```typescript
// In any page.tsx or API route:
import { fetchViaAirtableRoundTrip } from "@/lib/airtable-loader";

const sheet = await fetchViaAirtableRoundTrip(
  "1abc...",           // Google Sheet ID
  "james-blake-test",  // campaign ID for Airtable keys
  { log: true }        // prints comparison diagnostics
);
```

This fetches from Google Sheets, converts to Airtable format, converts back, and logs any differences.

## Known Differences

The round-trip is not perfectly lossless — some data is intentionally simplified:

1. **ukContext**: Emptied (was manual annotations, rarely used)
2. **Weekly aggregation**: Daily → weekly grouping may differ slightly from original weekly imports due to day-of-week boundaries
3. **intent_super / intent_moderate**: Zeroed in paid campaigns (granular intent splits not carried to Airtable events)
4. **campaign_objective**: Not mapped to Airtable events (rarely populated)

These are acceptable trade-offs — the fields are either unused by the UI or have negligible impact on chart rendering.
