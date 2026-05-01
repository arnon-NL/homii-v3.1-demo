// ═══════════════════════════════════════════════════════════════
// meterLinks.js — Cost Category ↔ Main Meter connections
//
// Manages the manual links between cost categories and main meters.
// These links enable reconciliation: comparing ledger costs to
// consumption-based expected costs.
// ═══════════════════════════════════════════════════════════════
import rawLinks from "../../data/costCategoryMeterLinks.json";

// Index: "costCategoryId|buildingId" → link
const linkByCatBuilding = new Map();
// Index: buildingId → [links]
const linksByBuilding = new Map();
// Index: serviceId → [links]
const linksByService = new Map();

for (const link of rawLinks) {
  linkByCatBuilding.set(`${link.costCategoryId}|${link.buildingId}`, link);
  if (!linksByBuilding.has(link.buildingId)) linksByBuilding.set(link.buildingId, []);
  linksByBuilding.get(link.buildingId).push(link);
  if (!linksByService.has(link.serviceId)) linksByService.set(link.serviceId, []);
  linksByService.get(link.serviceId).push(link);
}

export const costCategoryMeterLinks = rawLinks;

/**
 * Get the meter link for a specific cost category + building combination.
 * Returns null if no link exists.
 */
export function getMeterLink(costCategoryId, buildingId) {
  return linkByCatBuilding.get(`${costCategoryId}|${String(buildingId)}`) || null;
}

/**
 * Get all meter links for a building.
 */
export function getMeterLinksByBuilding(buildingId) {
  return linksByBuilding.get(String(buildingId)) || [];
}

/**
 * Get all meter links for a service.
 */
export function getMeterLinksByService(serviceId) {
  return linksByService.get(serviceId) || [];
}

/**
 * Add a new meter link (in-memory only for prototype).
 */
export function addMeterLink({ costCategoryId, meterId, buildingId, serviceId }) {
  const link = {
    id: `CCML-${Date.now()}`,
    costCategoryId,
    meterId,
    buildingId: String(buildingId),
    serviceId,
    linkedAt: new Date().toISOString().split("T")[0],
    linkedBy: "user-current",
  };
  rawLinks.push(link);
  linkByCatBuilding.set(`${costCategoryId}|${String(buildingId)}`, link);
  if (!linksByBuilding.has(link.buildingId)) linksByBuilding.set(link.buildingId, []);
  linksByBuilding.get(link.buildingId).push(link);
  if (!linksByService.has(link.serviceId)) linksByService.set(link.serviceId, []);
  linksByService.get(link.serviceId).push(link);
  return link;
}

/**
 * Remove a meter link (in-memory only for prototype).
 */
export function removeMeterLink(costCategoryId, buildingId) {
  const key = `${costCategoryId}|${String(buildingId)}`;
  const link = linkByCatBuilding.get(key);
  if (!link) return false;
  linkByCatBuilding.delete(key);
  // Remove from building index
  const bLinks = linksByBuilding.get(link.buildingId);
  if (bLinks) {
    const idx = bLinks.findIndex((l) => l.id === link.id);
    if (idx >= 0) bLinks.splice(idx, 1);
  }
  // Remove from service index
  const sLinks = linksByService.get(link.serviceId);
  if (sLinks) {
    const idx = sLinks.findIndex((l) => l.id === link.id);
    if (idx >= 0) sLinks.splice(idx, 1);
  }
  // Remove from raw array
  const rIdx = rawLinks.findIndex((l) => l.id === link.id);
  if (rIdx >= 0) rawLinks.splice(rIdx, 1);
  return true;
}
