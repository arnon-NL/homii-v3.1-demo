// ═══════════════════════════════════════════════════════════════
// src/lib/data/index.js — Org-aware data layer
//
// Uses a module-level active org so all existing component imports
// continue to work. OrgContext calls setActiveOrg() when switching.
//
// Pattern: all getter functions delegate to the active org's dataset.
// ═══════════════════════════════════════════════════════════════
import { getDataset } from "./orgData.js";

// --- Active org state (set by OrgContext) ---
let _activeOrgId = "rochdale";

export function setActiveOrg(orgId) {
  _activeOrgId = orgId;
}

export function getActiveOrgId() {
  return _activeOrgId;
}

function ds() {
  return getDataset(_activeOrgId);
}

// ═══════════════════════════════════════════════════════════════
// Array exports — these are getters so they always return current org data
// ═══════════════════════════════════════════════════════════════
export function getBuildings() { return ds().buildings; }
export function getServices() { return ds().services; }
export function getServiceCategories() { return ds().serviceCategories; }
export function getAllBuildingServices() { return ds().buildingServices; }
export function getVhes() { return ds().vhes; }
export function getMeters() { return ds().meters; }
export function getAllLedgerEntries() { return ds().ledgerEntries; }
export function getSuppliers() { return ds().suppliers; }
export function getSupplierCategories() { return ds().supplierCategories; }
export function getDistributionMethods() { return ds().distributionMethods; }
export function getDistributionModels() { return ds().distributionModels; }
export function getMonthlyCloseStatuses() { return ds().monthlyCloseStatuses; }
export function getSavedViews() { return ds().savedViews; }
export function getActivities() { return ds().activities; }
export function getCostAttribution() { return ds().costAttribution; }
export function getCostCategories() { return ds().costCategories; }
export function getModuleConfig() { return ds().moduleConfig; }

// ── Backward-compatible property-style exports ─────────────
// These use Object.defineProperty with getters so they dynamically
// resolve to current org's data when accessed.
// ── NOTE: This is a prototype pattern. In production, use hooks. ─
const _proxy = {};
Object.defineProperty(_proxy, "buildings", { get: () => ds().buildings, enumerable: true });
Object.defineProperty(_proxy, "services", { get: () => ds().services, enumerable: true });
Object.defineProperty(_proxy, "serviceCategories", { get: () => ds().serviceCategories, enumerable: true });
Object.defineProperty(_proxy, "buildingServices", { get: () => ds().buildingServices, enumerable: true });
Object.defineProperty(_proxy, "costAttribution", { get: () => ds().costAttribution, enumerable: true });
Object.defineProperty(_proxy, "costCategories", { get: () => ds().costCategories, enumerable: true });
Object.defineProperty(_proxy, "vhes", { get: () => ds().vhes, enumerable: true });
Object.defineProperty(_proxy, "meters", { get: () => ds().meters, enumerable: true });
Object.defineProperty(_proxy, "ledgerEntries", { get: () => ds().ledgerEntries, enumerable: true });
Object.defineProperty(_proxy, "suppliers", { get: () => ds().suppliers, enumerable: true });
Object.defineProperty(_proxy, "supplierCategories", { get: () => ds().supplierCategories, enumerable: true });
Object.defineProperty(_proxy, "distributionMethods", { get: () => ds().distributionMethods, enumerable: true });
Object.defineProperty(_proxy, "distributionModels", { get: () => ds().distributionModels, enumerable: true });
Object.defineProperty(_proxy, "monthlyCloseStatuses", { get: () => ds().monthlyCloseStatuses, enumerable: true });
Object.defineProperty(_proxy, "savedViews", { get: () => ds().savedViews, enumerable: true });
Object.defineProperty(_proxy, "activities", { get: () => ds().activities, enumerable: true });
Object.defineProperty(_proxy, "moduleConfig", { get: () => ds().moduleConfig, enumerable: true });
Object.defineProperty(_proxy, "distributions", { get: () => ds().distributions || [], enumerable: true });

