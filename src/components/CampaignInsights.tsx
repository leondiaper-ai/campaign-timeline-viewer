"use client";

import { useMemo } from "react";
import { CampaignInsight, WeeklyMetric, VerdictLevel, MomentumDirection } from "@/types";
import { formatNumber } from "@/lib/format";

interface CampaignInsightsProps {
  insight: CampaignInsight;
  metrics: WeeklyMetric[];
  campaignId: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function VerdictBadge({ level }: { level: VerdictLevel }) {
  const config: Record<VerdictLevel, { color: string; bg: string }> = {
    STRONG: { color: "#4ADE80", bg: "#4ADE8018" },
    MODERATE: { color: "#F59E0B", bg: "#F59E0B18" },
    WEAK: { color: "#FB7185", bg: "#FB718518" },
  };
  const c = config[level];
  return (
    <span
      className="text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-md"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {level}
    </span>
  );
}

function MomentumArrow({ direction }: { direction: MomentumDirection }) {
  const config: Record<MomentumDirection, { icon: string; color: string }> = {
    RISING: { icon: "↗", color: "#4ADE80" },
    PEAKING: { icon: "⬆", color: "#6C9EFF" },
    DECLINING: { icon: "↘", color: "#FB7185" },
    STABLE: { icon: "→", color: "#5F6578" },
  };
  const c = config[direction];
  return (
    <span className="text-lg" style={{ color: c.color }}>
      {c.icon}
    </span>
  );
}

export default function CampaignInsights({
  insight,
  metrics,
  campaignId,
}: CampaignInsightsProps) {
  // Compute total streams & sales for the verdict card (absorbs CampaignStats)
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* ─── Campaign Verdict ─── */}
      <div
        className="rounded-xl border px-5 py-5"
        style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
            Campaign Verdict
          </p>
          <VerdictBadge level={insight.verdict} />
        </div>
        <p className="text-[12px] text-label-secondary leading-relaxed mb-4">
          {insight.verdict_explanation}
        </p>
        <div className="flex items-center gap-4">
          <div>
            <p
              className="text-xl font-bold tabular-nums tracking-tight"
              style={{ color: "#6C9EFF" }}
            >
              {formatNumber(stats.globalStreams)}
            </p>
            <p className="text-[10px] text-label-muted mt-0.5">
              streams
              <span className="text-border mx-1">·</span>
              UK {formatNumber(stats.ukStreams)}
            </p>
          </div>
          <div className="w-px h-8" style={{ backgroundColor: "#2A2D3E" }} />
          <div>
            <p
              className="text-xl font-bold tabular-nums tracking-tight"
              style={{ color: "#4ADE80" }}
            >
              {formatNumber(stats.globalSales)}
            </p>
            <p className="text-[10px] text-label-muted mt-0.5">
              sales
              <span className="text-border mx-1">·</span>
              UK {formatNumber(stats.ukSales)}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Top Impact Moment ─── */}
      <div
        className="rounded-xl border px-5 py-5"
        style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
      >
        <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em] mb-3">
          Top Impact Moment
        </p>
        {insight.top_moment ? (
          <>
            <p className="text-sm font-semibold text-label-primary mb-1 truncate">
              {insight.top_moment.event_title}
            </p>
            <p className="text-[11px] text-label-muted font-mono mb-4">
              {formatDate(insight.top_moment.date)}
            </p>
            <div className="flex items-center gap-6">
              {insight.top_moment.streams_delta_pct !== null && (
                <div>
                  <p
                    className="text-xl font-bold tabular-nums font-mono"
                    style={{
                      color:
                        insight.top_moment.streams_delta_pct > 0
                          ? "#4ADE80"
                          : "#FB7185",
                    }}
                  >
                    {insight.top_moment.streams_delta_pct > 0 ? "+" : ""}
                    {insight.top_moment.streams_delta_pct}%
                  </p>
                  <p className="text-[10px] text-label-muted mt-0.5">
                    streams
                  </p>
                </div>
              )}
              {insight.top_moment.sales_delta_pct !== null && (
                <div>
                  <p
                    className="text-xl font-bold tabular-nums font-mono"
                    style={{
                      color:
                        insight.top_moment.sales_delta_pct > 0
                          ? "#4ADE80"
                          : "#FB7185",
                    }}
                  >
                    {insight.top_moment.sales_delta_pct > 0 ? "+" : ""}
                    {insight.top_moment.sales_delta_pct}%
                  </p>
                  <p className="text-[10px] text-label-muted mt-0.5">sales</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-label-muted leading-relaxed">
            Not enough data to identify a top impact moment yet.
          </p>
        )}
      </div>

      {/* ─── Momentum Status ─── */}
      <div
        className="rounded-xl border px-5 py-5"
        style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
      >
        <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em] mb-3">
          Momentum Status
        </p>
        <div className="flex items-center gap-3 mb-3">
          <MomentumArrow direction={insight.momentum} />
          <span
            className="text-sm font-bold tracking-wider"
            style={{
              color:
                insight.momentum === "RISING"
                  ? "#4ADE80"
                  : insight.momentum === "PEAKING"
                    ? "#6C9EFF"
                    : insight.momentum === "DECLINING"
                      ? "#FB7185"
                      : "#5F6578",
            }}
          >
            {insight.momentum}
          </span>
        </div>
        <p className="text-[12px] text-label-secondary leading-relaxed">
          {insight.momentum_context}
        </p>
      </div>
    </div>
  );
}
