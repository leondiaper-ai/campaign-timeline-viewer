"use client";

import type { AppData } from "@/types";
import DemoSection from "./DemoSection";
import ToolSection from "./ToolSection";

interface DashboardProps {
  initialData: AppData;
  isDemo?: boolean;
}

/**
 * Dashboard — page-level composition.
 *
 * Structure:
 *   1. Intro (rendered by the parent via ToolIntro in app/page.tsx)
 *   2. Demo section       — interactive example with a pre-loaded campaign
 *   3. Tool section       — upload or pick sample, graph updates on input
 */
export default function Dashboard({ initialData }: DashboardProps) {
  const campaigns = initialData.campaigns;

  if (campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/40 text-lg">No campaigns available.</p>
      </div>
    );
  }

  // Demo always uses the first campaign (the album campaign).
  const demoIdx = 0;
  const demoCampaign = campaigns[demoIdx];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-[1400px] mx-auto px-6 py-10 space-y-12">
        {/* 1 — Demo: pre-loaded, interactive, no CSV input */}
        <DemoSection campaign={demoCampaign} />

        {/* 2 — Tool: upload CSV or pick a sample, graph updates on input */}
        <ToolSection campaigns={campaigns} demoIdx={demoIdx} />
      </main>
    </div>
  );
}
