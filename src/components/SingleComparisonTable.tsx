"use client";

import { useMemo } from "react";
import { TrackPerformance, Territory } from "@/types";
import { formatNumber } from "@/lib/format";

interface SingleComparisonTableProps {
  trackPerformance: TrackPerformance[];
  campaignId: string;
  territory: Territory;
}

interface ComparisonRow {
  track_name: string;
  release_date: string;
  streams_14d: number;
  streams_28d: number;
  vs_prev_pct: number | null;
  is_best: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function SingleComparisonTable({
  trackPerformance,
  campaignId,
  territory,
}: SingleComparisonTableProps) {
  const rows = useMemo((): ComparisonRow[] => {
    // Filter singles for this campaign + territory
    const singles = trackPerformance
      .filter(
        (t) =>
          t.campaign_id === campaignId &&
          t.territory === territory &&
          t.release_type === "single"
      )
      .sort((a, b) => a.release_date.localeCompare(b.release_date));

    if (singles.length === 0) return [];

    // Find best performer (highest 28-day streams)
    const best28d = Math.max(...singles.map((s) => s.streams_28d));

    return singles.map((s, i) => {
      const prev = i > 0 ? singles[i - 1] : null;
      const vs_prev_pct =
        prev && prev.streams_28d > 0
          ? Math.round(
              ((s.streams_28d - prev.streams_28d) / prev.streams_28d) * 100
            )
          : null;

      return {
        track_name: s.track_name,
        release_date: s.release_date,
        streams_14d: s.streams_14d,
        streams_28d: s.streams_28d,
        vs_prev_pct,
        is_best: s.streams_28d === best28d && singles.length > 1,
      };
    });
  }, [trackPerformance, campaignId, territory]);

  // Don't render if no track data
  if (rows.length === 0) return null;

  return (
    <div
      className="mt-6 rounded-xl border overflow-hidden"
      style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
            Single Comparison
          </h3>
          <span className="text-[10px] text-label-muted font-mono px-2 py-0.5 rounded bg-surface-primary border border-border/50">
            {territory === "global" ? "Global" : territory}
          </span>
        </div>
        <p className="text-[11px] text-label-muted">
          28-day streams comparison across singles
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              className="text-[10px] font-bold text-label-muted uppercase tracking-[0.12em]"
              style={{ borderBottom: "1px solid #2A2D3E" }}
            >
              <th className="text-left px-5 py-2.5">Track</th>
              <th className="text-left px-3 py-2.5">Release</th>
              <th className="text-right px-3 py-2.5">14-day</th>
              <th className="text-right px-3 py-2.5">28-day</th>
              <th className="text-right px-5 py-2.5">vs Prev</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-white/[0.02]"
                style={{
                  borderBottom:
                    i < rows.length - 1 ? "1px solid #1E2130" : "none",
                }}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-label-primary">
                      {row.track_name}
                    </span>
                    {row.is_best && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: "#F59E0B",
                          backgroundColor: "#F59E0B18",
                        }}
                      >
                        BEST
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-[11px] text-label-muted font-mono tabular-nums">
                  {formatDate(row.release_date)}
                </td>
                <td
                  className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums"
                  style={{ color: "#6C9EFF" }}
                >
                  {formatNumber(row.streams_14d)}
                </td>
                <td
                  className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums"
                  style={{ color: "#6C9EFF" }}
                >
                  {formatNumber(row.streams_28d)}
                </td>
                <td className="px-5 py-3 text-right">
                  {row.vs_prev_pct !== null ? (
                    <span
                      className="text-[12px] font-bold font-mono tabular-nums"
                      style={{
                        color:
                          row.vs_prev_pct > 0
                            ? "#4ADE80"
                            : row.vs_prev_pct < 0
                              ? "#FB7185"
                              : "#5F6578",
                      }}
                    >
                      {row.vs_prev_pct > 0 ? "+" : ""}
                      {row.vs_prev_pct}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-label-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
