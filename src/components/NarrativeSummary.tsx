"use client";

import { CampaignNarrative } from "@/types";

interface NarrativeSummaryProps {
  narrative: CampaignNarrative;
  trackNarrative?: string;
}

export default function NarrativeSummary({
  narrative,
  trackNarrative,
}: NarrativeSummaryProps) {
  return (
    <div
      className="rounded-xl border overflow-hidden mb-6"
      style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
    >
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-streams" />
          <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
            Campaign Summary
          </h3>
        </div>

        <p className="text-base font-semibold text-label-primary mb-2">
          {narrative.headline}
        </p>

        <p className="text-[13px] text-label-secondary leading-relaxed">
          {narrative.summary}
        </p>

        {narrative.highlights.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {narrative.highlights.map((highlight, i) => (
              <div
                key={i}
                className="text-[11px] text-label-secondary px-3 py-1.5 rounded-lg border"
                style={{
                  backgroundColor: "#1E2130",
                  borderColor: "#2A2D3E",
                }}
              >
                {highlight}
              </div>
            ))}
          </div>
        )}

        {trackNarrative && (
          <div
            className="mt-4 pt-3 border-t"
            style={{ borderColor: "#2A2D3E" }}
          >
            <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em] mb-1.5">
              Tracks
            </p>
            <p className="text-[12px] text-label-secondary leading-relaxed">
              {trackNarrative}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
