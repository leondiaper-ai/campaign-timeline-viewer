import { EventCategory } from "@/types";

interface CategoryConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

const EVENT_CATEGORIES: Record<EventCategory, CategoryConfig> = {
  music: {
    label: "Music",
    color: "#8B5CF6",
    bgColor: "#8B5CF620",
    icon: "♫",
  },
  marketing: {
    label: "Marketing",
    color: "#F59E0B",
    bgColor: "#F59E0B20",
    icon: "◎",
  },
  editorial: {
    label: "Editorial",
    color: "#EC4899",
    bgColor: "#EC489920",
    icon: "✎",
  },
  product: {
    label: "Product",
    color: "#06B6D4",
    bgColor: "#06B6D420",
    icon: "▢",
  },
  live: {
    label: "Live",
    color: "#EF4444",
    bgColor: "#EF444420",
    icon: "●",
  },
  marquee: {
    label: "Marquee",
    color: "#10B981",
    bgColor: "#10B98120",
    icon: "◈",
  },
};

/**
 * Maps a moment_type string (from the moments sheet tab) to an EventCategory.
 * Handles both direct matches ("marketing") and descriptive types ("single_release").
 */
export function mapMomentType(momentType: string): EventCategory {
  const val = momentType.toLowerCase().trim();

  // Direct match
  if (val in EVENT_CATEGORIES) return val as EventCategory;

  // Music-related
  if (
    val.includes("release") ||
    val.includes("single") ||
    val.includes("album") ||
    val.includes("preorder")
  )
    return "music";

  // Editorial
  if (
    val.includes("editorial") ||
    val.includes("press") ||
    val.includes("review") ||
    val.includes("playlist")
  )
    return "editorial";

  // Marquee (paid campaign)
  if (val.includes("marquee")) return "marquee";

  // Marketing
  if (
    val.includes("marketing") ||
    val.includes("ad") ||
    val.includes("social") ||
    val.includes("promo") ||
    val.includes("paid")
  )
    return "marketing";

  // Product
  if (
    val.includes("product") ||
    val.includes("merch") ||
    val.includes("vinyl") ||
    val.includes("physical")
  )
    return "product";

  // Live
  if (
    val.includes("live") ||
    val.includes("tour") ||
    val.includes("gig") ||
    val.includes("concert") ||
    val.includes("festival")
  )
    return "live";

  // Default fallback
  return "music";
}

/**
 * Get display config for a moment_type string.
 * Works with both EventCategory values and descriptive moment_type strings.
 */
export function getCategoryConfig(momentType: string): CategoryConfig {
  const category = mapMomentType(momentType);
  return EVENT_CATEGORIES[category];
}

export function getAllCategories(): Record<
  EventCategory,
  CategoryConfig
> {
  return EVENT_CATEGORIES;
}
