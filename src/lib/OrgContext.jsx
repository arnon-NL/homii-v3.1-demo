// ═══════════════════════════════════════════════════════════════
// OrgContext.jsx — Organization context provider
// Manages active org, module config, and org switching.
// Also syncs the data layer's active org on every change.
// ═══════════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import organizations from "../data/organizations.json";
import { setActiveOrg } from "./data/index.js";
import { getDataset } from "./data/orgData.js";

const OrgCtx = createContext(null);

export function OrgProvider({ children }) {
  const [orgId, setOrgId] = useState(() => {
    // Initialize data layer immediately
    setActiveOrg(organizations[0].id);
    return organizations[0].id;
  });

  const org = useMemo(
    () => organizations.find((o) => o.id === orgId) || organizations[0],
    [orgId],
  );

  // Keep data layer in sync
  useEffect(() => {
    setActiveOrg(orgId);
  }, [orgId]);

  const switchOrg = useCallback((id) => {
    setActiveOrg(id); // Sync immediately (before re-render)
    setOrgId(id);
  }, []);

  const hasModule = useCallback(
    (mod) => org.modules.includes(mod),
    [org],
  );

  const isFeatureEnabled = useCallback(
    (feature) => {
      const cfg = org.moduleConfig;
      if (cfg.mode === "full") return true;
      const featureMap = {
        ledger: cfg.hasLedgerData,
        consumption: cfg.hasConsumptionData,
        nonUtility: cfg.hasNonUtilityServices,
        consumptionControl: cfg.hasConsumptionData,
      };
      return featureMap[feature] ?? false;
    },
    [org],
  );

  // Provide direct access to org dataset for components that need arrays
  const data = useMemo(() => getDataset(orgId), [orgId]);

  const value = useMemo(
    () => ({
      org,
      orgId: org.id,
      organizations,
      switchOrg,
      hasModule,
      isFeatureEnabled,
      moduleConfig: org.moduleConfig,
      data, // pre-indexed dataset for the current org
    }),
    [org, switchOrg, hasModule, isFeatureEnabled, data],
  );

  return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgCtx);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}

export { OrgCtx };
