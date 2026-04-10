"use client";

import type { LoadedCampaign } from "@/types";
import CampaignExplorer from "./CampaignExplorer";

interface Props {
  campaign: LoadedCampaign;
}

/**
 * DemoSection — pre-loaded example campaign.
 *
 * No CSV input, no dataset switching. Just: "here's what it looks like on a
 * real campaign". Click moments → see impact on chart.
 */
export default function DemoSection({ campaign }: Props) {
  const sheet = campaign.sheet;

  return (
    <section className="space-y-5">
      {/* Eyebrow + title row */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-sun mb-1.5">
            Demo
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            Example campaign —{" "}
            <span className="text-ink/50 font-medium">
              see what drove performance
            </span>
          </h2>
          <p className="text-[12px] text-ink/40 mt-1">
            {sheet.setup.artist_name} · {sheet.setup.campaign_name}
            {sheet.setup.release_date && (
              <>
                {" "}
                · Released{" "}
                {new Date(
                  sheet.setup.release_date + "T00:00:00",
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
          </p>
        </div>
      </div>

      <CampaignExplorer
        campaign={campaign}
        variant="compact"
        helperText="Click moments to see how activity impacted performance"
      />
    </section>
  );
}
