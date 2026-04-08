import { fetchCampaignSheetData } from "@/lib/sheets";
import NewCampaignDashboard from "@/components/NewCampaignDashboard";

export const dynamic = "force-dynamic";

const NEW_CAMPAIGN_SHEET_ID = "1WokPfbrbXLC5zHdh1eua-nUThQHnQSi-3tlnXBrGlhA";

export const metadata = {
  title: "K Trap – Trapo 2 — Campaign Timeline Viewer",
};

export default async function NewCampaignPage() {
  const sheet = await fetchCampaignSheetData(NEW_CAMPAIGN_SHEET_ID);
  return <NewCampaignDashboard sheet={sheet} />;
}
