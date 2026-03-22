"use client";

import { useMemo, useState } from "react";
import { CampaignSheetData, Territory } from "@/types";
import { getCampaignLearningsFlat, type LearningItem } from "@/lib/transforms";

interface CampaignLearningsProps {
  sheet: CampaignSheetData;
  territory: Territory;
}

function SentimentDot({ sentiment }: { sentiment: LearningItem["sentiment"] }) {
  const cls = sentiment === "positive" ? "text-emerald-400" :
              sentiment === "negative" ? "text-red-400" : "text-[#6B7280]";
  const icon = sentiment === "positive" ? "↑" : sentiment === "negative" ? "↓" : "·";
  return <span className={`text-[10px] mt-0.5 flex-shrink-0 ${cls}`}>{icon}</span>;
}

export default function CampaignLearnings({ sheet, territory }: CampaignLearningsProps) {
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(() => getCampaignLearningsFlat(sheet, territory), [sheet, territory]);

  if (items.length === 0) return null;

  return (
    <div className="bg-[#131620] rounded-xl border border-[#1E2130]">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left group">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
            Campaign Learnings
          </h3>
          {!expanded && <span className="text-[10px] text-[#4B5563] group-hover:text-[#6B7280] transition-colors">What worked, what didn't, what to change</span>}
        </div>
        <svg className={`w-4 h-4 text-[#4B5563] transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <SentimentDot sentiment={item.sentiment} />
              <span className={`text-[11px] leading-snug ${i === 0 ? "text-white font-semibold" : "text-[#D1D5DB]"}`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
