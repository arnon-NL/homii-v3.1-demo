/* perTenant — synthesised VHE registry + per-tenancy outcome math.
 *
 * Why synthesised?
 *   The cost-flow JSON tells us *audience* totals (Block 1 owes €43k for
 *   electricity). It doesn't tell us which addresses live in Block 1, who
 *   the tenants are, what each tenant pre-paid, or who moved mid-year.
 *   Real ERPs hold that data; for the prototype we generate a plausible
 *   registry deterministically from the existing siblingGroups + advance/
 *   amount fields on settlement nodes.
 *
 *   "Deterministic" matters: the same call always returns the same VHEs,
 *   tenancies, advances. That way React renders are stable, and edits in
 *   the workflow ripple through the math without the registry shifting
 *   under the user.
 *
 * Reading model
 *   `getCostFlow()` from costFlow.js already overlays user edits via
 *   active(). Every read here goes through that same accessor, so:
 *     • editing a settlement amount in the workflow re-flows the calc;
 *     • adding a cost source updates the lane's source total (no direct
 *       effect on per-VHE calc unless you also change the settlement);
 *     • freezing a component flips `locked` to true on its column.
 *
 * The math
 *   For a given (tenancy, settlement):
 *     calc = settlement.amount × proration × shareOf(vhe, settlement)
 *     adv  = settlement.advance × proration × shareOf(vhe, settlement)
 *   where:
 *     proration = tenancyDays / periodDays  (always ≤ 1)
 *     shareOf depends on settlement.distribution.method:
 *       • per_vhe / metered_*  → 1 / denominator
 *       • by_m2                → vhe.m2 / total_m2
 *       • fixed_pct            → pct / audienceVheCount
 *       • single               → 1 if VHE is the chosen recipient, else 0
 *   A VHE that doesn't belong to the settlement's target audience gets 0.
 *
 *   For mid-year handovers, two tenancies share a VHE — their prorations
 *   sum to 1, so combined they receive the full audience share, matching
 *   what Excel does on the per-tenant Subtotaal rows.
 */

import { getCostFlow } from "./costFlow";
import { isLaneFrozen } from "./costFlowEdits";

/* ─── Address bases per group ────────────────────────────────
 * Group → street name to render addresses against. A real ERP holds these
 * in the building registry; the demo hardcodes the two complexes. */
const STREET_BASE = {
  "GRP-tulpenhof":     "Tulpenhof",
  "GRP-bloemkwartier": "Bloemkwartierlaan",
};

const COMMERCIAL_SUFFIX = "BV";
const SUFFIX_LETTERS = ["A", "B", "C"];

/* ─── Tenant name pool ──────────────────────────────────── */
const FIRST_NAMES = [
  "Jan", "Pieter", "Anneke", "Maria", "Bart", "Lisa", "Floor", "Sanne",
  "Tom", "Eva", "Mark", "Iris", "Daan", "Sophie", "Lars", "Femke",
  "Jeroen", "Sara", "Bas", "Noor", "Hugo", "Linde", "Sven", "Roos",
  "Tijn", "Esmee", "Wout", "Lotte", "Niels", "Mila",
];
const LAST_NAMES = [
  "de Vries", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder",
  "Hendriks", "Jansen", "Dijkstra", "van Dijk", "Bos", "Vos", "Peters",
  "Hoekstra", "van der Berg", "Kuipers", "Brouwer", "de Wit", "Kramer",
];
const COMMERCIAL_NAMES = [
  "Café Carolina B.V.",
  "Wasserij Sciencepark",
  "Studio 3198",
];

/* Tiny string-hash → unsigned int. Stable across reloads. */
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/* ─── Period helpers ────────────────────────────────────── */

function periodInfo(year) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const days = Math.round((end - start) / 86400000) + 1; // inclusive → 365/366
  return { start, end, days };
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000) + 1;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/* ─── VHE generation ─────────────────────────────────────
 *
 * For each Group's siblingGroups, classify:
 *   primary  = complex / commercial   (their own VHE pool)
 *   block    = a block-partition of the complex (sums must match)
 *   subset   = subgroup audience that's a slice of the complex
 *
 * Allocation:
 *   1. For each primary, generate that many VHEs (sequential).
 *   2. If the complex has blocks, partition its VHEs across them.
 *   3. For each subgroup, pick its vheCount VHEs from the complex pool
 *      using a stable hash so the same group always picks the same set.
 */

function classifySiblings(siblings) {
  const primary = [];
  const blocks = [];
  const subsets = [];
  for (const sg of siblings) {
    const k = sg.kind;
    if (k === "complex" || k === "commercial") primary.push(sg);
    else if (k === "block") blocks.push(sg);
    else subsets.push(sg);
  }
  return { primary, blocks, subsets };
}

