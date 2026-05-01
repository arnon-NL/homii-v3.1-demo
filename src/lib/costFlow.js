import tulpenhof from "@/data/costFlowTulpenhof.json";
import bloemkwartier from "@/data/costFlowBloemkwartier.json";
import { getEdits } from "./costFlowEdits";

/* ─────────────────────────────────────────────────────────────
 * Cost-flow data accessors — multi-group registry (v3.1 demo)
 *
 * Demo build of homii — Zonnestraal Wonen. Two curated complexes show the
 * patterns that earn this product its keep:
 *   • Tulpenhof    — small (36 woningen), two blocks + one subset audience
 *   • Bloemkwartier — medium (56 woningen + 3 BOG), block partition,
 *                     two subset audiences (CV-aansluiting / Galerij),
 *                     separate commercial pool
 *
 * Each Group's flow lives in its own JSON. The "active" group is set
 * synchronously by the page (GroupDetailPage / CostFlowView) before
 * children render, so all helpers below can read from a single source.
 *
 * Schema per flow (unchanged):
 *   group, period, siblingGroups, lanes, nodes, edges, trustSummary.
 * ──────────────────────────────────────────────────────────── */

const REGISTRY = {
  "GRP-tulpenhof":     tulpenhof,
  "GRP-bloemkwartier": bloemkwartier,
};

const DEFAULT_GROUP_ID = "GRP-tulpenhof";
let activeGroupId = DEFAULT_GROUP_ID;

/** Set the active group. Idempotent. Falls back to the default if the
 * given groupId isn't registered. */
export function setActiveGroup(groupId) {
  if (groupId && REGISTRY[groupId]) activeGroupId = groupId;
  else activeGroupId = DEFAULT_GROUP_ID;
}

/** Internal — current flow object with user edits overlaid. The base data
 * lives in the JSON registry; user edits (per-node field overrides, plus
 * Phase-5 added/deleted nodes) sit in costFlowEdits and overlay the base on
 * every read. This means every helper below — getNodeById, summariseLane,
 * getCategoryFlowSummary, etc. — sees the merged truth without any per-call
 * wiring.
 *
 * Phase 5 layering:
 *   1. Drop base nodes that the user has tombstoned (deletedNodes).
 *   2. Apply nodeEdits to the survivors.
 *   3. Append addedNodes (also passed through nodeEdits in case the user
 *      tweaked them after adding).
 *   4. Append addedEdges, then drop any edges that touch a deleted endpoint.
 */
