"use client";

import { CampaignLearning } from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";

interface CampaignLearningsProps {
  learnings: CampaignLearning[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CampaignLearnings({
  learnings,
}: CampaignLearningsProps) {
  if (learnings.length === 0) return null;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "#161922", borderColor: "#2A2D3E" }}
    >
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-[11px] font-bold text-label-muted uppercase tracking-[0.15em]">
          Campaign Learnings
        </h3>
      </div>

      <div className="px-6 pb-5 space-y-4">
        {learnings.map((learning, i) => {
          const cat = getCategoryConfig(learning.event_type);
          const isAuto = learning.source === "auto";
          return (
            <div key={i} className="flex gap-4">
              {/* Left accent */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {i < learnings.length - 1 && (
                  <div className="w-px flex-1 mt-2 bg-border/50" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono text-label-muted tabular-nums">
                    {formatDate(learning.date)}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-label-secondary font-medium">
                    {learning.event_title}
                  </span>
                  {isAuto && (
                    <span className="text-[9px] text-label-muted px-1.5 py-0.5 rounded border border-border/50 bg-surface-primary font-mono">
                      auto
                    </span>
                  )}
                </div>

                <p className="text-[13px] text-label-primary leading-relaxed">
                  {learning.what_we_learned}
                </p>

                <p className="text-[11px] text-label-muted mt-1">
                  Impact: {learning.observed_impact}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
