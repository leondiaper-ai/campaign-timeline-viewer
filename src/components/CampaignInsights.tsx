"use client";

import { useMemo } from "react";
import { CampaignSheetData, Territory } from "@/types";

function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

interface CampaignInsightsProps {
  sheet: CampaignSheetData;
  territory: Territory;
}

export default function CampaignInsights({ sheet, territory }: CampaignInsightsProps) {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  const stats = useMemo(() => {
    const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL");
    const totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);
    const ukStreams = territory === "global"
      ? totalRows.reduce((sum, r) => sum + r.streams_uk, 0) : 0;
    const totalPhysical = sheet.physicalData.reduce((sum, r) => sum + r.units, 0);
    return { totalStreams, ukStreams, totalPhysical };
  }, [sheet, territory, streamKey]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
        <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">
          Total Streams
        </p>
        <p className="text-2xl font-bold text-[#6C9EFF] tabular-nums">{fmt(stats.totalStreams)}</p>
        {territory === "global" && stats.ukStreams > 0 && (
          <p className="text-[10px] text-[#4B5563] mt-1">UK: {fmt(stats.ukStreams)}</p>
        )}
      </div>
      <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
        <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">
          Total Physical
        </p>
        <p className="text-2xl font-bold text-[#4ADE80] tabular-nums">
          {stats.totalPhysical > 0 ? fmt(stats.totalPhysical) : "\u2014"}
        </p>
      </div>
    </div>
  );
}
