import { CampaignData, SingleCampaignData, RegistryEntry } from "@/types";
import { mockCampaigns, mockMetrics, mockEvents } from "./mock-data";

// ─── Data Fetcher (mock or Google Sheets) ───────────────────────
// This file is server-only. Client components should import from
// @/lib/transforms instead for buildChartData / getFilteredEvents.

/**
 * Fetch all active campaigns from the registry.
 * Returns registry entries that can be used to populate a campaign picker.
 */
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

/**
 * Load data for a single campaign by its sheet_id.
 */
export async function getSingleCampaignData(
  sheetId: string,
  campaignId: string
): Promise<SingleCampaignData> {
  const { fetchCampaignSheetData } = await import("./sheets");
  return fetchCampaignSheetData(sheetId, campaignId);
}

/**
 * Load and merge all active campaigns into the combined CampaignData
 * format expected by the Dashboard component.
 *
 * Registry flow:
 *   1. Read campaign_registry → get active entries with sheet_ids
 *   2. For each active entry, read its campaign spreadsheet (3 tabs)
 *   3. Merge all campaigns, metrics, and events into one bundle
 */
export async function getCampaignData(): Promise<CampaignData> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    return {
      campaigns: mockCampaigns,
      metrics: mockMetrics,
      events: mockEvents,
    };
  }

  // Dynamic import keeps googleapis out of the client bundle
  const { fetchActiveCampaigns, fetchCampaignSheetData } = await import(
    "./sheets"
  );

  const entries = await fetchActiveCampaigns();

  // Load all campaign sheets in parallel
  const results = await Promise.all(
    entries.map((entry) =>
      fetchCampaignSheetData(entry.sheet_id, entry.campaign_id)
    )
  );

  // Merge into the combined shape Dashboard expects
  return {
    campaigns: results.map((r) => r.campaign),
    metrics: results.flatMap((r) => r.metrics),
    events: results.flatMap((r) => r.events),
  };
}
