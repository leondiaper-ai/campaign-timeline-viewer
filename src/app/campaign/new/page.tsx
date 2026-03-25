import { fetchCampaignSheetData } from "@/lib/sheets";
import NewCampaignDashboard from "@/components/NewCampaignDashboard";

export const revalidate = 300;

const NEW_CAMPAIGN_SHEET_ID = "1xbWrRHoCmSi1mq_Wt4wqfV4JSH1kDVRWnYD1uQ5oRJo";

export const metadata = {
  title: "New Campaign — Campaign Timeline Viewer",
};

export default async function NewCampaignPage() {
  const sheet = await fetchCampaignSheetData(NEW_CAMPAIGN_SHEET_ID);
  return <NewCampaignDashboard sheet={sheet} />;
}
