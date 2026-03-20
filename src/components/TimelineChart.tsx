"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea,
} from "recharts";
import { ChartDataPoint, Moment, Territory } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import { TrackWithRole, HandoverMoment, getTrackRoleLabel, UKMilestone } from "@/lib/transforms";

const TOTAL_COLOR = "#6C9EFF";
const PHYSICAL_COLOR = "#4ADE80";

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}
function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtFull(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function trunc(t: string, m: number = 16): string {
  if (t.length <= m) return t;
  const c = t.slice(0, m - 1); const s = c.lastIndexOf(" ");
  return (s > m * 0.4 ? c.slice(0, s) : c) + "\u2026";
}

export type ChartMode = "campaign" | "tracks";

interface Props {
  data: ChartDataPoint[];
  selectedTracks: string[];
  trackRoles: TrackWithRole[];
  visibleEventDates: Set<string>;
  highlightedDate: string | null;
  handoverMoment?: HandoverMoment | null;
  chartInsight?: string | null;
  trackModeContext?: string | null;
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
  albumDate?: string;
  ukMilestones?: UKMilestone[];
  territory?: Territory;
}

// ——— Campaign tooltip ———
function CampTip({ active, payload, label, territory }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  const events = dp.events || [];
  const prev = dp.prev_week_streams;
  const wow = prev != null && prev > 0 && dp.total_streams > 0 ? ((dp.total_streams - prev) / prev) * 100 : null;
  const isUK = territory === "UK";
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-3 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? fmtFull(label) : ""}</p>
      {dp.total_streams > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#9CA3AF]">{isUK ? "UK Streams" : "Global Streams"}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.total_streams)}</span>
            {wow != null && <span className={`text-[10px] font-semibold ${wow >= 0 ? "text-emerald-400" : "text-red-400"}`}>{wow >= 0 ? "+" : ""}{wow.toFixed(0)}%</span>}
          </div>
        </div>
      )}
      {dp.physical_units > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[#9CA3AF]">{isUK ? "UK Physical" : "Physical"}</span>
          <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp.physical_units)}</span>
        </div>
      )}
      {events.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#2A2D3E]">
          {events.map((m: Moment, i: number) => (<div key={i} className="mb-1 last:mb-0 flex items-center gap-1.5">
            <span style={{ color: getCategoryConfig(m.moment_type).color }} className="text-xs">{getCategoryConfig(m.moment_type).icon}</span>
            <span className="text-[11px] font-medium text-white">{m.moment_title}</span>
          </div>))}
        </div>
      )}
    </div>
  );
}

