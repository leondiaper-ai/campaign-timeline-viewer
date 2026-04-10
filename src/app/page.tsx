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
        purpose="Understand what actually drove the campaign."
        inputs={[
          "Weekly streams (global + UK)",
          "Release moments & key dates",
          "Paid, editorial & D2C activity",
        ]}
        outputs={[
          "What drove each spike",
          "How releases, paid & editorial played in",
          "Where momentum shifted",
        ]}
        ctaLabel="See the demo"
        ctaHref="#tool"
        footer={
          <div className="rounded-2xl border border-black/10 bg-[#F6F1E7] px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
            <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-black/50">
              Example exports
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-mono text-black/70">
              <span>campaign_timeline_export_global.csv</span>
              <span className="text-black/25">·</span>
              <span>campaign_timeline_export_uk.csv</span>
            </div>
            <div className="md:ml-auto text-[11px] text-black/50">
              Includes: streams, release moments, paid activity, editorial, D2C
            </div>
          </div>
        }
      />

      {/* Dashboard — uses demo data when no API keys present */}
      <div id="tool" className="scroll-mt-16">
        <Dashboard initialData={data} isDemo={isDemo} />
      </div>
    </>
  );
}
