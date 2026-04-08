"use client";

import { useState, useMemo } from "react";
import { CampaignSheetData, Moment, Territory } from "@/types";
import { ClassifiedMoment } from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";

function fmtShort(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Derive action for a moment based on its context ──
function deriveAction(classified: ClassifiedMoment): string {
  const { tier, context, moment } = classified;
  const type = moment.moment_type.toLowerCase();

  if (tier === "driver") {
    if (type === "music") return "Amplify — push across all channels while momentum is fresh";
    if (type === "marquee" || type === "showcase" || type === "paid") return "Monitor intent rate — scale if above benchmark";
    if (type === "live" || type === "tour") return "Use as narrative anchor for next campaign phase";
    if (type === "media") return "Leverage press for playlist and editorial pitching";
    return "Maintain cadence — this is driving the campaign forward";
  }
  if (tier === "supporting") {
    if (type === "editorial") return "Track playlist positioning — request editorial refresh if stalling";
    if (type === "marketing") return "Assess conversion — shift budget if underperforming";
    if (type === "marquee" || type === "paid") return "Review targeting — optimise or reallocate";
    return "Supporting activity — no immediate action needed";
  }
  return "Background activity — monitor passively";
}

// ── Interactive moment card ──
function MomentCard({ classified, isExpanded, onToggle }: {
  classified: ClassifiedMoment;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { moment, tier, context } = classified;
  const cat = getCategoryConfig(moment.moment_type);
  const isDriver = tier === "driver";
  const action = deriveAction(classified);

  return (
    <div
      onClick={onToggle}
      className={`rounded-xl border transition-all cursor-pointer ${
        isExpanded
          ? "bg-paper border-ink/12 shadow-[4px_4px_0_0_rgba(14,14,14,0.04)]"
          : "bg-transparent border-transparent hover:bg-paper/60 hover:border-ink/6"
      }`}
    >
      {/* Collapsed row */}
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span
          className={`${isDriver ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full mt-1.5 flex-shrink-0`}
          style={{ backgroundColor: cat.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[12px] leading-snug ${isDriver ? "font-semibold text-ink" : "font-medium text-ink/70"}`}>
              {moment.moment_title}
            </span>
          </div>
          <span className="text-[10px] text-ink/30">{fmtShort(moment.date)} · {cat.label}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-ink/20 flex-shrink-0 mt-1.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 ml-[18px] space-y-2">
          <div className="border-t border-ink/6 pt-2 space-y-1.5">
            {/* What happened */}
            {context && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink/30 mb-0.5">Impact</p>
                <p className="text-[11px] text-ink/60 leading-snug">{context}</p>
              </div>
            )}
            {/* Action */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink/30 mb-0.5">Action</p>
              <p className="text-[11px] text-ink/70 leading-snug">
                <span className="text-ink/30 mr-1">→</span>{action}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
interface CampaignBreakdownProps {
  sheet: CampaignSheetData;
  classified: ClassifiedMoment[];
}

export default function CampaignBreakdown({ sheet, classified }: CampaignBreakdownProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showLearnings, setShowLearnings] = useState(false);

  const learnings = sheet.learnings || [];

  // Split into drivers + supporting (skip background)
  const drivers = useMemo(
    () => classified.filter(c => c.tier === "driver").sort((a, b) => a.moment.date.localeCompare(b.moment.date)),
    [classified]
  );
  const supporting = useMemo(
    () => classified.filter(c => c.tier === "supporting").sort((a, b) => a.moment.date.localeCompare(b.moment.date)),
    [classified]
  );

  const TYPE_CONFIG = {
    worked: { label: "What worked", icon: "↑", color: "text-[#1FBE7A]" },
    didnt: { label: "What didn't", icon: "↓", color: "text-[#FF4A1C]" },
    next: { label: "What's next", icon: "→", color: "text-[#2C25FF]" },
  } as const;

  const grouped = {
    worked: learnings.filter(l => l.type === "worked"),
    didnt: learnings.filter(l => l.type === "didnt"),
    next: learnings.filter(l => l.type === "next"),
  };

  return (
    <div className="rounded-2xl bg-cream border border-ink/8">
      <div className="px-6 py-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
          Campaign Breakdown
        </h3>
      </div>

      <div className="px-6 pb-5 space-y-4">
        {/* Key Moments (Drivers) */}
        {drivers.length > 0 && (
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFD24C] mb-1.5 pb-1 border-b border-ink/8">
              Key Moments <span className="text-ink/25 font-normal ml-1">({drivers.length})</span>
            </h4>
            <div className="space-y-0.5">
              {drivers.map((c, i) => (
                <MomentCard
                  key={`d${i}`}
                  classified={c}
                  isExpanded={expandedIdx === i}
                  onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Supporting Activity */}
        {supporting.length > 0 && (
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/30 mb-1.5 pb-1 border-b border-ink/8">
              Supporting Activity <span className="text-ink/25 font-normal ml-1">({supporting.length})</span>
            </h4>
            <div className="space-y-0.5">
              {supporting.map((c, i) => {
                const globalIdx = drivers.length + i;
                return (
                  <MomentCard
                    key={`s${i}`}
                    classified={c}
                    isExpanded={expandedIdx === globalIdx}
                    onToggle={() => setExpandedIdx(expandedIdx === globalIdx ? null : globalIdx)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* What We Learned — collapsed secondary section */}
        {learnings.length > 0 && (
          <div className="mt-2 pt-2 border-t border-ink/5">
            <button
              onClick={() => setShowLearnings(v => !v)}
              className="flex items-center gap-1.5 w-full text-left opacity-50 hover:opacity-70 transition-opacity"
            >
              <h4 className="text-[8px] font-semibold uppercase tracking-[0.18em] text-ink/25">
                What We Learned <span className="text-ink/20 font-normal ml-1">({learnings.length})</span>
              </h4>
              <svg
                className={`w-2.5 h-2.5 text-ink/15 transition-transform ${showLearnings ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLearnings && (
              <div className="space-y-2 mt-2 opacity-70">
                {(["worked", "didnt", "next"] as const).map(type => {
                  const items = grouped[type];
                  if (items.length === 0) return null;
                  const cfg = TYPE_CONFIG[type];
                  return (
                    <div key={type} className="space-y-0.5">
                      <p className={`text-[8px] font-bold uppercase tracking-[0.15em] ${cfg.color}`}>{cfg.label}</p>
                      {items.map((item, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className={`text-[9px] mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                          <span className="text-[10px] leading-snug text-ink/50">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
