"use client";

import { useMemo } from "react";
import { CampaignSheetData, Territory } from "@/types";

// ——— Formatting ——————————————————————————————————————————
function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function fmtPct(value: number): string {
  if (!isFinite(value)) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
}

// ——— Props ————————————————————————————————————————————
interface CampaignInsightsProps {
  sheet: CampaignSheetData;
  territory: Territory;
}

// ——— Component ————————————————————————————————————————
export default function CampaignInsights({
  sheet,
  territory,
}: CampaignInsightsProps) {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";

  // Calculate all stats
  const stats = useMemo(() => {
    // TOTAL rows only, sorted by date
    const totalRows = sheet.weeklyData
      .filter((r) => r.track_name === "TOTAL")
      .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));

    // Total streams
    const totalStreams = totalRows.reduce((sum, r) => sum + r[streamKey], 0);

    // UK sub-stat (only when territory is global)
    const ukStreams =
      territory === "global"
        ? totalRows.reduce((sum, r) => sum + r.streams_uk, 0)
        : 0;

    // Total physical units
    const totalPhysical = sheet.physicalData.reduce(
      (sum, r) => sum + r.units,
      0
    );

    // UK physical sub-stat - not available in schema, so skip
    // Physical is always shown as total

    // Stream growth %: earliest vs most recent week
    let streamGrowth = 0;
    if (totalRows.length >= 2) {
      const first = totalRows[0][streamKey];
      const last = totalRows[totalRows.length - 1][streamKey];
      if (first > 0) {
        streamGrowth = ((last - first) / first) * 100;
      }
    }

    // Physical growth %: earliest vs most recent week
    let physicalGrowth = 0;
    const physicalSorted = [...sheet.physicalData].sort((a, b) =>
      a.week_start_date.localeCompare(b.week_start_date)
    );
    if (physicalSorted.length >= 2) {
      const first = physicalSorted[0].units;
      const last = physicalSorted[physicalSorted.length - 1].units;
      if (first > 0) {
        physicalGrowth = ((last - first) / first) * 100;
      }
    }

    return {
      totalStreams,
      ukStreams,
      totalPhysical,
      streamGrowth,
      physicalGrowth,
      hasPhysical: totalPhysical > 0,
      hasStreams: totalStreams > 0,
    };
  }, [sheet, territory, streamKey]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Total Streams */}
      <StatCard
        label="Total Streams"
        value={fmt(stats.totalStreams)}
        sub={
          territory === "global" && stats.ukStreams > 0
            ? `UK: ${fmt(stats.ukStreams)}`
            : undefined
        }
        color="#6C9EFF"
      />

      {/* Total Physical Units */}
      <StatCard
        label="Total Physical"
        value={stats.hasPhysical ? fmt(stats.totalPhysical) : "—"}
        color="#4ADE80"
      />

      {/* Stream Growth % */}
      <StatCard
        label="Stream Growth"
        value={stats.hasStreams ? fmtPct(stats.streamGrowth) : "—"}
        color={stats.streamGrowth >= 0 ? "#4ADE80" : "#F87171"}
      />

      {/* Physical Growth % */}
      <StatCard
        label="Physical Growth"
        value={stats.hasPhysical ? fmtPct(stats.physicalGrowth) : "—"}
        color={stats.physicalGrowth >= 0 ? "#4ADE80" : "#F87171"}
      />
    </div>
  );
}

// ——— Stat Card ————————————————————————————————————————
function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-[#161922] rounded-xl border border-[#2A2D3E] p-4">
      <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em] mb-2">
        {label}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-label-muted mt-1">{sub}</p>
      )}
    </div>
  );
}
