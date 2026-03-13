"use client";
import { CampaignLearning } from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";
interface Props { learnings: CampaignLearning[]; }
function fmt(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
export default function CampaignLearnings({ learnings }: Props) {
  if (!learnings.length) return null;
  return (<div className="rounded-xl border overflow-hidden" style={{backgroundColor:"#161922",borderColor:"#2A2D3E"}}>
    <div className="px-6 pt-5 pb-3"><h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">Campaign Learnings</h3></div>
    <div className="px-6 pb-5 space-y-4">{learnings.map((l,i)=>{const c=getCategoryConfig(l.event_type);return(<div key={i} className="flex gap-4"><div className="flex flex-col items-center pt-1"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:c.color}}/>{i<learnings.length-1&&<div className="w-px flex-1 mt-2 bg-border/50"/>}</div><div className="flex-1 min-w-0 pb-1"><div className="flex items-center gap-2 mb-1"><span className="text-[11px] font-mono text-label-muted tabular-nums">{fmt(l.date)}</span><span className="text-[10px] font-semibold uppercase tracking-wider" style={{color:c.color}}>{c.label}</span><span className="text-[11px] text-label-secondary font-medium">{l.event_title}</span>{l.source==="auto"&&<span className="text-[9px] text-label-muted px-1.5 py-0.5 rounded border border-border/50 bg-surface-primary font-mono">auto</span>}</div><p className="text-[13px] text-label-primary leading-relaxed">{l.what_we_learned}</p><p className="text-[11px] text-label-muted mt-1">Impact: {l.observed_impact}</p></div></div>);})}</div></div>);
}