function active() {
  const base = REGISTRY[activeGroupId] || REGISTRY[DEFAULT_GROUP_ID];
  const edits = getEdits(activeGroupId);
  const nodeEdits = edits.nodeEdits || {};
  const addedNodes = edits.addedNodes || [];
  const addedEdges = edits.addedEdges || [];
  const deletedNodes = edits.deletedNodes || [];
  const deletedEdges = edits.deletedEdges || [];

  const noEdits =
    Object.keys(nodeEdits).length === 0 &&
    addedNodes.length === 0 &&
    addedEdges.length === 0 &&
    deletedNodes.length === 0 &&
    deletedEdges.length === 0;

  if (noEdits) return base;

  const deletedSet = new Set(deletedNodes.map((d) => d.id));
  // deletedEdges is a list of {from,to} pairs — encode as "from→to" key
  // so filtering is O(1) per edge.
  const deletedEdgeKey = new Set(
    deletedEdges.map((e) => `${e.from}→${e.to}`)
  );

  const overlay = (n) => {
    const ne = nodeEdits[n.id];
    return ne ? { ...n, ...ne } : n;
  };

  const baseSurvivors = base.nodes
    .filter((n) => !deletedSet.has(n.id))
    .map(overlay);
  const newOnes = addedNodes.map(overlay);
  const allNodes = [...baseSurvivors, ...newOnes];

  const allEdges = [...base.edges, ...addedEdges].filter(
    (e) =>
      !deletedSet.has(e.from) &&
      !deletedSet.has(e.to) &&
      !deletedEdgeKey.has(`${e.from}→${e.to}`)
  );

  // ─ Phase 7 — live adjustment math.
  //   For each lane that contains adjustment nodes, sum their (signed)
  //   amounts and apply the delta to every settlement in the same lane.
  //   For lanes with one settlement (every lane in v3.1 demo data) this
  //   means: settlement.amount = base + Σ(adjustments). For lanes with
  //   multiple settlements we distribute the delta proportionally to
  //   each settlement's existing share — preserves audience splits.
  const adjByLane = {};
  for (const n of allNodes) {
    if (n.type !== "adjustment") continue;
    if (!n.laneId) continue;
    adjByLane[n.laneId] = (adjByLane[n.laneId] || 0) + (n.amount || 0);
  }
  let nodes = allNodes;
  if (Object.keys(adjByLane).length > 0) {
    nodes = allNodes.map((n) => {
      if (n.type !== "settlement" || n.outOfScope) return n;
      const totalAdj = adjByLane[n.laneId];
      if (!totalAdj) return n;
      // Compute this settlement's share within the lane (against other
      // in-scope settlements). One-settlement lanes always get share=1.
      const peers = allNodes.filter(
        (m) =>
          m.type === "settlement" &&
          m.laneId === n.laneId &&
          !m.outOfScope
      );
      const peerSum = peers.reduce((s, m) => s + (m.amount || 0), 0);
      const share =
        peerSum !== 0 ? (n.amount || 0) / peerSum : 1 / (peers.length || 1);
      const delta = totalAdj * share;
      const newAmount = (n.amount || 0) + delta;
      // Settlement.delta in the data uses convention `delta = advance −
      // amount`; recompute here so the workflow's "te innen / te
      // restitueren" surfaces stay honest.
      const newDelta =
        n.advance != null
          ? Math.round(((n.advance || 0) - newAmount) * 100) / 100
          : null;
      return {
        ...n,
        amount: Math.round(newAmount * 100) / 100,
        ...(newDelta != null ? { delta: newDelta } : {}),
      };
    });
  }

  return {
    ...base,
    nodes,
    edges: allEdges,
  };
}

export function listGroups() {
  return Object.keys(REGISTRY);
}

export function getCostFlow() {
  return active();
}

export function getNodeById(id) {
  return active().nodes.find((n) => n.id === id) || null;
}

export function getNodesByLane(laneId) {
  return active().nodes.filter((n) => n.laneId === laneId);
}

export function getEdgesForNode(nodeId) {
  return {
    incoming: active().edges.filter((e) => e.to === nodeId),
    outgoing: active().edges.filter((e) => e.from === nodeId),
  };
}

export function getSourceNodes() {
  return active().nodes.filter((n) => n.type === "source");
}

/* Service codes carried by settlement nodes within a lane (one lane can carry
 * multiple services — the shared electricity meter feeds SV1370G + SV1372G). */
export function getLaneServiceCodes(laneId) {
  const codes = new Set();
  for (const n of active().nodes) {
    if (n.laneId === laneId && n.type === "settlement" && n.serviceCode) {
      codes.add(n.serviceCode);
    }
  }
  return [...codes];
}

/* Settlements that share a Group (used for sibling navigation in the inspector) */
export function getSettlementsByGroup(groupId, exceptId = null) {
  return active().nodes.filter(
    (n) =>
      n.type === "settlement" &&
      !n.outOfScope &&
      n.groupId === groupId &&
      n.id !== exceptId
  );
}

