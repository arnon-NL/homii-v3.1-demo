// ═══════════════════════════════════════════════════════════════
// src/lib/columnRegistry.js — Building column definitions
//
// Single source of truth for every attribute that can appear on
// the Buildings list. Columns are grouped into categories so the
// ColumnPicker UI can render a structured, grouped list.
//
// Each column exposes:
//   key          — unique string id
//   label        — bilingual { en, nl }
//   category     — groups columns in the picker
//   unit         — optional display unit suffix (e.g. "GJ", "kWh")
//   align        — "left" | "right" | "center"
//   sortable     — whether the column supports server/client sort
//   sortKey      — field name on the enriched building object used for sorting
//                  (defaults to `key` when omitted)
//   defaultVisible — included in defaultComplexColumns
// ═══════════════════════════════════════════════════════════════

export const COLUMN_CATEGORIES = [
  { key: "identity",    label: { en: "Identity",    nl: "Identiteit" } },
  { key: "overview",    label: { en: "Overview",    nl: "Overzicht" } },
  { key: "consumption", label: { en: "Consumption", nl: "Verbruik" } },
  { key: "finance",     label: { en: "Finance",     nl: "Financiën" } },
  { key: "quality",     label: { en: "Quality",     nl: "Kwaliteit" } },
];

export const BUILDING_COLUMNS = {
  // ── Identity ──────────────────────────────────────────────────
  complex: {
    key: "complex",
    label: { en: "Complex", nl: "Complex" },
    category: "identity",
    align: "left",
    sortable: false,
    defaultVisible: true,
  },
  complexId: {
    key: "complexId",
    label: { en: "Complex ID", nl: "Complex ID" },
    category: "identity",
    align: "left",
    sortable: false,
    defaultVisible: true,
  },

  // ── Overview ──────────────────────────────────────────────────
  location: {
    key: "location",
    label: { en: "Location", nl: "Locatie" },
    category: "overview",
    align: "left",
    sortable: false,
    defaultVisible: true,
  },
  vhe: {
    key: "vhe",
    label: { en: "VHE", nl: "VHE" },
    category: "overview",
    align: "right",
    sortable: true,
    defaultVisible: true,
  },
  components: {
    key: "components",
    label: { en: "Services", nl: "Diensten" },
    category: "overview",
    align: "right",
    sortable: true,
    defaultVisible: true,
  },
  utilities: {
    key: "utilities",
    label: { en: "Utilities", nl: "Nutsvoorzieningen" },
    category: "overview",
    align: "left",
    sortable: true,
    sortKey: "utilityCount",
    defaultVisible: true,
  },

  // ── Consumption ───────────────────────────────────────────────
  heat_consumption: {
    key: "heat_consumption",
    label: { en: "Heat", nl: "Warmte" },
    unit: "GJ",
    category: "consumption",
    align: "right",
    sortable: true,
    defaultVisible: false,
  },
  water_consumption: {
    key: "water_consumption",
    label: { en: "Water", nl: "Water" },
    unit: "m³",
    category: "consumption",
    align: "right",
    sortable: true,
    defaultVisible: false,
  },
  electricity_consumption: {
    key: "electricity_consumption",
    label: { en: "Electricity", nl: "Elektriciteit" },
    unit: "kWh",
    category: "consumption",
    align: "right",
    sortable: true,
    defaultVisible: false,
  },
  warmWater_consumption: {
    key: "warmWater_consumption",
    label: { en: "Warm Water", nl: "Warm water" },
    unit: "m³",
    category: "consumption",
    align: "right",
    sortable: true,
    defaultVisible: false,
  },

  // ── Finance ───────────────────────────────────────────────────
  budgetProgress: {
    key: "budgetProgress",
    label: { en: "Budget", nl: "Budget" },
    category: "finance",
    align: "left",
    sortable: false,
    defaultVisible: false,
  },

  // ── Quality ───────────────────────────────────────────────────
  dataQuality: {
    key: "dataQuality",
    label: { en: "Data Quality", nl: "Datakwaliteit" },
    category: "quality",
    align: "center",
    sortable: false,
    defaultVisible: true,
  },
};

// Ordered list of column keys shown by default when no view is active
export const defaultComplexColumns = [
  "complex", "complexId", "location", "vhe", "components", "utilities", "dataQuality",
];

// Helper: get all columns for a given category, in registry order
export function getColumnsByCategory(categoryKey) {
  return Object.values(BUILDING_COLUMNS).filter((c) => c.category === categoryKey);
}
