"use client";

import { useMemo } from "react";
import { CampaignSheetData } from "@/types";

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtShort(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

interface Props {
  sheet: CampaignSheetData;
}

export default function D2COwnership({ sheet }: Props) {
  const d2c = sheet.d2cSales;
  if (!d2c || d2c.length === 0) return null;

  const latest = d2c[d2c.length - 1];
  const first = d2c[0];
  const hasMultiple = d2c.length > 1;

  const ukShareLatest = useMemo(() => {
    if (latest.global_d2c_sales === 0) return 0;
    return (latest.uk_d2c_sales / latest.global_d2c_sales) * 100;
  }, [latest]);

  // UK share trend: is it growing?
  const ukShareFirst = useMemo(() => {
    if (first.global_d2c_sales === 0) return 0;
    return (first.uk_d2c_sales / first.global_d2c_sales) * 100;
  }, [first]);

  const shareGrowing = ukShareLatest > ukShareFirst;

  return (
    <div className="bg-[#131620] rounded-xl border border-[#1E2130] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
            D2C Ownership
          </h3>
        </div>
        <span className="text-[9px] text-[#4B5563]">
          as of {fmtShort(latest.date)}
        </span>
      </div>

      {/* Latest KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-[9px] text-[#6B7280] mb-0.5">Global D2C</p>
          <p className="text-lg font-bold text-[#A78BFA] tabular-nums">{fmt(latest.global_d2c_sales)}</p>
        </div>
        <div>
          <p className="text-[9px] text-[#6B7280] mb-0.5">UK D2C</p>
          <p className="text-lg font-bold text-[#A78BFA] tabular-nums">{fmt(latest.uk_d2c_sales)}</p>
        </div>
        <div>
          <p className="text-[9px] text-[#6B7280] mb-0.5">UK Share</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: ukShareLatest >= 20 ? "#A78BFA" : "#9CA3AF" }}>
            {ukShareLatest.toFixed(1)}%
          </p>
          {hasMultiple && shareGrowing && (
            <p className="text-[9px] text-emerald-400/70">↑ growing</p>
          )}
        </div>
      </div>

      {/* Trend rows — compact sparkline-style */}
      {hasMultiple && (
        <div className="border-t border-[#1E2130] pt-2">
          <div className="space-y-1">
            {d2c.map((row, i) => {
              const ukShare = row.global_d2c_sales > 0
                ? ((row.uk_d2c_sales / row.global_d2c_sales) * 100).toFixed(1)
                : "0";
              // Bar width proportional to latest global
              const barWidth = latest.global_d2c_sales > 0
                ? (row.global_d2c_sales / latest.global_d2c_sales) * 100
                : 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[9px] text-[#4B5563] tabular-nums flex-shrink-0" style={{ minWidth: "3rem" }}>
                    {fmtShort(row.date)}
                  </span>
                  {/* Mini bar */}
                  <div className="flex-1 h-3 bg-[#1E2130] rounded-sm overflow-hidden relative">
                    <div
                      className="h-full rounded-sm transition-all"
                      style={{
                        width: `${barWidth}%`,
                        background: "linear-gradient(90deg, #A78BFA 0%, #7C3AED 100%)",
                        opacity: 0.6 + (i / d2c.length) * 0.4,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-[#9CA3AF] tabular-nums flex-shrink-0" style={{ minWidth: "3rem" }}>
                    {fmt(row.global_d2c_sales)}
                  </span>
                  <span className="text-[9px] text-[#6B7280] tabular-nums flex-shrink-0" style={{ minWidth: "3rem" }}>
                    UK {ukShare}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
