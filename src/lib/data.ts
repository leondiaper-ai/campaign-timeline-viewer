import { AppData, LoadedCampaign } from "@/types";
import { fetchActiveCampaigns, fetchCampaignSheetData } from "./sheets";

export async function getCampaignData(): Promise<AppData> {
  const registry = await fetchActiveCampaigns();

  if (registry.length === 0) {
    console.warn("[CTV] No active campaigns in registry.");
    return { campaigns: [] };
  }

  const campaigns: LoadedCampaign[] = [];

  for (const entry of registry) {
    try {
      const sheet = await fetchCampaignSheetData(entry.sheet_id);
      campaigns.push({
        campaign_id: entry.campaign_id,
        sheet,
      });
    } catch (err) {
      console.error(
        `[CTV] Failed to load campaign "${entry.campaign_name}":`,
        err
      );
    }
  }

  return { campaigns };
}
