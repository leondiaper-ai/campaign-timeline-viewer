import { NextResponse } from "next/server";
import { getCampaignData } from "@/lib/data";

export const dynamic = "force-dynamic"; // no ISR cache

export async function GET() {
  try {
    const data = await getCampaignData();
    const results = data.campaigns.map((c) => {
      const s = c.sheet;
      const dtd = s.dailyTrackData || [];
      const dtt = s.dailyTerritoryData || [];
      const wd = s.weeklyData || [];
      const ph = s.physicalData || [];
      const mom = s.moments || [];

      const globalDates = dtd.map(r => r.date).sort();
      const ukRows = dtt.filter(r => r.territory === "UK");
      const ukDates = ukRows.map(r => r.date).sort();

      return {
        campaign_id: c.campaign_id,
        setup: s.setup,
        tracks: s.tracks.map(t => t.track_name),
        dailyTrackData: {
          count: dtd.length,
          tracks: [...new Set(dtd.map(r => r.track_name))],
          dateRange: globalDates.length ? `${globalDates[0]} → ${globalDates[globalDates.length - 1]}` : "empty",
          first5: dtd.slice(0, 5),
          last5: dtd.slice(-5),
        },
        dailyTerritoryData: {
          count: dtt.length,
          territories: [...new Set(dtt.map(r => r.territory))],
          ukCount: ukRows.length,
          ukTracks: [...new Set(ukRows.map(r => r.track_name))],
          ukDateRange: ukDates.length ? `${ukDates[0]} → ${ukDates[ukDates.length - 1]}` : "empty",
          ukDates: [...new Set(ukDates)],
          ukFirst5: ukRows.slice(0, 5),
          ukLast5: ukRows.slice(-5),
        },
        weeklyData: {
          count: wd.length,
          trackNames: [...new Set(wd.map(r => r.track_name))],
          dates: [...new Set(wd.map(r => r.week_start_date))].sort(),
          ukNonZeroCount: wd.filter(r => r.streams_uk > 0).length,
          first5: wd.slice(0, 5),
          last5: wd.slice(-5),
        },
        physicalData: { count: ph.length, first3: ph.slice(0, 3) },
        moments: { count: mom.length, first3: mom.slice(0, 3) },
      };
    });
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("Debug route error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