// Re-export as named constants (these reference the proxy getters)
export const buildings = _proxy.buildings;
export const services = _proxy.services;
export const serviceCategories = _proxy.serviceCategories;
export const buildingServices = _proxy.buildingServices;
export const costAttribution = _proxy.costAttribution;
export const costCategories = _proxy.costCategories;
export const vhes = _proxy.vhes;
export const meters = _proxy.meters;
export const ledgerEntries = _proxy.ledgerEntries;
export const suppliers = _proxy.suppliers;
export const supplierCategories = _proxy.supplierCategories;
export const distributionMethods = _proxy.distributionMethods;
export const distributionModels = _proxy.distributionModels;
export const monthlyCloseStatuses = _proxy.monthlyCloseStatuses;
export const savedViews = _proxy.savedViews;
export const activities = _proxy.activities;
export const moduleConfig = _proxy.moduleConfig;

// ═══════════════════════════════════════════════════════════════
// Getter functions — all delegate to active org's indexed dataset
// ═══════════════════════════════════════════════════════════════

// --- Buildings ---
export function getBuilding(id) {
  return ds()._buildingMap.get(String(id)) || null;
}

export function getBuildingByComplexId(complexId) {
  return ds().buildings.find((b) => b.complexId === complexId) || null;
}

// --- Services ---
export function getService(id) {
  return ds()._serviceMap.get(id) || null;
}

export function getServiceByCode(code) {
  return ds()._serviceByCode.get(code) || null;
}

export function getServicesByCategoryId(categoryId) {
  return ds().services.filter((s) => s.category === categoryId);
}

// --- Finance ---
export function getBuildingServices(buildingId, year) {
  const all = ds()._bsByBuilding.get(String(buildingId)) || [];
  if (year) return all.filter((bs) => bs.year === year);
  return all;
}

export function getBuildingServicesByService(serviceId, year) {
  const all = ds()._bsByService.get(serviceId) || [];
  if (year) return all.filter((bs) => bs.year === year);
  return all;
}

export function getBuildingService(buildingId, serviceId, year) {
  return ds()._bsLookup.get(`${buildingId}|${serviceId}|${year}`) || null;
}

export function getCostAttributionByVhe(vheId, year) {
  const all = ds()._caByVhe.get(vheId) || [];
  if (year) return all.filter((ca) => ca.year === year);
  return all;
}

export function getCostCategoriesByService(serviceId) {
  return ds().costCategories.filter((cc) => cc.serviceId === serviceId);
}

// --- VHEs ---
export function getVhe(id) {
  return ds()._vheMap.get(id) || null;
}

export function getVhesByBuilding(buildingId) {
  return ds()._vhesByBuilding.get(String(buildingId)) || [];
}

// --- Meters ---
export function getMetersByBuilding(buildingId) {
  return ds()._metersByBuilding.get(String(buildingId)) || [];
}

export function getMetersByVhe(vheId) {
  return ds()._metersByVhe.get(vheId) || [];
}

// --- Ledger ---
export function getLedgerByService(serviceId, year) {
  const entries = ds()._ledgerByService.get(serviceId) || [];
  if (year != null) return entries.filter((e) => e.year === year);
  return entries;
}

export function getLedgerByBuilding(buildingId) {
  return ds()._ledgerByBuilding.get(String(buildingId)) || [];
}

export function getLedgerByServiceAndBuilding(serviceId, buildingId) {
  return ds()._ledgerByServiceBuilding.get(`${serviceId}|${String(buildingId)}`) || [];
}

export function getLedgerGroupedByCostCategory(serviceId, buildingId, year) {
  let entries = buildingId
    ? getLedgerByServiceAndBuilding(serviceId, buildingId)
    : getLedgerByService(serviceId);
  if (year != null) entries = entries.filter((e) => e.year === year);
  const grouped = {};
  const unassigned = [];
  for (const e of entries) {
    const cat = e.costCategoryId;
    if (!cat) { unassigned.push(e); continue; }
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(e);
  }
  return { grouped, unassigned };
}

