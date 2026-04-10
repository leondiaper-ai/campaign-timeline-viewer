"use client";

import { useMemo, useState } from "react";
import type { LoadedCampaign, Territory } from "@/types";
import {
  buildChartData,
  getAllTrackNames,
  getAllMoments,
} from "@/lib/transforms";
import ProgressiveDemoChart from "./ProgressiveDemoChart";
import CampaignExplorer from "./CampaignExplorer";

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
 * DemoSection — progressive build experience.
 *
 * Starts empty. User adds layers one at a time (streams → moments → activity)
 * to see how the campaign is actually composed. Once all three are on, a tiny
 * insight strip appears and the user can "View full campaign" to load the
 * complete interactive dashboard.
 */
export default function DemoSection({ campaign }: Props) {
  const sheet = campaign.sheet;
  const [layers, setLayers] = useState<LayerState>(INITIAL);
  const [viewFull, setViewFull] = useState(false);

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

  // ── Full view (after "View full campaign" click) ──
  if (viewFull) {
    return (
      <section className="space-y-5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-sun mb-1.5">
              Demo
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">
              Example campaign —{" "}
              <span className="text-ink/50 font-medium">full view</span>
            </h2>
            <p className="text-[12px] text-ink/40 mt-1">
              {sheet.setup.artist_name} · {sheet.setup.campaign_name}
            </p>
          </div>
          <button
            onClick={() => {
              setViewFull(false);
              reset();
            }}
            className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/40 hover:text-ink transition-colors"
          >
            ← Back to build
          </button>
        </div>
        <CampaignExplorer
          campaign={campaign}
          helperText="Click moments to see how activity impacted performance"
        />
      </section>
    );
  }

  // ── Progressive build view ──
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

      {/* Layer builder pills */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/35 mr-1">
            Build
          </span>
          <LayerPill
            label="Streams"
            sub="Weekly global + UK"
            active={layers.streams}
            onClick={() => toggle("streams")}
          />
          <LayerPill
            label="Moments"
            sub="Releases, key dates"
            active={layers.moments}
            onClick={() => toggle("moments")}
          />
          <LayerPill
            label="Activity"
            sub="Paid, editorial, D2C"
            active={layers.activity}
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
        <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-[11px] text-ink/55 transition-opacity">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
            <span>
              Primary spike: <span className="text-ink/80">Album release</span>
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

      {/* CTA — appears once all 3 layers are on */}
      {allOn && (
        <div className="flex justify-start pt-1">
          <button
            onClick={() => setViewFull(true)}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-ink/85 transition-colors"
          >
            View full campaign →
          </button>
        </div>
      )}
    </section>
  );
}

function LayerPill({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold transition-all ${
        active
          ? "bg-ink text-paper border-ink shadow-[3px_3px_0_0_rgba(14,14,14,0.12)]"
          : "bg-cream text-ink/60 border-ink/12 hover:text-ink hover:border-ink/35"
      }`}
      aria-pressed={active}
    >
      <span
        className={`text-[13px] leading-none ${
          active ? "text-paper/70" : "text-ink/30"
        }`}
      >
        {active ? "✓" : "+"}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span
          className={`text-[9px] font-medium ${
            active ? "text-paper/55" : "text-ink/35"
          }`}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}
