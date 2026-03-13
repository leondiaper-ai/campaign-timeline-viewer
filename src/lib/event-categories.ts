import { EventCategory } from "@/types";
interface CategoryConfig { label: string; color: string; icon: string; }
export const EVENT_CATEGORIES: Record<EventCategory, CategoryConfig> = {
  music: { label: "Music", color: "#A78BFA", icon: "♫2 },
  marketing: { label: "Marketing", color: "#FBBF24", icon: "◎" },
  editorial: { label: "Editorial", color: "#F472B6", icon: "✎" },
  product: { label: "Product", color: "#22D3EE", icon: "▢" },
  live: { label: "Live", color: "#FB7185", icon: "●" },
};
export function getCategoryConfig(type: EventCategory): CategoryConfig { return EVENT_CATEGORIES[type] || EVENT_CATEGORIES.music; }
export const MAJOR_EVENT_KEYWORDS = ["single","album release","album out","pre-save","vinyl","merch","deluxe","release","pre-order","playlist placement","best new track"];
export function inferIsMajor(title: string): boolean { return MAJOR_EVENT_KEYWORDS.some((kw) => title.toLowerCase().includes(kw)); }
