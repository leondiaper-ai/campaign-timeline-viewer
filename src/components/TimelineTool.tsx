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

// ── Editorial metadata per campaign ───────────────────────────
const SAMPLE_DESCRIPTIONS: Record<string, string> = {
  "K Trap":
    "Physical-first album rollout with paid push post-release.",
  "James Blake":
    "Editorial-driven album campaign, slow burn across the release window.",
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

function campaignWindow(c: LoadedCampaign): string {
  const rel = c.sheet.setup.release_date;
  if (!rel) return "Campaign export · full window";
  const d = new Date(rel + "T00:00:00");
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.getFullYear();
  return `Campaign export · ${month} ${year} window`;
}

// ── File-icon SVG ─────────────────────────────────────────────
function FileIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 1.5h6.5L13 5v9.5a0 0 0 0 1 0 0H3a0 0 0 0 1 0 0V1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 1.5V5H13"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────
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

  // Step progression state
  const currentStep =
    source.kind === "empty"
      ? 1
      : source.kind === "uploaded"
        ? 2
        : 2;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ─── Top bar ─── */}
      <header className="border-b border-ink/10 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[12px] text-ink/55 hover:text-ink transition-colors"
          >
            <span>←</span>
            <span>Back to overview</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center text-[10px] font-black tracking-[0.12em] bg-sun text-ink rounded-full w-8 h-8">
              02
            </span>
            <span className="text-[13px] font-bold text-ink">
              Campaign Timeline Viewer
            </span>
          </div>
        </div>
      </header>

      {/* ─── Main workspace ─── */}
      <main className="max-w-[1400px] mx-auto px-6 pt-12 pb-16">
        {/* Eyebrow + title row */}
        <div className="mb-10 max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
            Campaign Timeline · Campaign Performance
          </div>
          <h1 className="text-[54px] md:text-[64px] font-black tracking-[-0.02em] leading-[0.95] text-ink">
            Campaign Timeline
          </h1>
          <p className="text-[16px] text-ink/55 mt-4">
            This is what a real campaign breakdown looks like.
          </p>
        </div>

        {/* Step progression */}
        <div className="flex items-center gap-8 mb-8 flex-wrap">
          <StepPill
            n={1}
            label="Add data"
            active={currentStep === 1}
            done={currentStep > 1}
          />
          <StepPill
            n={2}
            label="See timeline"
            active={currentStep === 2}
            done={currentStep > 2}
          />
          <StepPill
            n={3}
            label="Explore what drove it"
            active={false}
            done={false}
          />
        </div>

        {/* Two-column workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
          {/* LEFT — sample files + upload */}
          <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
            {/* Sample campaigns */}
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
                Sample Campaign Data
              </h2>
              <div className="space-y-2.5">
                {campaigns.map((c, i) => {
                  const active =
                    source.kind === "sample" && source.idx === i;
                  return (
                    <button
                      key={c.campaign_id}
                      onClick={() => setSource({ kind: "sample", idx: i })}
                      className={`w-full text-left rounded-2xl border p-4 flex gap-3 transition-all ${
                        active
                          ? "bg-ink text-paper border-ink shadow-[4px_4px_0_0_rgba(14,14,14,0.12)]"
                          : "bg-cream border-ink/10 hover:border-ink/30 hover:shadow-[3px_3px_0_0_rgba(14,14,14,0.06)]"
                      }`}
                    >
                      <FileIcon
                        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          active ? "text-paper/70" : "text-ink/40"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-mono text-[12px] font-semibold mb-1 break-all leading-tight ${
                            active ? "text-paper" : "text-ink"
                          }`}
                        >
                          {toCsvName(c)}
                        </div>
                        <div
                          className={`text-[11px] leading-snug ${
                            active ? "text-paper/65" : "text-ink/50"
                          }`}
                        >
                          {campaignWindow(c)}
                        </div>
                        <div
                          className={`text-[11px] leading-snug mt-0.5 ${
                            active ? "text-paper/60" : "text-ink/45"
                          }`}
                        >
                          Includes: streams, release moments, paid, editorial, D2C
                        </div>
                        <div
                          className={`text-[11px] italic mt-1.5 leading-snug ${
                            active ? "text-paper/75" : "text-ink/55"
                          }`}
                        >
                          {describe(c)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink/40 mt-3 leading-snug">
                Each file represents a different campaign scenario.
              </p>
            </div>

            {/* Upload */}
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
                Or upload your own
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
                    <div className="text-[12px] font-semibold text-ink">
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

        {/* Step breadcrumb footer */}
        <div className="mt-16 pt-8 border-t border-ink/10">
          <div className="text-[11px] text-ink/40 tracking-wide">
            Add data → See timeline → Explore what drove it
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Step progression pill ────────────────────────────────────
function StepPill({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-colors ${
          active
            ? "bg-electric text-paper"
            : done
              ? "bg-ink text-paper"
              : "bg-transparent text-ink/35 border border-ink/20"
        }`}
      >
        {n}
      </span>
      <span
        className={`text-[13px] font-semibold ${
          active ? "text-ink" : done ? "text-ink/55" : "text-ink/35"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink/12 bg-cream/30 min-h-[540px] flex items-center justify-center p-10">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-ink/15 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-5 h-5 text-ink/30"
            aria-hidden="true"
          >
            <path
              d="M7 17L17 7M17 7H8M17 7V16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-[14px] text-ink/55">
          Select a campaign to begin
        </p>
      </div>
    </div>
  );
}

// ── Uploaded (placeholder) state ────────────────────────────
function UploadedState({ filename }: { filename: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink/12 bg-cream/30 min-h-[540px] flex items-center justify-center p-10">
      <div className="text-center max-w-md">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint mb-3">
          File received
        </div>
        <div className="font-mono text-[13px] text-ink mb-5 break-all">
          {filename}
        </div>
        <p className="text-[12px] text-ink/50 leading-relaxed">
          Custom CSV parsing is in progress. For now, pick one of the sample
          campaigns on the left to preview the full timeline experience.
        </p>
      </div>
    </div>
  );
}

// ── Active campaign (full explorer) ─────────────────────────
function SampleActiveState({ campaign }: { campaign: LoadedCampaign }) {
  const sheet = campaign.sheet;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-ink">
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
