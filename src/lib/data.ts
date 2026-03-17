import { AppData } from "@/types";
import { fetchActiveCampaigns, fetchCampaignSheetData } from "./sheets";

export async function getCampaignData(): Promise<AppData> {
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
