"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LoadedCampaign, Territory } from "@/types";
import {
  buildChartData,
  getAllTrackNames,
  getAllMoments,
} from "@/lib/transforms";
import ProgressiveDemoChart from "./ProgressiveDemoChart";

interface Props {
  campaign: LoadedCampaign;
}

interface LayerState {
  streams: boolean;
  moments: boolean;
  activity: boolean;
}

const INITIAL: LayerState = { streams: false, moments: false, activity: false };

/**
 * DemoSection — progressive build experience on the marketing page.
 *
 * Scope is deliberately limited: empty → streams → moments → activity →
 * light insights → CTA. The CTA is a hard route to /app/timeline where the
 * real working tool lives.
 */
export default function DemoSection({ campaign }: Props) {
  const sheet = campaign.sheet;
  const [layers, setLayers] = useState<LayerState>(INITIAL);

  const territory: Territory = sheet.setup.default_territory || "global";

  const chartData = useMemo(() => {
    const trackNames = getAllTrackNames(sheet);
    return buildChartData(sheet, territory, trackNames);
  }, [sheet, territory]);

  const moments = useMemo(() => getAllMoments(sheet), [sheet]);

  const toggle = (key: keyof LayerState) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const reset = () => setLayers(INITIAL);

  const allOn = layers.streams && layers.moments && layers.activity;
  const anyOn = layers.streams || layers.moments || layers.activity;

  return (
    <section className="space-y-5">
      {/* Header */}
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-sun mb-1.5">
          Demo
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink">
          Example campaign —{" "}
          <span className="text-ink/50 font-medium">
            see what drove performance
          </span>
        </h2>
        <p className="text-[12px] text-ink/40 mt-1">
          {sheet.setup.artist_name} · {sheet.setup.campaign_name}
        </p>
      </div>

      {/* Sample campaign inputs heading */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
          Sample campaign inputs
        </div>

        {/* Step indicator strip — matches Track Lens step style */}
        <div className="flex items-center gap-6 flex-wrap mb-4">
          <DemoStepPill n={1} label="Streams" done={layers.streams} />
          <DemoStepPill n={2} label="Moments" done={layers.moments} />
          <DemoStepPill n={3} label="Activity" done={layers.activity} />
        </div>

        {/* Interactive layer builder pills */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <LayerPill
              label="Streams"
              sub="Weekly global + UK"
              active={layers.streams}
              weight="primary"
              onClick={() => toggle("streams")}
            />
            <LayerPill
              label="Moments"
              sub="Releases, key dates"
              active={layers.moments}
              weight="secondary"
              onClick={() => toggle("moments")}
            />
            <LayerPill
              label="Activity"
              sub="Paid, editorial, D2C"
              active={layers.activity}
              weight="tertiary"
              onClick={() => toggle("activity")}
            />
          </div>
          {anyOn && (
            <button
              onClick={reset}
              className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/35 hover:text-ink transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Chart frame */}
      <div className="rounded-3xl bg-paper border border-ink/8 p-5 md:p-6 shadow-[8px_8px_0_0_rgba(14,14,14,0.06)]">
        <ProgressiveDemoChart
          data={chartData}
          moments={moments}
          showStreams={layers.streams}
          showMoments={layers.moments}
          showActivity={layers.activity}
        />
      </div>

      {/* Light insights — appear once all 3 layers are on */}
      {allOn && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-[11px] text-ink/55">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
            <span>
              Primary spike:{" "}
              <span className="text-ink/80">Album release</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-mint" />
            <span>
              Paid: <span className="text-ink/80">short-term uplift</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-signal" />
            <span>
              Momentum:{" "}
              <span className="text-ink/80">cooling post-release</span>
            </span>
          </div>
        </div>
      )}

      {/* CTA — hard route to the real tool */}
      {allOn && (
        <div className="flex justify-start pt-1">
          <Link
            href="/app/timeline"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-ink/85 transition-colors"
          >
            Open full tool →
          </Link>
        </div>
      )}
    </section>
  );
}

// ── Step indicator pill (non-interactive progress) ───────────
function DemoStepPill({
  n,
  label,
  done,
}: {
  n: number;
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-colors ${
          done
            ? "bg-ink text-paper"
            : "bg-transparent text-ink/35 border border-ink/20"
        }`}
      >
        {n}
      </span>
      <span
        className={`text-[13px] font-semibold ${
          done ? "text-ink" : "text-ink/35"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

type PillWeight = "primary" | "secondary" | "tertiary";

function LayerPill({
  label,
  sub,
  active,
  weight,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  weight: PillWeight;
  onClick: () => void;
}) {
  // Inactive visual hierarchy: Streams reads strongest, Activity subtlest.
  const inactiveCls: Record<PillWeight, string> = {
    primary:
      "bg-cream text-ink border-ink/25 hover:border-ink/55 shadow-[2px_2px_0_0_rgba(14,14,14,0.08)]",
    secondary:
      "bg-cream text-ink/70 border-ink/15 hover:text-ink hover:border-ink/35",
    tertiary:
      "bg-cream/70 text-ink/50 border-ink/10 hover:text-ink/80 hover:border-ink/30",
  };

  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold transition-all ${
        active
          ? "bg-ink text-paper border-ink shadow-[3px_3px_0_0_rgba(14,14,14,0.12)]"
          : inactiveCls[weight]
      }`}
      aria-pressed={active}
    >
      <span
        className={`text-[13px] leading-none ${
          active
            ? "text-paper/70"
            : weight === "primary"
              ? "text-ink/50"
              : weight === "secondary"
                ? "text-ink/35"
                : "text-ink/25"
        }`}
      >
        {active ? "✓" : "+"}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span
          className={`text-[9px] font-medium ${
            active
              ? "text-paper/55"
              : weight === "primary"
                ? "text-ink/45"
                : weight === "secondary"
                  ? "text-ink/35"
                  : "text-ink/30"
          }`}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}
