"use client";

import { Campaign } from "@/types";

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedId: string;
  onChange: (id: string) => void;
}

export default function CampaignSelector({
  campaigns,
  selectedId,
  onChange,
}: CampaignSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="campaign-select"
        className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.15em]"
      >
        Campaign
      </label>
      <select
        id="campaign-select"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-surface-card border border-border rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-label-primary focus:outline-none focus:ring-1 focus:ring-streams/40 cursor-pointer min-w-[280px]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%235F6578' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
      >
        {campaigns.map((c) => (
          <option key={c.campaign_id} value={c.campaign_id}>
            {c.artist} — {c.campaign_name}
          </option>
        ))}
      </select>
    </div>
  );
}
