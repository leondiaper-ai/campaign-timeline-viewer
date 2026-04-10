import { getDemoCampaigns } from './src/lib/demo-campaigns';
import { buildChartData, getAllTrackNames } from './src/lib/transforms';

// Replicate the layout logic from TimelineChart
type MomentMeaning = "release" | "editorial" | "paid" | "live";
const MEANING_COLORS: Record<MomentMeaning, string> = {
  release: "#8B5CF6", editorial: "#10B981", paid: "#F59E0B", live: "#EF4444",
};

function getMomentMeaning(m: any): MomentMeaning {
  const type = m.moment_type.toLowerCase();
  const title = m.moment_title.toLowerCase();
  if (type === "music" || title.includes("single") || title.includes("album") || title.includes("release")) return "release";
  if (type === "editorial" || title.includes("playlist")) return "editorial";
  if (type === "marquee" || type === "showcase" || type === "paid" || type === "marketing") return "paid";
  if (type === "live" || type === "tour" || type === "media" || title.includes("tour") || title.includes("festival")) return "live";
  return "release";
}

const appData = getDemoCampaigns();
for (const c of appData.campaigns) {
  const s = c.sheet;
  const names = getAllTrackNames(s);
  const data = buildChartData(s, 'global', names);
  const chartDates = data.map((d: any) => d.date).sort();

  // Merge paid campaign moments (same as Dashboard)
  const allMoments = [...s.moments];
  if (s.paidCampaigns) {
    const seen = new Set<string>();
    for (const pc of s.paidCampaigns) {
      if (pc.start_date) {
        const key = `${pc.start_date}|${pc.platform}`;
        if (!seen.has(key)) {
          seen.add(key);
          allMoments.push({ date: pc.start_date, moment_title: `${pc.platform} (${pc.territory})`, moment_type: "marquee", is_key: true });
        }
      }
    }
  }

  const keyMoments = allMoments.filter((m: any) => m.is_key);
  console.log(`\n=== ${s.setup.artist_name} — ${keyMoments.length} key moments ===`);
  for (const m of keyMoments.sort((a: any, b: any) => a.date.localeCompare(b.date))) {
    const meaning = getMomentMeaning(m);
    const idx = chartDates.indexOf(m.date);
    const pct = chartDates.length > 1 ? (idx >= 0 ? (idx / (chartDates.length - 1)) * 100 : -1) : 50;
    console.log(`  ${m.date} | ${meaning.padEnd(10)} | pct=${pct.toFixed(1)}% | ${m.moment_title}`);
  }
}
