import { google } from "googleapis";
import {
  Campaign,
  WeeklyMetric,
  CampaignEvent,
  SingleCampaignData,
  TrackPerformance,
  TrackWeeklyMetric,
  Territory,
  EventCategory,
  Confidence,
  RegistryEntry,
  CampaignStatus,
} from "A/types";
import { inferIsMajor } from "./event-categories";
