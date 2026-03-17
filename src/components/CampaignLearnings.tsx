"use client";

import { useMemo } from "react";
import { CampaignSheetData, Territory } from "@/types";
import { getCampaignLearnings } from "@/lib/transforms";

interface CampaignLearningsProps {
  sheet: CampaignSheetData;
  territory: Territory;
}

export default function CampaignLearnings({ sheet, territory }: CampaignLearningsProps) {
  const learnings = useMemo(() => getCampaignLearnings(sheet, territory), [sheet, territory]);

  if (learnings.length === 0) return null;

  return (
    <div className="bg-[#131620] rounded-xl border border-[#1E2130] p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mb-4">
        Campaign Learnings
      </h3>
      <div className="space-y-3">
        {learnings.map((l, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                l.phase === "pre" ? "bg-[#6B7280]/10 text-[#6B7280]" :
                l.phase === "peak" ? "bg-[#6C9EFF]/10 text-[#6C9EFF]" :
                "bg-[#FBBF24]/10 text-[#FBBF24]"
              }`}>
                {l.dateLabel}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mr-2">
                {l.eventType}
              </span>
              <span className="text-[12px] text-[#D1D5DB]">{l.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