/*
 * Connected subgraph through nodeId — the union of:
 *   • all ancestors reachable by walking edges backwards (edge.to === current)
 *   • all descendants reachable by walking edges forwards
 *   • all edges that touch any of those nodes on either side
 *
 * Lane-aware: traversal only continues from "interior" nodes (same lane as
 * the start). Cross-lane neighbours are included as boundary leaves — they
 * appear in the subgraph so the bridge edge is visible, but BFS does not
 * spread further into other lanes. Without this guard, hovering elektra in
 * Carolina would highlight gas + water transitively via the cross-lane
 * transfer edges.
 *
 * Returned as Sets so look-ups in render are O(1).
 */
export function getConnectedSubgraph(nodeId) {
  if (!nodeId) return { nodes: new Set(), edges: new Set() };
  const flow = active();
  const startNode = flow.nodes.find((n) => n.id === nodeId);
  if (!startNode) return { nodes: new Set(), edges: new Set() };

  const edges = flow.edges;
  const nodeLane = {};
  for (const n of flow.nodes) nodeLane[n.id] = n.laneId;
  const startLane = startNode.laneId;

  const reached = new Set([nodeId]);
  const interior = new Set([nodeId]); // nodes we will traverse FROM

  // Upstream BFS — only from interior nodes
  const upQ = [nodeId];
  while (upQ.length) {
    const cur = upQ.shift();
    if (!interior.has(cur)) continue;
    for (const e of edges) {
      if (e.to === cur && !reached.has(e.from)) {
        reached.add(e.from);
        if (nodeLane[e.from] === startLane) {
          interior.add(e.from);
          upQ.push(e.from);
        }
      }
    }
  }
  // Downstream BFS — only from interior nodes
  const downQ = [nodeId];
  while (downQ.length) {
    const cur = downQ.shift();
    if (!interior.has(cur)) continue;
    for (const e of edges) {
      if (e.from === cur && !reached.has(e.to)) {
        reached.add(e.to);
        if (nodeLane[e.to] === startLane) {
          interior.add(e.to);
          downQ.push(e.to);
        }
      }
    }
  }

  // Edges where both endpoints are in `reached`
  const touchingEdges = new Set();
  edges.forEach((e, idx) => {
    if (reached.has(e.from) && reached.has(e.to)) touchingEdges.add(idx);
  });

  return { nodes: reached, edges: touchingEdges };
}

/* Subgraph for a whole lane: union of connected subgraphs of each source in the lane */
export function getLaneSubgraph(laneId) {
  const sources = active().nodes.filter(
    (n) => n.laneId === laneId && n.type === "source"
  );
  const nodes = new Set();
  const edges = new Set();
  for (const s of sources) {
    const sub = getConnectedSubgraph(s.id);
    sub.nodes.forEach((n) => nodes.add(n));
    sub.edges.forEach((e) => edges.add(e));
  }
  return { nodes, edges };
}

/*
 * Audiences = the Groups that receive cost via in-scope settlement nodes.
 * Each audience's subgraph is the union of subgraphs of all settlement nodes
 * whose groupId matches.
 */
export function getAudienceSubgraph(groupId) {
  const settlements = active().nodes.filter(
    (n) => n.type === "settlement" && !n.outOfScope && n.groupId === groupId
  );
  const nodes = new Set();
  const edges = new Set();
  for (const s of settlements) {
    const sub = getConnectedSubgraph(s.id);
    sub.nodes.forEach((n) => nodes.add(n));
    sub.edges.forEach((e) => edges.add(e));
  }
  return { nodes, edges };
}