/* Generate addresses for a primary pool. Carolina starts the streetnumber
 * from 2082 (matches the source Excel block); other complexes use 1..N.
 * Roughly 8% of addresses get an A/B/C suffix to look real. */
function addressFor(streetBase, idx, isCommercial) {
  const startNumber = streetBase === "Carolina MacGillavrylaan" ? 2082 : 1;
  const number = startNumber + idx;
  const suffixIdx = hash(streetBase + ":" + idx) % 12;
  const suffix = suffixIdx < SUFFIX_LETTERS.length ? " " + SUFFIX_LETTERS[suffixIdx] : "";
  if (isCommercial) {
    return `${streetBase} ${number} (${COMMERCIAL_SUFFIX})`;
  }
  return `${streetBase} ${number}${suffix}`;
}

/* m² is a stable per-VHE value, not particularly accurate. 50–95 for
 * residential, 80–250 for commercial. Used by by_m2 distributions. */
function m2For(id, isCommercial) {
  const h = hash(id);
  if (isCommercial) return 80 + (h % 170);
  return 50 + (h % 45);
}

const _vheCache = {};

export function getVhesForGroup(groupId) {
  if (_vheCache[groupId]) return _vheCache[groupId];

  const flow = getCostFlow();
  const pageGroupId = flow.group?.id;
  if (pageGroupId !== groupId) {
    // Caller is asking for a different group than the one currently active
    // in costFlow. We only synthesise for the active group.
    _vheCache[groupId] = [];
    return [];
  }

  const siblings = flow.siblingGroups || [];
  const { primary, blocks, subsets } = classifySiblings(siblings);
  const streetBase = STREET_BASE[groupId] || flow.group?.name || "Unit";

  const vhes = [];
  let idx = 0;

  for (const p of primary) {
    const isCommercial = p.kind === "commercial";
    for (let i = 0; i < (p.vheCount || 0); i++) {
      const id = `vhe-${groupId}-${idx}`;
      vhes.push({
        id,
        index: idx,
        groupId,
        primaryAudienceId: p.id,
        audienceIds: [p.id],
        address: addressFor(streetBase, idx, isCommercial),
        m2: m2For(id, isCommercial),
        isCommercial,
      });
      idx++;
    }
  }

  // Partition the complex pool across blocks, if any.
  const complexPool = vhes.filter((v) =>
    primary.some((p) => p.kind === "complex" && p.id === v.primaryAudienceId)
  );
  if (blocks.length > 0 && complexPool.length > 0) {
    const total = complexPool.length;
    let cursor = 0;
    for (const b of blocks) {
      const slice = Math.min(b.vheCount || 0, total - cursor);
      for (let i = 0; i < slice; i++) {
        complexPool[cursor + i].audienceIds.push(b.id);
      }
      cursor += slice;
    }
  }

  // Subset audiences: deterministic stable picks from the complex pool.
  for (const s of subsets) {
    const picks = [...complexPool]
      .map((v) => ({ v, h: hash(v.id + ":" + s.id) }))
      .sort((a, b) => a.h - b.h)
      .slice(0, s.vheCount || 0)
      .map((x) => x.v);
    for (const v of picks) {
      v.audienceIds.push(s.id);
    }
  }

  _vheCache[groupId] = vhes;
  return vhes;
}

/* Clear the registry cache. Call sites that mutate audience metadata
 * (siblingGroups changes — not currently supported via edits) would call
 * this; for now it's exposed for tests. */
export function _clearVheCache() {
  for (const k of Object.keys(_vheCache)) delete _vheCache[k];
}

/* ─── Tenancy generation ─────────────────────────────────
 *
 * 80% of VHEs are full-year occupied by one tenant. ~15% have a mid-year
 * handover (two tenancies). ~5% are vacant for part of the year — handled
 * for prototype as "still occupied but with one shorter tenancy" so the
 * math stays clean.
 *
 * Handover dates skew toward end-of-month around the "natural" times
 * tenants move (Mar/Jun/Sep). Tenant names are picked deterministically
 * from the pool by hashing (vheId, tenancy index).
 */

const _tenancyCache = {};

function tenantNameFor(vheId, tenancyIdx, isCommercial) {
  if (isCommercial) {
    const h = hash(vheId + ":" + tenancyIdx);
    return COMMERCIAL_NAMES[h % COMMERCIAL_NAMES.length];
  }
  const h1 = hash(vheId + ":first:" + tenancyIdx);
  const h2 = hash(vheId + ":last:" + tenancyIdx);
  return `${FIRST_NAMES[h1 % FIRST_NAMES.length]} ${LAST_NAMES[h2 % LAST_NAMES.length]}`;
}

function contractCodeFor(tenancyId) {
  const h = hash(tenancyId);
  // Real-world codes look like "CTR-NNNN-MMMMM"; we approximate.
  return `CTR-${10000 + (h % 89999)}`;
}

