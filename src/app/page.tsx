import { getCampaignData, isDemoData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
import ToolIntro from "@/components/shared/ToolIntro";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getCampaignData();
  const isDemo = isDemoData(data);
  return (
    <>
      {/* Editorial intro — bridges landing page → tool */}
      <ToolIntro
        number="02"
        accent="sun"
        name="Campaign Timeline Viewer"
        purpose="Every release moment, push, and performance peak on one line — so teams can read momentum and tighten cadence."
        inputs={["Release moments", "Activity log", "Performance markers"]}
        outputs={["Unified timeline", "Momentum read", "Cadence gaps"]}
        ctaLabel="View timeline"
        ctaHref="#tool"
      />

      {/* Dashboard — uses demo data when no API keys present */}
      <div id="tool" className="scroll-mt-16">
        <Dashboard initialData={data} isDemo={isDemo} />
      </div>
    </>
  );
}
