import { getCampaignData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export const revalidate = 300;

export default async function Home() {
  const data = await getCampaignData();
  return <Dashboard initialData={data} />;
}
