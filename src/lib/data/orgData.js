// ═══════════════════════════════════════════════════════════════
// orgData.js — Org-aware data registry
// v3.1 demo build: only the Zonnestraal Wonen org. The legacy data
// layer here is largely unused by the demo flow (the Cost-flow / Tenants
// surfaces read directly from costFlow.json + perTenant.js synthesis),
// but a few side surfaces still call getDataset(orgId), so we keep the
// shape and feed it the empty-stub data files.
// ═══════════════════════════════════════════════════════════════

import rBuildings from "../../data/buildings.json";
import rServices from "../../data/services.json";
import rServiceCategories from "../../data/serviceCategories.json";
import rBuildingServices from "../../data/buildingServices.json";
import rCostAttribution from "../../data/costAttribution.json";
import rCostCategories from "../../data/costCategories.json";
import rVhes from "../../data/vhes.json";
import rMeters from "../../data/meters.json";
import rLedger from "../../data/ledgerEntries.json";
import rSuppliers from "../../data/suppliers.json";
import rSupplierCategories from "../../data/supplierCategories.json";
import rDistributionMethods from "../../data/distributionMethods.json";
import rDistributionModels from "../../data/distributionModels.json";
import rMonthlyClose from "../../data/monthlyCloseStatuses.json";
import rSavedViews from "../../data/savedViews.json";
import rActivities from "../../data/activities.json";
import rHeatingSeasons from "../../data/heatingSeasons.json";
import rModuleConfig from "../../data/moduleConfig.json";
import rTasks from "../../data/tasks.json";
import rNotes from "../../data/notes.json";
import rDistributions from "../../data/distributions.json";

// ── Build indexes for a dataset ─────────────────────────────
function buildIndexes(ds) {
  // Buildings
  ds._buildingMap = new Map();
  for (const b of ds.buildings) ds._buildingMap.set(b.id, b);

  // Services
  ds._serviceMap = new Map();
  ds._serviceByCode = new Map();
  for (const s of ds.services) {
    ds._serviceMap.set(s.id, s);
    ds._serviceByCode.set(s.code, s);
  }

  // BuildingServices
  ds._bsByBuilding = new Map();
  ds._bsByService = new Map();
  ds._bsLookup = new Map();
  for (const bs of ds.buildingServices) {
    if (!ds._bsByBuilding.has(bs.buildingId)) ds._bsByBuilding.set(bs.buildingId, []);
    ds._bsByBuilding.get(bs.buildingId).push(bs);
    if (!ds._bsByService.has(bs.serviceId)) ds._bsByService.set(bs.serviceId, []);
    ds._bsByService.get(bs.serviceId).push(bs);
    ds._bsLookup.set(`${bs.buildingId}|${bs.serviceId}|${bs.year}`, bs);
  }

  // Cost attribution by VHE
  ds._caByVhe = new Map();
  for (const ca of ds.costAttribution) {
    if (!ds._caByVhe.has(ca.vheId)) ds._caByVhe.set(ca.vheId, []);
    ds._caByVhe.get(ca.vheId).push(ca);
  }

  // VHEs
  ds._vheMap = new Map();
  ds._vhesByBuilding = new Map();
  for (const v of ds.vhes) {
    ds._vheMap.set(v.id, v);
    if (!ds._vhesByBuilding.has(v.buildingId)) ds._vhesByBuilding.set(v.buildingId, []);
    ds._vhesByBuilding.get(v.buildingId).push(v);
  }

  // Meters
  ds._metersByBuilding = new Map();
  ds._metersByVhe = new Map();
  for (const m of ds.meters) {
    if (!ds._metersByBuilding.has(m.buildingId)) ds._metersByBuilding.set(m.buildingId, []);
    ds._metersByBuilding.get(m.buildingId).push(m);
    if (m.vheId) {
      if (!ds._metersByVhe.has(m.vheId)) ds._metersByVhe.set(m.vheId, []);
      ds._metersByVhe.get(m.vheId).push(m);
    }
  }

  // Ledger
  ds._ledgerByService = new Map();
  ds._ledgerByBuilding = new Map();
  ds._ledgerByServiceBuilding = new Map();
  for (const e of ds.ledgerEntries) {
    if (!ds._ledgerByService.has(e.serviceId)) ds._ledgerByService.set(e.serviceId, []);
    ds._ledgerByService.get(e.serviceId).push(e);
    if (!ds._ledgerByBuilding.has(e.buildingId)) ds._ledgerByBuilding.set(e.buildingId, []);
    ds._ledgerByBuilding.get(e.buildingId).push(e);
    const key = `${e.serviceId}|${e.buildingId}`;
    if (!ds._ledgerByServiceBuilding.has(key)) ds._ledgerByServiceBuilding.set(key, []);
    ds._ledgerByServiceBuilding.get(key).push(e);
  }

  // Suppliers
  ds._supplierMap = new Map();
  for (const s of ds.suppliers) ds._supplierMap.set(s.id, s);

  // Heating seasons by building
  ds._hsByBuilding = new Map();
  for (const hs of (ds.heatingSeasons || [])) {
    if (!ds._hsByBuilding.has(hs.buildingId)) ds._hsByBuilding.set(hs.buildingId, []);
    ds._hsByBuilding.get(hs.buildingId).push(hs);
  }

  // Distribution models by building
  ds._dmByBuilding = new Map();
  for (const dm of ds.distributionModels) {
    if (!ds._dmByBuilding.has(String(dm.buildingId))) ds._dmByBuilding.set(String(dm.buildingId), []);
    ds._dmByBuilding.get(String(dm.buildingId)).push(dm);
  }

  // Distributions (process objects) — indexed by id and by building
  ds._distributionMap = new Map();
  ds._distributionsByBuilding = new Map();
  for (const d of (ds.distributions || [])) {
    ds._distributionMap.set(d.id, d);
    if (!ds._distributionsByBuilding.has(String(d.buildingId))) ds._distributionsByBuilding.set(String(d.buildingId), []);
    ds._distributionsByBuilding.get(String(d.buildingId)).push(d);
  }

  // Enrich Building objects with distributionIds (computed from process data)
  for (const b of ds.buildings) {
    const dists = ds._distributionsByBuilding.get(String(b.id)) || [];
    b.distributionIds = dists.map((d) => d.id);
  }

  return ds;
}

// ── Create the single demo dataset ──────────────────────────
const zonnestraal = buildIndexes({
  buildings: rBuildings,
  services: rServices,
  serviceCategories: rServiceCategories,
  buildingServices: rBuildingServices,
  costAttribution: rCostAttribution,
  costCategories: rCostCategories,
  vhes: rVhes,
  meters: rMeters,
  ledgerEntries: rLedger,
  suppliers: rSuppliers,
  supplierCategories: rSupplierCategories,
  distributionMethods: rDistributionMethods,
  distributionModels: rDistributionModels,
  monthlyCloseStatuses: rMonthlyClose,
  savedViews: rSavedViews,
  activities: rActivities,
  moduleConfig: rModuleConfig,
  heatingSeasons: rHeatingSeasons,
  tasks: rTasks,
  notes: rNotes,
  distributions: rDistributions,
});

const datasets = {
  zonnestraal,
};

/**
 * Get the dataset for an org. The v3.1 demo only registers
 * "zonnestraal"; any other id falls back to it so legacy callers
 * don't crash if they hold a stale org slug.
 */
export function getDataset(orgId) {
  return datasets[orgId] || zonnestraal;
}

