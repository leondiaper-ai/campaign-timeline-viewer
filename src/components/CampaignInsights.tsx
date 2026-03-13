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
  
  "use client";

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
  