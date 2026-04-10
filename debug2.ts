import { getDemoCampaigns } from './src/lib/demo-campaigns';
import { buildChartData, getAllTrackNames } from './src/lib/transforms';
const appData = getDemoCampaigns();

// Test James Blake specifically (index 1)
const jb = appData.campaigns[1];
const sheet = jb.sheet;
console.log('=== James Blake ===');
console.log('dailyTrackData count:', sheet.dailyTrackData.length);
console.log('weeklyData TOTAL rows:', sheet.weeklyData.filter((r: any) => r.track_name === 'TOTAL').length);

// Check what tracks are being selected
const names = getAllTrackNames(sheet);
console.log('All track names:', names);

const data = buildChartData(sheet, 'global', names);
console.log('\nChart data points:', data.length);
data.forEach((d: any) => {
  console.log(d.date, 'total:', d.total_streams, 'tracks:', names.map((n: string) => `${n}:${d[n] ?? 'null'}`).join(', '));
});

// Check weekly totals directly
console.log('\n=== Weekly TOTAL rows ===');
sheet.weeklyData.filter((r: any) => r.track_name === 'TOTAL').forEach((r: any) => {
  console.log(r.week_start_date, 'global:', r.streams_global, 'uk:', r.streams_uk);
});