export function getTenanciesForGroup(groupId) {
  if (_tenancyCache[groupId]) return _tenancyCache[groupId];
  const flow = getCostFlow();
  const period = flow.period || new Date().getFullYear();
  const { start, end, days: periodDays } = periodInfo(period);

  const vhes = getVhesForGroup(groupId);
  const tenancies = [];
  for (const vhe of vhes) {
    const h = hash(vhe.id + ":tenancy");
    const r = h % 100;
    if (r < 80 || vhe.isCommercial) {
      // Full-year, single tenancy
      const tid = `ten-${vhe.id}-1`;
      tenancies.push({
        id: tid,
        vheId: vhe.id,
        tenantName: tenantNameFor(vhe.id, 1, vhe.isCommercial),
        contractCode: contractCodeFor(tid),
        start: isoDate(start),
        end: isoDate(end),
        daysInPeriod: periodDays,
        coverage: "full",
      });
    } else {
      // Mid-year handover. Switch month is one of Mar, Jun, Sep with bias.
      const switchMonth = [2, 5, 8][hash(vhe.id + ":switch") % 3]; // 0-indexed
      const switchDay = 28; // end of month
      const switchDate = new Date(Date.UTC(period, switchMonth, switchDay));
      const beforeEnd = new Date(switchDate.getTime() - 86400000);
      const afterStart = switchDate;

      const beforeDays = daysBetween(start, beforeEnd);
      const afterDays = daysBetween(afterStart, end);

      const t1 = `ten-${vhe.id}-1`;
      const t2 = `ten-${vhe.id}-2`;
      tenancies.push({
        id: t1,
        vheId: vhe.id,
        tenantName: tenantNameFor(vhe.id, 1, false),
        contractCode: contractCodeFor(t1),
        start: isoDate(start),
        end: isoDate(beforeEnd),
        daysInPeriod: beforeDays,
        coverage: "partial-first",
      });
      tenancies.push({
        id: t2,
        vheId: vhe.id,
        tenantName: tenantNameFor(vhe.id, 2, false),
        contractCode: contractCodeFor(t2),
        start: isoDate(afterStart),
        end: isoDate(end),
        daysInPeriod: afterDays,
        coverage: "partial-second",
      });
    }
  }
  _tenancyCache[groupId] = tenancies;
  return tenancies;
}

export function _clearTenancyCache() {
  for (const k of Object.keys(_tenancyCache)) delete _tenancyCache[k];
}

/* ─── Calc / advance per (tenancy × settlement) ──────────
 *
 * Each settlement targets ONE audience. A VHE pays into a settlement only
 * if that audience is in vhe.audienceIds. Distribution rules:
 *
 *   per_vhe / metered_*  → share = 1 / denominator
 *   by_m2                → share = vhe.m2 / total_m2_in_audience
 *   fixed_pct            → share = pct / audienceVheCount
 *   single               → share = 1 if VHE is the recipient (first VHE in audience), else 0
 *
 * The proration factor (tenancyDays / periodDays) applies on top, so a
 * tenancy that occupied 6 months of a 12-month period gets half-share.
 */

function audienceVheCount(audienceId, allVhes) {
  let n = 0;
  for (const v of allVhes) if (v.audienceIds.includes(audienceId)) n++;
  return n;
}

function totalM2InAudience(audienceId, allVhes) {
  let s = 0;
  for (const v of allVhes) if (v.audienceIds.includes(audienceId)) s += v.m2 || 0;
  return s;
}

/* Determine whether a VHE is the "single recipient" for a settlement.
 * Convention: lowest-index VHE inside the target audience. Stable per
 * settlement because audienceIds are fixed at registry build time. */
function isSingleRecipient(vhe, settlement, allVhes) {
  if (!settlement?.groupId) return false;
  const inAudience = allVhes
    .filter((v) => v.audienceIds.includes(settlement.groupId))
    .sort((a, b) => a.index - b.index);
  return inAudience[0]?.id === vhe.id;
}

function shareOf(vhe, settlement, ctx) {
  if (!settlement?.groupId) return 0;
  if (!vhe.audienceIds.includes(settlement.groupId)) return 0;
  const dist = settlement.distribution || { method: "per_vhe" };
  switch (dist.method) {
    case "per_vhe":
    case "metered_ista":
    case "metered_internal": {
      const denom = dist.denominator || audienceVheCount(settlement.groupId, ctx.vhes) || 1;
      return 1 / denom;
    }
    case "by_m2": {
      const denom = dist.denominator || totalM2InAudience(settlement.groupId, ctx.vhes) || 1;
      return (vhe.m2 || 0) / denom;
    }
    case "fixed_pct": {
      const pct = dist.pct ?? 1;
      const n = audienceVheCount(settlement.groupId, ctx.vhes) || 1;
      return pct / n;
    }
    case "single": {
      return isSingleRecipient(vhe, settlement, ctx.vhes) ? 1 : 0;
    }
    default:
      return 0;
  }
}

