"use client";

import type { LoadedCampaign } from "@/types";

interface Props {
  campaigns: LoadedCampaign[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}

/**
 * Convert a campaign into a CSV-style filename.
 *   "K Trap" + "Album Campaign" → "k_trap_album_campaign.csv"
 */
function toCsvName(c: LoadedCampaign): string {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const artist = slug(c.sheet.setup.artist_name);
  const name = slug(c.sheet.setup.campaign_name);
  return `${artist}_${name}.csv`;
}

/**
 * DatasetStrip — compact CSV filename selector.
 *
 * Acts as a lightweight dataset picker at the top of the dashboard.
 * Click a filename to load that campaign's data into the graph / moments /
 * supporting activity below. No analysis, no report output — just a
 * data-source switch.
 */
export default function DatasetStrip({ campaigns, activeIdx, onSelect }: Props) {
  if (campaigns.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/35">
        Dataset
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {campaigns.map((c, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={c.campaign_id}
              onClick={() => onSelect(i)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-mono transition-all ${
                active
                  ? "bg-ink text-paper"
                  : "bg-cream text-ink/55 border border-ink/10 hover:text-ink hover:border-ink/30"
              }`}
            >
              {toCsvName(c)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