export function getLedgerSummaryByService(serviceId, year) {
  const entries = getLedgerByService(serviceId, year);
  const byBuilding = {};
  for (const e of entries) {
    if (!byBuilding[e.buildingId])
      byBuilding[e.buildingId] = { total: 0, count: 0, flagged: 0, pending: 0 };
    const b = byBuilding[e.buildingId];
    b.total += e.amount || 0;
    b.count += 1;
    if (e.status === "flagged") b.flagged += 1;
    if (e.status === "pending") b.pending += 1;
  }
  return byBuilding;
}

export function getLedgerSummaryByBuilding(buildingId) {
  const entries = getLedgerByBuilding(buildingId);
  const byService = {};
  for (const e of entries) {
    if (!byService[e.serviceId])
      byService[e.serviceId] = { total: 0, count: 0 };
    byService[e.serviceId].total += e.amount || 0;
    byService[e.serviceId].count += 1;
  }
  return byService;
}

export function getLedgerMonthlySummaryByService(serviceId) {
  const entries = getLedgerByService(serviceId);
  const byMonth = {};
  for (const e of entries) {
    const key = `${e.year}-${String(e.month).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { total: 0, count: 0 };
    byMonth[key].total += e.amount || 0;
    byMonth[key].count += 1;
  }
  return byMonth;
}

// --- Suppliers ---
export function getSupplier(id) {
  return ds()._supplierMap.get(id) || null;
}

export function getSuppliersByService(serviceId) {
  return ds().suppliers.filter((s) => s.serviceIds && s.serviceIds.includes(serviceId));
}

// --- Distributions (process objects) ---
// Runtime-aware getters delegate to distributions.js which merges
// session-created distributions with the static JSON data.
export {
  addRuntimeDistribution,
  buildDistributionFromData,
  getDistributionById,
  getDistributionsByBuilding,
  getActiveDistribution,
  STEP_ORDER,
  STEP_CONFIG,
  getStepIndex,
  getFlaggedServiceCount,
} from "./distributions.js";

import {
  getDistributionsByBuilding as _getRtDistsByBuilding,
} from "./distributions.js";

export function getDistributions() {
  return ds().distributions || [];
}

export function getDistributionByPeriod(buildingId, period) {
  const all = _getRtDistsByBuilding(buildingId);
  return all.find((d) => d.period === period) || null;
}

// --- Distribution Methods / Models ---
export function getDistributionMethod(id) {
  return ds().distributionMethods.find((m) => m.id === id) || null;
}

export function getDistributionModel(buildingId, serviceId) {
  const bid = String(buildingId);
  // First try exact match (buildingId + serviceId)
  if (serviceId) {
    for (const m of ds().distributionModels) {
      if (String(m.buildingId) === bid && m.serviceId === serviceId) return m;
    }
  }
  // Fallback: match by buildingId only (for energy module where model is per-building)
  const byBuilding = ds()._dmByBuilding?.get(bid);
  return byBuilding?.[0] || null;
}

export function getDistributionModelsByBuilding(buildingId) {
  return ds()._dmByBuilding?.get(String(buildingId)) || [];
}

// --- Heating Seasons ---
export function getHeatingSeasonsByBuilding(buildingId) {
  return ds()._hsByBuilding?.get(String(buildingId)) || [];
}

export function getHeatingSeasons() {
  return ds().heatingSeasons || [];
}

// --- Monthly Close ---
export function getMonthlyCloseForBuilding(buildingId, year) {
  const all = ds().monthlyCloseStatuses.filter(
    (s) => String(s.buildingId) === String(buildingId),
  );
  if (year) return all.filter((s) => s.year === year);
  return all;
}

export function getMonthlyCloseForBuildingService(buildingId, serviceId, year) {
  const all = ds().monthlyCloseStatuses.filter(
    (s) => String(s.buildingId) === String(buildingId) && s.serviceId === serviceId,
  );
  if (year) return all.filter((s) => s.year === year);
  return all;
}

export function getMonthlyCloseGridForBuilding(buildingId, year) {
  const entries = getMonthlyCloseForBuilding(buildingId, year);
  const grid = {};
  for (const e of entries) {
    if (!grid[e.serviceId]) {
      grid[e.serviceId] = Array(12).fill(null).map(() => ({ status: "pending" }));
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

// --- Views ---
export function getView(id) {
  return ds().savedViews.find((v) => v.id === id) || null;
}

// --- Config ---
export function isFeatureEnabled(feature) {
  const cfg = ds().moduleConfig;
  if (cfg.mode === "full") return true;
  const featureMap = {
    ledger: cfg.hasLedgerData,
    consumption: cfg.hasConsumptionData,
    nonUtility: cfg.hasNonUtilityServices,
    consumptionControl: cfg.hasConsumptionData,
  };
  return featureMap[feature] ?? false;
}

// --- Meter Links ---
export {
  costCategoryMeterLinks,
  getMeterLink,
  getMeterLinksByBuilding,
  getMeterLinksByService,
  addMeterLink,
  removeMeterLink,
} from "./meterLinks.js";

// --- Field Sources (shared across orgs) ---
export { FIELD_SOURCES, getFieldSource, getEntitySource } from "./fieldSources.js";

// ═══════════════════════════════════════════════════════════════
// Compatibility aliases — match original mockData.js signatures
// ═══════════════════════════════════════════════════════════════

/** getBuildingServicesByYear: returns { year: [...], ... } */
export function getBuildingServicesByYear(buildingId) {
  const all = getBuildingServices(buildingId);
  const byYear = {};
  for (const bs of all) {
    if (!byYear[bs.year]) byYear[bs.year] = [];
    byYear[bs.year].push(bs);
  }
  return byYear;
}

/** getSubmetersByVhe: alias for getMetersByVhe, filtered to type=sub */
export function getSubmetersByVhe(vheId) {
  return getMetersByVhe(vheId).filter((m) => m.type === "sub");
}

/** getVheMeterReadings: returns meter readings for a VHE+year */
export function getVheMeterReadings(vheId, year) {
  const submeters = getMetersByVhe(vheId);
  return submeters
    .filter((m) => m.readings && m.readings[year])
    .map((m) => ({ ...m.readings[year], meterId: m.id, utility: m.utility }));
}

/** getActivitiesByBuilding */
export function getActivitiesByBuilding(buildingId) {
  return ds().activities.filter((a) => a.buildingId === String(buildingId));
}

/** Tasks */
export const tasks = [];   // populated from ds()
export function getTasksByBuilding(buildingId) {
  return (ds().tasks || []).filter((t) => t.buildingId === String(buildingId));
}

/** Notes */
export const notes = [];   // populated from ds()
export function getNotesByBuilding(buildingId) {
  return (ds().notes || []).filter((n) => n.buildingId === String(buildingId));
}

/** getSuppliersByCategory */
export function getSuppliersByCategory(categoryId) {
  return ds().suppliers.filter(
    (s) => s.categories && s.categories.includes(categoryId),
  );
}

/** getViewsForObject: filter saved views by objectType */
export function getViewsForObject(objectType) {
  return ds().savedViews.filter((v) => v.objectType === objectType);
}

/** getCategory: get a service category by id */
export function getCategory(categoryId) {
  return ds().serviceCategories.find((c) => c.id === categoryId) || null;
}

/**
 * getServicesByCategory: returns { categoryId: [services], ... }
 * Matches original mockData.js behavior (returns grouped object, not array)
 */
export function getServicesByCategory() {
  const cats = ds().serviceCategories;
  const svcs = ds().services;
  const grouped = {};
  for (const cat of cats) {
    grouped[cat.id] = svcs.filter((s) => s.category === cat.id);
  }
  return grouped;
}
