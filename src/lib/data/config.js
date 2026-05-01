// ═══════════════════════════════════════════════════════════════
// config.js — Module config + feature flags
// ═══════════════════════════════════════════════════════════════
import rawConfig from "../../data/moduleConfig.json";

export const moduleConfig = rawConfig;

export function isFeatureEnabled(feature) {
  if (rawConfig.mode === "full") return true;
  const featureMap = {
    ledger: rawConfig.hasLedgerData,
    consumption: rawConfig.hasConsumptionData,
    nonUtility: rawConfig.hasNonUtilityServices,
  };
  return featureMap[feature] ?? false;
}
