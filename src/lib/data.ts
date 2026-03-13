import { CampaignData, SingleCampaignData, RegistryEntry } from "@/types";
import { mockCampaigns, mockMetrics, mockEvents } from "./mock-data";
export async function getActiveCampaigns(): Promise<RegistryEntry[]> {
  if (process.env.USE_MOCK_DATA === "true") {
    return mockCampaigns.map((c) => ({ campaign_id: c.campaign_id, artist_name: c.artist, campaign_name: c.campaign_name, sheet_url: "", sheet_id: "", status: "active" as const, campaign_owner: "Mock" }));
  }
  const { fetchActiveCampaigns } = await import("./sheets");
  return fetchActiveCampaigns();
}
export async function getSingleCampaignData(sheetId: string, campaignId: string): Promise<SingleCampaignData> {
  const { fetchCampaignSheetData } = await import("./sheets");
  return fetchCampaignSheetData(sheetId, campaignId);
}
export async function getCampaignData(): Promise<CampaignData> {
  if (process.env.USE_MOCK_DATA === "true") { return { campaigns: mockCampaigns, metrics: mockMetrics, events: mockEvents }; }
  const { fetchActiveCampaigns, fetchCampaignSheetData } = await import("./sheets");
  const entries = await fetchActiveCampaigns();
  const results = await Promise.all(entries.map((e) => fetchCampaignSheetData(e.sheet_id, e.campaign_id)));
  return { campaigns: results.map((r) => r.campaign), metrics: results.flatMap((r) => r.metrics), events: results.flatMap((r) => r.events) };
}
