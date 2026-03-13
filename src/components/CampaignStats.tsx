"use client";

import { useMemo } from "react";
import { WeeklyMetric } from "@/types";
import { formatNumber } from "@/lib/format";

interface CampaignStatsProps {
  metrics: WeeklyMetric[];
  campaignId: string;
}

export default function CampaignStats({
  metrics,
  campaignId,
}: CampaignStatsProps) {
  const stats = useMemo(() => {
    const campaignMetrics = metrics.filter(
      (m) => m.campaign_id === campaignId
    );
    const global = campaignMetrics.filter((m) => m.territory === "global");
    const uk = campaignMetrics.filter((m) => m.territory === "UK");

    const sumStreams = (arr: WeeklyMetric[]) =>
      arr.reduce((s, m) => s + m.total_streams, 0);
    const sumSales = (arr: WeeklyMetric[]) =>
      arr.reduce((s, m) => s + (m.retail_units + m.d2c_units), 0);

    return {
      globalStreams: sumStreams(global),
      ukStreams: sumStreams(uk),
      globalSales: sumSales(global),
      ukSales: sumSales(uk),
    };
  }, [metrics, campaignId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {/* Total Streams */}
      <div
        className="rounded-xl border px-6 py-5"
        style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
      >
        <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em] mb-2">
          Total Streams
        </p>
        <p
          className="text-3xl font-bold tabular-nums tracking-tight"
          style={{ color: "#6C9EFF" }}
        >
          {formatNumber(stats.globalStreams)}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-label-muted">
          <span>
            Global{" "}
            <span className="font-semibold text-label-secondary">
              {formatNumber(stats.globalStreams)}
            </span>
          </span>
          <span style={{ color: "#2A2D3E" }}>·</span>
          <span>
            UK{" "}
            <span className="font-semibold text-label-secondary">
              {formatNumber(stats.ukStreams)}
            </span>
          </span>
        </div>
      </div>

      {/* Total Sales */}
      <div
        className="rounded-xl border px-6 py-5"
        style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
      >
        <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em] mb-2">
          Total Sales
        </p>
        <p
          className="text-3xl font-bold tabular-nums tracking-tight"
          style={{ color: "#4ADE80" }}
        >
          {formatNumber(stats.globalSales)}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-label-muted">
          <span>
            Global{" "}
            <span className="font-semibold text-label-secondary">
              {formatNumber(stats.globalSales)}
            </span>
          </span>
          <span style={{ color: "#2A2D3E" }}>·</span>
          <span>
            UK{" "}
            <span className="font-semibold text-label-secondary">
              {formatNumber(stats.ukSales)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
