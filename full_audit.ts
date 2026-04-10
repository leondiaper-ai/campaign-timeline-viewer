import { getDemoCampaigns } from './src/lib/demo-campaigns';
import { buildChartData, getAllTrackNames } from './src/lib/transforms';

const appData = getDemoCampaigns();
console.log(`Total campaigns: ${appData.campaigns.length}\n`);

for (const c of appData.campaigns) {
  const s = c.sheet;
  console.log(`════════════════════════════════════════`);
  console.log(`${s.setup.artist_name} — ${s.setup.campaign_name}`);
  console.log(`campaign_id: ${c.campaign_id}`);
  console.log(`────────────────────────────────────────`);

  // 1. Schema conformance
  console.log(`setup.release_date: ${s.setup.release_date}`);
  console.log(`setup.campaign_type: ${s.setup.campaign_type}`);
  console.log(`setup.default_territory: ${s.setup.default_territory}`);

  // 2. Tracks
  console.log(`\nTracks (${s.tracks.length}):`);
  const KEY_ROLES = ["lead_single", "second_single", "focus_track"];
  const keyTracks = s.tracks.filter((t: any) => KEY_ROLES.includes(t.track_role));
  for (const t of s.tracks) {
    const isKey = KEY_ROLES.includes(t.track_role);
    console.log(`  ${isKey ? '★' : '·'} ${t.track_name} [${t.track_role}] default_on=${t.default_on}`);
  }
  console.log(`Key tracks (lead/second/focus): ${keyTracks.length}`);
  if (keyTracks.length < 2) console.log(`  ⚠ PROBLEM: fewer than 2 key tracks!`);

  // 3. dailyTrackData
  console.log(`\ndailyTrackData: ${s.dailyTrackData.length} rows`);
  const trackNamesInDaily = [...new Set(s.dailyTrackData.map((r: any) => r.track_name))];
  console.log(`  track names in daily data: ${trackNamesInDaily.join(', ')}`);
  for (const kt of keyTracks) {
    const rows = s.dailyTrackData.filter((r: any) => r.track_name === kt.track_name);
    const nonZero = rows.filter((r: any) => r.global_streams > 0);
    console.log(`  ${kt.track_name}: ${rows.length} rows, ${nonZero.length} non-zero`);
  }

  // 4. weeklyData
  const totalRows = s.weeklyData.filter((r: any) => r.track_name === 'TOTAL');
  console.log(`\nweeklyData: ${s.weeklyData.length} total rows, ${totalRows.length} TOTAL rows`);

  // 5. Moments
  console.log(`\nMoments: ${s.moments.length}`);
  const keyMoments = s.moments.filter((m: any) => m.is_key);
  console.log(`  key moments: ${keyMoments.length}`);

  // 6. Paid campaigns
  console.log(`paidCampaigns: ${(s.paidCampaigns || []).length}`);
  
  // 7. Learnings
  console.log(`learnings: ${(s.learnings || []).length}`);

  // 8. buildChartData output
  const allNames = getAllTrackNames(s);
  console.log(`\ngetAllTrackNames: [${allNames.join(', ')}]`);
  
  const chartData = buildChartData(s, 'global', allNames);
  console.log(`buildChartData: ${chartData.length} points`);
  
  // Verify key track data exists in chart points
  const peakPoint = chartData.reduce((best: any, d: any) => d.total_streams > (best?.total_streams || 0) ? d : best, null);
  if (peakPoint) {
    console.log(`\nPeak week (${peakPoint.date}, ${peakPoint.total_streams.toLocaleString()} streams):`);
    for (const kt of keyTracks) {
      const val = peakPoint[kt.track_name];
      console.log(`  ${kt.track_name}: ${val != null ? val.toLocaleString() : 'NULL ⚠'}`);
    }
  }
  
  // Check ALL chart points for null/missing track data
  let nullCount = 0;
  for (const dp of chartData) {
    for (const kt of keyTracks) {
      if (dp[kt.track_name] == null || dp[kt.track_name] === 0) nullCount++;
    }
  }
  console.log(`\nNull/zero track values across all chart points: ${nullCount} / ${chartData.length * keyTracks.length}`);
  
  console.log();
}
