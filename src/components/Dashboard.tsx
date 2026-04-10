"use client";

import type { AppData } from "@/types";
import DemoSection from "./DemoSection";

interface DashboardProps {
  initialData: AppData;
  isDemo?: boolean;
}

/**
 * Dashboard — page-level composition for the marketing + demo page.
 *
 * The marketing page shows:
 *   1. Intro (rendered by parent via ToolIntro in app/page.tsx)
 *   2. Demo section — progressive build experience
 *
 * The full working tool lives on its own route: /app/timeline
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
  const demoCampaign = campaigns[0];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-[1400px] mx-auto px-6 py-10 space-y-12">
        <DemoSection campaign={demoCampaign} />
      </main>
    </div>
  );
}
