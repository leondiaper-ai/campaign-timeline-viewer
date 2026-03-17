"use client";

import { useMemo } from "react";
import { CampaignData, Territory } from "@/types";
import { formatNumber } from "@/lib/format";
import { getPeakWeekStats } from "@/lib/transforms";

interface CampaignInsightsProps {
  data: CampaignData;
  campaignId: string;
  territory: Territory;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CampaignInsights({
  data,
  campaignId,
  territory,
}: CampaignInsightsProps) {
  const stats = useMemo(() => {
    const metrics = data.metrics.filter(
      (m) => m.campaign_id === campaignId && m.territory === territory
    );
    const totalStreams = metrics.reduce((s, m) => s + m.total_streams, 0);
    const totalPhysical = metrics.reduce(
      (s, m) => s + (m.retail_units + m.d2c_units),
      0
    );

    const peak = getPeakWeekStats(data, campaignId, territory);

    return { totalStreams, totalPhysical, peak };
  }, [data, campaignId, territory]);

  const cards = [
    {
      label: "Total Streams",
      value: formatNumber(stats.totalStreams),
      color: "#6C9EFF",
      sub: null as string | null,
    },
    {
      label: "Total Physical Units",
      value: formatNumber(stats.totalPhysical),
      color: "#4ADE80",
      sub: null as string | null,
    },
    {
      label: "Peak Week Streams",
      value: formatNumber(stats.peak.peakWeekStreams),
      color: "#FBBF24",
      sub: stats.peak.peakWeekDate
        ? `w/e ${formatDate(stats.peak.peakWeekDate)}`
        : null,
    },
    {
      label: "Top Track",
      value: stats.peak.topTrackName
        ? stats.peak.topTrackName.length > 16
          ? stats.peak.topTrackName.substring(0, 14) + "\u2026"
          : stats.peak.topTrackName
        : "\u2014",
      color: "#F472B6",
      sub: stats.peak.topTrackStreams
        ? `${formatNumber(stats.peak.topTrackStreams)} streams`
        : null,
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
          <p
            className="text-2xl font-bold tabular-nums tracking-tight truncate"
            style={{ color: card.color }}
          >
            {card.value}
          </p>
          {card.sub && (
            <p className="text-[10px] text-label-muted mt-1.5">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
