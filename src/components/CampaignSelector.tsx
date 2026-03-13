"use client";
import { Campaign } from "@/types";
interface CampaignSelectorProps { campaigns: Campaign[]; selectedId: string; onChange: (id: string) => void; }
export default function CampaignSelector({ campaigns, selectedId, onChange }: CampaignSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="campaign-select" className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.15em]">Campaign</label>
      <select id="campaign-select" value={selectedId} onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-surface-card border border-border rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-label-primary focus:outline-none focus:ring-1 focus:ring-streams/40 cursor-pointer min-w-[280px]">
        {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.artist} — {c.campaign_name}</option>)}
      </select>
    </div>
  );
}
