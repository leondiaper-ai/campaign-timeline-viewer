"use client";

import { useMemo, useState } from "react";
import { CampaignSheetData, Territory } from "@/types";
import { getCampaignLearnings } from "@/lib/transforms";

interface CampaignLearningsProps {
  sheet: CampaignSheetData;
  territory: Territory;
}

export default function CampaignLearnings({ sheet, territory }: CampaignLearningsProps) {
  const [expanded, setExpanded] = useState(false);
  const learnings = useMemo(() => getCampaignLearnings(sheet, territory), [sheet, territory]);

  // Generate paid campaign learnings from sheet data
  const paidLearnings = useMemo(() => {
    const pcs = sheet.paidCampaigns || [];
    if (pcs.length === 0) return [];
    const items: { text: string; sentiment: "positive" | "neutral" | "negative" }[] = [];

    // Best intent rate
    const withIntent = pcs.filter(p => p.intent_total > 0);
    if (withIntent.length > 0) {
      const best = withIntent.reduce((a, b) => a.intent_total > b.intent_total ? a : b);
      if (best.intent_total >= 30) {
        items.push({ text: `${best.platform} (${best.territory}) hit ${best.intent_total}% intent — strong listener conversion`, sentiment: "positive" });
      } else if (best.intent_total >= 25) {
        items.push({ text: `${best.platform} (${best.territory}) at ${best.intent_total}% intent — on benchmark`, sentiment: "neutral" });
      }
    }

    // Best segment insight
    const segments = pcs.filter(p => p.best_segment).map(p => p.best_segment);
    const segmentCounts = new Map<string, number>();
    for (const s of segments) segmentCounts.set(s, (segmentCounts.get(s) || 0) + 1);
    const topSegment = [...segmentCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topSegment) {
      items.push({ text: `"${topSegment[0]}" listeners responded strongest across paid campaigns`, sentiment: "positive" });
    }

    // Total spend
    const totalSpend = pcs.reduce((s, p) => s + p.spend, 0);
    if (totalSpend > 0) {
      const fmtSpend = totalSpend >= 1000 ? `$${(totalSpend / 1000).toFixed(0)}K` : `$${totalSpend}`;
      items.push({ text: `Total paid spend: ${fmtSpend} across ${pcs.length} campaign${pcs.length > 1 ? "s" : ""}`, sentiment: "neutral" });
    }

    return items;
  }, [sheet]);

  if (learnings.length === 0 && paidLearnings.length === 0) return null;

  return (
    <div className="bg-[#131620] rounded-xl border border-[#1E2130]">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left group">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
            Campaign Learnings <span className="text-[#4B5563] font-normal ml-1">({learnings.length + paidLearnings.length})</span>
          </h3>
          {!expanded && <span className="text-[10px] text-[#4B5563] group-hover:text-[#6B7280] transition-colors">Key takeaways from this campaign</span>}
        </div>
        <svg className={`w-4 h-4 text-[#4B5563] transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Performance learnings */}
          {learnings.length > 0 && (
            <div className="space-y-2">
              {learnings.map((l, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      l.phase === "pre" ? "bg-[#6B7280]/10 text-[#6B7280]" :
                      l.phase === "peak" ? "bg-[#6C9EFF]/10 text-[#6C9EFF]" :
                      "bg-[#FBBF24]/10 text-[#FBBF24]"
                    }`}>
                      {l.dateLabel}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#4B5563] mr-2">
                      {l.eventType}
                    </span>
                    <span className="text-[11px] text-[#D1D5DB]">{l.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paid campaign learnings */}
          {paidLearnings.length > 0 && (
            <div className={learnings.length > 0 ? "pt-3 border-t border-[#1E2130]" : ""}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#10B981]/60 mb-2">Paid Campaigns</p>
              <div className="space-y-1.5">
                {paidLearnings.map((pl, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[10px] mt-0.5 flex-shrink-0 ${
                      pl.sentiment === "positive" ? "text-emerald-400" :
                      pl.sentiment === "negative" ? "text-red-400" : "text-[#6B7280]"
                    }`}>
                      {pl.sentiment === "positive" ? "↑" : pl.sentiment === "negative" ? "↓" : "·"}
                    </span>
                    <span className="text-[11px] text-[#D1D5DB]">{pl.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
