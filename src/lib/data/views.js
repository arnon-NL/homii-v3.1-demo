// ═══════════════════════════════════════════════════════════════
// views.js — Saved views + getters
// ═══════════════════════════════════════════════════════════════
import rawViews from "../../data/savedViews.json";

const viewMap = new Map();
for (const v of rawViews) {
  viewMap.set(v.id, v);
}

export const savedViews = rawViews;

export function getView(id) {
  return viewMap.get(id) || null;
}
