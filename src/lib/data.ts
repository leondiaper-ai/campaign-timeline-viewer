import {
  CampaignData,
  SingleCampaignData,
  RegistryEntry,
  TrackWeeklyMetric,
  WeeklyMetric,
} from "A/types";
import { mockCampaigns, mockMetrics, mockEvents } from "./mock-data";

// ─── Mock Track Data for K Trap ─────────────────────────────────

const MOCK_K_TRAP_TRACKS = [
  {
    id: "no_discussion",
    name: "No Discussion",
    sharePeak: 0.38,
    shareBase: 0.28,
  },
  {
    id: "background_headie_one",
    name: "Background ft Headie One",
    sharePeak: 0.22,
    shareBase: 0.18,
  },
  {
    id: "no_feelings",
    name: "No Feelings",
    sharePeak: 0.12,
    shareBase: 0.08,
  },
];