export function getAudienceSummary(groupId) {
  const sibling = active().siblingGroups?.find((g) => g.id === groupId);
  const settlements = active().nodes.filter(
    (n) => n.type === "settlement" && !n.outOfScope && n.groupId === groupId
  );
  // We track BOTH a signed sum (`settled`, used in headlines and the rail
  // total) and a magnitude (sum of |amount|, used by the Sankey to size the
  // audience band). Categories on the left already size by magnitude. Sizing
  // audiences by |signed sum| would mismatch when the audience receives both
  // costs and refunds (Carolina residents net to a smaller absolute number
  // than the magnitude of money flowing through), causing ribbons to
  // overflow the audience band. Emitting magnitude here keeps left and
  // right balanced in every scope.
  let settled = 0;
  let magnitude = 0;
  let flagCount = 0;
  for (const s of settlements) {
    settled += s.amount || 0;
    magnitude += Math.abs(s.amount || 0);
    flagCount += (s.flags?.length || 0);
  }
  // Lanes that touch this audience (at least one settlement node lives in)
  const laneIds = new Set(settlements.map((s) => s.laneId));
  return {
    id: groupId,
    name: sibling?.name || groupId,
    kind: sibling?.kind || "adhoc",
    vheCount: sibling?.vheCount,
    active: sibling?.active || false,
    settled,
    magnitude,
    settlementCount: settlements.length,
    laneCount: laneIds.size,
    flagCount,
  };
}

export function getAllAudiences() {
  const sg = active().siblingGroups || [];
  return sg
    .map((g) => getAudienceSummary(g.id))
    .filter((s) => s.settlementCount > 0); // hide computational-only groups
}

/* Lane summary used by the left rail */
export function summariseLane(laneId) {
  const nodes = getNodesByLane(laneId);
  const sources = nodes.filter((n) => n.type === "source");
  const settlements = nodes.filter((n) => n.type === "settlement" && !n.outOfScope);

  const expected = sources.reduce((s, n) => s + (n.amount || 0), 0);
  const settled = settlements.reduce((s, n) => s + (n.amount || 0), 0);

  // Worst anchor status across all nodes in lane
  const statuses = nodes.flatMap((n) => (n.anchors || []).map((a) => a.status));
  const flagKinds = nodes.flatMap((n) => (n.flags || []).map((f) => f.kind));

  let health = "matched";
  if (statuses.includes("wrong_account") || flagKinds.includes("error")) health = "error";
  else if (statuses.includes("matched_partial") || statuses.includes("missing") || statuses.includes("duplicate") || flagKinds.includes("warning")) health = "warning";
  else if (statuses.length === 0 && nodes.some((n) => n.type === "deduction" || n.type === "addition")) health = "warning";

  const issueCount = nodes.reduce((c, n) => c + (n.flags?.length || 0), 0);

  // Net delta across in-scope settlements. Convention in the data is
  //   delta = advance − actual
  // So:
  //   + = refund   (advance was higher than actual; tenant overpaid)
  //   − = collect  (advance was lower than actual; tenant still owes)
  const deltaContributors = settlements.filter((n) => n.delta != null);
  const netDelta = deltaContributors.reduce((s, n) => s + n.delta, 0);
  const hasDelta = deltaContributors.length > 0;
  const settlementDirection = !hasDelta
    ? "none"
    : netDelta > 1
    ? "refund"
    : netDelta < -1
    ? "collect"
    : "balanced";

  // YoY % vs prior year, taken from the dominant source node (largest by amount)
  let yoyPct = null;
  const dominantSource = sources.reduce((m, s) => (!m || (s.amount || 0) > (m.amount || 0) ? s : m), null);
  if (dominantSource && dominantSource.yoyComparison && dominantSource.yoyComparison.length >= 2) {
    const sorted = [...dominantSource.yoyComparison].sort((a, b) => a.year - b.year);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (prev && prev.amount > 0) yoyPct = (last.amount - prev.amount) / prev.amount;
  }

  return {
    laneId,
    expected,
    settled,
    health,
    issueCount,
    sourceCount: sources.length,
    settlementCount: settlements.length,
    netDelta: hasDelta ? netDelta : null,
    settlementDirection,
    yoyPct,
  };
}

/* Anchor status → semantic colour bucket */
export function anchorStatusBucket(status) {
  switch (status) {
    case "matched":         return "ok";
    case "matched_partial": return "warn";
    case "wrong_account":   return "error";
    case "duplicate":       return "warn";
    case "missing":         return "error";
    case "none":
    default:                return "neutral";
  }
}

