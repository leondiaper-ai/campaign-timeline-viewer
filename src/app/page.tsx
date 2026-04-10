import { getCampaignData, isDemoData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getCampaignData();
  const isDemo = isDemoData(data);

  return (
    <>
      {/* Editorial intro — minimal, product-first */}
      <section
        className="relative bg-[#FAF7F2] text-[#0E0E0E] border-b border-black/10"
        style={{
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div className="mx-auto max-w-[1440px] px-6 md:px-10 pt-16 md:pt-24 pb-14 md:pb-20">
          {/* Eyebrow */}
          <div className="flex items-center justify-between mb-10">
            <span className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-black/60">
              Tool 02 — Decision System
            </span>
            <a
              href="/"
              className="text-[0.72rem] tracking-[0.18em] uppercase font-semibold text-black/60 hover:text-[#FF4A1C] transition-colors"
            >
              ← Back to system
            </a>
          </div>

          {/* Chip + name + CTA */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-[#FFD24C] text-[#0E0E0E] rounded-full px-3 py-1.5 text-[10px] font-bold tracking-widest mb-6 shadow-[3px_3px_0_0_rgba(14,14,14,1)]">
                <span>02</span>
                <span className="opacity-60">/</span>
                <span className="uppercase">SUN</span>
              </div>

              <h1 className="font-extrabold leading-[0.92] tracking-[-0.04em] text-[clamp(2.5rem,7vw,5.5rem)]">
                Campaign Timeline Viewer
              </h1>
              <p className="mt-5 text-lg md:text-xl text-black/75 leading-snug max-w-xl">
                See what actually drove the campaign
              </p>
            </div>

            <div className="flex flex-wrap gap-3 md:justify-end">
              <a
                href="#tool"
                className="group inline-flex items-center gap-2 rounded-full bg-[#0E0E0E] text-[#FAF7F2] px-6 py-3 text-sm font-medium hover:bg-[#FF4A1C] transition-colors"
              >
                See the demo
                <span className="transition-transform group-hover:translate-x-1">
                  ↓
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Soft handoff into the demo below */}
        <div className="h-10 bg-gradient-to-b from-[#FAF7F2] to-transparent pointer-events-none" />
      </section>

      {/* Dashboard — progressive demo */}
      <div id="tool" className="scroll-mt-16">
        <Dashboard initialData={data} isDemo={isDemo} />
      </div>
    </>
  );
}
