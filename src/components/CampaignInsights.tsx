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
  }
}