// ——— Tracks tooltip ———
function TrackTip({ active, payload, label, trackRoles, ukMilestones }: any) {
  if (!active || !payload?.length) return null;
  const dp = payload[0]?.payload;
  if (!dp) return null;
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2A2D3E] p-3 max-w-xs shadow-2xl">
      <p className="text-[11px] font-semibold text-[#6B7280] mb-2">{label ? fmtFull(label) : ""}</p>
      {(trackRoles as TrackWithRole[])
        .filter(tr => dp[tr.track_name] != null && (dp[tr.track_name] as number) > 0)
        .sort((a: TrackWithRole, b: TrackWithRole) => (dp[b.track_name] as number) - (dp[a.track_name] as number))
        .map((tr: TrackWithRole, i: number) => {
          const ukm = (ukMilestones as UKMilestone[] || []).find((m: UKMilestone) => m.date === label && m.track_name === tr.track_name);
          return (
            <div key={i} className="mb-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tr.color }} />
                  <span className="text-xs text-[#9CA3AF]">{tr.track_name}</span>
                </div>
                <span className="text-xs font-semibold text-white tabular-nums">{fmt(dp[tr.track_name] as number)}</span>
              </div>
              {ukm && (
                <div className="flex items-center justify-between gap-4 ml-4">
                  <span className="text-[10px] text-[#6B7280]">UK</span>
                  <span className="text-[10px] text-[#6B7280] tabular-nums">{fmt(ukm.uk_streams)}</span>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}


// ——— Marquee moment context (static enrichment) ———
interface MarqueeContext { territory: string; spend: string; intent: string; intentGrade: string; driver: string; topTrack: string; }
const MARQUEE_CONTEXT: Record<string, MarqueeContext> = {
  "Single One - Death Of Love":       { territory: "Global", spend: "$12K", intent: "29.6%", intentGrade: "Strong", driver: "Indie/Alt listeners 25\u201334", topTrack: "Death Of Love" },
  "Single Two - I Had a Dream":       { territory: "Global", spend: "$8K",  intent: "24.1%", intentGrade: "On Benchmark", driver: "R&B crossover 18\u201324", topTrack: "I Had a Dream" },
  "'Trying' Times Album Release":     { territory: "UK + Global", spend: "$22K", intent: "31.2%", intentGrade: "Strong", driver: "Core fanbase 25\u201344", topTrack: "Doesn\u2019t Just Happen" },
  "Announce UK In-Store signing":     { territory: "UK", spend: "$4K",  intent: "18.5%", intentGrade: "On Benchmark", driver: "UK fanbase 18\u201334", topTrack: "Walk Out Music" },
  "Fallon Late Night TV Performance": { territory: "US", spend: "$6K",  intent: "22.3%", intentGrade: "On Benchmark", driver: "US discovery 25\u201344", topTrack: "Death Of Love" },
};

// ——— Moment markers for campaign mode ———
interface MM { date: string; label: string; fullTitle: string; color: string; row: number; }
function layoutMoments(data: ChartDataPoint[], vis: Set<string>): MM[] {
  const byDate = new Map<string, { date: string; label: string; fullTitle: string; color: string; p: number }>();
  const pm: Record<string, number> = { music: 5, live: 4, editorial: 3, marketing: 2, product: 1 };
  data.forEach(d => {
    if (d.events.length > 0) {
      const ke = d.events.filter(e => e.is_key && vis.has(e.date));
      if (ke.length > 0) {
        let best = ke[0], bp = 0;
        for (const e of ke) { const cat = getCategoryConfig(e.moment_type); const p = pm[cat.label.toLowerCase()] || 1; if (p > bp) { bp = p; best = e; } }
        const cat = getCategoryConfig(best.moment_type);
        const ex = byDate.get(d.date);
        if (!ex || bp > ex.p) byDate.set(d.date, { date: d.date, label: trunc(best.moment_title, 18), fullTitle: best.moment_title, color: cat.color, p: bp });
      }
    }
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7)
    .map((m, i) => ({ date: m.date, label: m.label, fullTitle: m.fullTitle, color: m.color, row: i % 2 }));
}

// ——— Phase boundaries ———
function getPhases(data: ChartDataPoint[], albumDate?: string) {
  if (!albumDate) return null;
  const dates = data.map(d => d.date).filter(d => d).sort();
  const first = dates[0], last = dates[dates.length - 1];
  const post = dates.filter(d => d > albumDate);
  return { first, albumDate, postStart: post.length > 1 ? post[1] : post[0] || last, last };
}

export default function TimelineChart({
  data, selectedTracks, trackRoles, visibleEventDates,
  highlightedDate, handoverMoment, chartInsight, trackModeContext,
  chartMode, onChartModeChange, albumDate, ukMilestones, territory,
}: Props) {
  const moments = useMemo(() => layoutMoments(data, visibleEventDates), [data, visibleEventDates]);
  const hasPhysical = useMemo(() => data.some(d => d.physical_units > 0), [data]);
  const isCampaign = chartMode === "campaign";
  const phases = useMemo(() => getPhases(data, albumDate), [data, albumDate]);
  // Detect sparse data (e.g. territory view with few dates) — show dots so single points are visible
  const isSparse = useMemo(() => data.filter(d => d.total_streams > 0).length <= 3, [data]);

  return (
    <div className="w-full">
      {/* Campaign / Tracks toggle — clean, no sub-toggles */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-0.5 bg-[#0D1117] rounded-lg p-0.5 border border-[#1E2130]">
          <button onClick={() => onChartModeChange("campaign")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Campaign</button>
          <button onClick={() => onChartModeChange("tracks")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!isCampaign ? "bg-[#1E2130] text-white shadow-sm" : "text-[#6B7280] hover:text-[#9CA3AF]"}`}>Tracks</button>
        </div>
        <span className="text-[10px] text-[#4B5563] max-w-[420px] text-right">
          {isCampaign ? "Overall campaign performance" : (trackModeContext || "Individual track performance")}
        </span>
      </div>

      {/* Campaign mode: moment labels above chart */}
      {isCampaign && moments.length > 0 && (
        <div className="relative w-full mb-1" style={{ height: 44 }}>
          <div className="absolute inset-0 flex items-end">
            {moments.map((m, i) => {
              const dates = data.map(d => d.date).sort();
              const idx = dates.indexOf(m.date);
              const pct = dates.length > 1 ? (idx / (dates.length - 1)) * 100 : 50;
              const mq = MARQUEE_CONTEXT[m.fullTitle];
              return (
                <div key={i} className="absolute flex flex-col items-center group"
                  style={{ left: `${4 + pct * 0.88}%`, bottom: m.row === 0 ? 20 : 2, transform: "translateX(-50%)" }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap px-1 cursor-default" style={{ color: m.color }}>{m.label}</span>
                  <div className="w-px h-1.5 mt-0.5" style={{ backgroundColor: m.color, opacity: 0.4 }} />
                  {mq && (
                    <div className="hidden group-hover:block absolute bottom-full mb-2 z-50 bg-[#1A1D2E] rounded-lg border border-[#2A2D3E] p-2.5 shadow-2xl whitespace-nowrap">
                      <p className="text-[10px] font-semibold text-white mb-1">{m.fullTitle} <span className="text-[#6B7280] font-normal">&mdash; {mq.territory}</span></p>
                      <p className="text-[10px] text-[#9CA3AF]">Spend: <span className="text-white font-medium">{mq.spend}</span></p>
                      <p className="text-[10px] text-[#9CA3AF]">Intent: <span className="text-white font-medium">{mq.intent}</span> <span className={`${mq.intentGrade === "Strong" ? "text-emerald-400" : "text-[#6B7280]"}`}>({mq.intentGrade})</span></p>
                      <p className="text-[10px] text-[#9CA3AF]">Driver: <span className="text-white font-medium">{mq.driver}</span></p>
                      <p className="text-[10px] text-[#9CA3AF]">Top Track: <span className="text-white font-medium">{mq.topTrack}</span></p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========= CAMPAIGN MODE ========= */}
      {isCampaign && (
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: hasPhysical ? 60 : 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#1E2130" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis yAxisId="s" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
              {hasPhysical && <YAxis yAxisId="p" orientation="right" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />}
              <Tooltip content={<CampTip territory={territory} />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
              {highlightedDate && <ReferenceLine x={highlightedDate} yAxisId="s" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />}
              {moments.map((m, i) => <ReferenceLine key={`m${i}`} x={m.date} yAxisId="s" stroke={m.color} strokeDasharray="3 4" strokeWidth={1.5} strokeOpacity={0.5} />)}
              <Area yAxisId="s" type="monotone" dataKey="total_streams" fill={`${TOTAL_COLOR}15`} stroke="none" />
              <Line yAxisId="s" type="monotone" dataKey="total_streams" stroke={TOTAL_COLOR} strokeWidth={3}
                dot={isSparse ? { r: 4, fill: TOTAL_COLOR, stroke: "#0D1117", strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: TOTAL_COLOR, stroke: "#0D1117", strokeWidth: 2 }} name="Total Streams" />
              {selectedTracks.map(t => {
                const r = trackRoles.find(x => x.track_name === t);
                return <Line key={t} yAxisId="s" type="monotone" dataKey={t} stroke={r?.color ?? "#4B5563"}
                  strokeWidth={r?.strokeWidth ? r.strokeWidth * 0.6 : 1} strokeOpacity={r?.opacity ?? 0.25}
                  dot={isSparse ? { r: 3, fill: r?.color ?? "#4B5563", stroke: "#0D1117", strokeWidth: 1 } : false}
                  activeDot={false} connectNulls={false} name={t} />;
              })}
              {hasPhysical && <Bar yAxisId="p" dataKey="physical_units" fill={`${PHYSICAL_COLOR}35`} stroke={PHYSICAL_COLOR} strokeWidth={1} radius={[3, 3, 0, 0]} name="Physical" barSize={18} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ========= TRACKS MODE — narrative chart, real values ========= */}
      {!isCampaign && (
        <div className="w-full h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#151825" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={{ stroke: "#151825" }} tickLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#4B5563" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<TrackTip trackRoles={trackRoles} ukMilestones={ukMilestones} />} cursor={{ stroke: "#3A3D4E", strokeDasharray: "4 4" }} />
              {highlightedDate && <ReferenceLine x={highlightedDate} stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" />}

              {/* Phase background shading */}
              {phases && (
                <>
                  <ReferenceArea x1={phases.first} x2={phases.albumDate} fill="#6B728006" label={{ value: "PRE-RELEASE", position: "insideTopLeft", fill: "#4B5563", fontSize: 9, fontWeight: 700 }} />
                  <ReferenceArea x1={phases.albumDate} x2={phases.postStart} fill="#6C9EFF08" label={{ value: "RELEASE", position: "insideTop", fill: "#6C9EFF", fontSize: 9, fontWeight: 700 }} />
                  <ReferenceArea x1={phases.postStart} x2={phases.last} fill="#FBBF2406" label={{ value: "POST-RELEASE", position: "insideTopRight", fill: "#FBBF24", fontSize: 9, fontWeight: 700 }} />
                </>
              )}

              {/* Album release marker */}
              {albumDate && <ReferenceLine x={albumDate} stroke="#6B7280" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.4} />}

              {/* DJH handover annotation */}
              {handoverMoment && (
                <ReferenceLine x={handoverMoment.date} stroke="#FBBF24" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.6}
                  label={{ value: "Holding post-release", position: "insideTopRight", fill: "#FBBF24", fontSize: 9, fontWeight: 700, offset: 8 }} />
              )}

              {/* Track lines — fixed colours for key tracks, muted for others */}
              {selectedTracks.map(track => {
                const role = trackRoles.find(r => r.track_name === track);
                if (!role) return null;
                const isKey = role.opacity >= 0.5;
                return <Line key={track} type="monotone" dataKey={track}
                  stroke={role.color}
                  strokeWidth={role.strokeWidth}
                  strokeOpacity={role.opacity}
                  dot={isSparse ? { r: isKey ? 5 : 3, fill: role.color, stroke: "#0D1117", strokeWidth: 2 } : false}
                  activeDot={isKey ? { r: 5, fill: role.color, stroke: "#0D1117", strokeWidth: 2 } : false}
                  connectNulls={false} name={track} />;
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaign insight */}
      {isCampaign && chartInsight && (
        <p className="text-[11px] text-[#9CA3AF] italic text-center mt-2">{chartInsight}</p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
        {isCampaign && <LI color={TOTAL_COLOR} label="Total Streams" type="line" bold />}
        {trackRoles
          .filter(tr => selectedTracks.includes(tr.track_name))
          .sort((a, b) => b.strokeWidth - a.strokeWidth)
          .map(tr => (
            <LI key={tr.track_name} color={tr.color}
              label={isCampaign ? tr.track_name : `${getTrackRoleLabel(tr.role)} — ${tr.track_name}`}
              type="line" opacity={isCampaign ? 0.25 : tr.opacity}
              bold={!isCampaign && tr.role === "POST_RELEASE_BREAKOUT"} />
          ))}
        {isCampaign && hasPhysical && <LI color={PHYSICAL_COLOR} label="Physical" type="bar" />}
      </div>
    </div>
  );
}

function LI({ color, label, type, opacity = 1, bold = false }: {
  color: string; label: string; type: "line" | "bar"; opacity?: number; bold?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" style={{ opacity: Math.max(opacity, 0.35) }}>
      {type === "line" ? (
        <span className={`inline-block rounded-full ${bold ? "w-4 h-1" : "w-3 h-0.5"}`} style={{ backgroundColor: color }} />
      ) : (
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: `${color}40`, border: `1px solid ${color}` }} />
      )}
      <span className={`text-[10px] ${bold ? "text-white font-semibold" : "text-[#6B7280]"}`}>{label}</span>
    </div>
  );
}
