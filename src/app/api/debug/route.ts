import { NextResponse } from "next/server";
import { fetchActiveCampaigns, debugTerritoryData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await fetchActiveCampaigns();
    const results = await Promise.all(
      entries.map(async (entry) => ({
        campaign_id: entry.campaign_id,
        sheet_id: entry.sheet_id,
        territory_debug: await debugTerritoryData(entry.sheet_id),
      }))
    );
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("Debug route error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
