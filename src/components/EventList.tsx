"use client";

import { useState } from "react";
import { CampaignEvent, AutoObservation, Confidence, TrackPerformance, Territory } from "@/types";
import { getCategoryConfig } from "@/lib/event-categories";
import SinglePerformanceSnapshot from "./SinglePerformanceSnapshot";

interface EventListProps {
  events: CampaignEvent[];
  observations: Map<string, AutoObservation>;
  visibleDates: Set<string>;
  onToggleVisibility: (date: string) => void;
  onHoverDate: (date: string | null) => void;
  trackPerformance: TrackPerformance[];
  territory: Territory;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatMetric(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function ConfidencePips({ level }: { level?: Confidence }) {
  const filled =
    level === "high" ? 3 : level === "medium" ? 2 : level === "low" ? 1 : 0;
  if (filled === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: i <= filled ? "#6C9EFF" : "#2A2D3E",
          }}
        />
      ))}
      <span className="text-[10px] text-label-muted ml-1 capitalize">
        {level}
      </span>
    </div>
  );
}

export default function EventList({
  events,
  observations,
  visibleDates,
  onToggleVisibility,
  onHoverDate,
  trackPerformance,
  territory,
}: EventListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-label-muted text-sm">
        No events for this campaign and territory.
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[420px]">
      {events.map((event, i) => {
        const cat = getCategoryConfig(event.event_type);
        const isVisible = event.is_major || visibleDates.has(event.date);
        const isExpanded = expandedIndex === i;
        const obs = observations.get(event.date);

        const hasManualLearning = !!(
          event.observed_impact || event.what_we_learned
        );
        const hasAutoObs = !!(obs && !obs.summary.startsWith("Not enough"));
        const isMusicEvent = event.event_type === "music";
        const hasAnyInsight = hasManualLearning || hasAutoObs || isMusicEvent;

        return (
          <div
            key={i}
            className="border-b border-border/50"
            onMouseEnter={() => onHoverDate(event.date)}
            onMouseLeave={() => onHoverDate(null)}
          >
            {/* ─── Main row ─── */}
            <div
              className="event-row flex items-center gap-4 px-5 py-3 cursor-pointer select-none"
              style={{ opacity: isVisible ? 1 : 0.45 }}
              onClick={() => {
                if (hasAnyInsight) {
                  setExpandedIndex(isExpanded ? null : i);
                }
                if (!event.is_major) {
                  onToggleVisibility(event.date);
                }
              }}
            >
              {/* Toggle indicator */}
              <div className="flex-shrink-0 w-5 flex justify-center">
                {event.is_major ? (
                  <div
                    className="w-2.5 h-2.5 rounded-sm rotate-45"
                    style={{ backgroundColor: cat.color }}
                  />
                ) : (
                  <div
                    className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: isVisible ? cat.color : "#353849",
                      backgroundColor: isVisible
                        ? cat.color + "20"
                        : "transparent",
                    }}
                  >
                    {isVisible && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path
                          d="M1 3L3 5L7 1"
                          stroke={cat.color}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="flex-shrink-0 w-[72px] text-[11px] font-mono text-label-muted tabular-nums">
                {formatDate(event.date)}
              </div>

              {/* Category */}
              <div className="flex-shrink-0 w-[90px] flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span
                  className="text-[11px] font-medium uppercase tracking-wider"
                  style={{ color: cat.color }}
                >
                  {cat.label}
                </span>
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm font-medium text-label-primary truncate">
                  {event.event_title}
                </span>
                {hasAnyInsight && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`flex-shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="#5F6578"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Notes */}
              <div className="flex-1 min-w-0 hidden lg:block">
                <span className="text-xs text-label-muted truncate block">
                  {event.notes}
                </span>
              </div>

              {/* Territory badge */}
              <div className="flex-shrink-0">
                <span className="text-[10px] font-semibold text-label-muted uppercase tracking-wider px-2 py-0.5 rounded bg-surface-primary border border-border/50">
                  {event.territory}
                </span>
              </div>

              {/* Key badge */}
              {event.is_major && (
                <div className="flex-shrink-0 w-6">
                  <span className="text-[9px] font-bold text-streams uppercase tracking-widest">
                    Key
                  </span>
                </div>
              )}
            </div>

            {/* ─── Expanded insight detail ─── */}
            {isExpanded && hasAnyInsight && (
              <div
                className="px-5 pb-4 pt-1"
                style={{ marginLeft: "calc(20px + 16px)" }}
              >
                <div className="space-y-3">
                  {/* System Observation */}
                  {hasAutoObs && obs && (
                    <div
                      className="rounded-lg p-4"
                      style={{ backgroundColor: "#181B27" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          width="14"
                          height="14"
                             viewBox="0 0 14 14"
                          fill="none"
                          className="flex-shrink-0"
                        >
                          <rect
                            x="1"
                            y="1"
                            width="12"
                            height="12"
                            rx="2"
                            stroke="#5F6578"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M4 8L6 5L8 7L10 4"
                            stroke="#6C9EFF"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em]">
                          System Observation
                        </span>
                        <span className="text-[9px] text-label-muted px-1.5 py-0.5 rounded border border-border/50 bg-surface-primary font-mono">
                          auto
                        </span>
                      </div>
                      <p className="text-[12px] text-label-secondary leading-relaxed">
                        {obs.summary}
                      </p>

                      {/* Metric context */}
                      {obs.streams_before !== null &&
                        obs.streams_after !== null && (
                          <div className="flex gap-6 mt-2.5">
                            <div className="text-[10px] text-label-muted">
                              <span className="font-mono tabular-nums">
                                {formatMetric(obs.streams_before)}
                              </span>{" "}
                              streams (week before)
                            </div>
                            <div className="text-[10px] text-label-muted">
                              <span className="font-mono tabular-nums">
                                {formatMetric(obs.streams_after)}
                              </span>{" "}
                              streams (week after)
                            </div>
                            {obs.streams_change_pct !== null && (
                              <div
                                className="text-[10px] font-semibold font-mono tabular-nums"
                                style={{
                                  color:
                                    obs.streams_change_pct > 10
                                      ? "#4ADE80"
                                      : obs.streams_change_pct < -10
                                        ? "#FB7185"
                                        : "#5F6578",
                                }}
                              >
                                {obs.streams_change_pct > 0 ? "+" : ""}
                                {obs.streams_change_pct}%
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Team Insight */}
                  {hasManualLearning && (
                    <div
                      className="rounded-lg p-4"
                      style={{ backgroundColor: "#1E2130" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className="flex-shrink-0"
                        >
                          <circle
                            cx="7"
                            cy="5.5"
                            r="3.5"
                            stroke="#FBBF24"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M5.5 9.5V11.5H8.5V9.5"
                            stroke="#FBBF24"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em]">
                          Team Insight
                        </span>
                        {event.confidence && (
                          <ConfidencePips level={event.confidence} />
                        )}
                      </div>

                      <div
                        className="grid gap-4"
                        style={{
                          gridTemplateColumns:
                            event.observed_impact && event.what_we_learned
                              ? "1fr 1fr"
                              : "1fr",
                        }}
                      >
                        {event.observed_impact && (
                          <div>
                            <p className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em] mb-1">
                              Observed impact
                            </p>
                            <p className="text-[13px] text-label-primary leading-relaxed">
                              {event.observed_impact}
                            </p>
                          </div>
                        )}
                        {event.what_we_learned && (
                          <div>
                            <p className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em] mb-1">
                              What we learned
                            </p>
                            <p className="text-[13px] text-label-secondary leading-relaxed">
                              {event.what_we_learned}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Single Performance Snapshot (for music events) */}
                  <SinglePerformanceSnapshot
                    event={event}
                    trackPerformance={trackPerformance}
                    territory={territory}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
