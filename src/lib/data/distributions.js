// ═══════════════════════════════════════════════════════════════
// distributions.js — Distribution process objects
// ═══════════════════════════════════════════════════════════════
import rawDistributions from "../../data/distributions.json";

export const STEP_ORDER = [
  "validation",
  "comparison",
  "control",
  "check",
  "approval",
  "distribution",
];

export const STEP_CONFIG = {
  validation:   { label: { en: "Validation",   nl: "Validatie"    }, index: 0 },
  comparison:   { label: { en: "Comparison",   nl: "Vergelijking" }, index: 1 },
  control:      { label: { en: "Control",      nl: "Controle"     }, index: 2 },
  check:        { label: { en: "Check",        nl: "Check"        }, index: 3 },
  approval:     { label: { en: "Approval",     nl: "Goedkeuring"  }, index: 4 },
  distribution: { label: { en: "Distribution", nl: "Verdeling"    }, index: 5 },
};

// ─── Static indexes (from JSON) ────────────────────────────────
const _distMap        = new Map();
const _distByBuilding = new Map();

for (const d of rawDistributions) {
  _distMap.set(d.id, d);
  if (!_distByBuilding.has(d.buildingId)) _distByBuilding.set(d.buildingId, []);
  _distByBuilding.get(d.buildingId).push(d);
}

// ─── Runtime store (session-only distributions) ────────────────
// Distributions created via buildDistributionFromData() live here
// during the session. They are not persisted to JSON.
const _runtimeDists   = new Map();
const _runtimeByBuilding = new Map();

export function addRuntimeDistribution(dist) {
  _runtimeDists.set(dist.id, dist);
  const bkey = String(dist.buildingId);
  if (!_runtimeByBuilding.has(bkey)) _runtimeByBuilding.set(bkey, []);
  // Replace if same id already exists (idempotent)
  const existing = _runtimeByBuilding.get(bkey);
  const idx = existing.findIndex((d) => d.id === dist.id);
  if (idx >= 0) existing[idx] = dist;
  else existing.push(dist);
}

// ─── Exports ────────────────────────────────────────────────────
export const distributions = rawDistributions;

export function getDistributionById(id) {
  // Runtime dists take precedence (user may have started a new one)
  return _runtimeDists.get(id) || _distMap.get(id) || null;
}

export function getDistributionsByBuilding(buildingId) {
  const bkey = String(buildingId);
  const static_ = _distByBuilding.get(bkey) || [];
  const runtime_ = _runtimeByBuilding.get(bkey) || [];
  // Merge: runtime entries that share an id with static ones replace them
  const staticFiltered = static_.filter(
    (s) => !runtime_.some((r) => r.id === s.id)
  );
  return [...runtime_, ...staticFiltered].sort((a, b) => b.period - a.period);
}

export function getDistribution(buildingId, period) {
  const all = getDistributionsByBuilding(buildingId);
  return all.find((d) => d.period === period) || null;
}

/** Returns the current (most recent non-complete) or latest distribution for a building */
export function getActiveDistribution(buildingId) {
  const all = getDistributionsByBuilding(buildingId);
  if (!all.length) return null;
  const active = all.find((d) => d.currentStep !== "complete");
  return active || all[0]; // already sorted by period desc
}

/** Returns step index (0-5) for a distribution's current step */
export function getStepIndex(distribution) {
  if (distribution.currentStep === "complete") return 6;
  return STEP_ORDER.indexOf(distribution.currentStep);
}

/** Returns how many services are flagged in a distribution */
export function getFlaggedServiceCount(distribution) {
  return (distribution.services || []).filter((s) => s.status === "flagged").length;
}

// ─── Factory: build a new distribution from live building data ──
/**
 * buildDistributionFromData(buildingId, period)
 *
 * Constructs a fresh Distribution object at currentStep "validation"
 * by reading services from the building's existing distribution data
 * as a template. In a real system this would read ledger entries;
 * here we derive actuals from the most recent completed distribution
 * and apply slight adjustments for freshness.
 *
 * The created distribution is NOT added to the runtime store — the
 * caller must call addRuntimeDistribution() after confirming creation.
 */
export function buildDistributionFromData(buildingId, period) {
  const bkey  = String(buildingId);
  const id    = `DIST-${bkey}-${period}`;

  // Guard: already exists (static or runtime)?
  if (getDistributionById(id)) return getDistributionById(id);

  // Use most recent completed distribution as a template for services
  const allDists = getDistributionsByBuilding(buildingId);
  const template = allDists.find((d) => d.currentStep === "complete") || allDists[0];

  const services = template
    ? template.services.map((s) => ({
        serviceId:            s.serviceId,
        distributionMethod:   s.distributionMethod,
        distributionModelId:  s.distributionModelId || null,
        // Simulate new actuals: apply a small random-ish growth factor
        budget:               Math.round(s.actual * 1.03),
        actual:               null,       // not yet known — filled by validation
        previousActual:       s.actual,
        variancePct:          null,
        completeness:         0,
        status:               "pending",
      }))
    : [];

  return {
    id,
    buildingId: bkey,
    period,
    currentStep: "validation",
    services,
    steps: {
      validation:   { status: "in_progress", completedAt: null, completedBy: null, issues: [] },
      comparison:   { status: "pending",     completedAt: null, completedBy: null, deviations: [] },
      control:      { status: "pending",     completedAt: null, completedBy: null, threshold: 10, excesses: [] },
      check:        { status: "pending",     completedAt: null, completedBy: null, tenantOutcomes: [] },
      approval:     { status: "pending",     completedAt: null, requestedFrom: null, requestedAt: null, approvedBy: null, approvedAt: null, note: null },
      distribution: { status: "pending",     completedAt: null, sentToErp: false, erpReference: null },
    },
    totals: { totalCost: null, totalVoorschot: null, netResult: null },
    _isNew: true,
  };
}
