// ═══════════════════════════════════════════════════════════════
// monthlyClose.js — Monthly close statuses + getters (mock data)
// NOTE: Large dataset (~161K entries). Consider lazy-loading in production.
// ═══════════════════════════════════════════════════════════════
import rawStatuses from "../../data/monthlyCloseStatuses.json";

// Index: buildingId → entries
const byBuilding = new Map();
// Index: "buildingId|serviceId" → entries
const byBuildingService = new Map();

for (const s of rawStatuses) {
  if (!byBuilding.has(s.buildingId)) byBuilding.set(s.buildingId, []);
  byBuilding.get(s.buildingId).push(s);

  const key = `${s.buildingId}|${s.serviceId}`;
  if (!byBuildingService.has(key)) byBuildingService.set(key, []);
  byBuildingService.get(key).push(s);
}

export const monthlyCloseStatuses = rawStatuses;

export function getMonthlyCloseForBuilding(buildingId, year) {
  const all = byBuilding.get(String(buildingId)) || [];
  if (year) return all.filter((s) => s.year === year);
  return all;
}

export function getMonthlyCloseForBuildingService(buildingId, serviceId, year) {
  const key = `${String(buildingId)}|${serviceId}`;
  const all = byBuildingService.get(key) || [];
  if (year) return all.filter((s) => s.year === year);
  return all;
}

export function getMonthlyCloseGridForBuilding(buildingId, year) {
  const entries = getMonthlyCloseForBuilding(buildingId, year);
  // Group by serviceId → array of 12 months
  const grid = {};
  for (const e of entries) {
    if (!grid[e.serviceId]) {
      grid[e.serviceId] = Array(12)
        .fill(null)
        .map(() => ({ status: "pending" }));
    }
    const idx = (e.month || 1) - 1;
    grid[e.serviceId][idx] = {
      status: e.status,
      closedAt: e.closedAt,
      closedBy: e.closedBy,
    };
  }
  return grid;
}
