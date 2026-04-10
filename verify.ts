import { getDemoCampaigns } from './src/lib/demo-campaigns';
import { buildChartData, getAllTrackNames } from './src/lib/transforms';
const appData = getDemoCampaigns();
for (const c of appData.campaigns) {
  const s = c.sheet;
  const names = getAllTrackNames(s);
  const data = buildChartData(s, 'global', names);
  const peak = Math.max(...data.map((d: any) => d.total_streams));
  // Key tracks (lead/second/focus)
  const keyTracks = s.tracks.filter((t: any) => ['lead_single','second_single','focus_track'].includes(t.track_role));
  console.log(`\n=== ${s.setup.artist_name} ===`);
  console.log(`Total: ${data.length} weeks, peak ${peak.toLocaleString()}`);
  console.log(`Key tracks: ${keyTracks.map((t: any) => `${t.track_name} [${t.track_role}]`).join(', ')}`);
  // Verify track data exists in chart points
  const peakWeek = data.find((d: any) => d.total_streams === peak);
  if (peakWeek) {
    console.log(`Peak week (${peakWeek.date}):`);
    for (const t of keyTracks) {
      const val = peakWeek[t.track_name];
      console.log(`  ${t.track_name}: ${val != null ? val.toLocaleString() : 'NULL'}`);
    }
  }
}
