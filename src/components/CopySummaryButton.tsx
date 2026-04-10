"use client";

import { useState } from "react";
import type { CampaignSheetData, Territory } from "@/types";
import { buildDecision } from "./CampaignDecisionStrip";

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

// ── Concise Slack-ready summary ────────────────────────────────
// Structure: headline · numbers · decision · next step.
// No long narrative.
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

  const decision = buildDecision(sheet, territory);
  const nextActions = (sheet.learnings || [])
    .filter((l) => l.type === "next")
    .slice(0, 2)
    .map((l) => l.text);

  const artist = sheet.setup.artist_name || "Artist";
  const campaign = sheet.setup.campaign_name || "Campaign";
  const terr = territory === "UK" ? "UK" : "Global";

  const lines: string[] = [];
  lines.push(`*${artist} — ${campaign}*  (${terr})`);

  // Numbers — single compact line
  const nums: string[] = [`Streams ${fmtNum(totalStreams)}`];
  if (totalPhysical > 0) nums.push(`Physical ${fmtNum(totalPhysical)}`);
  if (totalSpend > 0) nums.push(`Spend ${fmtSpend(totalSpend)}`);
  lines.push(nums.join("  ·  "));

  // Decision
  lines.push("");
  lines.push(`*Decision:* ${decision.signal} — ${decision.headline}`);
  decision.reasons.forEach((r) => lines.push(`• ${r}`));

  // Next step
  if (nextActions.length > 0) {
    lines.push("");
    lines.push(`*Next step*`);
    nextActions.forEach((a) => lines.push(`→ ${a}`));
  }

  return lines.join("\n");
}

export default function CopySummaryButton({ sheet, territory }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = buildSlackSummary(sheet, territory);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-[11px] text-ink/40">
        Share this campaign summary with your team.
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
          copied
            ? "bg-mint text-ink"
            : "bg-ink text-paper hover:bg-ink/85"
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
            Copied to clipboard
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
