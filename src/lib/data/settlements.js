// ═══════════════════════════════════════════════════════════════
// settlements.js — Building settlements + settlement checks
// ═══════════════════════════════════════════════════════════════
import rawSettlements from "../../data/settlements.json";
import rawChecks from "../../data/settlementChecks.json";

// Index settlements: buildingId → entries
const byBuilding = new Map();
for (const s of rawSettlements) {
  if (!byBuilding.has(s.buildingId)) byBuilding.set(s.buildingId, []);
  byBuilding.get(s.buildingId).push(s);
}

// Index checks: "buildingId|year" → checks
const checksByBldYear = new Map();
for (const c of rawChecks) {
  const key = `${c.buildingId}|${c.year}`;
  if (!checksByBldYear.has(key)) checksByBldYear.set(key, []);
  checksByBldYear.get(key).push(c);
}

export const buildingSettlements = rawSettlements;
export const settlementChecks = rawChecks;

export function getSettlement(buildingId, year) {
  const all = byBuilding.get(String(buildingId)) || [];
  if (year) return all.find((s) => s.year === year) || null;
  return all[0] || null;
}

export function getSettlementsByYear(year) {
  return rawSettlements.filter((s) => s.year === year);
}

export function getSettlementChecks(buildingId, year) {
  return checksByBldYear.get(`${String(buildingId)}|${year}`) || [];
}
