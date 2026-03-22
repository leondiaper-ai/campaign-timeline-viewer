"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { AppData, LoadedCampaign, Territory, Moment } from "@/types";
import {
  buildChartData, getAllTrackNames, getAllMoments,
  inferTrackRoles, detectHandoverMoment, getChartInsight,
  getCampaignSummary, getTrackModeContext,
  buildUKTrackContext, buildUKMilestones, UKTrackContext,
} from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";
import CampaignInsights from "./CampaignInsights";
import CampaignLearnings from "./CampaignLearnings";
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

  const campaign: LoadedCampaign | undefined = campaigns[campaignIdx];
  const sheet = campaign?.sheet;

  useEffect(() => { if (sheet?.setup.default_territory) setTerritory(sheet.setup.default_territory); }, [sheet]);

  const allTrackNames = useMemo(() => sheet ? getAllTrackNames(sheet) : [], [sheet]);
  const trackRoles = useMemo(() => sheet ? inferTrackRoles(sheet, territory) : [], [sheet, territory]);
  const chartData = useMemo(() => sheet ? buildChartData(sheet, territory, allTrackNames) : [], [sheet, territory, allTrackNames]);
  const handoverMoment = useMemo(() => sheet ? detectHandoverMoment(sheet, territory) : null, [sheet, territory]);
  const chartInsight = useMemo(() => sheet ? getChartInsight(sheet, territory) : null, [sheet, territory]);
  const trackModeContext = useMemo(() => sheet ? getTrackModeContext(sheet, territory) : null, [sheet, territory]);
  const ukTrackContext = useMemo(() => sheet ? buildUKTrackContext(sheet) : [], [sheet]);
  const ukMilestones = useMemo(() => sheet ? buildUKMilestones(sheet) : [], [sheet]);
  const summary = useMemo(() => sheet ? getCampaignSummary(sheet, territory) : "", [sheet, territory]);
  const moments = useMemo(() => {
    if (!sheet) return [];
    const base = getAllMoments(sheet);
    // Generate paid-campaign moments from sheet data (paid_campaigns tab)
    if (sheet.paidCampaigns) {
      for (const pc of sheet.paidCampaigns) {
        if (pc.start_date) {
          base.push({
            date: pc.start_date,
            moment_title: `${pc.platform} \u2014 ${pc.campaign_name}`,
            moment_type: "marquee",
            is_key: true,
          });
        }
      }
    }
    return base.sort((a, b) => a.date.localeCompare(b.date));
  }, [sheet]);
  const keyMomentDates = useMemo(() => new Set(moments.filter(m => m.is_key).map(m => m.date)), [moments]);

  // Group moments by phase
  const albumDate = sheet?.setup.release_date || "";
  const phasedMoments = useMemo(() => {
    const pre = moments.filter(m => m.date < albumDate);
    const release = moments.filter(m => m.date === albumDate);
    const post = moments.filter(m => m.date > albumDate);
    return { pre, release, post };
  }, [moments, albumDate]);

  const handleMomentClick = useCallback((date: string) => { setPinnedDate(prev => prev === date ? null : date); }, []);
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
              <h1 className="text-lg font-semibold">{sheet.setup.artist_name}<span className="text-[#6B7280] font-normal"> — {sheet.setup.campaign_name}</span></h1>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#161922] text-[#6B7280] border border-[#2A2D3E]">{sheet.setup.campaign_type}</span>
            {sheet.setup.release_date && <span className="text-[10px] text-[#4B5563]">Release: {fmtDate(sheet.setup.release_date)}</span>}
          </div>
          <div className="flex items-center gap-1 bg-[#161922] rounded-lg p-0.5 border border-[#2A2D3E]">
            {(["global", "UK"] as Territory[]).map(t => (
              <button key={t} onClick={() => setTerritory(t)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${territory === t ? "bg-white/10 text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>
                {t === "global" ? "Global" : "UK"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        {/* Team Focus */}
        <div className="bg-[#131620] rounded-xl border border-[#FBBF24]/20 px-5 py-3">
          <div className="flex items-center gap-3 mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#FBBF24]">Team Focus</p>
            <span className="text-[10px] text-[#6B7280]">&middot; Momentum building post-release</span>
          </div>
          <p className="text-[13px] font-semibold text-white mb-1">Primary Focus: Single &mdash; &ldquo;Doesn&rsquo;t Just Happen&rdquo;</p>
          <div className="flex gap-6">
            <p className="text-[11px] text-[#D1D5DB]"><span className="text-[#6B7280] font-semibold">UK:</span> Lean into Outstore Run (23 Mar)</p>
            <p className="text-[11px] text-[#D1D5DB]"><span className="text-[#6B7280] font-semibold">US:</span> Build into Tour window (May)</p>
          </div>
        </div>

        {/* Stats */}
        <CampaignInsights sheet={sheet} territory={territory} />

        {/* Chart */}
        <div className="bg-[#131620] rounded-2xl border border-[#1E2130] p-5">
          <TimelineChart data={chartData} selectedTracks={allTrackNames} trackRoles={trackRoles}
            visibleEventDates={keyMomentDates} highlightedDate={effectiveHighlight}
            handoverMoment={handoverMoment} chartInsight={chartInsight} trackModeContext={trackModeContext}
            chartMode={chartMode} onChartModeChange={setChartMode} albumDate={albumDate}
            ukMilestones={ukMilestones} territory={territory}
            paidCampaigns={sheet.paidCampaigns} />
        </div>

        {/* Full Campaign Log — collapsed by default */}
        <div className="bg-[#131620] rounded-xl border border-[#1E2130]">
          <button onClick={() => setLogExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-4 text-left group">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
                Full Campaign Log <span className="text-[#4B5563] font-normal ml-1">({moments.length} events)</span>
              </h3>
              {!logExpanded && <span className="text-[10px] text-[#4B5563] group-hover:text-[#6B7280] transition-colors">Expand to view full campaign history</span>}
            </div>
            <div className="flex items-center gap-2">
              {pinnedDate && logExpanded && <span onClick={(e) => { e.stopPropagation(); setPinnedDate(null); }} className="text-[10px] text-[#6B7280] hover:text-white underline underline-offset-2 cursor-pointer">Clear selection</span>}
              <svg className={`w-4 h-4 text-[#4B5563] transition-transform ${logExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>

          {logExpanded && (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pre-release */}
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#6B7280] mb-2 pb-1 border-b border-[#1E2130]">Pre-release</h4>
                  <div className="space-y-1">
                    {phasedMoments.pre.map((m, i) => <MomentRow key={`pre${i}`} moment={m} pinnedDate={pinnedDate} effectiveHighlight={effectiveHighlight}
                      onHover={setHighlightedDate} onClick={handleMomentClick} />)}
                    {phasedMoments.pre.length === 0 && <p className="text-[10px] text-[#4B5563]">No pre-release moments</p>}
                  </div>
                </div>
                {/* Release */}
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#6C9EFF] mb-2 pb-1 border-b border-[#1E2130]">Album Release</h4>
                  <div className="space-y-1">
                    {phasedMoments.release.map((m, i) => <MomentRow key={`rel${i}`} moment={m} pinnedDate={pinnedDate} effectiveHighlight={effectiveHighlight}
                      onHover={setHighlightedDate} onClick={handleMomentClick} />)}
                    {phasedMoments.release.length === 0 && <p className="text-[10px] text-[#4B5563]">No release moments</p>}
                  </div>
                </div>
                {/* Post-release */}
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#FBBF24] mb-2 pb-1 border-b border-[#1E2130]">Post-release</h4>
                  <div className="space-y-1">
                    {phasedMoments.post.map((m, i) => <MomentRow key={`post${i}`} moment={m} pinnedDate={pinnedDate} effectiveHighlight={effectiveHighlight}
                      onHover={setHighlightedDate} onClick={handleMomentClick} />)}
                    {phasedMoments.post.length === 0 && <p className="text-[10px] text-[#4B5563]">No post-release moments</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Learnings */}
        <CampaignLearnings sheet={sheet} territory={territory} />
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

function MomentRow({ moment, pinnedDate, effectiveHighlight, onHover, onClick }: {
  moment: Moment; pinnedDate: string | null; effectiveHighlight: string | null;
  onHover: (d: string | null) => void; onClick: (d: string) => void;
}) {
  const cat = getCategoryConfig(moment.moment_type);
  const isPinned = pinnedDate === moment.date;
  return (
    <div onClick={() => onClick(moment.date)}
      className={`flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
        isPinned ? "bg-white/8 ring-1 ring-white/10" : effectiveHighlight === moment.date ? "bg-white/5" : "hover:bg-white/[0.03]"
      }`}
      onMouseEnter={() => onHover(moment.date)} onMouseLeave={() => onHover(null)}>
      <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: cat.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-white leading-tight">{moment.moment_title}</span>
          {moment.is_key && <span className="text-[7px] font-bold uppercase px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">Key</span>}
        </div>
        <span className="text-[9px] text-[#4B5563]">{fmtShort(moment.date)} · {cat.label}</span>
      </div>
    </div>
  );
}