/* ────────────────────────────────────────────────────────────
 * Category-level rollup — for the progressive "L1" cost-flow view.
 *
 * Each lane has a category (energy, cleaning, management, other, …).
 * The summary aggregates lane-level numbers into category bands AND
 * records, for each category, how its settled euros distribute across
 * audiences (used to draw ribbons in the sankey).
 *
 * Both sides of the flow use SETTLED amounts (the in-scope settlement
 * total) so that left and right balance — categories' settled total
 * equals audiences' settled total by construction.
 * ──────────────────────────────────────────────────────────── */
export function getCategoryFlowSummary({ scopeAudienceId = null } = {}) {
  const flow = active();
  const map = {};

  for (const lane of flow.lanes) {
    const cat = lane.category || "other";

    // Per-lane in-scope settlements. When `scopeAudienceId` is set, we narrow
    // to settlements that go to that audience — categories with no settlements
    // matching the scope are dropped from the result.
    const settlements = flow.nodes.filter(
      (n) =>
        n.laneId === lane.id &&
        n.type === "settlement" &&
        !n.outOfScope &&
        (!scopeAudienceId || n.groupId === scopeAudienceId)
    );
    if (scopeAudienceId && settlements.length === 0) continue;

    const summary = summariseLane(lane.id);

    // When scoped, the lane's "amount" reflects only the slice going to the
    // scoped audience (so category bands sum correctly to the audience total).
    // Source amount, health and flag count remain lane-wide — narrowing those
    // would lie about the lane's own truth.
    const scopedAmount = scopeAudienceId
      ? settlements.reduce((s, n) => s + (n.amount || 0), 0)
      : summary.settled;

    // Magnitude — sum of |amount| per settlement. Used for Sankey band sizing
    // so a refunded settlement (negative amount) still contributes to "money
    // moved" rather than cancelling out the rest of the category visually.
    // Carolina's settle-elektra-res = -€155k is the motivating case: it
    // belongs in the energy band's *size* even though it shows as a refund.
    const scopedMagnitude = settlements.reduce(
      (s, n) => s + Math.abs(n.amount || 0),
      0
    );

    if (!map[cat]) {
      map[cat] = {
        id: cat,
        amount: 0,        // signed — drives labels
        magnitude: 0,     // abs sum — drives band heights / ribbon widths
        sourceAmount: 0,
        lanes: [],
        audiences: {},
        flagCount: 0,
        netDelta: 0,
        hasDelta: false,
        worstHealth: "matched",
      };
    }

    map[cat].amount += scopedAmount;
    map[cat].magnitude += scopedMagnitude;
    map[cat].sourceAmount += summary.expected;
    map[cat].flagCount += summary.issueCount;
    if (summary.netDelta != null) {
      map[cat].netDelta += summary.netDelta;
      map[cat].hasDelta = true;
    }
    const rank = { matched: 0, warning: 1, error: 2 };
    if (rank[summary.health] > rank[map[cat].worstHealth]) {
      map[cat].worstHealth = summary.health;
    }

    // Per-lane settlement → audience map for L2 ribbon sizing. We store the
    // ABS magnitude per audience so a refund-driven negative settlement
    // still sizes its ribbon by money-moved, not signed-residual.
    const laneAudiences = {};
    for (const s of settlements) {
      const audId = s.groupId;
      if (!audId) continue;
      const m = Math.abs(s.amount || 0);
      laneAudiences[audId] = (laneAudiences[audId] || 0) + m;
      map[cat].audiences[audId] = (map[cat].audiences[audId] || 0) + m;
    }

    // Skip empty lanes (nothing settled to anyone in scope) — they'd show
    // as noise in the L2 expansion. Carolina's lane-elektrapp (€0) is the
    // motivating example.
    if (scopedMagnitude > 0) {
      map[cat].lanes.push({
        laneId: lane.id,
        title: lane.title,
        category: cat,
        complexity: lane.complexity,
        amount: scopedAmount,
        magnitude: scopedMagnitude,
        sourceAmount: summary.expected,
        health: summary.health,
        issueCount: summary.issueCount,
        netDelta: summary.netDelta,
        audiences: laneAudiences,
      });
    }
  }

  // Sort by magnitude (so a category that's mostly a refund still ranks by
  // size of money moved, not the small signed residual).
  const out = Object.values(map).sort((a, b) => b.magnitude - a.magnitude);
  for (const cat of out) cat.lanes.sort((a, b) => b.magnitude - a.magnitude);
  return out;
}

