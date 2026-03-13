"use client";
import { Territory } from "@/types";
interface TerritoryToggleProps { selected: Territory; onChange: (t: Territory) => void; }
const territories: { value: Territory; label: string }[] = [{ value: "global", label: "Global" }, { value: "UK", label: "UK" }];
export default function TerritoryToggle({ selected, onChange }: TerritoryToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-primary p-0.5">
      {territories.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`px-5 py-1.5 text-xs font-semibold rounded-md transition-all uppercase tracking-wider ${selected===t.value?"bg-surface-card text-label-primary shadow-sm":"text-label-muted hover:text-label-secondary"}`}>{t.label}</button>
      ))}
    </div>
  );
}
