"use client";

import { useMemo } from "react";
import { CampaignSheetData, Territory } from "@/types";
import { getUKTotals } from "@/lib/transforms";

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}
function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
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

    // Preferred: release-level territory data (same source the chart uses)
    const hasReleaseTerr = territory !== "global"
      && sheet.dailyReleaseTerritoryData
      && sheet.dailyReleaseTerritoryData.length > 0
      && sheet.dailyReleaseTerritoryData.some(r => r.territory === territory);

    let totalStreams = 0;

    if (hasReleaseTerr) {
      // Sum release-level daily streams for this territory — matches chart exactly
      totalStreams = sheet.dailyReleaseTerritoryData
        .filter(r => r.territory === territory)
        .reduce((sum, r) => sum + r.streams, 0);
    } else {
      // Fallback chain: weekly totals → track-level daily → global daily
      const totalRows = sheet.weeklyData.filter((r) => r.track_name === "TOTAL");
      totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);
      if (totalStreams === 0) {
        if (isUK && sheet.dailyTerritoryData && sheet.dailyTerritoryData.length > 0) {
          totalStreams = sheet.dailyTerritoryData
            .filter((r) => r.territory === "UK")
            .reduce((sum, r) => sum + r.streams, 0);
        } else if (!isUK && sheet.dailyTrackData && sheet.dailyTrackData.length > 0) {
          totalStreams = sheet.dailyTrackData.reduce((sum: number, r: any) => sum + r.global_streams, 0);
        }
      }
    }

    const totalPhysical = sheet.physicalData.reduce((sum, r) => sum + r.units, 0);
    const uk = getUKTotals(sheet, territory);

    // Paid campaign spend
    const pcs = sheet.paidCampaigns || [];
    const totalSpend = pcs.reduce((s, p) => s + p.spend, 0);

    // D2C data for UK Physical card
    const d2c = sheet.d2cSales && sheet.d2cSales.length >= 2 ? (() => {
      const first = sheet.d2cSales[0];
      const latest = sheet.d2cSales[sheet.d2cSales.length - 1];
      const firstShare = first.global_d2c_sales > 0
        ? Math.round((first.uk_d2c_sales / first.global_d2c_sales) * 1000) / 10 : 0;
      const latestShare = latest.global_d2c_sales > 0
        ? Math.round((latest.uk_d2c_sales / latest.global_d2c_sales) * 1000) / 10 : 0;
      return { global: latest.global_d2c_sales, uk: latest.uk_d2c_sales, firstShare, latestShare, rising: latestShare > firstShare };
    })() : null;

    return { totalStreams, totalPhysical, uk, totalSpend, d2c };
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
        {stats.d2c && (
          <div className="mt-1.5 leading-tight">
            <p className="text-[10px] text-[#9CA3AF]">
              {fmtK(stats.d2c.uk)} direct (D2C) · {fmtK(stats.d2c.global)} global
            </p>
            <p className="text-[10px] text-[#4B5563]">
              {stats.d2c.rising
                ? `UK share rising (${stats.d2c.firstShare}% → ${stats.d2c.latestShare}%)`
                : `UK share: ${stats.d2c.latestShare}%`}
            </p>
          </div>
        )}
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
