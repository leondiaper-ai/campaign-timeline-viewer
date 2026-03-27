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

import type {
  AirtableCampaignData,
  AirtableCampaign,
  AirtableEvent,
  AirtableDailyMetric,
  AirtableTrackMetric,
} from "./airtable-schema";
// ═══════════════════════════════════════════════════════════════
// MAIN ADAPTER: Airtable → CampaignSheetData
// ═══════════════════════════════════════════════════════════════

export function airtableToCampaignSheet(data: AirtableCampaignData): CampaignSheetData {
  const { campaign, events, dailyMetrics, trackMetrics } = data;
  return {
    setup: campaignToSetup(campaign),
    tracks: campaignToTracks(campaign),
    weeklyData: dailyMetricsToWeeklyData(dailyMetrics),
    physicalData: dailyMetricsToPhysicalData(dailyMetrics),
    moments: eventsToMoments(events),
    dailyTrackData: trackMetricsToDailyTrackData(trackMetrics),
    dailyTerritoryData: trackMetricsToDailyTerritoryData(trackMetrics),
    dailyReleaseTerritoryData: dailyMetricsToReleaseTerritoryData(dailyMetrics),
    ukContext: [], // Derived from track metrics at query time; no longer a separate tab
    paidCampaigns: eventsToPaidCampaigns(events),
    learnings: campaignToLearnings(campaign),
    d2cSales: dailyMetricsToD2CSales(dailyMetrics),(����)