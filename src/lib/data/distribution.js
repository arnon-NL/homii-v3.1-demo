// ═══════════════════════════════════════════════════════════════
// distribution.js — Distribution methods + models
// ═══════════════════════════════════════════════════════════════
import rawMethods from "../../data/distributionMethods.json";
import rawModels from "../../data/distributionModels.json";

const modelMap = new Map();
for (const m of rawModels) {
  modelMap.set(`${m.buildingId}|${m.serviceId}`, m);
}

export const distributionMethods = rawMethods;
export const distributionModels = rawModels;

export function getDistributionMethod(id) {
  return rawMethods.find((m) => m.id === id) || null;
}

export function getDistributionModel(buildingId, serviceId) {
  return modelMap.get(`${String(buildingId)}|${serviceId}`) || null;
}
