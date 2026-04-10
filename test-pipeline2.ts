import { getDemoCampaigns } from './src/lib/demo-campaigns';
import { buildChartData, getAllTrackNames } from './src/lib/transforms';
const appData = getDemoCampaigns();
const campaigns = appData.campaigns;
for (const c of campaigns) {
  const sheet = c.sheet;
  const names = getAllTrackNames(sheet);
  const data = buildChartData(sheet, 'global', names);
  const peak = Math.max(...data.map((d: any) => d.total_streams));
  console.log(sheet.setup.artist_name, '— weeks:', data.length, 'peak:', peak.toLocaleString());
  data.slice(0,4).forEach((d: any) => console.log('  ', d.date, 'total:', d.total_streams.toLocaleString()));
  console.log('  ...');
  const last = data[data.length-1];
  console.log('  last:', last?.date, 'total:', last?.total_streams.toLocaleString());
  console.log();
}
