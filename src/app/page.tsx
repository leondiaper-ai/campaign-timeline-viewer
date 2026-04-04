import { getCampaignData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
import ToolIntro from "@/components/shared/ToolIntro";

export const revalidate = 300;

export default async function Home() {
  const data = await getCampaignData();
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

      {/* Existing dashboard — unchanged core logic */}
      <div id="tool" className="scroll-mt-16">
        <Dashboard initialData={data} />
      </div>
    </>
  );
}
