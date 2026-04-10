import { getDemoCampaigns } from './src/lib/demo-campaigns';
import { buildChartData, getAllTrackNames } from './src/lib/transforms';

const appData = getDemoCampaigns();
for (const c of appData.campaigns) {
  const s = c.sheet;
  const names = getAllTrackNames(s);
  const data = buildChartData(s, 'global', names);
  const sortedDates = data.map((d: any) => d.date).sort();
  
  console.log(`\n=== ${s.setup.artist_name} ===`);
  console.log(`Chart dates: ${sortedDates[0]} to ${sortedDates[sortedDates.length-1]} (${sortedDates.length} points)`);
  
  // Test interpolation for each key moment
  const keyMoments = s.moments.filter((m: any) => m.is_key);
  for (const m of keyMoments) {
    const idx = sortedDates.indexOf(m.date);
    let pct: number;
    if (idx >= 0) {
      pct = sortedDates.length > 1 ? (idx / (sortedDates.length - 1)) * 100 : 50;
    } else {
      const mTime = new Date(m.date).getTime();
      const firstTime = new Date(sortedDates[0]).getTime();
      const lastTime = new Date(sortedDates[sortedDates.length - 1]).getTime();
      pct = lastTime > firstTime ? ((mTime - firstTime) / (lastTime - firstTime)) * 100 : 50;
    }
    console.log(`  ${m.date} → ${pct.toFixed(1)}% | ${m.moment_title}`);
  }
}
