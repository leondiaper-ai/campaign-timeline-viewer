import { getDemoCampaigns } from './src/lib/demo-campaigns';
import { buildChartData, getAllTrackNames } from './src/lib/transforms';
const campaigns = getDemoCampaigns();
for (const c of campaigns) {
  const sheet = c.sheet;
  const names = getAllTrackNames(sheet);
  const data = buildChartData(sheet, 'global', names);
  const peak = Math.max(...data.map(d => d.total_streams));
  console.log(sheet.setup.artist_name, '— weeks:', data.length, 'peak:', peak.toLocaleString());
  data.slice(0,3).forEach((d: any) => console.log('  ', d.date, 'total:', d.total_streams));
  console.log('  ...last:', data[data.length-1]?.date, 'total:', data[data.length-1]?.total_streams);
}
