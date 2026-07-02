export const ECOMMERCE_ACCENT_IDS = [
  "ink",
  "navy",
  "burgundy",
  "forest",
  "copper",
  "plum",
] as const;

export type EcommerceAccentId = (typeof ECOMMERCE_ACCENT_IDS)[number];

export type EcommerceAccentPreset = {
  id: EcommerceAccentId;
  label: string;
  /** Preview swatch + charts */
  swatch: string;
  primary: string;
  primaryForeground: string;
};

export const ECOMMERCE_ACCENT_PRESETS: Record<EcommerceAccentId, EcommerceAccentPreset> = {
  ink: {
    id: "ink",
    label: "שחור עמוק",
    swatch: "#2a2a2a",
    primary: "oklch(0.22 0.02 260)",
    primaryForeground: "oklch(0.99 0.005 80)",
  },
  navy: {
    id: "navy",
    label: "כחול ים",
    swatch: "#1e3a5f",
    primary: "oklch(0.35 0.08 255)",
    primaryForeground: "oklch(0.99 0.005 80)",
  },
  burgundy: {
    id: "burgundy",
    label: "בורדו",
    swatch: "#6b2d3c",
    primary: "oklch(0.42 0.12 15)",
    primaryForeground: "oklch(0.99 0.005 80)",
  },
  forest: {
    id: "forest",
    label: "ירוק יער",
    swatch: "#2d4a3e",
    primary: "oklch(0.38 0.06 155)",
    primaryForeground: "oklch(0.99 0.005 80)",
  },
  copper: {
    id: "copper",
    label: "נחושת",
    swatch: "#8b5a3c",
    primary: "oklch(0.52 0.09 55)",
    primaryForeground: "oklch(0.99 0.005 80)",
  },
  plum: {
    id: "plum",
    label: "סגול עמוק",
    swatch: "#4a3a5c",
    primary: "oklch(0.4 0.08 305)",
    primaryForeground: "oklch(0.99 0.005 80)",
  },
};

export const DEFAULT_ECOMMERCE_ACCENT: EcommerceAccentId = "ink";

export function accentStorageKey(projectId: string) {
  return `ecommerce-admin-accent:${projectId}`;
}

export function parseAccentId(raw: unknown): EcommerceAccentId | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim() as EcommerceAccentId;
  return ECOMMERCE_ACCENT_IDS.includes(id) ? id : null;
}

export function resolveAccentId(projectId: string, fromDb: unknown): EcommerceAccentId {
  const parsed = parseAccentId(fromDb);
  if (parsed) return parsed;
  if (typeof window !== "undefined") {
    const stored = parseAccentId(localStorage.getItem(accentStorageKey(projectId)));
    if (stored) return stored;
  }
  return DEFAULT_ECOMMERCE_ACCENT;
}

export function persistAccentLocal(projectId: string, accentId: EcommerceAccentId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(accentStorageKey(projectId), accentId);
}

import type { CSSProperties } from "react";

export function accentThemeStyle(preset: EcommerceAccentPreset): CSSProperties {
  return {
    "--primary": preset.primary,
    "--primary-foreground": preset.primaryForeground,
    "--ring": preset.primary,
  } as CSSProperties;
}