/* Cross-lane neighbours of a node — the edges whose other endpoint lives in a
 * different lane. Used by the inspector to surface "← From X" / "→ To Y"
 * jumping affordances. Returns nodes/lanes deduped per neighbour-lane. */
export function getCrossLaneNeighbors(nodeId) {
  const flow = active();
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return { incoming: [], outgoing: [] };

  const incoming = [];
  const outgoing = [];
  const seenIn = new Set();
  const seenOut = new Set();

  for (const edge of flow.edges) {
    if (edge.to === nodeId) {
      const fromNode = flow.nodes.find((n) => n.id === edge.from);
      if (!fromNode) continue;
      if (fromNode.laneId === node.laneId) continue;
      if (seenIn.has(fromNode.laneId)) {
        // Aggregate amounts when multiple edges come from the same other lane
        const existing = incoming.find((c) => c.lane.id === fromNode.laneId);
        if (existing) existing.amount += edge.amount || 0;
        continue;
      }
      const lane = flow.lanes.find((l) => l.id === fromNode.laneId);
      incoming.push({ node: fromNode, lane, amount: edge.amount || 0 });
      seenIn.add(fromNode.laneId);
    }
    if (edge.from === nodeId) {
      const toNode = flow.nodes.find((n) => n.id === edge.to);
      if (!toNode) continue;
      if (toNode.laneId === node.laneId) continue;
      if (seenOut.has(toNode.laneId)) {
        const existing = outgoing.find((c) => c.lane.id === toNode.laneId);
        if (existing) existing.amount += edge.amount || 0;
        continue;
      }
      const lane = flow.lanes.find((l) => l.id === toNode.laneId);
      outgoing.push({ node: toNode, lane, amount: edge.amount || 0 });
      seenOut.add(toNode.laneId);
    }
  }
  return { incoming, outgoing };
}

/* A lane's "focal subgraph" for the L3 sheet — the lane's nodes plus any
 * cross-lane neighbours connected through edges (e.g. Carolina's
 * passthrough-elektra-to-gas → addition-gas-from-elektra pair). Returns a
 * narrowed flow object that can be fed directly to the existing Canvas. */
export function getSingleLaneFlow(laneId) {
  const flow = active();
  const sub = getLaneSubgraph(laneId);

  const nodes = flow.nodes.filter((n) => sub.nodes.has(n.id));
  const edges = flow.edges.filter((_, idx) => sub.edges.has(idx));

  const laneIds = new Set(nodes.map((n) => n.laneId));
  const lanes = flow.lanes.filter((l) => laneIds.has(l.id));

  return {
    ...flow,
    lanes,
    nodes,
    edges,
  };
}

/* Trust meter computation across the whole flow */
export function computeTrust() {
  const ts = active().trustSummary;
  const reconciledPct = ts.totalAnchored / ts.totalExpected;
  return {
    ...ts,
    reconciledPct,
    formattedPct: Math.round(reconciledPct * 100),
  };
}

/* Format helpers */
export const fmtEur = (v) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export const fmtEur2 = (v) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export const fmtPct = (v) =>
  new Intl.NumberFormat("nl-NL", { style: "percent", maximumFractionDigits: 0 }).format(v);

export const fmtSignedEur = (v) => {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return sign + fmtEur(v);
};
