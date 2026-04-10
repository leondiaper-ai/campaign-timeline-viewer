"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { LoadedCampaign } from "@/types";
import CampaignExplorer from "./CampaignExplorer";

interface Props {
  campaigns: LoadedCampaign[];
}

type SourceState =
  | { kind: "empty" }
  | { kind: "sample"; idx: number }
  | { kind: "uploaded"; filename: string };

/**
 * Short editorial descriptions keyed by artist name. Falls back to a generic
 * line if we don't have anything specific to say about a campaign.
 */
const SAMPLE_DESCRIPTIONS: Record<string, string> = {
  "K Trap": "Album campaign — physical-first rollout with paid push post-release.",
  "James Blake":
    "Album campaign — editorial-driven, slow burn across release window.",
};

function describe(c: LoadedCampaign): string {
  return (
    SAMPLE_DESCRIPTIONS[c.sheet.setup.artist_name] ??
    "Example campaign with full streams, moments & activity."
  );
}

function toCsvName(c: LoadedCampaign): string {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${slug(c.sheet.setup.artist_name)}_${slug(
    c.sheet.setup.campaign_name,
  )}.csv`;
}

export default function TimelineTool({ campaigns }: Props) {
  const [source, setSource] = useState<SourceState>({ kind: "empty" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setSource({ kind: "uploaded", filename: file.name });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const activeCampaign =
    source.kind === "sample" ? campaigns[source.idx] : null;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Top bar */}
      <header className="border-b border-ink/10 px-6 py-5">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <span className="text-[10px] font-black tracking-[0.18em] bg-sun text-ink px-2 py-1 rounded-sm">
              02
            </span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-ink">
                Campaign Timeline
              </h1>
              <p className="text-[12px] text-ink/50 mt-0.5">
                This is what a real campaign breakdown looks like
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="text-[10px] tracking-[0.14em] uppercase font-mono text-ink/40 hover:text-ink transition-colors"
          >
            ← Back to overview
          </Link>
        </div>
      </header>

      {/* Two-column workspace */}
      <div className="max-w-[1500px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          {/* LEFT — sample CSVs + upload */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Sample files */}
            <div>
              <h2 className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
                Sample campaigns
              </h2>
              <div className="space-y-2">
                {campaigns.map((c, i) => {
                  const active =
                    source.kind === "sample" && source.idx === i;
                  return (
                    <button
                      key={c.campaign_id}
                      onClick={() => setSource({ kind: "sample", idx: i })}
                      className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
                        active
                          ? "bg-ink text-paper border-ink shadow-[4px_4px_0_0_rgba(14,14,14,0.12)]"
                          : "bg-cream border-ink/10 hover:border-ink/30 hover:shadow-[3px_3px_0_0_rgba(14,14,14,0.06)]"
                      }`}
                    >
                      <div
                        className={`font-mono text-[11px] mb-1 ${
                          active ? "text-paper/70" : "text-ink/50"
                        }`}
                      >
                        {toCsvName(c)}
                      </div>
                      <div className="font-semibold text-[13px] leading-snug">
                        {c.sheet.setup.artist_name} —{" "}
                        {c.sheet.setup.campaign_name}
                      </div>
                      <div
                        className={`text-[11px] mt-1 leading-snug ${
                          active ? "text-paper/60" : "text-ink/50"
                        }`}
                      >
                        {describe(c)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-ink/10" />

            {/* Upload */}
            <div>
              <h2 className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
                Or upload
              </h2>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                  isDragging
                    ? "border-electric bg-electric/5"
                    : "border-ink/15 bg-paper/50 hover:border-ink/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                {source.kind === "uploaded" ? (
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-mint">
                      File received
                    </div>
                    <div className="font-mono text-[12px] text-ink break-all">
                      {source.filename}
                    </div>
                    <button
                      onClick={() => setSource({ kind: "empty" })}
                      className="text-[9px] tracking-[0.14em] uppercase font-mono text-ink/40 hover:text-ink transition-colors"
                    >
                      Clear file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-ink">
                      Upload your campaign export
                    </div>
                    <p className="text-[10px] text-ink/45 leading-snug">
                      Works with messy exports
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] hover:bg-ink/85 transition-colors"
                    >
                      Browse file
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT — workspace */}
          <div>
            {source.kind === "empty" && <EmptyState />}

            {source.kind === "uploaded" && (
              <UploadedState filename={source.filename} />
            )}

            {source.kind === "sample" && activeCampaign && (
              <SampleActiveState campaign={activeCampaign} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-ink/15 bg-cream/40 min-h-[520px] flex items-center justify-center p-10">
      <div className="text-center max-w-sm">
        <div className="w-10 h-10 mx-auto mb-4 rounded-full border border-ink/15 flex items-center justify-center">
          <span className="text-ink/30 text-lg">←</span>
        </div>
        <h2 className="text-[15px] font-bold text-ink/80 mb-1.5">
          Select a campaign to begin
        </h2>
        <p className="text-[12px] text-ink/45 leading-relaxed">
          Pick one of the sample campaigns on the left, or drop in your own
          export to see the full timeline.
        </p>
      </div>
    </div>
  );
}

// ── Uploaded-but-not-parseable state ───────────────────────────
function UploadedState({ filename }: { filename: string }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-cream/40 min-h-[520px] flex items-center justify-center p-10">
      <div className="text-center max-w-md">
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-mint mb-2">
          File received
        </div>
        <div className="font-mono text-[13px] text-ink mb-4">{filename}</div>
        <p className="text-[12px] text-ink/50 leading-relaxed">
          Custom CSV parsing is in progress. For now, pick one of the sample
          campaigns on the left to preview the full timeline experience.
        </p>
      </div>
    </div>
  );
}

// ── Sample-selected state (full tool) ──────────────────────────
function SampleActiveState({ campaign }: { campaign: LoadedCampaign }) {
  const sheet = campaign.sheet;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">
          {sheet.setup.artist_name}{" "}
          <span className="text-ink/40 font-medium">
            — {sheet.setup.campaign_name}
          </span>
        </h2>
        <p className="text-[11px] text-ink/40 mt-0.5">
          <span className="capitalize">{sheet.setup.campaign_type}</span>
          {sheet.setup.release_date && (
            <>
              {" "}
              · Released{" "}
              {new Date(
                sheet.setup.release_date + "T00:00:00",
              ).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </>
          )}
        </p>
      </div>
      <CampaignExplorer
        campaign={campaign}
        helperText="Click moments to see how activity impacted performance"
      />
    </div>
  );
}
