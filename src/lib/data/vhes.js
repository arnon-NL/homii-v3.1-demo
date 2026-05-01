// ═══════════════════════════════════════════════════════════════
// vhes.js — VHE (rental unit) data + getters
// ═══════════════════════════════════════════════════════════════
import rawVhes from "../../data/vhes.json";

// Index: buildingId → VHEs
const vhesByBuilding = new Map();
const vheMap = new Map();

for (const v of rawVhes) {
  vheMap.set(v.id, v);
  if (!vhesByBuilding.has(v.buildingId)) vhesByBuilding.set(v.buildingId, []);
  vhesByBuilding.get(v.buildingId).push(v);
}

export const vhes = rawVhes;

export function getVhe(id) {
  return vheMap.get(id) || null;
}

export function getVhesByBuilding(buildingId) {
  return vhesByBuilding.get(String(buildingId)) || [];
}
