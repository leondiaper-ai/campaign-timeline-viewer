"use client";

import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { EventCategory } from "@/types";

export default function CategoryLegend() {
  const categories = Object.entries(EVENT_CATEGORIES) as [EventCategory, (typeof EVENT_CATEGORIES)[EventCategory]][];
  return (
    <div className="flex items-center gap-5 flex-wrap">
      {categories.map(([key, config]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
          <span className="text-[11px] text-label-muted font-medium">{config.label}</span>
        </div>
      ))}
    </div>
  );
}
