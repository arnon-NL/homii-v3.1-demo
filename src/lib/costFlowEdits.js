/* Cost-flow edits store — Phase 4 + Phase 5.
 *
 * The base data lives in the JSON registry (read-only). The user's edits sit
 * on top, persisted to localStorage, and overlay the base whenever
 * `active()` is called in costFlow.js. This keeps the canvas, inspector,
 * workflow page and bookkeeping tab all reading the same merged state
 * without having to thread edits through every component manually.
 *
 * Shape per group:
 *   {
 *     nodeEdits:    { [nodeId]: { [field]: value } },
 *     frozenLanes:  string[]                          (lane ids)
 *     addedNodes:   Node[]                            (Phase 5 — new sources)
 *     addedEdges:   Edge[]                            (Phase 5 — wiring for added)
 *     deletedNodes: { id, laneId }[]                  (Phase 5 — soft delete)
 *   }
 *
 * Phase 5 conventions:
 * - addedNodes are full node objects (so `active()` can append them straight
 *   into flow.nodes after applying nodeEdits).
 * - deletedNodes track laneId alongside id so "discard lane edits" can
 *   restore them without needing to reach back into the base flow.
 * - Editing an added node still uses nodeEdits[id]; we apply the same
 *   overlay to both base and added so the edit path is uniform.
 *
 * React reactivity is handled by a small subscribe pattern — `useEditsVersion`
 * returns a version number that ticks every time the store changes. Mount it
 * at the top of any component that depends on the merged data; the component
 * re-renders on each tick.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "homii.costFlow.edits.v1";

let store = {};
let version = 0;
const subscribers = new Set();

function load() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) store = JSON.parse(raw);
  } catch {
    store = {};
  }
}
load();

function persist() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function notify() {
  version++;
  for (const fn of subscribers) {
    try {
      fn(version);
    } catch {
      // ignore
    }
  }
}

function ensureGroup(groupId) {
  if (!store[groupId]) {
    store[groupId] = {
      nodeEdits: {},
      frozenLanes: [],
      addedNodes: [],
      addedEdges: [],
      deletedNodes: [],
      deletedEdges: [],
    };
  }
  if (!store[groupId].nodeEdits) store[groupId].nodeEdits = {};
  if (!Array.isArray(store[groupId].frozenLanes)) store[groupId].frozenLanes = [];
  if (!Array.isArray(store[groupId].addedNodes)) store[groupId].addedNodes = [];
  if (!Array.isArray(store[groupId].addedEdges)) store[groupId].addedEdges = [];
  if (!Array.isArray(store[groupId].deletedNodes)) store[groupId].deletedNodes = [];
  if (!Array.isArray(store[groupId].deletedEdges)) store[groupId].deletedEdges = [];
}

const EMPTY_EDITS = Object.freeze({
  nodeEdits: {},
  frozenLanes: [],
  addedNodes: [],
  addedEdges: [],
  deletedNodes: [],
  deletedEdges: [],
});

/* ─── Read API ───────────────────────────────────────────── */

export function getEdits(groupId) {
  return store[groupId] || EMPTY_EDITS;
}

export function getNodeEdits(groupId, nodeId) {
  return store[groupId]?.nodeEdits?.[nodeId] || null;
}

export function isLaneFrozen(groupId, laneId) {
  return !!store[groupId]?.frozenLanes?.includes(laneId);
}

export function hasEditsForGroup(groupId) {
  const e = store[groupId];
  if (!e) return false;
  return (
    Object.keys(e.nodeEdits || {}).length > 0 ||
    (e.frozenLanes || []).length > 0 ||
    (e.addedNodes || []).length > 0 ||
    (e.deletedNodes || []).length > 0
  );
}

export function hasEditsForLane(groupId, laneNodes, laneId = null) {
  const e = store[groupId];
  if (!e) return false;
  for (const n of laneNodes || []) {
    if (e.nodeEdits?.[n.id] && Object.keys(e.nodeEdits[n.id]).length > 0) {
      return true;
    }
  }
  if (laneId) {
    if ((e.addedNodes || []).some((n) => n.laneId === laneId)) return true;
    if ((e.deletedNodes || []).some((d) => d.laneId === laneId)) return true;
  }
  return false;
}

export function isNodeDeleted(groupId, nodeId) {
  return !!store[groupId]?.deletedNodes?.some((d) => d.id === nodeId);
}

