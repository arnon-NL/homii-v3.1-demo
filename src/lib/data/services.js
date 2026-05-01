// ═══════════════════════════════════════════════════════════════
// services.js — Service definitions + categories + getters
// ═══════════════════════════════════════════════════════════════
import rawServices from "../../data/services.json";
import rawCategories from "../../data/serviceCategories.json";

const serviceMap = new Map();
const serviceByCode = new Map();
for (const s of rawServices) {
  serviceMap.set(s.id, s);
  serviceByCode.set(s.code, s);
}

export const services = rawServices;
export const serviceCategories = rawCategories;

export function getService(id) {
  return serviceMap.get(id) || null;
}

export function getServiceByCode(code) {
  return serviceByCode.get(code) || null;
}

export function getServicesByCategory(categoryId) {
  return rawServices.filter((s) => s.category === categoryId);
}
