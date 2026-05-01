// ═══════════════════════════════════════════════════════════════
// meters.js — Meter data + getters
// ═══════════════════════════════════════════════════════════════
import rawMeters from "../../data/meters.json";

const metersByBuilding = new Map();
const metersByVhe = new Map();

for (const m of rawMeters) {
  if (!metersByBuilding.has(m.buildingId)) metersByBuilding.set(m.buildingId, []);
  metersByBuilding.get(m.buildingId).push(m);
  if (m.vheId) {
    if (!metersByVhe.has(m.vheId)) metersByVhe.set(m.vheId, []);
    metersByVhe.get(m.vheId).push(m);
  }
}

export const meters = rawMeters;

export function getMetersByBuilding(buildingId) {
  return metersByBuilding.get(String(buildingId)) || [];
}

export function getMetersByVhe(vheId) {
  return metersByVhe.get(vheId) || [];
}
