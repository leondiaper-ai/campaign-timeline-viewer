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

// ─── Growth edge-case helper ────────────────────────────────────

interface GrowthDisplay {
  text: string;
  color: string;
  arrow: "up" | "down" | "none";
}

function computeGrowth(
  firstVal: number,
  lastVal: number,
  hasSufficientData: boolean
): GrowthDisplay {
  if (!hasSufficientData) {
    return { text: "\u2014", color: "#5F6578", arrow: "none" };
  }
  if (firstVal === 0 && lastVal === 0) {
    return { text: "\u2014", color: "#5F6578", arrow: "none" };
  }
  if (firstVal === 0 && lastVal > 0) {
    return { text: "New", color: "#4ADE80", arrow: "up" };
  }
  if (firstVal === 0) {
    return { text: "\u2014", color: "#5F6578", arrow: "none" };
  }
  const pct = Math.round(((lastVal - firstVal) / firstVal) * 100);
  return {
    text: `${pct > 0 ? "+" : ""}${pct}%`,
    color: pct > 0 ? "#4ADE80" : pct < 0 ? "#FB7185" : "#5F6578",
    arrow: pct > 0 ? "up" : pct < 0 ? "down" : "none",
  };
}

function GrowthArrow({ dir }: { dir: "up" | "down" | "none" }) {
  if (dir === "up") return <span style={{ color: "#4ADE80" }}>&#9650;</span>;
  if (dir === "down") return <span style={{ color: "#FB7185" }}>&#9660;</span>;
  return null;
}

// ─── Component ──────────────────────────────────────────────────

export default function CampaignInsights({
  metrics,
  campaignId,
  territory,
}: CampaignInsightsProps) {
  const stats = useMemo(() => {
    const campaignMetrics = metrics.filter(
      (m) => m.campaign_id === campaignId
    );

    // Territory-filtered metrics (main display values)
    const filtered = campaignMetrics.filter((m) => m.territory === territory);
    const sorted = [...filtered].sort((a, b) =>
      a.week_ending.localeCompare(b.week_ending)
    );

    // Global metrics (for context sub-label when viewing UK)
    const globalFiltered = campaignMetrics.filter(
      (m) => m.territory === "global"
    );

    const totalStreams = filtered.reduce((s, m) => s + m.total_streams, 0);
    const totalPhysical = filtered.reduce(
      (s, m) => s + (m.retail_units + m.d2c_units),
      0
    );
    const globalStreams = globalFiltered.reduce(
      (s, m) => s + m.total_streams,
      0
    );
    const globalPhysical = globalFiltered.reduce(
      (s, m) => s + (m.retail_units + m.d2c_units),
      0
    );

    // Growth calculation with edge cases
    const hasSufficientData = sorted.length >= 2;

    let streamGrowth: GrowthDisplay = {
      text: "\u2014",
      color: "#5F6578",
      arrow: "none",
    };
    let physicalGrowth: GrowthDisplay = {
      text: "\u2014",
      color: "#5F6578",
      arrow: "none",
    };

    if (hasSufficientData) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      streamGrowth = computeGrowth(
        first.total_streams,
        last.total_streams,
        true
      );

      const firstPhys = first.retail_units + first.d2c_units;
      const lastPhys = last.retail_units + last.d2c_units;
      physicalGrowth = computeGrowth(firstPhys, lastPhys, true);
    }

    return {
      totalStreams,
      totalPhysical,
      globalStreams,
      globalPhysical,
      streamGrowth,
      physicalGrowth,
      showContext: territory !== "global",
    };
  }, [metrics, campaignId, territory]);

  const cards = [
    {
      label: "Total Streams",
      value: formatNumber(stats.totalStreams),
      color: "#6C9EFF",
      sub: stats.showContext
        ? `Global: ${formatNumber(stats.globalStreams)}`
        : null,
      isGrowth: false,
      growth: null as GrowthDisplay | null,
    },
    {
      label: "Total Physical Units",
      value: formatNumber(stats.totalPhysical),
      color: "#4ADE80",
      sub: stats.showContext
        ? `Global: ${formatNumber(stats.globalPhysical)}`
        : null,
      isGrowth: false,
      growth: null as GrowthDisplay | null,
    },
    {
      label: "Stream Growth",
      value: stats.streamGrowth.text,
      color: stats.streamGrowth.color,
      sub: "First vs last week",
      isGrowth: true,
      growth: stats.streamGrowth,
    },
    {
      label: "Physical Growth",
      value: stats.physicalGrowth.text,
      color: stats.physicalGrowth.color,
      sub: "First vs last week",
      isGrowth: true,
      growth: stats.physicalGrowth,
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
            {card.isGrowth && card.growth && (
              <GrowthArrow dir={card.growth.arrow} />
            )}
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
