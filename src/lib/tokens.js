/**
 * Design Tokens — Single source of truth for the homii v3 visual system.
 *
 * Rules:
 *   • Icon sizes: 3 only (sm 14, md 16, lg 20)
 *   • Font scale: 5 steps (micro 11, caption 12, body 14, heading 16, title 20)
 *   • Font weights: 3 (normal 400, medium 500, semibold 600 — no bold)
 *   • Spacing: 4px grid (4, 8, 12, 16, 20, 24, 32, 40, 48)
 *   • Border radius: lg (8px) + full — no md
 *   • Shadows: none (static), sm (hover), md (floating)
 *   • Status colors: neutral + amber + red — NO green for persistent status
 */

import { brand } from "./brand";

// ─── Icon sizes ──────────────────────────────────────────
export const iconSize = {
  sm: 14,   // caption-level: badges, meta labels, view items
  md: 16,   // body-level: nav items, table rows, buttons
  lg: 20,   // heading-level: page actions, empty states
};

// ─── Font scale (px) ─────────────────────────────────────
export const fontSize = {
  micro:   11,   // section labels (UPPERCASE), codes
  caption: 12,   // column headers, meta, timestamps  → text-xs
  body:    14,   // table cells, descriptions          → text-sm
  heading: 16,   // card titles, section heads          → text-base
  title:   20,   // page headings                      → text-xl
};

// Tailwind class equivalents (for quick reference in JSX)
export const fontClass = {
  micro:   "text-[11px]",
  caption: "text-xs",      // 12px
  body:    "text-sm",      // 14px
  heading: "text-base",    // 16px
  title:   "text-xl",      // 20px
};

// ─── Font weights ────────────────────────────────────────
export const fontWeight = {
  normal:   400,
  medium:   500,
  semibold: 600,
  // no bold (700) — use semibold instead
};

// ─── Spacing (4px grid) ──────────────────────────────────
export const space = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
};

// ─── Border radius ───────────────────────────────────────
export const radius = {
  lg:   "0.5rem",  // 8px — containers, cards, inputs
  full: "9999px",  // pills, avatars, dots
};

// ─── Shadows ─────────────────────────────────────────────
export const shadow = {
  none: "none",                                          // static cards
  sm:   "0 1px 2px 0 rgb(0 0 0 / 0.05)",               // hover states
  md:   "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", // floating (dropdowns)
};

// ─── Status semantic colors ──────────────────────────────
// 3-tier system: confirmed (brand blue) → warning (amber) → error (red)
// Inactive/ended states stay neutral gray.
export const status = {
  confirmed: {
    bg:   "bg-sky-50",
    text: "text-sky-600",
    dot:  brand.blue,       // #3EB1C8
  },
  neutral: {
    bg:   "bg-slate-100",
    text: "text-slate-500",
    dot:  brand.muted,      // #94A3B8
  },
  warning: {
    bg:   "bg-amber-50",
    text: "text-amber-600",
    dot:  brand.amber,      // #F59E0B
  },
  error: {
    bg:   "bg-red-50",
    text: "text-red-600",
    dot:  brand.red,        // #EF4444
  },
};

// ─── Re-export brand for convenience ─────────────────────
export { brand };
