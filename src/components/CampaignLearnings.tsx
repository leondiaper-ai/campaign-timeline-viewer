"use client";

import { useState } from "react";
import { CampaignSheetData } from "@/types";

interface CampaignLearningsProps {
  sheet: CampaignSheetData;
}

const TYPE_CONFIG = {
  worked: { label: "What worked", icon: "↑", color: "text-mint", textColor: "text-ink" },
  didnt: { label: "What didn\u2019t", icon: "↓", color: "text-signal", textColor: "text-ink/70" },
  next: { label: "What\u2019s next", icon: "→", color: "text-electric", textColor: "text-ink/60" },
} as const;

export default function CampaignLearnings({ sheet }: CampaignLearningsProps) {
  const [expanded, setExpanded] = useState(false);
  const learnings = sheet.learnings || [];

  if (learnings.length === 0) return null;

  const grouped = {
    worked: learnings.filter(l => l.type === "worked"),
    didnt: learnings.filter(l => l.type === "didnt"),
    next: learnings.filter(l => l.type === "next"),
  };

  return (
    <div className="rounded-2xl bg-cream border border-ink/8">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-6 py-4 text-left group">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
            What we learned
          </h3>
          {!expanded && <span className="text-[10px] text-ink/30 group-hover:text-ink/50 transition-colors">What worked, what didn&apos;t, what&apos;s next</span>}
        </div>
        <svg className={`w-4 h-4 text-ink/30 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 pb-5 space-y-3">
          {(["worked", "didnt", "next"] as const).map(type => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const cfg = TYPE_CONFIG[type];
            return (
              <div key={type} className="space-y-1.5">
                <p className={`text-[9px] font-bold uppercase tracking-[0.15em] ${cfg.color}`}>{cfg.label}</p>
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[10px] mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                    <span className={`text-[11px] leading-snug ${cfg.textColor}`}>{item.text}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
