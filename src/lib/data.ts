import { AppData } from "@/types";
import { fetchActiveCampaigns, fetchCampaignSheetData } from "./sheets";
import { fetchFromAirtable } from "./airtable-loader";

/**
 * Primary data loader.
 *
 * Strategy:
 *   1. If AIRTABLE_BASE_ID + AIRTABLE_API_KEY are set → fetch from Airtable
 *   2. Otherwise → fetch from Google Sheets (original behavior)
 *
 * Either way, returns AppData with CampaignSheetData — the UI doesn't change.
 */
export async function getCampaignData(): Promise<AppData> {
  const useAirtable =
    !!process.env.AIRTABLE_BASE_ID && !!process.env.AIRTABLE_API_KEY;

  if (useAirtable) {
    return getCampaignDataFromAirtable();
  }

  return getCampaignDataFromSheets();
}

/** Fetch all campaigns from Google Sheets (original path) */
async function getCampaignDataFromSheets(): Promise<AppData> {
  const entries = await fetchActiveCampaigns();
  const campaigns = await Promise.all(
    entries.map(async (entry) => {
      const sheet = await fetchCampaignSheetData(entry.sheet_id);
      return {
        campaign_id: entry.campaign_id,
        sheet,
        trackWeeklyMetrics: [], // Empty until track_weekly_streams tab exists
      };
    })
  );
  return { campaigns };
}

/** Fetch all campaigns from Airtable */
async function getCampaignDataFromAirtable(): Promise<AppData> {
  // For now, we still use the registry to discover campaign IDs.
  // In the future, we can query the Airtable Campaigns table directly.
  const entries = await fetchActiveCampaigns();
  const campaigns = await Promise.all(
    entries.map(async (entry) => {
      try {
        const sheet = await fetchFromAirtable(entry.campaign_id);
        return {
          campaign_id: entry.campaign_id,
          sheet,
          trackWeeklyMetrics: [],
        };
      } catch (err) {
        // Fallback to Google Sheets if Airtable fetch fails for a campaign
        console.warn(
          `[CTV] Airtable fetch failed for ${entry.campaign_id}, falling back to Sheets:`,
          err instanceof Error ? err.message : err
        );
        const sheet = await fetchCampaignSheetData(entry.sheet_id);
        return {
          campaign_id: entry.campaign_id,
          sheet,
          trackWeeklyMetrics: [],
        };
      }
    })
  );
  return { campaigns };
}

// Daily data pipeline v2
