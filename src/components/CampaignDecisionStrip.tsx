"use client";

import { useMemo, useState } from "react";
import type { CampaignSheetData, Territory } from "@/types";
import {
  getCampaignVerdict,
  getMomentumStatus,
  getTopImpactMoment,
  getCampaignSummary,
  getUKTotals,
} from "@/lib/transforms";

interface Props {
  sheet: CampaignSheetData;
  territory: Territory;
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}
function fmtSpend(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  if (v > 0) return `$${v}`;
  return "—";
}
function fmtShortDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

// ── Signal sentence ────────────────────────────────────────────
function buildSignalSentence(
  sheet: CampaignSheetData,
  territory: Territory,
): string {
  const verdict = getCampaignVerdict(sheet, territory);
  const momentum = getMomentumStatus(sheet, territory);

  // momentum phrasing
  const momentumLabel =
    momentum.direction === "rising"
      ? "momentum rising"
      : momentum.direction === "declining"
        ? "momentum cooling"
        : "momentum holding";

  // conversion phrasing — look at pre-release lift
  const pcs = sheet.paidCampaigns || [];
  const preReleasePaid = pcs.filter(
    (p) => sheet.setup.release_date && p.start_date < sheet.setup.release_date,
  );
  const hadPreReleasePaid = preReleasePaid.length > 0;

  // Try to detect weak pre-release conversion — small release bump vs peak
  let conversionPhrase = "";
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = (sheet.weeklyData || [])
    .filter((r) => r.track_name === "TOTAL")
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
  const albumDate = sheet.setup.release_date;
  if (albumDate && totalRows.length >= 2) {
    const preAlbum = totalRows.filter((r) => r.week_start_date < albumDate);
    const postAlbum = totalRows.filter((r) => r.week_start_date >= albumDate);
    if (preAlbum.length > 0 && postAlbum.length > 0) {
      const prePeak = Math.max(...preAlbum.map((r) => r[streamKey]));
      const postPeak = Math.max(...postAlbum.map((r) => r[streamKey]));
      if (prePeak > 0 && postPeak > 0) {
        const lift = postPeak / prePeak;
        if (lift >= 2.5)
          conversionPhrase = "strong pre-release conversion";
        else if (lift >= 1.4)
          conversionPhrase = "steady pre-release conversion";
        else conversionPhrase = "weak pre-release conversion";
      }
    }
  }
  if (!conversionPhrase && hadPreReleasePaid)
    conversionPhrase = "pre-release activity logged";

  // verdict phrasing
  const verdictPhrase =
    verdict.level === "strong"
      ? "strong campaign"
      : verdict.level === "building"
        ? "building momentum"
        : "early phase";

  const parts = [verdictPhrase, momentumLabel];
  if (conversionPhrase) parts.push(conversionPhrase);
  return parts.join(", ");
}

// ── Slack-formatted summary ────────────────────────────────────
function buildSlackSummary(
  sheet: CampaignSheetData,
  territory: Territory,
): string {
  const streamKey = territory === "UK" ? "streams_uk" : "streams_global";
  const totalRows = (sheet.weeklyData || []).filter(
    (r) => r.track_name === "TOTAL",
  );
  const totalStreams = totalRows.reduce((s, r) => s + r[streamKey], 0);
  const totalPhysical = (sheet.physicalData || []).reduce(
    (s, r) => s + r.units,
    0,
  );
  const totalSpend = (sheet.paidCampaigns || []).reduce(
    (s, p) => s + p.spend,
    0,
  );

  const topMoment = getTopImpactMoment(sheet, territory);
  const summary = getCampaignSummary(sheet, territory);
  const verdict = getCampaignVerdict(sheet, territory);
  const momentum = getMomentumStatus(sheet, territory);
  const signal = buildSignalSentence(sheet, territory);

  // Key drivers — top 3 key moments by type diversity
  const keyMoments = (sheet.moments || [])
    .filter((m) => m.is_key)
    .sort((a, b) => a.date.localeCompare(b.date));
  const drivers = keyMoments.slice(0, 3).map((m) => {
    const date = fmtShortDate(m.date);
    return `• ${m.moment_title} (${date})`;
  });

  const uk = getUKTotals(sheet, territory);
  const artist = sheet.setup.artist_name || "Artist";
  const campaign = sheet.setup.campaign_name || "Campaign";
  const territoryLabel = territory === "UK" ? "UK" : "Global";

  const lines: string[] = [];
  lines.push(`*${artist} — ${campaign}*`);
  lines.push(`_${verdict.label} · ${momentum.label}_`);
  lines.push("");
  lines.push(`*Headline numbers (${territoryLabel})*`);
  lines.push(`• Streams: ${fmtNum(totalStreams)}`);
  if (uk.ukStreams > 0 && territory === "global")
    lines.push(`• UK share: ${fmtNum(uk.ukStreams)} (${uk.ukShare}% of global)`);
  if (totalPhysical > 0) lines.push(`• Physical: ${fmtNum(totalPhysical)}`);
  if (totalSpend > 0) lines.push(`• Campaign spend: ${fmtSpend(totalSpend)}`);
  lines.push("");
  lines.push(`*Peak moment*`);
  lines.push(`• ${topMoment.title}${topMoment.date ? ` — ${fmtShortDate(topMoment.date)}` : ""}`);
  lines.push(`• ${topMoment.impact}`);
  lines.push("");
  if (drivers.length > 0) {
    lines.push(`*Key drivers*`);
    lines.push(...drivers);
    lines.push("");
  }
  lines.push(`*Decision signal*`);
  lines.push(`• ${signal}`);
  lines.push(`• ${summary}`);

  return lines.join("\n");
}

export default function CampaignDecisionStrip({ sheet, territory }: Props) {
  const signal = useMemo(
    () => buildSignalSentence(sheet, territory),
    [sheet, territory],
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = buildSlackSummary(sheet, territory);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // swallow
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div className="rounded-2xl bg-ink text-paper px-5 py-4 flex items-start justify-between gap-4 flex-wrap shadow-[4px_4px_0_0_rgba(14,14,14,0.1)]">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="inline-flex items-center justify-center text-[9px] font-bold uppercase tracking-[0.18em] bg-sun text-ink rounded-full px-2 py-1 shrink-0 mt-0.5">
          Signal
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/50 mb-1">
            Campaign signal
          </p>
          <p className="text-[14px] md:text-[15px] font-semibold leading-snug text-paper break-words">
            {signal}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
          copied
            ? "bg-mint text-ink"
            : "bg-paper text-ink hover:bg-sun"
        }`}
      >
        {copied ? (
          <>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="w-3.5 h-3.5"
              aria-hidden="true"
            >
              <path
                d="M3 8.5L6.5 12L13 4.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="w-3.5 h-3.5"
              aria-hidden="true"
            >
              <rect
                x="5"
                y="5"
                width="9"
                height="9"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M3 11V3a1 1 0 0 1 1-1h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Copy summary
          </>
        )}
      </button>
    </div>
  );
}
