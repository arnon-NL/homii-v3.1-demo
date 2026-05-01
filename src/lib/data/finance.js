// ═══════════════════════════════════════════════════════════════
// finance.js — Building services, cost attribution, cost categories
// ═══════════════════════════════════════════════════════════════
import rawBuildingServices from "../../data/buildingServices.json";
import rawCostAttribution from "../../data/costAttribution.json";
import rawCostCategories from "../../data/costCategories.json";

// Index: buildingId → entries
const bsByBuilding = new Map();
// Index: serviceId → entries
const bsByService = new Map();
// Index: "buildingId|serviceId|year" → entry
const bsLookup = new Map();

for (const bs of rawBuildingServices) {
  // By building
  if (!bsByBuilding.has(bs.buildingId)) bsByBuilding.set(bs.buildingId, []);
  bsByBuilding.get(bs.buildingId).push(bs);
  // By service
  if (!bsByService.has(bs.serviceId)) bsByService.set(bs.serviceId, []);
  bsByService.get(bs.serviceId).push(bs);
  // Unique key
  bsLookup.set(`${bs.buildingId}|${bs.serviceId}|${bs.year}`, bs);
}

// Cost attribution by VHE
const caByVhe = new Map();
for (const ca of rawCostAttribution) {
  if (!caByVhe.has(ca.vheId)) caByVhe.set(ca.vheId, []);
  caByVhe.get(ca.vheId).push(ca);
}

export const buildingServices = rawBuildingServices;
export const costAttribution = rawCostAttribution;
export const costCategories = rawCostCategories;

export function getBuildingServices(buildingId, year) {
  const all = bsByBuilding.get(String(buildingId)) || [];
  if (year) return all.filter((bs) => bs.year === year);
  return all;
}

export function getBuildingServicesByService(serviceId, year) {
  const all = bsByService.get(serviceId) || [];
  if (year) return all.filter((bs) => bs.year === year);
  return all;
}

export function getBuildingService(buildingId, serviceId, year) {
  return bsLookup.get(`${buildingId}|${serviceId}|${year}`) || null;
}

export function getCostAttributionByVhe(vheId, year) {
  const all = caByVhe.get(vheId) || [];
  if (year) return all.filter((ca) => ca.year === year);
  return all;
}

export function getCostCategoriesByService(serviceId) {
  return rawCostCategories.filter((cc) => cc.serviceId === serviceId);
}
