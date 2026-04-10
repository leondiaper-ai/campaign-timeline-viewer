"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { AppData, LoadedCampaign, Territory } from "@/types";
import {
  buildChartData,
  getAllTrackNames,
  getAllMoments,
  classifyMomentImpact,
  type ClassifiedMoment,
} from "@/lib/transforms";
import CampaignInsights from "./CampaignInsights";
import TimelineChart, { ChartMode } from "./TimelineChart";
import CampaignBreakdown from "./CampaignBreakdown";
import DatasetStrip from "./DatasetStrip";

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtShort(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

interface DashboardProps {
  initialData: AppData;
  isDemo?: boolean;
}

export default function Dashboard({ initialData, isDemo }: DashboardProps) {
  const campaigns = initialData.campaigns;
  const [campaignIdx, setCampaignIdx] = useState(0);
  const [territory, setTerritory] = useState<Territory>("global");
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [pinnedDate, setPinnedDate] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("campaign");

  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  useEffect(() => {
    if (sheet?.setup.default_territory) setTerritory(sheet.setup.default_territory);
  }, [sheet]);

  const allTrackNames = useMemo(() => (sheet ? getAllTrackNames(sheet) : []), [sheet]);
  const chartData = useMemo(
    () => (sheet ? buildChartData(sheet, territory, allTrackNames) : []),
    [sheet, territory, allTrackNames],
  );

  const moments = useMemo(() => {
    if (!sheet) return [];
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

  const albumDate = sheet?.setup.release_date || "";

  const classified = useMemo(() => {
    if (!sheet) return [] as ClassifiedMoment[];
    return classifyMomentImpact(moments, sheet, territory);
  }, [moments, sheet, territory]);

  const chartRef = useRef<HTMLDivElement>(null);
  const effectiveHighlight = pinnedDate || highlightedDate;

  const handleCampaignChange = useCallback((idx: number) => {
    setCampaignIdx(idx);
    setHighlightedDate(null);
    setPinnedDate(null);
    setChartMode("campaign");
  }, []);

  // Click a moment row → pin on chart + scroll chart into view
  const handleMomentClick = useCallback((date: string) => {
    setPinnedDate((prev) => (prev === date ? null : date));
    if (chartRef.current) {
      chartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  if (!campaign || !sheet) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/40 text-lg">No active campaigns found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink/8 px-6 py-5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {isDemo && (
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-sun bg-sun/10 px-2.5 py-1 rounded-full">
                Demo
              </span>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                {sheet.setup.artist_name}
                <span className="text-ink/40 font-medium">
                  {" "}
                  — {sheet.setup.campaign_name}
                </span>
              </h1>
              <p className="text-[11px] text-ink/40 mt-0.5">
                <span className="capitalize">{sheet.setup.campaign_type}</span>
                {sheet.setup.release_date && (
                  <> · Released {fmtDate(sheet.setup.release_date)}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 bg-cream rounded-full p-1 border border-ink/10">
            {(["global", "UK"] as Territory[]).map((t) => (
              <button
                key={t}
                onClick={() => setTerritory(t)}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                  territory === t
                    ? "bg-ink text-paper shadow-sm"
                    : "text-ink/40 hover:text-ink/70"
                }`}
              >
                {t === "global" ? "Global" : "UK"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Dataset strip — CSV filename pickers (acts like a file source selector) */}
        <DatasetStrip
          campaigns={campaigns}
          activeIdx={campaignIdx}
          onSelect={handleCampaignChange}
        />

        {/* Helper line — guides the interaction */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[12px] text-ink/50">
            Click moments to see how activity impacted performance
          </p>
          {pinnedDate && (
            <button
              onClick={() => setPinnedDate(null)}
              className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/35 hover:text-ink transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Timeline chart */}
        <div
          ref={chartRef}
          className="rounded-3xl bg-paper border border-ink/8 p-6 md:p-8 scroll-mt-4 shadow-[8px_8px_0_0_rgba(14,14,14,0.06)]"
        >
          {pinnedDate &&
            (() => {
              const pm = moments.find((m) => m.date === pinnedDate);
              if (!pm) return null;
              return (
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                    <span className="text-[11px] font-medium text-ink">
                      {pm.moment_title}
                    </span>
                    <span className="text-[10px] text-ink/30">{fmtShort(pinnedDate)}</span>
                  </div>
                  <button
                    onClick={() => setPinnedDate(null)}
                    className="text-[9px] text-ink/30 hover:text-ink/60 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              );
            })()}
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

        {/* Campaign Breakdown — click-to-highlight list */}
        <CampaignBreakdown
          sheet={sheet}
          classified={classified}
          activeDate={pinnedDate}
          onMomentClick={handleMomentClick}
        />

        {/* Stats */}
        <CampaignInsights sheet={sheet} territory={territory} />
      </main>
    </div>
  );
}
