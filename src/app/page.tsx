import { getCampaignData } from "@/lib/data";
import TimelineTool from "@/components/TimelineTool";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getCampaignData();
  return <TimelineTool campaigns={data.campaigns} />;
}
