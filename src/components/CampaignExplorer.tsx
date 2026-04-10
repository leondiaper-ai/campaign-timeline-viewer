"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LoadedCampaign, Territory } from "@/types";
import {
  buildChartData,
  getAllTrackNames,
  getAllMoments,
  classifyMomentImpact,
  type ClassifiedMoment,
} from "@/lib/transforms";
import TimelineChart, { ChartMode } from "./TimelineChart";
import CampaignBreakdown from "./CampaignBreakdown";
import CampaignInsights from "./CampaignInsights";
import CampaignDecisionStrip from "./CampaignDecisionStrip";
import CampaignLearnings from "./CampaignLearnings";

function fmtShort(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

interface Props {
  campaign: LoadedCampaign;
  /** Compact variant renders a tighter chart frame + no stats below (for demo). */
  variant?: "default" | "compact";
  /** Optional helper text shown above the chart. */
  helperText?: string;
  /** Show the inline territory toggle on the chart frame. */
  showTerritoryToggle?: boolean;
}

/**
 * CampaignExplorer — self-contained chart + breakdown for a single campaign.
 *
 * Manages its own pin/territory/mode state so it can be dropped into either
 * the Demo section or the Tool section without cross-talk.
 */
export default function CampaignExplorer({
  campaign,
  variant = "default",
  helperText,
  showTerritoryToggle = true,
}: Props) {
  const sheet = campaign.sheet;
  const [territory, setTerritory] = useState<Territory>(
    sheet.setup.default_territory || "global",
  );
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [pinnedDate, setPinnedDate] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("campaign");

  useEffect(() => {
    setTerritory(sheet.setup.default_territory || "global");
    setPinnedDate(null);
    setHighlightedDate(null);
    setChartMode("campaign");
  }, [sheet]);

  const allTrackNames = useMemo(() => getAllTrackNames(sheet), [sheet]);
  const chartData = useMemo(
    () => buildChartData(sheet, territory, allTrackNames),
    [sheet, territory, allTrackNames],
  );

  const moments = useMemo(() => {
    const base = getAllMoments(sheet);
    if (sheet.paidCampaigns) {
      const seen = new Set<string>();
      for (const pc of sheet.paidCampaigns) {
        if (pc.start_date) {
          const key = `${pc.start_date}|${pc.platform}|${pc.campaign_name}|${pc.territory}`;
          if (!seen.has(key)) {
            seen.add(key);
            base.push({
              date: pc.start_date,
              moment_title: `${pc.platform} (${pc.territory}) — ${pc.campaign_name}`,
              moment_type: "marquee",
              is_key: true,
            });
          }
        }
      }
    }
    return base.sort((a, b) => a.date.localeCompare(b.date));
  }, [sheet]);

  const albumDate = sheet.setup.release_date || "";
  const classified = useMemo<ClassifiedMoment[]>(
    () => classifyMomentImpact(moments, sheet, territory),
    [moments, sheet, territory],
  );

  const chartRef = useRef<HTMLDivElement>(null);
  const effectiveHighlight = pinnedDate || highlightedDate;

  const handleMomentClick = useCallback((date: string) => {
    setPinnedDate((prev) => (prev === date ? null : date));
    if (chartRef.current) {
      chartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const pinnedMoment = pinnedDate
    ? moments.find((m) => m.date === pinnedDate)
    : undefined;

  return (
    <div className="space-y-5">
      {/* ═════ METRICS BAR — top-of-analysis entry point ═════ */}
      {variant !== "compact" && (
        <CampaignInsights sheet={sheet} territory={territory} />
      )}

      {/* Helper text + territory toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {helperText ? (
          <p className="text-[12px] text-ink/50">{helperText}</p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {pinnedDate && (
            <button
              onClick={() => setPinnedDate(null)}
              className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/35 hover:text-ink transition-colors"
            >
              Clear selection
            </button>
          )}
          {showTerritoryToggle && (
            <div className="flex items-center gap-0.5 bg-cream rounded-full p-1 border border-ink/10">
              {(["global", "UK"] as Territory[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTerritory(t)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                    territory === t
                      ? "bg-ink text-paper shadow-sm"
                      : "text-ink/40 hover:text-ink/70"
                  }`}
                >
                  {t === "global" ? "Global" : "UK"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline chart */}
      <div
        ref={chartRef}
        className={`rounded-3xl bg-paper border border-ink/8 ${
          variant === "compact" ? "p-5 md:p-6" : "p-6 md:p-8"
        } scroll-mt-4 shadow-[8px_8px_0_0_rgba(14,14,14,0.06)]`}
      >
        {pinnedMoment && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
              <span className="text-[11px] font-medium text-ink">
                {pinnedMoment.moment_title}
              </span>
              <span className="text-[10px] text-ink/30">
                {fmtShort(pinnedDate!)}
              </span>
            </div>
            <button
              onClick={() => setPinnedDate(null)}
              className="text-[9px] text-ink/30 hover:text-ink/60 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
        <TimelineChart
          data={chartData}
          moments={moments}
          highlightedDate={effectiveHighlight}
          pinnedDate={pinnedDate}
          albumDate={albumDate}
          territory={territory}
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          tracks={sheet.tracks}
        />
      </div>

      {/* ═════ DECISION STRIP — signal + Copy summary ═════ */}
      {variant !== "compact" && (
        <CampaignDecisionStrip sheet={sheet} territory={territory} />
      )}

      {/* Campaign breakdown — click-to-highlight */}
      <CampaignBreakdown
        sheet={sheet}
        classified={classified}
        activeDate={pinnedDate}
        onMomentClick={handleMomentClick}
      />

      {/* Learnings — collapsed by default */}
      {variant !== "compact" && <CampaignLearnings sheet={sheet} />}
    </div>
  );
}
