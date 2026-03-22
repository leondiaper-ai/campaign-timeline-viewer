"use client";

import { useMemo, useState } from "react";
import { CampaignSheetData, Territory } from "@/types";
import { getGroupedLearnings, type LearningItem, type LearningGroup } from "@/lib/transforms";

interface CampaignLearningsProps {
  sheet: CampaignSheetData;
  territory: Territory;
}

const GROUP_META: Record<LearningGroup, { label: string; color: string }> = {
  music:      { label: "Music Performance",  color: "#8B5CF6" },
  campaign:   { label: "Campaign Impact",    color: "#10B981" },
  commercial: { label: "Commercial Signals", color: "#6C9EFF" },
  takeaway:   { label: "Key Takeaway",       color: "#FBBF24" },
};

const GROUP_ORDER: LearningGroup[] = ["music", "campaign", "commercial", "takeaway"];

function SentimentDot({ sentiment }: { sentiment: LearningItem["sentiment"] }) {
  const cls = sentiment === "positive" ? "text-emerald-400" :
              sentiment === "negative" ? "text-red-400" : "text-[#6B7280]";
  const icon = sentiment === "positive" ? "↑" : sentiment === "negative" ? "↓" : "·";
  return <span className={`text-[10px] mt-0.5 flex-shrink-0 ${cls}`}>{icon}</span>;
}

export default function CampaignLearnings({ sheet, territory }: CampaignLearningsProps) {
  const [expanded, setExpanded] = useState(false);
  const grouped = useMemo(() => getGroupedLearnings(sheet, territory), [sheet, territory]);

  const totalCount = GROUP_ORDER.reduce((n, g) => n + grouped[g].length, 0);
  if (totalCount === 0) return null;

  return (
    <div className="bg-[#131620] rounded-xl border border-[#1E2130]">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left group">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
            Campaign Learnings <span className="text-[#4B5563] font-normal ml-1">({totalCount})</span>
          </h3>
          {!expanded && <span className="text-[10px] text-[#4B5563] group-hover:text-[#6B7280] transition-colors">Key takeaways from this campaign</span>}
        </div>
        <svg className={`w-4 h-4 text-[#4B5563] transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {GROUP_ORDER.map((group, gi) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            const meta = GROUP_META[group];
            const isLast = group === "takeaway";
            return (
              <div key={group} className={`${gi > 0 ? "mt-3 pt-3 border-t border-[#1E2130]" : ""}`}>
                {/* Subtle group label */}
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: meta.color, opacity: isLast ? 0.9 : 0.5 }}>
                  {meta.label}
                </p>
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <SentimentDot sentiment={item.sentiment} />
                      <span className={`text-[11px] ${isLast ? "text-white font-medium" : "text-[#D1D5DB]"}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
