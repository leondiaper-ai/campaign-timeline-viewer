"use client";

import { useMemo } from "react";
import { CampaignSheetData } from "@/types";

interface CampaignLearningsProps {
  sheet: CampaignSheetData;
}

/**
 * "What we learned" — feels like the outcome of the analysis.
 *
 * Top:    What we learned   → 2–3 short insights (worked + didn't)
 * Bottom: Next step         → 1–2 clear actions (next)
 *
 * Expanded by default so it reads as the conclusion, not an optional aside.
 */
export default function CampaignLearnings({ sheet }: CampaignLearningsProps) {
  const { insights, nextActions } = useMemo(() => {
    const all = sheet.learnings || [];

    // Insights = what worked + what didn't
    const worked = all.filter((l) => l.type === "worked");
    const didnt = all.filter((l) => l.type === "didnt");
    const nextRaw = all.filter((l) => l.type === "next");

    // Interleave so the insight block shows a mix, then trim to 3.
    // Prefer 2 worked + 1 didnt, or 1 worked + 2 didnt depending on availability.
    const insights: { type: "worked" | "didnt"; text: string }[] = [];
    const maxTake = 3;
    let i = 0;
    while (insights.length < maxTake && (worked[i] || didnt[i])) {
      if (worked[i]) insights.push({ type: "worked", text: worked[i].text });
      if (insights.length < maxTake && didnt[i]) {
        insights.push({ type: "didnt", text: didnt[i].text });
      }
      i++;
    }

    const nextActions = nextRaw.slice(0, 2).map((l) => l.text);

    return { insights, nextActions };
  }, [sheet]);

  if (insights.length === 0 && nextActions.length === 0) return null;

  return (
    <div className="rounded-2xl bg-cream border border-ink/8 px-6 py-5">
      {/* ── What we learned ── */}
      {insights.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
            What we learned
          </h3>
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={`text-[12px] font-bold mt-0.5 flex-shrink-0 ${
                    ins.type === "worked" ? "text-mint" : "text-signal"
                  }`}
                  aria-hidden="true"
                >
                  {ins.type === "worked" ? "↑" : "↓"}
                </span>
                <span className="text-[13px] leading-snug text-ink/85">
                  {ins.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Next step ── */}
      {nextActions.length > 0 && (
        <div
          className={insights.length > 0 ? "pt-4 border-t border-ink/10" : ""}
        >
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-electric mb-3">
            Next step
          </h3>
          <ul className="space-y-2">
            {nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="text-[12px] font-bold text-electric mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                >
                  →
                </span>
                <span className="text-[13px] leading-snug text-ink font-medium">
                  {a}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