export function getAddedNodes(groupId, laneId = null) {
  const list = store[groupId]?.addedNodes || [];
  return laneId ? list.filter((n) => n.laneId === laneId) : list;
}

/* ─── Write API ──────────────────────────────────────────── */

export function setNodeField(groupId, nodeId, field, value) {
  ensureGroup(groupId);
  const ne = store[groupId].nodeEdits;
  ne[nodeId] = ne[nodeId] || {};
  ne[nodeId][field] = value;
  persist();
  notify();
}

/* Edit a settlement's advance and atomically recompute its delta.
 * The data convention is `delta = advance − actual`, so changing advance
 * has to ripple to delta in the same write. */
export function setSettlementAdvance(groupId, nodeId, newAdvance, currentAmount) {
  ensureGroup(groupId);
  const ne = store[groupId].nodeEdits;
  ne[nodeId] = ne[nodeId] || {};
  ne[nodeId].advance = newAdvance;
  ne[nodeId].delta =
    Math.round((newAdvance - (currentAmount || 0)) * 100) / 100;
  persist();
  notify();
}

export function clearNodeField(groupId, nodeId, field) {
  if (!store[groupId]?.nodeEdits?.[nodeId]) return;
  delete store[groupId].nodeEdits[nodeId][field];
  if (Object.keys(store[groupId].nodeEdits[nodeId]).length === 0) {
    delete store[groupId].nodeEdits[nodeId];
  }
  persist();
  notify();
}

/* Discard every kind of edit a single lane has accumulated:
 *   • nodeEdits keyed to lane nodes
 *   • added cost-source nodes (and their wiring edges)
 *   • soft-deletions of base nodes
 * `laneNodes` is the lane's currently-rendered nodes (already excluding
 * deletions); `laneId` lets us reach addedNodes / deletedNodes which
 * carry the laneId tag. */
export function clearLaneEdits(groupId, laneNodes, laneId = null) {
  const e = store[groupId];
  if (!e) return;

  if (e.nodeEdits) {
    for (const n of laneNodes || []) {
      delete e.nodeEdits[n.id];
    }
  }

  if (laneId) {
    const removedAddedIds = new Set(
      (e.addedNodes || [])
        .filter((n) => n.laneId === laneId)
        .map((n) => n.id)
    );
    if (removedAddedIds.size > 0) {
      e.addedNodes = (e.addedNodes || []).filter(
        (n) => !removedAddedIds.has(n.id)
      );
      e.addedEdges = (e.addedEdges || []).filter(
        (ed) => !removedAddedIds.has(ed.from) && !removedAddedIds.has(ed.to)
      );
      // Removed-added nodes also lose their nodeEdits entries.
      for (const id of removedAddedIds) {
        if (e.nodeEdits) delete e.nodeEdits[id];
      }
    }
    e.deletedNodes = (e.deletedNodes || []).filter((d) => d.laneId !== laneId);
  }

  persist();
  notify();
}

export function freezeLane(groupId, laneId) {
  ensureGroup(groupId);
  if (!store[groupId].frozenLanes.includes(laneId)) {
    store[groupId].frozenLanes.push(laneId);
    persist();
    notify();
  }
}

export function unfreezeLane(groupId, laneId) {
  if (!store[groupId]?.frozenLanes) return;
  store[groupId].frozenLanes = store[groupId].frozenLanes.filter(
    (id) => id !== laneId
  );
  persist();
  notify();
}

export function resetAll() {
  store = {};
  persist();
  notify();
}

/* ─── Phase 5 — add / delete cost sources ────────────────────
 *
 * addCostSource creates a new "source" node in the lane and (if the caller
 * provides a downstreamTargetId) wires it to an existing downstream node so
 * the new supplier participates in the Sankey + canvas. The caller is
 * responsible for finding a sensible target — typically the first outgoing
 * neighbour of any existing source in the same lane.
 *
 * We keep the wiring optional because some lanes might not have any source
 * yet, in which case the row still appears in the workflow page (which is
 * driven by node.laneId, not edges).
 *
 * deleteNode is soft: base-data nodes are tagged in deletedNodes so
 * `active()` filters them out; nodes the user added in this session are
 * removed from addedNodes outright (no need for a tombstone). Either way,
 * any lingering nodeEdits for that id are cleared.
 */

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

