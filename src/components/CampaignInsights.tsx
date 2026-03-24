"use client";

import { useMemo } from "react";
import { CampaignSheetData, Territory } from "@/types";
import { getUKTotals } from "@/lib/transforms";

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}
function fmtSpend(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  if (v > 0) return `$${v}`;
  return "—";
}

interface Props { sheet: CampaignSheetData; territory: Territory; }

export default function CampaignInsights({ sheet, territory }: Props) {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  const stats = useMemo(() => {
    const isUK = territory === "UK";
    const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL");
    let totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);
    // Fallback to daily data when weekly totals are zero
    if (totalStreams === 0) {
      if (isUK && sheet.dailyTerritoryData && sheet.dailyTerritoryData.length > 0) {
        totalStreams = sheet.dailyTerritoryData
          .filter((r) => r.territory === "UK")
          .reduce((sum, r) => sum + r.streams, 0);
      } else if (!isUK && sheet.dailyTrackData && sheet.dailyTrackData.length > 0) {
        totalStreams = sheet.dailyTrackData.reduce((sum: number, r: any) => sum + r.global_streams, 0);
      }
    }
    const totalPhysical = sheet.physicalData.reduce((sum, r) => sum + r.units, 0);
    const uk = getUKTotals(sheet);

    // Paid campaign spend
    const pcs = sheet.paidCampaigns || [];
    const totalSpend = pcs.reduce((s, p) => s + p.spend, 0);

    return { totalStreams, totalPhysical, uk, totalSpend };
  }, [sheet, streamKey, territory]);


  const isGlobal = territory === "global";

  const hasSpend = stats.totalSpend > 0;
  const cols = hasSpend ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid ${cols} gap-3`}>
      <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
        <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">
          {isGlobal ? "Global Streams" : "UK Streams"}
        </p>
        <p className="text-2xl font-bold text-[#6C9EFF] tabular-nums">{fmt(stats.totalStreams)}</p>
        {isGlobal && stats.uk.ukStreams > 0 && (
          <p className="text-[10px] text-[#4B5563] mt-1">
            UK: {fmt(stats.uk.ukStreams)} ({stats.uk.ukShare}% of global)
          </p>
        )}
      </div>
      <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
        <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">UK Physical</p>
        <p className="text-2xl font-bold text-[#4ADE80] tabular-nums">
          {stats.totalPhysical > 0 ? fmt(stats.totalPhysical) : "\u2014"}
        </p>
      </div>
      {hasSpend && (
        <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4 group relative">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">Digital Campaign Spend</p>
          <p className="text-[9px] text-[#4B5563] -mt-0.5 mb-1">Marquee + Showcase</p>
          <p className="text-2xl font-bold text-[#FBBF24] tabular-nums">{fmtSpend(stats.totalSpend)}</p>
          {/* Hover tooltip for context */}
          <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 z-50 bg-[#1A1D2E] rounded-lg border border-[#2A2D3E] px-3 py-2 shadow-2xl whitespace-nowrap">
            <p className="text-[10px] text-[#9CA3AF]">Based on tracked digital spend only.</p>
            <p className="text-[10px] text-[#6B7280]">Excludes editorial, physical, and organic impact.</p>
          </div>
        </div>
      )}
    </div>
  );
}
