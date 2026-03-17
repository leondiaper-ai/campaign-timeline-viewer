"use client";

import { useMemo } from "react";
import { CampaignSheetData, Territory } from "@/types";
import {
  getCampaignVerdict,
  getMomentumStatus,
  getTopImpactMoment,
  VerdictLevel,
  MomentumDirection,
} from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";

interface CampaignStatusRowProps {
  sheet: CampaignSheetData;
  territory: Territory;
}

const VERDICT_STYLES: Record<VerdictLevel, { bg: string; text: string; dot: string }> = {
  strong: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  building: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  early: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

const MOMENTUM_STYLES: Record<MomentumDirection, { icon: string; color: string }> = {
  rising: { icon: "\u2197", color: "text-emerald-400" },
  stable: { icon: "\u2192", color: "text-amber-400" },
  declining: { icon: "\u2198", color: "text-red-400" },
};

export default function CampaignStatusRow({ sheet, territory }: CampaignStatusRowProps) {
  const verdict = useMemo(() => getCampaignVerdict(sheet, territory), [sheet, territory]);
  const momentum = useMemo(() => getMomentumStatus(sheet, territory), [sheet, territory]);
  const topMoment = useMemo(() => getTopImpactMoment(sheet, territory), [sheet, territory]);

  const vs = VERDICT_STYLES[verdict.level];
  const ms = MOMENTUM_STYLES[momentum.direction];

  // Get color for top moment
  const momentConfig = useMemo(() => {
    const m = sheet.moments.find((m) => m.moment_title === topMoment.title);
    return m ? getCategoryConfig(m.moment_type) : { color: "#8B5CF6", icon: "\u266B" };
  }, [sheet, topMoment]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Verdict */}
      <div className={`rounded-xl border border-[#2A2D3E] p-4 ${vs.bg}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-2 h-2 rounded-full ${vs.dot}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${vs.text}`}>
            {verdict.label}
          </span>
        </div>
        <p className="text-[12px] text-[#9CA3AF] leading-relaxed">{verdict.summary}</p>
      </div>

      {/* Top Impact Moment */}
      <div className="rounded-xl border border-[#2A2D3E] bg-[#161922] p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs" style={{ color: momentConfig.color }}>{momentConfig.icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
            Top Impact Moment
          </span>
        </div>
        <p className="text-[12px] text-white font-medium mb-0.5 truncate">{topMoment.title}</p>
        <p className="text-[11px] text-[#6B7280]">{topMoment.impact}</p>
      </div>

      {/* Momentum */}
      <div className="rounded-xl border border-[#2A2D3E] bg-[#161922] p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-sm ${ms.color}`}>{ms.icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
            Momentum
          </span>
          <span className={`text-[10px] font-bold ${ms.color}`}>{momentum.label}</span>
        </div>
        <p className="text-[12px] text-[#9CA3AF] leading-relaxed">{momentum.detail}</p>
      </div>
    </div>
  );
}
