/**
 * Airtable → CampaignSheetData adapter.
 *
 * This is the single translation layer between the new Airtable-shaped
 * data model and the existing UI. No component changes needed.
 *
 * Direction: AirtableCampaignData → CampaignSheetData
 *
 * The UI continues to consume CampaignSheetData exactly as before.
 * When we eventually wire a real Airtable backend, we just change
 * how AirtableCampaignData is fetched — the adapter stays the same.
 */

import type {
  CampaignSheetData,
  CampaignSetup,
  Track,
  WeeklyRow,
  PhysicalRow,
  Moment,
  DailyTrackRow,
  DailyTerritoryRow,
  DailyReleaseTerritoryRow,
  UKContextRow,
  PaidCampaignRow,
  ManualLearning,
  D2CSalesRow,
  Territory,
} from "@/types";
