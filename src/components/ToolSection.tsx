"use client";

import { useRef, useState } from "react";
import type { LoadedCampaign } from "@/types";
import CampaignExplorer from "./CampaignExplorer";

interface Props {
  /** All available sample campaigns (the demo one is excluded by index). */
  campaigns: LoadedCampaign[];
  /** Index of the campaign shown in the demo section — excluded from sample list. */
  demoIdx: number;
}

type ToolState =
  | { kind: "idle" }
  | { kind: "sample"; idx: number }
  | { kind: "uploaded"; filename: string };

/**
 * ToolSection — "run this on your own campaign".
 *
 * Clearly separated from the demo. User can either drop a CSV (visual
 * acknowledgement — parsing schema handled by product) or load a different
 * sample to preview the tool with a new dataset.
 */
export default function ToolSection({ campaigns, demoIdx }: Props) {
  const [state, setState] = useState<ToolState>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const samples = campaigns
    .map((c, i) => ({ campaign: c, idx: i }))
    .filter(({ idx }) => idx !== demoIdx);

  const handleFile = (file: File) => {
    setState({ kind: "uploaded", filename: file.name });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleBrowse = () => fileInputRef.current?.click();

  const activeCampaign =
    state.kind === "sample" ? campaigns[state.idx] : null;

  const reset = () => setState({ kind: "idle" });

  return (
    <section className="space-y-5">
      {/* Section header — clear transition from demo */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap border-t border-ink/10 pt-10">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-electric mb-1.5">
            Your campaign
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            Run this on your own campaign
          </h2>
          <p className="text-[12px] text-ink/40 mt-1">
            Drop a campaign export to see the same breakdown on your data.
          </p>
        </div>
      </div>

      {/* Input layer — upload zone + sample fallback */}
      {state.kind !== "sample" && (
        <div className="rounded-3xl bg-cream border border-ink/8 p-6 md:p-8 space-y-5">
          {/* Upload zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed transition-all p-8 md:p-10 text-center ${
              isDragging
                ? "border-electric bg-electric/5"
                : "border-ink/15 bg-paper/50 hover:border-ink/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {state.kind === "uploaded" ? (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint">
                  File received
                </div>
                <div className="font-mono text-[13px] text-ink">
                  {state.filename}
                </div>
                <p className="text-[11px] text-ink/45 max-w-md mx-auto">
                  CSV parsing for custom exports is in progress. For now, load
                  a sample dataset below to preview the tool.
                </p>
                <button
                  onClick={reset}
                  className="mt-2 text-[10px] tracking-[0.14em] uppercase font-mono text-ink/40 hover:text-ink transition-colors"
                >
                  Clear file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/45">
                  Drop your CSV here
                </div>
                <p className="text-[12px] text-ink/55">
                  Campaign export with streams, moments, paid & editorial
                  activity
                </p>
                <button
                  onClick={handleBrowse}
                  className="mt-1 inline-flex items-center gap-2 rounded-full bg-ink text-paper px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-ink/85 transition-colors"
                >
                  Browse file
                </button>
              </div>
            )}
          </div>

          {/* Sample fallback — inline link style, not another panel */}
          {samples.length > 0 && (
            <div className="flex items-center justify-center gap-2 text-[11px] text-ink/45">
              <span>Or try it with a sample:</span>
              {samples.map(({ campaign, idx }) => (
                <button
                  key={campaign.campaign_id}
                  onClick={() => setState({ kind: "sample", idx })}
                  className="font-mono text-ink/70 underline underline-offset-2 decoration-ink/20 hover:decoration-ink hover:text-ink transition-colors"
                >
                  {campaign.sheet.setup.artist_name} —{" "}
                  {campaign.sheet.setup.campaign_name} →
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool output — only rendered when a sample is chosen */}
      {state.kind === "sample" && activeCampaign && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[12px] text-ink/55">
              Showing{" "}
              <span className="font-medium text-ink">
                {activeCampaign.sheet.setup.artist_name}
              </span>{" "}
              —{" "}
              <span className="font-medium text-ink">
                {activeCampaign.sheet.setup.campaign_name}
              </span>
            </div>
            <button
              onClick={reset}
              className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/40 hover:text-ink transition-colors"
            >
              ← Back to upload
            </button>
          </div>
          <CampaignExplorer
            campaign={activeCampaign}
            helperText="Click moments to see how activity impacted performance"
          />
        </div>
      )}
    </section>
  );
}
