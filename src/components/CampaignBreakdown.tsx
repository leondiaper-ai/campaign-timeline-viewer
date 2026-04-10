"use client";

import { useMemo } from "react";
import { CampaignSheetData } from "@/types";
import { ClassifiedMoment } from "@/lib/transforms";
import { getCategoryConfig } from "@/lib/event-categories";

function fmtShort(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Moment row: click → highlight on chart, show short contextual tooltip ──
function MomentRow({
  classified,
  isActive,
  onClick,
}: {
  classified: ClassifiedMoment;
  isActive: boolean;
  onClick: () => void;
}) {
  const { moment, tier, context } = classified;
  const cat = getCategoryConfig(moment.moment_type);
  const isDriver = tier === "driver";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all ${
        isActive
          ? "bg-paper border-ink/15 shadow-[3px_3px_0_0_rgba(14,14,14,0.05)]"
          : "bg-transparent border-transparent hover:bg-paper/60 hover:border-ink/6"
      }`}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span
          className={`${isDriver ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full mt-1.5 flex-shrink-0 ${
            isActive ? "ring-2 ring-offset-1 ring-offset-paper ring-ink/20" : ""
          }`}
          style={{ backgroundColor: cat.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[12px] leading-snug ${
                isDriver ? "font-semibold text-ink" : "font-medium text-ink/70"
              }`}
            >
              {moment.moment_title}
            </span>
          </div>
          <span className="text-[10px] text-ink/30">
            {fmtShort(moment.date)} · {cat.label}
          </span>

          {/* Short contextual tooltip — only shown when this row is active */}
          {isActive && context && (
            <p className="mt-1.5 text-[11px] leading-snug text-ink/60">
              <span className="text-ink/25 mr-1">↳</span>
              {context}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main Component ──
interface CampaignBreakdownProps {
  sheet: CampaignSheetData;
  classified: ClassifiedMoment[];
  activeDate: string | null;
  onMomentClick: (date: string) => void;
}

export default function CampaignBreakdown({
  classified,
  activeDate,
  onMomentClick,
}: CampaignBreakdownProps) {
  const drivers = useMemo(
    () =>
      classified
        .filter((c) => c.tier === "driver")
        .sort((a, b) => a.moment.date.localeCompare(b.moment.date)),
    [classified],
  );
  const supporting = useMemo(
    () =>
      classified
        .filter((c) => c.tier === "supporting")
        .sort((a, b) => a.moment.date.localeCompare(b.moment.date)),
    [classified],
  );

  return (
    <div className="rounded-2xl bg-cream border border-ink/8">
      <div className="px-6 py-4 flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
          Campaign Breakdown
        </h3>
        <span className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/25">
          Click to highlight
        </span>
      </div>

      <div className="px-6 pb-5 space-y-4">
        {/* Key Moments (drivers) */}
        {drivers.length > 0 && (
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFD24C] mb-1.5 pb-1 border-b border-ink/8">
              Key Moments{" "}
              <span className="text-ink/25 font-normal ml-1">({drivers.length})</span>
            </h4>
            <div className="space-y-0.5">
              {drivers.map((c, i) => (
                <MomentRow
                  key={`d${i}`}
                  classified={c}
                  isActive={activeDate === c.moment.date}
                  onClick={() => onMomentClick(c.moment.date)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Supporting Activity */}
        {supporting.length > 0 && (
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/30 mb-1.5 pb-1 border-b border-ink/8">
              Supporting Activity{" "}
              <span className="text-ink/25 font-normal ml-1">({supporting.length})</span>
            </h4>
            <div className="space-y-0.5">
              {supporting.map((c, i) => (
                <MomentRow
                  key={`s${i}`}
                  classified={c}
                  isActive={activeDate === c.moment.date}
                  onClick={() => onMomentClick(c.moment.date)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
