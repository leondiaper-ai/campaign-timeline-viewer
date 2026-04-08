import { AppData } from "@/types";
import { fetchActiveCampaigns, fetchCampaignSheetData } from "./sheets";
import { fetchFromAirtable } from "./airtable-loader";
import { getDemoCampaigns, shouldUseDemoData } from "./demo-campaigns";

/**
 * Primary data loader.
 *
 * Strategy:
 *   1. If no API keys configured → use demo campaigns (curated scenarios)
 *   2. If AIRTABLE_BASE_ID + AIRTABLE_API_KEY are set → fetch from Airtable
 *   3. Otherwise → fetch from Google Sheets (original behavior)
 *   4. If Sheets/Airtable fail → fall back to demo campaigns
 *
 * Either way, returns AppData with CampaignSheetData — the UI doesn't change.
 */
export async function getCampaignData(): Promise<AppData> {
  // No API keys → demo mode
  if (shouldUseDemoData()) {
    return getDemoCampaigns();
  }

  const useAirtable =
    !!process.env.AIRTABLE_BASE_ID && !!process.env.AIRTABLE_API_KEY;

  try {
    let data: AppData;
    if (useAirtable) {
      data = await getCampaignDataFromAirtable();
    } else {
      data = await getCampaignDataFromSheets();
    }

    // If no campaign has key track roles (lead_single, second_single, focus_track),
    // the Tracks view won't work. Fall back to curated demo campaigns.
    const KEY_ROLES = ["lead_single", "second_single", "focus_track"];
    const hasKeyTracks = data.campaigns.some(c =>
      c.sheet.tracks && c.sheet.tracks.length > 0 &&
      c.sheet.tracks.some(t => KEY_ROLES.includes(t.track_role)) &&
      c.sheet.weeklyData && c.sheet.weeklyData.length >= 8
    );

    if (!hasKeyTracks) {
      console.warn("[CTV] No campaign has key track roles with enough data. Using demo campaigns.");
      return getDemoCampaigns();
    }

    return data;
  } catch (err) {
    console.warn("[CTV] Data fetch failed, falling back to demo campaigns:", err instanceof Error ? err.message : err);
    return getDemoCampaigns();
  }
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

/** Check if the returned data is demo data (used for UI labeling) */
export function isDemoData(data: AppData): boolean {
  const demoIds = new Set(["k-trap-album-2026", "james-blake-trying-times"]);
  return data.campaigns.length > 0 && data.campaigns.every(c => demoIds.has(c.campaign_id));
}

// Daily data pipeline v2