export function addCostSource(
  groupId,
  laneId,
  {
    downstreamTargetId = null,
    supplier = "New supplier",
    sourceKind = "contracted",
    col = 0,
    row = 0,
  } = {}
) {
  ensureGroup(groupId);
  const id = `added-src-${shortId()}`;
  const node = {
    id,
    type: "source",
    laneId,
    // col/row are required by the canvas layout (nodePosition reads them);
    // omitting them silently piles every new source at col 0, row 0.
    col,
    row,
    supplier,
    sourceKind,
    amount: 0,
    budgetedAmount: 0,
    yoyComparison: [],
    anchors: [],
    flags: [],
    evidenceCount: 0,
    addedByUser: true,
  };
  store[groupId].addedNodes.push(node);
  if (downstreamTargetId) {
    store[groupId].addedEdges.push({
      from: id,
      to: downstreamTargetId,
      amount: 0,
      addedByUser: true,
    });
  }
  persist();
  notify();
  return id;
}

export function deleteNode(groupId, nodeId, laneId = null) {
  ensureGroup(groupId);

  // If it's an added node, drop it (and any of its added edges) entirely.
  const wasAdded = store[groupId].addedNodes.some((n) => n.id === nodeId);
  if (wasAdded) {
    store[groupId].addedNodes = store[groupId].addedNodes.filter(
      (n) => n.id !== nodeId
    );
    store[groupId].addedEdges = store[groupId].addedEdges.filter(
      (e) => e.from !== nodeId && e.to !== nodeId
    );
  } else {
    // Tombstone for base nodes, idempotent.
    if (!store[groupId].deletedNodes.some((d) => d.id === nodeId)) {
      store[groupId].deletedNodes.push({ id: nodeId, laneId });
    }
  }

  // Stale field edits on a deleted/added-then-removed node are noise.
  if (store[groupId].nodeEdits?.[nodeId]) {
    delete store[groupId].nodeEdits[nodeId];
  }

  persist();
  notify();
}

export function restoreNode(groupId, nodeId) {
  if (!store[groupId]?.deletedNodes) return;
  store[groupId].deletedNodes = store[groupId].deletedNodes.filter(
    (d) => d.id !== nodeId
  );
  persist();
  notify();
}

/* ─── Phase 7 — live adjustments on edges ───────────────────
 *
 * insertAdjustmentOnEdge takes an existing edge (from→to) and:
 *   1. Creates a new "adjustment" node sitting between the two endpoints
 *      with a signed amount + reason text. Sign is encoded in the amount
 *      itself (positive = addition, negative = subtraction) — same
 *      convention as settlements.
 *   2. Tombstones the original edge via deletedEdges.
 *   3. Adds two new edges: from→adjustment and adjustment→to.
 *
 * Math semantics live in costFlow.js's active(): every adjustment in a
 * lane modifies the lane's settlement amount(s) by its signed amount, so
 * settlements derive base.amount + Σ(adjustments). This makes corrections
 * propagate into the Settle workflow's step 4, the Tenants tab cells, and
 * the per-tenant detail sheet via the existing useEditsVersion hook.
 *
 * The (col, row) of the new node is computed as a placement between the
 * source and target — exact placement is the caller's job (it has access
 * to the canvas layout). We default to {col: from.col + 1, row: from.row}
 * if positions aren't supplied; the caller in Canvas computes a sensible
 * slot from the edge geometry.
 */
export function insertAdjustmentOnEdge(
  groupId,
  fromNodeId,
  toNodeId,
  laneId,
  {
    amount = 0,
    reason = "Handmatige correctie",
    col = 0,
    row = 0,
  } = {}
) {
  ensureGroup(groupId);
  const id = `added-adj-${shortId()}`;
  const node = {
    id,
    type: "adjustment",
    laneId,
    col,
    row,
    label: reason,
    // Sign carried by amount: + = addition, − = subtraction.
    amount,
    addedByUser: true,
  };
  store[groupId].addedNodes.push(node);
  store[groupId].deletedEdges.push({ from: fromNodeId, to: toNodeId });
  store[groupId].addedEdges.push({
    from: fromNodeId,
    to: id,
    amount: 0,
    addedByUser: true,
  });
  store[groupId].addedEdges.push({
    from: id,
    to: toNodeId,
    amount: 0,
    addedByUser: true,
  });
  persist();
  notify();
  return id;
}

/* ─── React reactivity ──────────────────────────────────── */

export function useEditsVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    const fn = (n) => setV(n);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);
  return v;
}
