"use client";

import { CampaignEvent, TrackPerformance, Territory } from "@/types";
import { formatNumber } from "@/lib/format";

interface SinglePerformanceSnapshotProps {
  event: CampaignEvent;
  trackPerformance: TrackPerformance[];
  territory: Territory;
}

/**
 * Match a music event to its track performance data.
 *
 * Strategy:
 * 1. Check if event_title contains any track_name (case-insensitive)
 * 2. Check if event date is within 7 days of a track's release_date
 * 3. Return null if no match 
 */
function findMatchingTrack(
  event: CampaignEvent,
  tracks: TrackPerformance[],
  territory: Territory
): TrackPerformance | null {
  const territoryTracks = tracks.filter(
    (t) =>
  
  t.campaign_id === event.campaign_id &&
    t.territory === territory
  );

  if (territoryTracks.length === 0) return null;

  const eventLower = event.event_title.toLowerCase();

  // 1. Title match
  for (const track of territoryTracks) {
    if (
      track.track_name &&
      eventLower.includes(track.track_name.toLowerCase())
    ) {
      return track;
    }
  }

  // 2. Date proximity match (within 7 days)
  const eventTime = new Date(event.date + "T00:00:00").getTime();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  let nearest: TrackPerformance | null = null;
  let nearestDist = Infinity;

  for (const track of territoryTracks) {
    if (!track.release_date) continue;
    const trackTime = new Date(track.release_date + "T00:00:00").getTime();
    const dist = Math.abs(eventTime - trackTime);
    if (dist <= SEVEN_DAYS && dist < nearestDist) {
      nearestDist = dist;
      nearest = track;
    }
  }

  return nearest;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SinglePerformanceSnapshot({
  event,
  trackPerformance,
  territory,
}: SinglePerformanceSnapshotProps) {
  // Only show for music events
  if (event.event_type !== "music") return null;

  const track = findMatchingTrack(event, trackPerformance, territory);
  if (!track) return null;

  return (
    <div
      className="rounded-lg p-4 mt-3"
      style={{ backgroundColor: "#1A1D2B" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="flex-shrink-0"
        >
          <circle cx="7" cy="7" r="5.5" stroke="#8B5CF6" strokeWidth="1.2" />
          <circle cx="7" cy="7" r="2" fill="#8B5CF6" />
        </svg>
        <span className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em]">
          Single Performance Snapshot
        </span>
        <span className="text-[9px] text-label-muted px-1.5 py-0.5 rounded border border-border/50 bg-surface-primary font-mono">
          {territory}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[13px] font-semibold text-label-primary">
          {track.track_name}
        </span>
        <span className="text-[11px] text-label-muted font-mono">
          Released {formatDate(track.release_date)}
        </span>
      </div>

      {/* Streams timeline */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em] mb-1">
            7-day
          </p>
          <p
            className="text-lg font-bold tabular-nums"
            style={{ color: "#6C9EFF" }}
          >
            {formatNumber(track.streams_7b)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em] mb-1">
            14-day
          </p>
          <p
            className="text-lg font-bold tabular-nums"
            style={{ color: "#6C9EFF" }}
          >
            {formatNumber(track.streams_14d)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-label-muted uppercase tracking-[0.12em] mb-1">
            28-day
          </p>
          <p
            className="text-lg font-bold tabular-nums"
            style={{ color: "#6C9EFF" }}
          >
            {formatNumber(track.streams_28d)}
          </p>
        </div>
      </div>

      {/* Additional metrics */}
      <div className="flex items-center gap-4 text-[11px] text-label-muted">
        {track.saves_28d > 0 && (
          <span>
            <span className="font-semibold text-label-secondary tabular-nums">
              {formatNumber(track.saves_28d)}
            </span>{" "}
            saves
          </span>
        )}
        {track.playlist_adds_28d > 0 && (
          <span>
            <span className="font-semibold text-label-secondary tabular-nums">
              {formatNumber(track.playlist_adds_28d)}
            </span>{" "}
            playlist adds
          </span>
        )}
        {track.editorial_adds_28d > 0 && (
          <span>
            <span className="font-semibold text-label-secondary tabular-nums">
              {track.editorial_adds_28d}
            </span>{" "}
            editorial
          </span>
        )}
      </div>
    </div>
  );
}
