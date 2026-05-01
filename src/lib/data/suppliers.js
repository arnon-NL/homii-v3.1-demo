// ═══════════════════════════════════════════════════════════════
// suppliers.js — Supplier data (mock, unchanged from original)
// ═══════════════════════════════════════════════════════════════
import rawSuppliers from "../../data/suppliers.json";
import rawCategories from "../../data/supplierCategories.json";

const supplierMap = new Map();
for (const s of rawSuppliers) {
  supplierMap.set(s.id, s);
}

export const suppliers = rawSuppliers;
export const supplierCategories = rawCategories;

export function getSupplier(id) {
  return supplierMap.get(id) || null;
}

export function getSuppliersByService(serviceId) {
  return rawSuppliers.filter((s) => s.serviceIds && s.serviceIds.includes(serviceId));
}
