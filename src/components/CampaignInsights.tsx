"use client";

import { useMemo } from "react";
import { CampaignInsight, WeeklyMetric, Territory } from "@/types";
import { formatNumber } from "@/lib/format";

interface CampaignInsightsProps {
  insight: CampaignInsight;
  metrics: WeeklyMetric[];
  campaignId: string;
  territory: Territory;
}

function GrowthArrow({ value }: { value: number }) {
  if (value > 0) return <span style={{ color: "#4ADE80" }}>&#9650;</span>;
  if (value < 0) return <span style={{ color: "#FB7185" }}>&#9660;</span>;
  return <span style={{ color: "#5F6578" }}>&#8212;</span>;
}

export default function CampaignInsights({
  metrics,
  campaignId,
  territory,
}: CampaignInsightsProps) {
  const stats = useMemo(() => {
    const campaignMetrics = metrics.filter(
      (m) => m.campaign_id === campaignId
    );

    // Territory-filtered metrics
    const filtered = campaignMetrics.filter((m) => m.territory === territory);
    const sorted = [...filtered].sort((a, b) =>
      a.week_ending.localeCompare(b.week_ending)
    );

    // UK metrics for sub-stat (only shown when territory === "global")
    const uk = campaignMetrics.filter((m) => m.territory === "UK");

    const totalStreams = filtered.reduce((s, m) => s + m.total_streams, 0);
    const totalPhysical = filtered.reduce(
      (s, m) => s + (m.retail_units + m.d2c_units),
      0
    );
    const ukStreams = uk.reduce((s, m) => s + m.total_streams, 0);
    const ukPhysical = uk.reduce(
      (s, m) => s + (m.retail_units + m.d2c_units),
      0
    );

    // Growth %: earliest week vs most recent week
    let streamGrowthPct = 0;
    let physicalGrowthPct = 0;

    if (sorted.length >= 2) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      if (first.total_streams > 0) {
        streamGrowthPct = Math.round(
          ((last.total_streams - first.total_streams) / first.total_streams) *
            100
        );
      }

      const firstPhys = first.retail_units + first.d2c_units;
      const lastPhys = last.retail_units + last.d2c_units;
      if (firstPhys > 0) {
        physicalGrowthPct = Math.round(
          ((lastPhys - firstPhys) / firstPhys) * 100
        );
      }
    }

    return {
      totalStreams,
      totalPhysical,
      ukStreams,
      ukPhysical,
      streamGrowthPct,
      physicalGrowthPct,
      showUk: territory === "global",
    };
  }, [metrics, campaignId, territory]);

  const cards = [
    {
      label: "Total Streams",
      value: formatNumber(stats.totalStreams),
      color: "#6C9EFF",
      sub: stats.showUk ? `UK: ${formatNumber(stats.ukStreams)}` : null,
      isGrowth: false,
      growthVal: 0,
    },
    {
      label: "Total Physical Units",
      value: formatNumber(stats.totalPhysical),
      color: "#4ADE80",
      sub: stats.showUk ? `UK: ${formatNumber(stats.ukPhysical)}` : null,
      isGrowth: false,
      growthVal: 0,
    },
    {
      label: "Stream Growth",
      value: `${stats.streamGrowthPct > 0 ? "+" : ""}${stats.streamGrowthPct}%`,
      color: stats.streamGrowthPct > 0 ? "#4ADE80" : stats.streamGrowthPct < 0 ? "#FB7185" : "#5F6578",
      sub: "First vs last week",
      isGrowth: true,
      growthVal: stats.streamGrowthPct,
    },
    {
      label: "Physical Growth",
      value: `${stats.physicalGrowthPct > 0 ? "+" : ""}${stats.physicalGrowthPct}%`,
      color: stats.physicalGrowthPct > 0 ? "#4ADE80" : stats.physicalGrowthPct < 0 ? "#FB7185" : "#5F6578",
      sub: "First vs last week",
      isGrowth: true,
      growthVal: stats.physicalGrowthPct,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border px-5 py-5"
          style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
        >
          <p className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em] mb-3">
            {card.label}
          </p>
          <div className="flex items-center gap-2">
            {card.isGrowth && <GrowthArrow value={card.growthVal} />}
            <p
              className="text-2xl font-bold tabular-nums tracking-tight"
              style={{ color: card.color }}
            >
              {card.value}
            </p>
          </div>
          {card.sub && (
            <p className="text-[10px] text-label-muted mt-1.5">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
