import { getDemoCampaigns } from './src/lib/demo-campaigns';
const appData = getDemoCampaigns();
for (const c of appData.campaigns) {
  const s = c.sheet;
  console.log(`\n=== ${s.setup.artist_name} ===`);
  console.log('Tracks:', s.tracks.map((t: any) => `${t.track_name} [${t.track_role}] default_on=${t.default_on}`));
  console.log('dailyTrackData rows:', s.dailyTrackData.length);
  // Show track data for first 2 dates
  const dates = [...new Set(s.dailyTrackData.map((r: any) => r.date))].sort();
  for (const d of dates.slice(0, 2)) {
    const rows = s.dailyTrackData.filter((r: any) => r.date === d);
    console.log(`  ${d}:`, rows.map((r: any) => `${r.track_name}=${r.global_streams}`).join(', '));
  }
}
