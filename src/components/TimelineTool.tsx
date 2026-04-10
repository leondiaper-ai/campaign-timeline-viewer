"use client";

import { useMemo, useRef, useState } from "react";
import type { LoadedCampaign } from "@/types";
import CampaignExplorer from "./CampaignExplorer";

interface Props {
  campaigns: LoadedCampaign[];
}

type SourceState =
  | { kind: "sample"; idx: number }
  | { kind: "uploaded"; filename: string };

// ── Main component ────────────────────────────────────────────
export default function TimelineTool({ campaigns }: Props) {
  // Start with the first sample campaign preloaded — no activation click required.
  const [source, setSource] = useState<SourceState>(() =>
    campaigns.length > 0
      ? { kind: "sample", idx: 0 }
      : ({ kind: "sample", idx: 0 } as SourceState),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const activeCampaign = useMemo<LoadedCampaign | null>(() => {
    if (source.kind === "sample")
      return campaigns[source.idx] ?? campaigns[0] ?? null;
    return null;
  }, [source, campaigns]);

  const handleFile = (file: File) => {
    setSource({ kind: "uploaded", filename: file.name });
  };

  const pickSample = (idx: number) => {
    setSource({ kind: "sample", idx });
    setShowSwitcher(false);
  };

  if (campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-10">
        <p className="text-[14px] text-ink/60">No campaign data available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ─── Top bar ─── */}
      <header className="border-b border-ink/10 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center text-[10px] font-black tracking-[0.12em] bg-sun text-ink rounded-full w-8 h-8">
              02
            </span>
            <span className="text-[13px] font-bold text-ink">
              Campaign Timeline Viewer
            </span>
          </div>
          <span className="text-[10px] tracking-[0.18em] uppercase font-bold text-ink/40">
            Tool 02 · Decision System
          </span>
        </div>
      </header>

      {/* ─── Main workspace ─── */}
      <main className="max-w-[1200px] mx-auto px-6 pt-12 pb-16">
        {/* Eyebrow + title row */}
        <div className="mb-10 max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-3">
            Campaign Timeline · Campaign Performance
          </div>
          <h1 className="text-[48px] md:text-[60px] font-black tracking-[-0.02em] leading-[0.95] text-ink">
            Campaign Timeline
          </h1>
          <p className="text-[16px] text-ink/55 mt-4 leading-snug">
            Here&apos;s an example campaign loaded and ready. Explore the
            breakdown, then upload your own export.
          </p>
        </div>

        {/* ─── Active campaign content ─── */}
        {source.kind === "sample" && activeCampaign && (
          <ActiveCampaignContent campaign={activeCampaign} />
        )}
        {source.kind === "uploaded" && (
          <UploadedPlaceholder
            filename={source.filename}
            onClear={() => setSource({ kind: "sample", idx: 0 })}
          />
        )}

        {/* ─── Next actions ─── */}
        {source.kind === "sample" && (
          <section className="mt-14 pt-10 border-t border-ink/10">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-4">
              What would you like to do next?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Explore this campaign — opens the sample switcher */}
              <div className="rounded-2xl border border-ink/12 bg-cream p-5">
                <button
                  type="button"
                  onClick={() => setShowSwitcher((s) => !s)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-ink">
                        Explore this campaign
                      </div>
                      <div className="text-[12px] text-ink/55 mt-1">
                        Switch between pre-loaded examples
                      </div>
                    </div>
                    <span
                      className={`text-[18px] text-ink/40 transition-transform ${
                        showSwitcher ? "rotate-45" : ""
                      }`}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </div>
                </button>

                {showSwitcher && (
                  <div className="mt-4 pt-4 border-t border-ink/10 space-y-2">
                    {campaigns.map((c, i) => {
                      const active =
                        source.kind === "sample" && source.idx === i;
                      return (
                        <button
                          key={c.campaign_id}
                          onClick={() => pickSample(i)}
                          className={`w-full text-left rounded-xl border p-3 transition-all ${
                            active
                              ? "bg-ink text-paper border-ink"
                              : "bg-paper border-ink/10 hover:border-ink/30"
                          }`}
                        >
                          <div
                            className={`text-[12px] font-bold ${
                              active ? "text-paper" : "text-ink"
                            }`}
                          >
                            {c.sheet.setup.artist_name}
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              active ? "text-paper/70" : "text-ink/50"
                            }`}
                          >
                            {c.sheet.setup.campaign_name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upload your own */}
              <div className="rounded-2xl border border-ink/12 bg-ink text-paper p-5">
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-paper">
                        Upload your own campaign export
                      </div>
                      <div className="text-[12px] text-paper/55 mt-1">
                        CSV, TSV or XLSX · messy exports are fine
                      </div>
                    </div>
                    <span
                      className="text-[18px] text-paper/60 group-hover:text-paper transition-colors"
                      aria-hidden="true"
                    >
                      ↗
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Subtle support CTA */}
            <p className="text-[12px] text-ink/40 mt-6">
              Need help structuring your campaign data?{" "}
              <a
                href="mailto:hello@example.com?subject=Campaign%20Timeline%20Viewer%20%E2%80%94%20setup%20help"
                className="text-ink/60 hover:text-ink underline underline-offset-2 decoration-ink/20 hover:decoration-ink transition-colors"
              >
                We can set this up with you →
              </a>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

// ── Active campaign content ────────────────────────────────────
function ActiveCampaignContent({ campaign }: { campaign: LoadedCampaign }) {
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

// ── Uploaded placeholder ───────────────────────────────────────
function UploadedPlaceholder({
  filename,
  onClear,
}: {
  filename: string;
  onClear: () => void;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink/12 bg-cream/30 min-h-[400px] flex items-center justify-center p-10">
      <div className="text-center max-w-md">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint mb-3">
          File received
        </div>
        <div className="font-mono text-[13px] text-ink mb-5 break-all">
          {filename}
        </div>
        <p className="text-[12px] text-ink/50 leading-relaxed mb-5">
          Custom CSV parsing is in progress. For now, you can keep exploring
          the example campaign.
        </p>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-ink/85 transition-colors"
        >
          Back to example
        </button>
      </div>
    </div>
  );
}
