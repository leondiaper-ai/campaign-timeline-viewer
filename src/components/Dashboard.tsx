"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { AppData, LoadedCampaign, Territory, Moment, PaidCampaignRow } from "@/types";
import {
  buildChartData, getAllTrackNames, getAllMoments,
  inferTrackRoles, detectHandoverMoment, getChartInsight,
  getCampaignSummary, getTrackModeContext,
  buildUKTrackContext, buildUKMilestones, UKTrackContext,
  classifyMomentImpact, type ClassifiedMoment, type ImpactTier,
} from "@/lib/transforms";
import { getCategoryConfig, getAllCategories } from "@/lib/event-categories";
import CampaignInsights from "./CampaignInsights";
import CampaignLearnings from "./CampaignLearnings";
// D2COwnership card removed — D2C now integrated into timeline chart
import TimelineChart, { ChartMode } from "./TimelineChart";

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface DashboardProps { initialData: AppData; }

export default function Dashboard({ initialData }: DashboardProps) {
  const campaigns = initialData.campaigns;
  const [campaignIdx, setCampaignIdx] = useState(0);
  const [territory, setTerritory] = useState<Territory>("global");
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("campaign");
  const [pinnedDate, setPinnedDate] = useState<string | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const [learningsExpanded, setLearningsExpanded] = useState(false);
  const [timelineView, setTimelineView] = useState<"impact" | "timeline">("timeline");

  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  useEffect(() => { if (sheet?.setup.default_territory) setTerritory(sheet.setup.default_territory); }, [sheet]);

  const allTrackNames = useMemo(() => sheet ? getAllTrackNames(sheet) : [], [sheet]);
  const trackRoles = useMemo(() => sheet ? inferTrackRoles(sheet, territory) : [], [sheet, territory]);
  const chartData = useMemo(() => sheet ? buildChartData(sheet, territory, allTrackNames) : [], [sheet, territory, allTrackNames]);

  // Default tracks view: show only key narrative tracks (not all 13)
  const DEFAULT_VISIBLE = ["Death Of Love", "I Had a Dream", "Doesn't Just Happen", "Trying Times"];
  const visibleTracks = useMemo(() => {
    // Use defaults if they exist in the data, otherwise fall back to key roles
    const matched = DEFAULT_VISIBLE.filter(t => allTrackNames.includes(t));
    if (matched.length >= 2) return matched;
    return trackRoles.filter(r => r.opacity >= 0.5).map(r => r.track_name).slice(0, 4);
  }, [allTrackNames, trackRoles]);
  const handoverMoment = useMemo(() => sheet ? detectHandoverMoment(sheet, territory) : null, [sheet, territory]);
  const chartInsight = useMemo(() => sheet ? getChartInsight(sheet, territory) : null, [sheet, territory]);
  const trackModeContext = useMemo(() => sheet ? getTrackModeContext(sheet, territory) : null, [sheet, territory]);
  const ukTrackContext = useMemo(() => sheet ? buildUKTrackContext(sheet) : [], [sheet]);
  const ukMilestones = useMemo(() => sheet ? buildUKMilestones(sheet) : [], [sheet]);
  const summary = useMemo(() => sheet ? getCampaignSummary(sheet, territory) : "", [sheet, territory]);
  const teamPush = useMemo(() => {
    if (!sheet) return null;
    const { team_push_push, team_push_support, team_push_next } = sheet.setup;
    if (!team_push_push && !team_push_support && !team_push_next) return null;
    return { push: team_push_push, support: team_push_support, next: team_push_next };
  }, [sheet]);
  const moments = useMemo(() => {
    if (!sheet) return [];
    const base = getAllMoments(sheet);
    // Generate paid-campaign moments from sheet data (paid_campaigns tab)
    // Deduplicate by date+platform+campaign: one moment per unique combo, with territory in title
    if (sheet.paidCampaigns) {
      const seen = new Set<string>();
      for (const pc of sheet.paidCampaigns) {
        if (pc.start_date) {
          const key = `${pc.start_date}|${pc.platform}|${pc.campaign_name}|${pc.territory}`;
          if (!seen.has(key)) {
            seen.add(key);
            base.push({
              date: pc.start_date,
              moment_title: `${pc.platform} (${pc.territory}) \u2014 ${pc.campaign_name}`,
              moment_type: "marquee",
              is_key: true,
            });
          }
        }
      }
    }
    // Generate D2C sales moments from d2c_sales tab
    if (sheet.d2cSales && sheet.d2cSales.length > 0) {
      const d2c = sheet.d2cSales;
      for (let i = 0; i < d2c.length; i++) {
        const row = d2c[i];
        const ukShare = row.global_d2c_sales > 0
          ? ((row.uk_d2c_sales / row.global_d2c_sales) * 100).toFixed(1)
          : "0";
        // Generate contextual framing
        let title = "";
        if (i === 0) {
          title = `D2C snapshot: ${row.global_d2c_sales.toLocaleString()} global, UK ${ukShare}%`;
        } else {
          const prev = d2c[i - 1];
          const globalGrowth = row.global_d2c_sales - prev.global_d2c_sales;
          const ukGrowth = row.uk_d2c_sales - prev.uk_d2c_sales;
          const prevUkShare = prev.global_d2c_sales > 0
            ? (prev.uk_d2c_sales / prev.global_d2c_sales) * 100
            : 0;
          const shareUp = parseFloat(ukShare) > prevUkShare;
          if (shareUp && ukGrowth > 0) {
            title = `D2C: UK share strengthening (${ukShare}%), +${ukGrowth.toLocaleString()} UK sales`;
          } else if (globalGrowth > 0) {
            title = `D2C: +${globalGrowth.toLocaleString()} global sales, UK ${ukShare}%`;
          } else {
            title = `D2C snapshot: ${row.global_d2c_sales.toLocaleString()} global, UK ${ukShare}%`;
          }
        }
        base.push({
          date: row.date,
          moment_title: title,
          moment_type: "product",
          is_key: false,
        });
      }
    }
    return base.sort((a, b) => a.date.localeCompare(b.date));
  }, [sheet]);
  const keyMomentDates = useMemo(() => new Set(moments.filter(m => m.is_key).map(m => m.date)), [moments]);

  const albumDate = sheet?.setup.release_date || "";
  const [showBackground, setShowBackground] = useState(false);
  // Classify moments by impact tier
  const classified = useMemo(() => {
    if (!sheet) return [] as ClassifiedMoment[];
    return classifyMomentImpact(moments, sheet, territory);
  }, [moments, sheet, territory]);
  const drivers = useMemo(() => classified.filter(c => c.tier === "driver").sort((a, b) => a.moment.date.localeCompare(b.moment.date)), [classified]);
  const supporting = useMemo(() => classified.filter(c => c.tier === "supporting").sort((a, b) => a.moment.date.localeCompare(b.moment.date)), [classified]);
  const background = useMemo(() => classified.filter(c => c.tier === "background").sort((a, b) => a.moment.date.localeCompare(b.moment.date)), [classified]);

  const chartRef = useRef<HTMLDivElement>(null);
  const handleMomentClick = useCallback((date: string) => {
    const next = pinnedDate === date ? null : date;
    setPinnedDate(next);
    if (next && chartRef.current) {
      chartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pinnedDate]);
  const effectiveHighlight = pinnedDate || highlightedDate;
  const handleCampaignChange = useCallback((idx: number) => { setCampaignIdx(idx); setHighlightedDate(null); setPinnedDate(null); setChartMode("campaign"); }, []);

  if (!campaign || !sheet) {
    return (<div className="min-h-screen bg-[#0D1117] flex items-center justify-center"><p className="text-[#6B7280] text-lg">No active campaigns found.</p></div>);
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <header className="border-b border-[#1E2130] px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {campaigns.length > 1 ? (
              <select className="bg-[#161922] border border-[#2A2D3E] rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                value={campaignIdx} onChange={e => handleCampaignChange(Number(e.target.value))}>
                {campaigns.map((c, i) => (<option key={c.campaign_id} value={i}>{c.sheet.setup.artist_name} — {c.sheet.setup.campaign_name}</option>))}
              </select>
            ) : (
              <div>
                <h1 className="text-lg font-semibold">{sheet.setup.artist_name}<span className="text-[#6B7280] font-normal"> — {sheet.setup.campaign_name}</span></h1>
                <p className="text-[11px] text-[#4B5563] mt-0.5">
                  <span className="capitalize">{sheet.setup.campaign_type}</span>
                  {sheet.setup.release_date && <> · Released {fmtDate(sheet.setup.release_date)}</>}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-[#161922] rounded-lg p-0.5 border border-[#2A2D3E]">
            {(["global", "UK"] as Territory[]).map(t => (
              <button key={t} onClick={() => setTerritory(t)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${territory === t ? "bg-[#6C9EFF]/15 text-[#6C9EFF] shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>
                {t === "global" ? "Global" : "UK"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        {/* Team Push — forward-looking action plan */}
        {teamPush && (
          <div className="bg-[#131620] rounded-xl border border-[#FBBF24]/10 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#FBBF24]/80 mb-2">Team Push</p>
            <div className="space-y-1">
              {teamPush.push && (
                <p className="text-[12px] text-white">
                  <span className="font-bold text-[#FBBF24]">PUSH</span>
                  <span className="text-[#4B5563] mx-1.5">→</span>
                  <span className="font-semibold">{teamPush.push}</span>
                </p>
              )}
              {teamPush.support && (
                <p className="text-[12px] text-[#D1D5DB]">
                  <span className="font-bold text-[#6B7280]">Support</span>
                  <span className="text-[#4B5563] mx-1.5">→</span>
                  {teamPush.support}
                </p>
              )}
              {teamPush.next && (
                <p className="text-[12px] text-[#9CA3AF]">
                  <span className="font-bold text-[#6B7280]">Next</span>
                  <span className="text-[#4B5563] mx-1.5">→</span>
                  {teamPush.next}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <CampaignInsights sheet={sheet} territory={territory} />

        {/* D2C headline — 2-line compact summary above chart */}
        {sheet.d2cSales && sheet.d2cSales.length >= 2 && (() => {
          const first = sheet.d2cSales[0];
          const latest = sheet.d2cSales[sheet.d2cSales.length - 1];
          const firstShare = first.global_d2c_sales > 0
            ? Math.round((first.uk_d2c_sales / first.global_d2c_sales) * 1000) / 10 : 0;
          const latestShare = latest.global_d2c_sales > 0
            ? Math.round((latest.uk_d2c_sales / latest.global_d2c_sales) * 1000) / 10 : 0;
          const rising = latestShare > firstShare;
          const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toLocaleString();
          return (
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-[5px] flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-[12px] text-[#D1D5DB] font-medium">
                  D2C: {fmtK(latest.global_d2c_sales)} global · {fmtK(latest.uk_d2c_sales)} UK
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  {rising
                    ? `UK share rising (${firstShare}% → ${latestShare}%)`
                    : `UK share: ${latestShare}%`}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Chart */}
        <div ref={chartRef} className="bg-[#131620] rounded-2xl border border-[#1E2130] p-5 scroll-mt-4">
          {/* Pinned moment context label */}
          {pinnedDate && (() => {
            const pm = moments.find(m => m.date === pinnedDate);
            const pc = classified.find(c => c.moment.date === pinnedDate);
            if (!pm) return null;
            return (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] animate-pulse" />
                  <span className="text-[11px] font-medium text-white">{pm.moment_title}</span>
                  {pc?.context && <span className="text-[10px] text-[#9CA3AF]">→ {pc.context.charAt(0).toLowerCase()}{pc.context.slice(1)}</span>}
                  <span className="text-[10px] text-[#4B5563]">{fmtShort(pinnedDate)}</span>
                </div>
                <button onClick={() => setPinnedDate(null)} className="text-[9px] text-[#4B5563] hover:text-[#9CA3AF] transition-colors">Clear</button>
              </div>
            );
          })()}
          <TimelineChart data={chartData} selectedTracks={visibleTracks} trackRoles={trackRoles}
            visibleEventDates={keyMomentDates} highlightedDate={effectiveHighlight}
            pinnedDate={pinnedDate}
            handoverMoment={handoverMoment} chartInsight={chartInsight} trackModeContext={trackModeContext}
            chartMode={chartMode} onChartModeChange={setChartMode} albumDate={albumDate}
            ukMilestones={ukMilestones} territory={territory}
            paidCampaigns={sheet.paidCampaigns} moments={moments} />
        </div>

        {/* Full Campaign Timeline — collapsed by default */}
        <div className="bg-[#131620] rounded-xl border border-[#1E2D44] shadow-[0_0_15px_rgba(59,130,246,0.08)] hover:shadow-[0_0_20px_rgba(59,130,246,0.12)] transition-shadow duration-300">
          <button onClick={() => setLogExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-4 text-left group">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B9CC7]">
                Full Campaign Timeline <span className="text-[#5B6B8A] font-normal ml-1">({moments.length} events)</span>
              </h3>
              {!logExpanded && <span className="text-[10px] text-[#5B6B8A] group-hover:text-[#8B9CC7] transition-colors">Expand to view full campaign history</span>}
            </div>
            <div className="flex items-center gap-2">
              {pinnedDate && logExpanded && <span onClick={(e) => { e.stopPropagation(); setPinnedDate(null); }} className="text-[10px] text-[#6B7280] hover:text-white underline underline-offset-2 cursor-pointer">Clear selection</span>}
              <svg className={`w-4 h-4 text-[#4B5563] transition-transform ${logExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>

          {logExpanded && (
            <div className="px-5 pb-5">
              {/* View Toggle + Legend */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1 bg-[#0D1117] rounded-lg p-0.5 w-fit">
                  {(["impact", "timeline"] as const).map(v => (
                    <button key={v} onClick={() => setTimelineView(v)}
                      className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${timelineView === v ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>
                      {v === "impact" ? "Impact View" : "Timeline View"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {Object.entries(getAllCategories()).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="text-[9px] text-[#6B7280]">{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {timelineView === "impact" ? (
                <div className="space-y-4">
                  {/* Moment Drivers */}
                  {drivers.length > 0 && (
                    <div>
                      <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#FBBF24] mb-2 pb-1 border-b border-[#1E2130]">
                        Moment Drivers <span className="text-[#4B5563] font-normal ml-1">({drivers.length})</span>
                      </h4>
                      <div className="space-y-0.5">
                        {drivers.map((c, i) => <TieredMomentRow key={`d${i}`} classified={c} pinnedDate={pinnedDate} effectiveHighlight={effectiveHighlight}
                          onHover={setHighlightedDate} onClick={handleMomentClick} />)}
                      </div>
                    </div>
                  )}

                  {/* Supporting Activity */}
                  {supporting.length > 0 && (
                    <div>
                      <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mb-2 pb-1 border-b border-[#1E2130]">
                        Supporting Activity <span className="text-[#4B5563] font-normal ml-1">({supporting.length})</span>
                      </h4>
                      <div className="space-y-0.5">
                        {supporting.map((c, i) => <TieredMomentRow key={`s${i}`} classified={c} pinnedDate={pinnedDate} effectiveHighlight={effectiveHighlight}
                          onHover={setHighlightedDate} onClick={handleMomentClick} />)}
                      </div>
                    </div>
                  )}

                  {/* Background Activity — collapsible */}
                  {background.length > 0 && (
                    <div>
                      {!showBackground ? (
                        <button onClick={() => setShowBackground(true)}
                          className="text-[10px] text-[#4B5563] hover:text-[#6B7280] transition-colors">
                          + {background.length} additional activit{background.length === 1 ? "y" : "ies"}
                        </button>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#1E2130]">
                            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#4B5563]">
                              Background Activity <span className="font-normal ml-1">({background.length})</span>
                            </h4>
                            <button onClick={() => setShowBackground(false)} className="text-[9px] text-[#4B5563] hover:text-[#6B7280] transition-colors">Collapse</button>
                          </div>
                          <div className="space-y-0.5">
                            {background.map((c, i) => <TieredMomentRow key={`b${i}`} classified={c} pinnedDate={pinnedDate} effectiveHighlight={effectiveHighlight}
                              onHover={setHighlightedDate} onClick={handleMomentClick} />)}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <ChronologicalTimeline moments={moments} classified={classified}
                  albumDate={albumDate} paidCampaigns={sheet.paidCampaigns || []}
                  pinnedDate={pinnedDate} effectiveHighlight={effectiveHighlight}
                  onHover={setHighlightedDate} onClick={handleMomentClick} />
              )}
            </div>
          )}
        </div>

        {/* Learnings */}
        <CampaignLearnings sheet={sheet} />
        {/* UK Track Context (supporting layer — visible in global mode) */}
        {territory === "global" && ukTrackContext.length > 0 && (
          <div className="bg-[#131620] rounded-xl border border-[#1E2130] p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mb-3">
              UK Context
              <span className="text-[#4B5563] font-normal ml-2">Supporting data — not rendered as daily lines</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1E2130]">
                    <th className="text-[9px] font-bold uppercase tracking-wider text-[#4B5563] pb-2 pr-4">Track</th>
                    <th className="text-[9px] font-bold uppercase tracking-wider text-[#4B5563] pb-2 pr-4 text-right">UK Streams</th>
                    <th className="text-[9px] font-bold uppercase tracking-wider text-[#4B5563] pb-2 pr-4 text-right">Global</th>
                    <th className="text-[9px] font-bold uppercase tracking-wider text-[#4B5563] pb-2 pr-4 text-right">UK Share</th>
                    <th className="text-[9px] font-bold uppercase tracking-wider text-[#4B5563] pb-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ukTrackContext.map((row: UKTrackContext, i: number) => (
                    <tr key={i} className="border-b border-[#1E2130]/50">
                      <td className="text-[11px] text-white font-medium py-2 pr-4">{row.track_name}</td>
                      <td className="text-[11px] text-[#D1D5DB] tabular-nums py-2 pr-4 text-right">{row.uk_streams >= 1_000_000 ? `${(row.uk_streams/1_000_000).toFixed(1)}M` : row.uk_streams >= 1_000 ? `${(row.uk_streams/1_000).toFixed(0)}K` : row.uk_streams}</td>
                      <td className="text-[11px] text-[#9CA3AF] tabular-nums py-2 pr-4 text-right">{row.global_streams >= 1_000_000 ? `${(row.global_streams/1_000_000).toFixed(1)}M` : row.global_streams >= 1_000 ? `${(row.global_streams/1_000).toFixed(0)}K` : row.global_streams}</td>
                      <td className="text-[11px] tabular-nums py-2 pr-4 text-right">
                        <span className={`${row.uk_share_pct >= 15 ? "text-emerald-400 font-semibold" : "text-[#6B7280]"}`}>{row.uk_share_pct}%</span>
                      </td>
                      <td className="text-[10px] text-[#6B7280] py-2">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function TieredMomentRow({ classified, pinnedDate, effectiveHighlight, onHover, onClick }: {
  classified: ClassifiedMoment; pinnedDate: string | null; effectiveHighlight: string | null;
  onHover: (d: string | null) => void; onClick: (d: string) => void;
}) {
  const { moment, tier, context } = classified;
  const cat = getCategoryConfig(moment.moment_type);
  const isPinned = pinnedDate === moment.date;
  const isDriver = tier === "driver";
  const isBg = tier === "background";
  return (
    <div onClick={() => onClick(moment.date)}
      className={`flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
        isPinned ? "bg-white/8 ring-1 ring-white/10" : effectiveHighlight === moment.date ? "bg-white/5" : "hover:bg-white/[0.03]"
      }`}
      onMouseEnter={() => onHover(moment.date)} onMouseLeave={() => onHover(null)}>
      <span className={`${isDriver ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full mt-1 flex-shrink-0`} style={{ backgroundColor: cat.color, opacity: isBg ? 0.4 : 1 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] leading-tight ${isDriver ? "font-semibold text-white" : isBg ? "font-normal text-[#6B7280]" : "font-medium text-[#D1D5DB]"}`}>{moment.moment_title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] ${isBg ? "text-[#374151]" : "text-[#4B5563]"}`}>{fmtShort(moment.date)} · {cat.label}</span>
          {context && <span className={`text-[9px] ${isDriver ? "text-[#FBBF24]/70" : "text-[#4B5563]"}`}>— {context}</span>}
        </div>
      </div>
    </div>
  );
}

// ——— Chronological Timeline View ———————————————————————————
type Phase = "pre" | "release" | "post";
const PHASE_META: Record<Phase, { label: string; color: string }> = {
  pre:     { label: "Pre-Release",   color: "#6C9EFF" },
  release: { label: "Release Week",  color: "#FBBF24" },
  post:    { label: "Post-Release",  color: "#10B981" },
};
const PHASE_ORDER: Phase[] = ["pre", "release", "post"];

interface NarrativeMoment {
  date: string;
  label: string;       // "Album Release" or combined title
  context: string;     // "→ primary campaign driver"
  isKey: boolean;
  phase: Phase;
}

function buildNarrativeMoments(
  moments: Moment[],
  classified: ClassifiedMoment[],
  albumDate: string,
  paidCampaigns: PaidCampaignRow[],
): NarrativeMoment[] {
  if (!albumDate) return [];
  const albumMs = new Date(albumDate).getTime();
  const releaseEnd = albumMs + 7 * 86400000; // release week = 7 days

  // Build a lookup from classified moments for context
  const classifiedMap = new Map<string, ClassifiedMoment>();
  for (const c of classified) {
    // Use date+title as key to handle multiple events on same date
    classifiedMap.set(`${c.moment.date}|${c.moment.moment_title}`, c);
  }

  // Build paid spend summaries by date+platform for merged display
  // e.g. "Marquee" on 2026-03-13 with UK $8K + DE $2.5K
  const paidByDatePlatform = new Map<string, { platform: string; territories: { territory: string; spend: number }[] }>();
  for (const pc of paidCampaigns) {
    if (!pc.start_date) continue;
    const key = `${pc.start_date}|${pc.platform}`;
    const existing = paidByDatePlatform.get(key);
    if (existing) {
      existing.territories.push({ territory: pc.territory, spend: pc.spend });
    } else {
      paidByDatePlatform.set(key, { platform: pc.platform, territories: [{ territory: pc.territory, spend: pc.spend }] });
    }
  }

  // Track which moments we've already rendered (to dedupe paid campaigns)
  const renderedPaidKeys = new Set<string>();
  const result: NarrativeMoment[] = [];

  for (const m of moments) {
    const dateMs = new Date(m.date).getTime();
    const phase: Phase = dateMs < albumMs ? "pre" : dateMs < releaseEnd ? "release" : "post";
    const cl = classifiedMap.get(`${m.date}|${m.moment_title}`);
    const tier = cl?.tier || "background";
    const clContext = cl?.context || "";

    // Skip background items entirely in timeline view
    if (tier === "background") continue;

    const type = m.moment_type.toLowerCase();
    const isPaid = type === "marquee" || type === "showcase" || type === "paid";

    // For paid campaigns, merge into single line per date+platform
    if (isPaid) {
      const paidKey = `${m.date}|${type === "marquee" ? "Marquee" : type === "showcase" ? "Showcase" : "Paid"}`;
      // Try exact platform match from paid data
      let matchedKey: string | null = null;
      for (const [k] of paidByDatePlatform) {
        if (k.startsWith(m.date + "|")) { matchedKey = k; break; }
      }
      const dedupKey = matchedKey || paidKey;
      if (renderedPaidKeys.has(dedupKey)) continue;
      renderedPaidKeys.add(dedupKey);

      const paidInfo = matchedKey ? paidByDatePlatform.get(matchedKey) : null;
      if (paidInfo) {
        const fmtSpend = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : `$${n}`;
        const territoryParts = paidInfo.territories
          .filter(t => t.spend > 0)
          .map(t => `${t.territory} ${fmtSpend(t.spend)}`)
          .join(" / ");
        const label = territoryParts ? `${paidInfo.platform} (${territoryParts})` : paidInfo.platform;
        result.push({ date: m.date, label, context: clContext ? `→ ${clContext.charAt(0).toLowerCase()}${clContext.slice(1)}` : "", isKey: tier === "driver", phase });
      } else {
        result.push({ date: m.date, label: m.moment_title, context: clContext ? `→ ${clContext.charAt(0).toLowerCase()}${clContext.slice(1)}` : "", isKey: tier === "driver", phase });
      }
      continue;
    }

    // Regular moment
    // Clean up the title for narrative readability
    let label = m.moment_title;
    // Strip redundant "release" from album release titles
    if (type === "music" && label.toLowerCase().includes("album") && label.toLowerCase().includes("release")) {
      label = "Album Release";
    }

    result.push({
      date: m.date,
      label,
      context: clContext ? `→ ${clContext.charAt(0).toLowerCase()}${clContext.slice(1)}` : "",
      isKey: tier === "driver",
      phase,
    });
  }

  return result;
}

function ChronologicalTimeline({ moments, classified, albumDate, paidCampaigns, pinnedDate, effectiveHighlight, onHover, onClick }: {
  moments: Moment[];
  classified: ClassifiedMoment[];
  albumDate: string;
  paidCampaigns: PaidCampaignRow[];
  pinnedDate: string | null;
  effectiveHighlight: string | null;
  onHover: (d: string | null) => void;
  onClick: (d: string) => void;
}) {
  const narrative = useMemo(() => buildNarrativeMoments(moments, classified, albumDate, paidCampaigns), [moments, classified, albumDate, paidCampaigns]);

  const phaseGroups = useMemo(() => {
    const groups: Record<Phase, NarrativeMoment[]> = { pre: [], release: [], post: [] };
    for (const nm of narrative) groups[nm.phase].push(nm);
    // Cap each phase at ~6 items, keeping key items first
    for (const phase of PHASE_ORDER) {
      const items = groups[phase];
      if (items.length > 6) {
        const key = items.filter(i => i.isKey);
        const nonKey = items.filter(i => !i.isKey);
        groups[phase] = [...key, ...nonKey].slice(0, 6);
      }
    }
    return groups;
  }, [narrative]);

  return (
    <div className="space-y-4">
      {PHASE_ORDER.map(phase => {
        const items = phaseGroups[phase];
        if (items.length === 0) return null;
        const meta = PHASE_META[phase];
        return (
          <div key={phase}>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 pb-1 border-b border-[#1E2130]"
              style={{ color: meta.color }}>
              {meta.label} <span className="text-[#4B5563] font-normal ml-1">({items.length})</span>
            </h4>
            <div className="space-y-0.5">
              {items.map((nm, i) => {
                const isPinned = pinnedDate === nm.date;
                return (
                  <div key={`${phase}${i}`}
                    onClick={() => onClick(nm.date)}
                    className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                      isPinned ? "bg-white/8 ring-1 ring-white/10" : effectiveHighlight === nm.date ? "bg-white/5" : "hover:bg-white/[0.03]"
                    }`}
                    onMouseEnter={() => onHover(nm.date)} onMouseLeave={() => onHover(null)}>
                    <span className={`text-[10px] tabular-nums flex-shrink-0 mt-px ${nm.isKey ? "text-[#9CA3AF] font-medium" : "text-[#4B5563]"}`} style={{ minWidth: "3.2rem" }}>
                      {fmtShort(nm.date)}
                    </span>
                    <span className="text-[#4B5563] text-[10px] mt-px flex-shrink-0">—</span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] leading-tight ${nm.isKey ? "font-semibold text-white" : "font-normal text-[#D1D5DB]"}`}>
                        {nm.label}
                      </span>
                      {nm.context && (
                        <span className={`text-[10px] ml-1.5 ${nm.isKey ? "text-[#9CA3AF]" : "text-[#4B5563]"}`}>
                          {nm.context}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
