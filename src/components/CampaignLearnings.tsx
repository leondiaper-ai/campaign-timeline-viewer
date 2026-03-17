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
    <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mb-3">
        Campaign Learnings
      </h3>
      <div className="space-y-2.5">
        {learnings.map((l, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-sm mt-0.5 w-4 text-center flex-shrink-0 text-[#6B7280]">{l.icon}</span>
            <p className="text-[12px] text-[#D1D5DB] leading-relaxed">{l.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
