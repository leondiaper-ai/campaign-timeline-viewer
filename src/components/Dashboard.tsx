"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { AppData, LoadedCampaign, Territory, Moment } from "@/types";
import {
  buildChartData, getAllTrackNames, getAllMoments,
  classifyMomentImpact, type ClassifiedMoment,
} from "@/lib/transforms";
import CampaignInsights from "./CampaignInsights";
import TimelineChart, { ChartMode } from "./TimelineChart";
import StateOfPlay from "./StateOfPlay";
import CampaignBreakdown from "./CampaignBreakdown";

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface DashboardProps { initialData: AppData; isDemo?: boolean; }

export default function Dashboard({ initialData, isDemo }: DashboardProps) {
  const campaigns = initialData.campaigns;
  const [campaignIdx, setCampaignIdx] = useState(0);
  const [territory, setTerritory] = useState<Territory>("global");
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [pinnedDate, setPinnedDate] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("campaign");

  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  useEffect(() => { if (sheet?.setup.default_territory) setTerritory(sheet.setup.default_territory); }, [sheet]);

  const allTrackNames = useMemo(() => sheet ? getAllTrackNames(sheet) : [], [sheet]);
  const chartData = useMemo(() => sheet ? buildChartData(sheet, territory, allTrackNames) : [], [sheet, territory, allTrackNames]);

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

  if (!campaign || !sheet) {
    return (<div className="min-h-screen bg-paper flex items-center justify-center"><p className="text-ink/40 text-lg">No active campaigns found.</p></div>);
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink/8 px-6 py-5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isDemo && (
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-sun bg-sun/10 px-2.5 py-1 rounded-full">Demo</span>
            )}
            {campaigns.length > 1 ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/30">Campaign</span>
                <select className="bg-cream border border-ink/10 rounded-full px-4 py-2 text-sm font-bold text-ink"
                  value={campaignIdx} onChange={e => handleCampaignChange(Number(e.target.value))}>
                  {campaigns.map((c, i) => (<option key={c.campaign_id} value={i}>{c.sheet.setup.artist_name} — {c.sheet.setup.campaign_name}</option>))}
                </select>
              </div>
            ) : (
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">{sheet.setup.artist_name}<span className="text-ink/40 font-medium"> — {sheet.setup.campaign_name}</span></h1>
                <p className="text-[11px] text-ink/40 mt-0.5">
                  <span className="capitalize">{sheet.setup.campaign_type}</span>
                  {sheet.setup.release_date && <> · Released {fmtDate(sheet.setup.release_date)}</>}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 bg-cream rounded-full p-1 border border-ink/10">
            {(["global", "UK"] as Territory[]).map(t => (
              <button key={t} onClick={() => setTerritory(t)}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${territory === t ? "bg-ink text-paper shadow-sm" : "text-ink/40 hover:text-ink/70"}`}>
                {t === "global" ? "Global" : "UK"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        {/* Debug strip — confirms data reaching UI. Remove when stable. */}
        {isDemo && (
          <div className="text-[9px] text-ink/20 font-mono flex flex-wrap gap-x-4 gap-y-0.5">
            <span>artist: {sheet.setup.artist_name}</span>
            <span>weeks: {chartData.length}</span>
            <span>peak: {Math.max(...chartData.map(d => d.total_streams)).toLocaleString()}</span>
            <span>tracks: {sheet.tracks.length} total, {sheet.tracks.filter(t => ["lead_single","second_single","focus_track"].includes(t.track_role)).length} key</span>
            <span>moments: {moments.length} ({moments.filter(m => m.is_key).length} key)</span>
            <span>mode: {chartMode}</span>
          </div>
        )}

        {/* 1. State of Play */}
        <StateOfPlay sheet={sheet} territory={territory} />

        {/* 2. Campaign / Tracks Graph */}
        <div ref={chartRef} className="rounded-3xl bg-paper border border-ink/8 p-6 md:p-8 scroll-mt-4 shadow-[8px_8px_0_0_rgba(14,14,14,0.06)]">
          {pinnedDate && (() => {
            const pm = moments.find(m => m.date === pinnedDate);
            if (!pm) return null;
            return (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                  <span className="text-[11px] font-medium text-ink">{pm.moment_title}</span>
                  <span className="text-[10px] text-ink/30">{fmtShort(pinnedDate)}</span>
                </div>
                <button onClick={() => setPinnedDate(null)} className="text-[9px] text-ink/30 hover:text-ink/60 transition-colors">Clear</button>
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

        {/* 3. Campaign Breakdown */}
        <CampaignBreakdown sheet={sheet} classified={classified} />

        {/* 4. Stats */}
        <CampaignInsights sheet={sheet} territory={territory} />
      </main>
    </div>
  );
}
