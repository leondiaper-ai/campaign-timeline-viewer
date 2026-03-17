import { CampaignData, SingleCampaignData, RegistryEntry } from "@/types";
import {
  mockCampaigns,
  mockMetrics,
  mockEvents,
  mockTrackMetrics,
  mockTracksLookup,
} from "./mock-data";

// ——— Data Fetcher (mock or Google Sheets) ———————————————————
// This file is server-only. Client components should import from
// @/lib/transforms instead for buildChartData / getFilteredEvents.

export async function getActiveCampaigns(): Promise<RegistryEntry[]> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    return mockCampaigns.map((c) => ({
      campaign_id: c.campaign_id,
      artist_name: c.artist,
      campaign_name: c.campaign_name,
      sheet_url: "",
      sheet_id: "",
      status: "active" as const,
      campaign_owner: "Mock",
    }));
  }

  const { fetchActiveCampaigns } = await import("./sheets");
  return fetchActiveCampaigns();
}

export async function getSingleCampaignData(
  sheetId: string,
  campaignId: string
): Promise<SingleCampaignData> {
  const { fetchCampaignSheetData } = await import("./sheets");
  return fetchCampaignSheetData(sheetId, campaignId);
}

export async function getCampaignData(): Promise<CampaignData> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    return {
      campaigns: mockCampaigns,
      metrics: mockMetrics,
      events: mockEvents,
      trackMetrics: mockTrackMetrics,
      tracksLookup: mockTracksLookup,
    };
  }

  const { fetchActiveCampaigns, fetchCampaignSheetData } = await import(
    "./sheets"
  );

  const entries = await fetchActiveCampaigns();

  const results = await Promise.all(
    entries.map((entry) =>
      fetchCampaignSheetData(entry.sheet_id, entry.campaign_id)
    )
  );

  return {
    campaigns: results.map((r) => r.campaign),
    metrics: results.flatMap((r) => r.metrics),
    events: results.flatMap((r) => r.events),
    trackMetrics: results.flatMap((r) => r.trackMetrics),
    tracksLookup: results.flatMap((r) => r.tracksLookup),
  };
}