/* ─── Outcome aggregation ────────────────────────────────
 *
 * For each tenancy, walk every lane and sum its contributing settlements.
 * Returns a TenancyOutcome with per-lane calc/advance/Δ and a net subtotal
 * — the row's headline number (the Excel "Saldo" subtotaal).
 */

export function getTenancyOutcomes(groupId) {
  const flow = getCostFlow();
  if (flow.group?.id !== groupId) return [];

  const vhes = getVhesForGroup(groupId);
  const tenancies = getTenanciesForGroup(groupId);
  const period = flow.period || new Date().getFullYear();
  const { days: periodDays } = periodInfo(period);

  const settlements = flow.nodes.filter(
    (n) => n.type === "settlement" && !n.outOfScope
  );
  // Index settlements by lane for O(1) lookup.
  const settlementsByLane = {};
  for (const s of settlements) {
    if (!settlementsByLane[s.laneId]) settlementsByLane[s.laneId] = [];
    settlementsByLane[s.laneId].push(s);
  }

  const ctx = { vhes };
  const vheById = {};
  for (const v of vhes) vheById[v.id] = v;

  const outcomes = [];
  for (const tenancy of tenancies) {
    const vhe = vheById[tenancy.vheId];
    if (!vhe) continue;
    const proration = (tenancy.daysInPeriod || periodDays) / periodDays;

    const byLane = {};
    let netCalc = 0;
    let netAdvance = 0;

    for (const lane of flow.lanes) {
      const lanesSettlements = settlementsByLane[lane.id] || [];
      // Sum across applicable settlements on this lane
      let calc = 0;
      let advance = 0;
      let applicable = false;
      for (const s of lanesSettlements) {
        const share = shareOf(vhe, s, ctx);
        if (share === 0) continue;
        applicable = true;
        calc += (s.amount || 0) * proration * share;
        advance += (s.advance || 0) * proration * share;
      }
      const locked = isLaneFrozen(groupId, lane.id);
      byLane[lane.id] = {
        laneId: lane.id,
        laneTitle: lane.title,
        laneCategory: lane.category,
        calcCost: calc,
        advance,
        // Convention here: delta = advance − calc (we surface this directly
        // to the user). Positive = refund to tenant, negative = collect.
        // Note this is the OPPOSITE sign from the Excel "Saldo" column,
        // which is calc − advance (negative there = refund). We picked
        // advance−calc because users read "delta" as "what's left to give
        // back / collect", matching the action-oriented label colour.
        delta: advance - calc,
        locked,
        applicable,
      };
      netCalc += calc;
      netAdvance += advance;
    }

    outcomes.push({
      vhe,
      tenancy,
      byLane,
      netCalc,
      netAdvance,
      netDelta: netAdvance - netCalc,
    });
  }
  return outcomes;
}

/* Single-tenancy lookup — used by the side panel. */
export function getTenancyOutcome(groupId, tenancyId) {
  return getTenancyOutcomes(groupId).find((o) => o.tenancy.id === tenancyId) || null;
}

/* For the slim Step 5 preview inside the lane workflow: outcomes for a
 * single lane only. The caller picks representative rows (extremes,
 * quartiles, partial-period) on top.
 *
 * `scopeAudienceId` narrows to tenancies whose VHE belongs to that audience
 * — used when the L3 sheet was opened with an audience filter active so
 * Step 5 stays consistent with Step 4's filtered settlements. */
export function getLaneTenancyOutcomes(groupId, laneId, scopeAudienceId = null) {
  return getTenancyOutcomes(groupId)
    .map((o) => ({
      vhe: o.vhe,
      tenancy: o.tenancy,
      cell: o.byLane[laneId] || null,
    }))
    .filter((r) => {
      if (!r.cell?.applicable) return false;
      if (scopeAudienceId && !r.vhe.audienceIds.includes(scopeAudienceId)) return false;
      return true;
    });
}

/* Group-level summary KPIs for the Tenants tab header. */
export function getTenantSummary(groupId) {
  const outcomes = getTenancyOutcomes(groupId);
  let collect = 0;
  let refund = 0;
  let collectCount = 0;
  let refundCount = 0;
  for (const o of outcomes) {
    if (o.netDelta > 1) {
      refund += o.netDelta;
      refundCount++;
    } else if (o.netDelta < -1) {
      collect += Math.abs(o.netDelta);
      collectCount++;
    }
  }
  return {
    tenancyCount: outcomes.length,
    collect,
    refund,
    collectCount,
    refundCount,
    balancedCount: outcomes.length - collectCount - refundCount,
  };
}

