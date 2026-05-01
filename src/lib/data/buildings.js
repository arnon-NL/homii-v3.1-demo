// ═══════════════════════════════════════════════════════════════
// buildings.js — Building data + getters
// ═══════════════════════════════════════════════════════════════
import rawBuildings from "../../data/buildings.json";

// Build lookup map on load
const buildingMap = new Map();
for (const b of rawBuildings) {
  buildingMap.set(b.id, b);
}

export const buildings = rawBuildings;

export function getBuilding(id) {
  return buildingMap.get(String(id)) || null;
}

export function getBuildingByComplexId(complexId) {
  return rawBuildings.find((b) => b.complexId === complexId) || null;
}
