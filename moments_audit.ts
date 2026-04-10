import { getDemoCampaigns } from './src/lib/demo-campaigns';
const appData = getDemoCampaigns();
for (const c of appData.campaigns) {
  const s = c.sheet;
  console.log(`\n=== ${s.setup.artist_name} ===`);
  console.log(`Release date: ${s.setup.release_date}`);
  console.log(`Moments (${s.moments.length}):`);
  for (const m of s.moments) {
    console.log(`  ${m.date} | ${m.moment_type.padEnd(12)} | key=${m.is_key} | ${m.moment_title}`);
  }
  // Also show paid campaigns that become moments
  if (s.paidCampaigns && s.paidCampaigns.length > 0) {
    console.log(`Paid campaigns (${s.paidCampaigns.length}):`);
    for (const pc of s.paidCampaigns) {
      console.log(`  ${pc.start_date} | ${pc.platform} | ${pc.territory} | ${pc.campaign_name}`);
    }
  }
}
