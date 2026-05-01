import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Layers,
  Calendar,
  Eye,
  EyeOff,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Zap,
  Flame,
  Sparkles,
  HardHat,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Split,
  Users,
  CircleDot,
  Link2,
  ChevronRight,
  Gauge,
  FlaskConical,
  Search,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Check,
  Focus,
  Receipt,
  Repeat,
  Droplets,
  HelpCircle,
  MoreHorizontal,
  Settings2,
  Divide,
  Percent,
  Square,
  User,
  Lock,
  Pencil,
  PlusCircle,
  Unlock,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { useLang } from "@/lib/i18n";
import {
  getCostFlow,
  getNodeById,
  getEdgesForNode,
  getSettlementsByGroup,
  getConnectedSubgraph,
  getLaneSubgraph,
  getAudienceSubgraph,
  getAllAudiences,
  getLaneServiceCodes,
  getSingleLaneFlow,
  getCrossLaneNeighbors,
  summariseLane,
  anchorStatusBucket,
  computeTrust,
  fmtEur,
  fmtEur2,
  fmtSignedEur,
} from "@/lib/costFlow";
import CategoryFlowView from "./CategoryFlowView";
import LaneWorkflowView from "./LaneWorkflowView";
import {
  useEditsVersion,
  isLaneFrozen,
  setNodeField,
  deleteNode as deleteNodeAction,
  insertAdjustmentOnEdge,
} from "@/lib/costFlowEdits";

/* ── Layout constants ── */
// Edge length between adjacent column cards is COL_WIDTH − (src_w + dst_w)/2
// (with src_w=208, settle_w=220 that's COL_WIDTH − 214). The on-arrow
// distribution chip's worst case is "÷ 605 VHE" ≈ 83 px; with 8 px breathing
// on each side it needs 99 px edge. 330 → 116 px edge, ~33 px of margin.
const COL_WIDTH = 330;
const ROW_HEIGHT = 96;
const LANE_TITLE_HEIGHT = 32;
const LANE_PADDING_TOP = 8;
const LANE_PADDING_BOTTOM = 16;
const CANVAS_LEFT_PAD = 16;

/* Per-type node geometry. Sources and settlements are full-size cards;
 * splits are operator-sized; passthroughs are tiny in-line markers;
 * deductions and additions are slim chips. */
const NODE_SIZES = {
  source:      { w: 208, h: 84 },
  settlement:  { w: 220, h: 84 },
  split:       { w: 164, h: 60 },
  // The current taxonomy uses "adjustment" + "marker"; the older "deduction"
  // / "addition" / "passthrough" entries stay as fallbacks for legacy data.
  adjustment:  { w: 200, h: 56 },
  marker:      { w: 152, h: 32 },
  deduction:   { w: 184, h: 48 },
  addition:    { w: 184, h: 48 },
  passthrough: { w: 152, h: 24 },
};
function nodeSize(type) {
  return NODE_SIZES[type] || { w: 188, h: 64 };
}

/* Category icons (neutral palette — type differentiated by glyph only) */
const categoryIcon = {
  energy: Zap,
  cleaning: Sparkles,
  management: HardHat,
  other: FileText,
};

/* Node type → glyph. The five canonical operations are:
 *   source     — money originates here
 *   split      — money is divided by a rule
 *   adjustment — money is modified up or down (sign carried by amount)
 *   marker     — money is labelled at a checkpoint, no transformation
 *   settlement — money becomes a bill on someone's account */
const typeIconStatic = {
  source: CircleDot,
  split: Split,
  marker: CircleDot,
  settlement: Users,
};

/* Sign-aware icon resolver — adjustment picks Plus or Minus based on amount. */
function getTypeIcon(node) {
  if (!node) return CircleDot;
  if (node.type === "adjustment") {
    return (node.amount || 0) >= 0 ? Plus : Minus;
  }
  return typeIconStatic[node.type] || CircleDot;
}

/* Health → text */
const healthBadge = {
  matched: { dot: "bg-slate-300", label: "Reconciled" },
  warning: { dot: "bg-amber-500", label: "Has warnings" },
  error: { dot: "bg-red-500", label: "Has errors" },
};

/* ─── Distribution method ────────────────────────────────────
 * The rule that turns "this cost exists" into "this is your share."
 * Always rendered on the settlement card so the basis isn't implicit.
 *
 *   per_vhe         flat divide across VHE count
 *   metered_ista    Ista handles per-unit allocation by measured consumption
 *   metered_internal we have meter readings; allocation is by measured units
 *   by_m2           by surface area
 *   fixed_pct       a negotiated percentage
 *   single          one recipient (BOG named tenant, insurance line, etc.)
 *
 * `tone: "info"` (sky) only for metered methods — they're operationally
 * different ("no further reconciliation needed at our end"). Everything
 * else is neutral slate. */
const distributionConfig = {
  per_vhe: {
    Icon: Divide,
    // For icon-paired use (settlement card chip): the Divide icon already
    // carries the "÷" cue, so we don't repeat it in the text.
    short: (d) => `${d.denominator} ${d.unit || "VHE"}`,
    // For text-only use (SVG edge chip): explicit "÷ N VHE" since there's no icon.
    inline: (d) => `÷ ${d.denominator} ${d.unit || "VHE"}`,
    long: (d) =>
      `Distributed evenly across ${d.denominator} ${d.unit || "VHE"}`,
    tone: "neutral",
  },
  metered_ista: {
    Icon: Gauge,
    short: () => "Metered (Ista)",
    inline: () => "Metered",
    long: () =>
      "Per-unit allocation by Ista based on heat-cost meters — no further reconciliation on our side",
    tone: "info",
  },
  metered_internal: {
    Icon: Gauge,
    short: () => "Metered",
    inline: () => "Metered",
    long: () => "Allocated by measured consumption",
    tone: "info",
  },
  by_m2: {
    Icon: Square,
    short: (d) => (d.denominator ? `${d.denominator} m²` : "m²"),
    inline: (d) => (d.denominator ? `÷ ${d.denominator} m²` : "by m²"),
    long: (d) =>
      `Distributed by surface area${
        d.denominator ? ` across ${d.denominator} m²` : ""
      }`,
    tone: "neutral",
  },
  fixed_pct: {
    Icon: Percent,
    short: (d) => (d.pct != null ? `${Math.round(d.pct * 100)}` : "Fixed"),
    inline: (d) => (d.pct != null ? `${Math.round(d.pct * 100)}%` : "Fixed %"),
    long: () => "Negotiated fixed percentage",
    tone: "neutral",
  },
  single: {
    Icon: User,
    short: () => "Direct",
    inline: () => "Direct",
    long: (d) => d.note || "Single recipient",
    tone: "neutral",
  },
};

/* Resolve a settlement's distribution config; returns null if absent (older
 * data without a backfilled distribution still renders without error). */
function resolveDistribution(node) {
  if (!node?.distribution) return null;
  const cfg = distributionConfig[node.distribution.method];
  if (!cfg) return null;
  return {
    cfg,
    short: cfg.short(node.distribution),
    inline: cfg.inline(node.distribution),
    long: cfg.long(node.distribution),
    Icon: cfg.Icon,
    tone: cfg.tone,
  };
}

/* Quiet property line rendering the distribution method on a settlement
 * card — Notion-property style, not a UI chip. No border, no background,
 * subtle icon + text; sky tint for metered methods (the only category that
 * carries operational meaning beyond audience pill). */
function DistributionChip({ node }) {
  const r = resolveDistribution(node);
  if (!r) return null;
  const Icon = r.Icon;
  const tone = r.tone === "info" ? "text-sky-700" : "text-slate-500";
  return (
    <div
      className={`flex items-center gap-1 text-[10px] leading-none ${tone} max-w-full`}
      title={r.long}
    >
      <Icon size={9} strokeWidth={2} className="shrink-0 opacity-80" />
      <span className="truncate">{r.short}</span>
    </div>
  );
}

const COLLAPSED_LANE_HEIGHT = 32;

/* Compute lane geometry. collapsedLaneIds (optional Set) marks lanes that
 * should render as a thin strip; all other lanes are full height. */
function buildLaneLayout(flow, collapsedLaneIds = null) {
  const layout = {};
  let y = 0;
  for (const lane of flow.lanes) {
    const nodes = flow.nodes.filter((n) => n.laneId === lane.id);
    const maxRow = nodes.reduce((m, n) => Math.max(m, n.row || 0), 0);
    const rowsCount = maxRow + 1;
    const isCollapsed =
      collapsedLaneIds != null && collapsedLaneIds.has(lane.id);
    const height = isCollapsed
      ? COLLAPSED_LANE_HEIGHT
      : LANE_TITLE_HEIGHT + LANE_PADDING_TOP + rowsCount * ROW_HEIGHT + LANE_PADDING_BOTTOM;
    layout[lane.id] = { y, height, rowsCount, isCollapsed };
    y += height;
  }
  return { lanes: layout, totalHeight: y };
}

function nodePosition(node, laneLayout) {
  const lane = laneLayout.lanes[node.laneId];
  const { w, h } = nodeSize(node.type);
  // Slot left + center horizontally within slot column
  const slotLeft = CANVAS_LEFT_PAD + node.col * COL_WIDTH;
  const slotInnerWidth = COL_WIDTH - 12;
  const x = slotLeft + (slotInnerWidth - w) / 2;
  // Slot top + center vertically within row
  const slotTop = lane.y + LANE_TITLE_HEIGHT + LANE_PADDING_TOP + (node.row || 0) * ROW_HEIGHT;
  const y = slotTop + (ROW_HEIGHT - h) / 2;
  return { x, y, width: w, height: h };
}

/* ──────────────────────────────────────────────────────────── */
/* Header strip                                                 */
/* ──────────────────────────────────────────────────────────── */
function ViewOptionsMenu({
  overlay,
  setOverlay,
  focusMode,
  setFocusMode,
  focusActive,
  showEdgeLabels,
  setShowEdgeLabels,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const Toggle = ({ checked, onChange, disabled, label, hint }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"
      }`}
    >
      <span
        className={`mt-0.5 w-7 h-4 rounded-full p-0.5 transition-colors shrink-0 ${
          checked ? "bg-slate-900" : "bg-slate-200"
        }`}
      >
        <span
          className={`block w-3 h-3 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-slate-800 font-medium leading-tight">{label}</span>
        {hint && <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">{hint}</span>}
      </span>
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium transition-colors ${
          open ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Settings2 size={12} />
        View
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 rounded-lg border border-slate-200 bg-white shadow-md z-30 py-1.5">
          <Toggle
            checked={overlay}
            onChange={setOverlay}
            label="Bookkeeping overlay"
            hint="Show ledger anchor pills under each node"
          />
          <Toggle
            checked={focusMode}
            onChange={setFocusMode}
            disabled={!focusActive}
            label="Focus on selected"
            hint={focusActive ? "Hide non-connected lanes" : "Select a node, lane, or audience first"}
          />
          <div className="h-px bg-slate-100 my-1 mx-2" />
          <Toggle
            checked={showEdgeLabels}
            onChange={setShowEdgeLabels}
            label="Always show edge labels"
            hint="Default: shown only on hover"
          />
        </div>
      )}
    </div>
  );
}

/* Tiny tile used in the toolbar */
function ToolbarTile({ label, value, sub, accent }) {
  const accentValue = {
    amber:   "text-amber-800",
    emerald: "text-emerald-800",
    red:     "text-red-700",
    slate:   "text-slate-800",
  }[accent || "slate"];
  const borderClass = {
    amber:   "border-amber-200 bg-amber-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    red:     "border-red-200 bg-red-50/40",
    slate:   "border-slate-200 bg-white",
  }[accent || "slate"];
  return (
    <div className={`rounded-md border px-2 py-1 min-w-[84px] ${borderClass}`}>
      <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold leading-none">
        {label}
      </div>
      <div className={`text-[13px] font-semibold tabular-nums leading-tight mt-0.5 ${accentValue}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] text-slate-500 leading-tight">{sub}</div>
      )}
    </div>
  );
}

const TOOLBAR_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "issues", label: "Issues" },
  { value: "settle", label: "To settle" },
];

function Header({
  flow,
  overlay, setOverlay,
  focusMode, setFocusMode,
  focusActive,
  showEdgeLabels, setShowEdgeLabels,
  onOpenHelp,
  onBack,
  compact = false,
}) {

  // Standalone (legacy /:orgId/cost-flow route) — keeps the identity bar
  if (!compact) {
    return (
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 mb-2"
            >
              <ArrowLeft size={12} /> Buildings
            </button>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold text-slate-900">
                {flow.group.name}
              </h1>
              <span className="text-xs text-slate-400">
                {flow.group.city} · {flow.group.vheCount} VHE · merged from{" "}
                {flow.group.sourceComplexes.map((c) => `cpl ${c}`).join(" + ")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600">
              <Calendar size={12} className="text-slate-400" />
              Period {flow.period}
            </div>
            <button
              onClick={onOpenHelp}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              title="How to read this"
            >
              <HelpCircle size={14} />
            </button>
            <ViewOptionsMenu
              overlay={overlay}
              setOverlay={setOverlay}
              focusMode={focusMode}
              setFocusMode={setFocusMode}
              focusActive={focusActive}
              showEdgeLabels={showEdgeLabels}
              setShowEdgeLabels={setShowEdgeLabels}
            />
          </div>
        </div>
      </div>
    );
  }

  // Compact (in-tab) — no toolbar. Help + View options live in the
  // audiences band's right edge (see CostFlowView).
  return null;
}

/* ──────────────────────────────────────────────────────────── */
/* Audiences band                                              */
/* ──────────────────────────────────────────────────────────── */

const AUDIENCE_KIND = {
  complex:    { label: "Complex",    stripe: "bg-slate-700",  badge: "text-slate-700 bg-slate-100 border-slate-200" },
  block:      { label: "Block",      stripe: "bg-slate-500",  badge: "text-slate-700 bg-slate-100 border-slate-200" },
  commercial: { label: "BOG",        stripe: "bg-amber-500",  badge: "text-amber-800 bg-amber-50 border-amber-200" },
  subgroup:   { label: "Subgroup",   stripe: "bg-slate-400",  badge: "text-slate-700 bg-slate-50 border-slate-200" },
  external:   { label: "External",   stripe: "bg-slate-300",  badge: "text-slate-500 bg-slate-50 border-slate-200" },
};

function AudienceCard({ audience, isSelected, isHovered, onClick, onHoverEnter, onHoverLeave }) {
  const cfg = AUDIENCE_KIND[audience.kind] || AUDIENCE_KIND.subgroup;

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className={`relative shrink-0 flex items-stretch rounded-lg border bg-white text-left transition-all ${
        isSelected
          ? "border-slate-900 shadow-sm ring-1 ring-slate-900"
          : isHovered
          ? "border-slate-400"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Identity stripe */}
      <span className={`w-1 rounded-l-lg ${cfg.stripe}`} aria-hidden />

      <div className="px-3 py-2 min-w-[180px]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`inline-flex items-center px-1.5 h-4 rounded text-[9px] uppercase tracking-widest font-semibold border ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-slate-400 tabular-nums">
            {audience.vheCount} VHE
          </span>
        </div>
        <div className="text-[12px] text-slate-800 truncate font-medium leading-tight">
          {audience.name}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <span className="text-slate-500 tabular-nums">{fmtEur(audience.settled)}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">
            {audience.settlementCount} {audience.settlementCount === 1 ? "service" : "services"}
          </span>
          {audience.flagCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-amber-700 font-semibold">{audience.flagCount} flag{audience.flagCount === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function AudiencesBand({ selectedGroupId, setSelectedGroupId, setHoveredGroupId, hoveredGroupId, rightActions }) {
  const audiences = useMemo(() => getAllAudiences(), []);

  return (
    <div className="border-b border-slate-200 bg-slate-50/40 px-6 py-2.5">
      <div className="flex items-center gap-3">
        <div className="shrink-0 flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Audiences
          </span>
          <span className="text-[10px] text-slate-400">
            who pays this cost
          </span>
        </div>
        <div className="flex items-stretch gap-2 flex-1 min-w-0 overflow-x-auto pb-0.5">
          {audiences.map((a) => (
            <AudienceCard
              key={a.id}
              audience={a}
              isSelected={selectedGroupId === a.id}
              isHovered={hoveredGroupId === a.id}
              onClick={() => setSelectedGroupId(selectedGroupId === a.id ? null : a.id)}
              onHoverEnter={() => setHoveredGroupId(a.id)}
              onHoverLeave={() => setHoveredGroupId((p) => (p === a.id ? null : p))}
            />
          ))}
          {selectedGroupId && (
            <button
              onClick={() => setSelectedGroupId(null)}
              className="shrink-0 px-2 self-center text-[10px] text-slate-500 hover:text-slate-900 underline"
            >
              clear
            </button>
          )}
        </div>
        {rightActions && (
          <div className="shrink-0 flex items-center gap-1.5 pl-2 border-l border-slate-200">
            {rightActions}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Source rail (left)                                           */
/* ──────────────────────────────────────────────────────────── */

const CATEGORY_ORDER = ["energy", "cleaning", "management", "other"];
const categoryLabel = {
  energy: "Energy",
  cleaning: "Cleaning",
  management: "Management",
  other: "Other",
};

const SORT_OPTIONS = [
  { value: "category", label: "By category" },
  { value: "cost", label: "By cost (largest)" },
  { value: "health", label: "By health (issues first)" },
  { value: "alpha", label: "Alphabetical" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "issues", label: "Issues" },
  { value: "settle", label: "To settle" },
];

function laneTotalsTopline(lanes) {
  let totalExpected = 0;
  let issueCount = 0;
  let issueLanes = 0;
  let collectTotal = 0;
  let refundTotal = 0;
  for (const lane of lanes) {
    const s = summariseLane(lane.id);
    totalExpected += s.expected;
    issueCount += s.issueCount;
    if (s.health !== "matched") issueLanes++;
    if (s.netDelta != null) {
      // delta = advance − actual: positive → refund, negative → collect.
      if (s.netDelta > 0) refundTotal += s.netDelta;
      else if (s.netDelta < 0) collectTotal += Math.abs(s.netDelta);
    }
  }
  return { totalExpected, issueCount, issueLanes, collectTotal, refundTotal };
}

function LaneRow({ lane, summary, isSelected, onClick }) {
  const Icon = categoryIcon[lane.category] || FileText;
  const health = healthBadge[summary.health];
  const yoyPct = summary.yoyPct;
  const yoyVisible = yoyPct != null && Math.abs(yoyPct) >= 0.02;
  const yoyColor = yoyPct > 0.02 ? "text-amber-700" : yoyPct < -0.02 ? "text-emerald-700" : "text-slate-500";

  const dir = summary.settlementDirection;
  const deltaColor = dir === "collect" ? "text-amber-700" : dir === "refund" ? "text-emerald-700" : "text-slate-400";

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-4 py-2.5 border-l-2 text-left transition-colors ${
        isSelected
          ? "bg-white border-l-slate-900"
          : "border-l-transparent hover:bg-slate-100/60"
      }`}
    >
      <div className="mt-0.5 w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center text-slate-500 shrink-0">
        <Icon size={12} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-slate-800 leading-tight truncate">{lane.title}</div>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${health.dot}`} />
          <span className="text-[11px] text-slate-500 tabular-nums">{fmtEur(summary.expected)}</span>
          {summary.netDelta != null && Math.abs(summary.netDelta) > 1 && (
            <span className={`text-[10px] tabular-nums ${deltaColor}`}>
              {fmtSignedEur(summary.netDelta)}
            </span>
          )}
          {yoyVisible && (
            <span className={`inline-flex items-center text-[10px] ${yoyColor}`}>
              {yoyPct > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {Math.abs(Math.round(yoyPct * 100))}%
            </span>
          )}
          {summary.issueCount > 0 && (
            <span className="ml-auto text-[10px] uppercase tracking-widest text-amber-700 font-semibold">
              {summary.issueCount} flag{summary.issueCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function SourceRail({
  flow,
  selectedLaneId,
  effectiveLaneId,
  setSelectedLaneId,
  scrollToLane,
  query,
  setQuery,
}) {
  // Sections start expanded — explicit Set initialised with every category
  const [expanded, setExpanded] = useState(() => new Set(CATEGORY_ORDER));

  const summaries = useMemo(() => {
    const m = {};
    for (const lane of flow.lanes) m[lane.id] = summariseLane(lane.id);
    return m;
  }, [flow.lanes]);

  const laneCodes = useMemo(() => {
    const m = {};
    for (const lane of flow.lanes) m[lane.id] = getLaneServiceCodes(lane.id);
    return m;
  }, [flow.lanes]);

  // Search-only filter
  const filteredLanes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flow.lanes;
    return flow.lanes.filter((lane) => {
      const titleMatch = lane.title.toLowerCase().includes(q);
      const codeMatch = laneCodes[lane.id]?.some((c) => c.toLowerCase().includes(q));
      return titleMatch || codeMatch;
    });
  }, [flow.lanes, query, laneCodes]);

  // Always group by category — the only ordering the rail ever uses now
  const grouped = useMemo(() => {
    const out = {};
    for (const c of CATEGORY_ORDER) out[c] = [];
    for (const lane of filteredLanes) {
      const c = CATEGORY_ORDER.includes(lane.category) ? lane.category : "other";
      out[c].push(lane);
    }
    return out;
  }, [filteredLanes]);


  function toggleSection(cat) {
    setExpanded((e) => {
      const next = new Set(e);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <aside className="w-[260px] shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col h-full">
      {/* Sticky search — only thing in the rail header now */}
      <div className="border-b border-slate-200 bg-slate-50/95 backdrop-blur sticky top-0 z-10 px-3 py-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lane or code…"
            className="w-full h-7 pl-6 pr-6 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {filteredLanes.length === 0 && (
          <div className="px-4 py-8 text-center text-[11px] text-slate-400">
            No matching lanes.
            <button
              onClick={() => setQuery("")}
              className="block mx-auto mt-2 text-[11px] text-slate-600 hover:text-slate-900 underline"
            >
              Clear search
            </button>
          </div>
        )}

        {CATEGORY_ORDER.map((cat) => {
          const lanes = grouped[cat];
          if (!lanes || lanes.length === 0) return null;
          const isOpen = expanded.has(cat);
          const Icon = categoryIcon[cat] || FileText;
          const sectionTotal = lanes.reduce((s, l) => s + summaries[l.id].expected, 0);
          const sectionFlags = lanes.reduce((s, l) => s + summaries[l.id].issueCount, 0);
          return (
            <div key={cat}>
              <button
                onClick={() => toggleSection(cat)}
                aria-expanded={isOpen}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-left bg-slate-100/40 border-y border-slate-200/60 hover:bg-slate-100/80 group"
              >
                <Icon size={11} className="text-slate-400 shrink-0" />
                <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                  {categoryLabel[cat] || cat}
                </span>
                <span className="text-[10px] text-slate-400">· {lanes.length}</span>
                <span className="ml-auto text-[10px] text-slate-400 tabular-nums">
                  {fmtEur(sectionTotal)}
                  {sectionFlags > 0 && (
                    <span className="ml-1 text-amber-700">· {sectionFlags}</span>
                  )}
                </span>
                <ChevronDown
                  size={11}
                  className={`text-slate-400 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {isOpen && (
                <ul className="list-none m-0 p-0">
                  {lanes.map((lane) => (
                    <li key={lane.id} className="list-none">
                      <LaneRow
                        lane={lane}
                        summary={summaries[lane.id]}
                        isSelected={(effectiveLaneId || selectedLaneId) === lane.id}
                        onClick={() => {
                          setSelectedLaneId(lane.id);
                          scrollToLane(lane.id);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Canvas — SVG edges + absolutely-positioned node cards        */
/* ──────────────────────────────────────────────────────────── */
/* Map a settlement node's audience kind to a stripe colour */
function audienceStripeFor(node) {
  // Look up the sibling group to read its `kind`
  const flow = getCostFlow();
  const g = flow.siblingGroups?.find((x) => x.id === node.groupId);
  const kind = g?.kind || "subgroup";
  return AUDIENCE_KIND[kind]?.stripe || "bg-slate-300";
}

const SOURCE_STRIPES = {
  electricity: "bg-slate-700",
  gas: "bg-slate-700",
  water: "bg-slate-700",
  default: "bg-slate-500",
};

/* Source kind taxonomy — every source belongs to exactly one. The icon
 * for "metered" comes from utility (Zap/Flame/Droplets); other kinds use
 * a fixed icon. Labels are short — they're what shows in the chip. */
const SOURCE_KIND = {
  metered:      { label: "Metered",      defaultIcon: Gauge },
  contracted:   { label: "Contract",     defaultIcon: FileText },
  pass_through: { label: "Pass-through", defaultIcon: Receipt },
  recurring:    { label: "Recurring",    defaultIcon: Repeat },
  internal:     { label: "Internal",     defaultIcon: HardHat },
};

const UTILITY_ICONS = {
  electricity: Zap,
  gas: Flame,
  water: Droplets,
  heat: Flame,
};

function sourceKindIcon(node) {
  if (node.sourceKind === "metered" && node.utility) {
    return UTILITY_ICONS[node.utility] || Gauge;
  }
  return SOURCE_KIND[node.sourceKind]?.defaultIcon || CircleDot;
}

const CADENCE_LABEL = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  ad_hoc: "On-demand",
};

/* Build the canvas subtitle. Same format for every source so the user
 * reads one pattern, not five exceptions:  "{counterparty} · {origin}". */
function sourceCanvasSubtitle(node) {
  const isMulti = node.supplier === "multi";
  const primary = isMulti
    ? node.supplierBreakdown?.[0]?.name
    : node.supplier;
  const supplierLabel = isMulti
    ? `${primary || "Multi"} +${(node.supplierBreakdown?.length || 1) - 1}`
    : primary || "—";

  if (node.sourceKind === "metered") {
    if (node.expectedConsumption && node.consumptionUnit) {
      return `${supplierLabel} · ${node.expectedConsumption.toLocaleString("nl-NL")} ${node.consumptionUnit}`;
    }
    return `${supplierLabel} · ${CADENCE_LABEL[node.cadence] || node.cadence}`;
  }
  if (node.sourceKind === "contracted") {
    return `${supplierLabel} · ${CADENCE_LABEL[node.cadence] || node.cadence}`;
  }
  if (node.sourceKind === "pass_through") {
    return `On-demand · variable invoices`;
  }
  if (node.sourceKind === "recurring") {
    return `${supplierLabel} · ${CADENCE_LABEL[node.cadence] || node.cadence}`;
  }
  if (node.sourceKind === "internal") {
    return `Internal · ${CADENCE_LABEL[node.cadence] || node.cadence}`;
  }
  return supplierLabel;
}

/* ─── AdjustmentEditor — popover for inserting a +/− correction on an
 *   existing edge. Anchored at the edge midpoint (caller passes anchor.x/y
 *   in canvas-relative coords). Sign is encoded by the user toggling
 *   between + (addition) and − (subtraction); we serialise that to a
 *   signed number when committing. */
function AdjustmentEditor({ anchor, fromLabel, toLabel, onClose, onCommit }) {
  const [sign, setSign] = useState("add"); // "add" | "subtract"
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const inputRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Click-outside dismiss + ESC. Capture phase so we close before any
  // outer keydown handler in the L3 sheet sees the ESC.
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  function commit() {
    const num = parseFloat(String(amountStr).replace(/[^0-9.\-]/g, ""));
    if (!isFinite(num) || num === 0) return;
    const signed = sign === "subtract" ? -Math.abs(num) : Math.abs(num);
    onCommit({
      amount: signed,
      reason: reason.trim() || (sign === "subtract" ? "Aftrek" : "Bijtelling"),
    });
  }

  return (
    <div
      ref={ref}
      className="absolute z-30 w-72 rounded-lg border border-slate-200 bg-white shadow-lg p-3 space-y-2.5"
      style={{
        left: anchor.x,
        top: anchor.y + 14,
        transform: "translateX(-50%)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <div className="text-[11px] font-semibold text-slate-700">
          Correctie op stroom
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          {fromLabel} → {toLabel}
        </div>
      </div>

      {/* Sign toggle */}
      <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-100 rounded-md">
        <button
          type="button"
          onClick={() => setSign("add")}
          className={`h-7 inline-flex items-center justify-center gap-1 rounded text-[11px] font-medium transition-colors ${
            sign === "add"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Plus size={11} strokeWidth={2.5} />
          Bijtellen
        </button>
        <button
          type="button"
          onClick={() => setSign("subtract")}
          className={`h-7 inline-flex items-center justify-center gap-1 rounded text-[11px] font-medium transition-colors ${
            sign === "subtract"
              ? "bg-white text-amber-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Minus size={11} strokeWidth={2.5} />
          Aftrekken
        </button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
          Bedrag
        </label>
        <div className="relative mt-0.5">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            €
          </span>
          <input
            ref={inputRef}
            type="text"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            placeholder="0,00"
            className="w-full text-[12px] border border-slate-200 rounded px-2 py-1 pl-6 focus:outline-none focus:ring-1 focus:ring-slate-500 tabular-nums"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
          Reden
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          placeholder="Bijv. dubbel geboekt, naheffing, terugbetaling…"
          className="mt-0.5 w-full text-[11px] border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
        <button
          onClick={onClose}
          className="h-7 px-2.5 rounded-md text-[11px] text-slate-600 hover:bg-slate-50"
        >
          Annuleren
        </button>
        <button
          onClick={commit}
          className="h-7 px-3 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
        >
          Toevoegen
        </button>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  overlay,
  isSelected,
  isHovered,
  dim,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  // ─ Phase 7 — edit mode plumbing.
  // editMode true ⇒ NodeCard becomes draggable (mousedown → drag start) and
  //   a delete-x affordance appears on hover. Locked lanes opt out.
  editMode = false,
  laneLocked = false,
  isDragging = false,
  dragOffset = null,
  onStartDrag,
  onDelete,
}) {
  const dimClass = node.outOfScope ? "opacity-50" : dim ? "opacity-30" : "";
  const ringClass = isSelected
    ? "ring-2 ring-slate-900 ring-offset-2"
    : isHovered
    ? "ring-1 ring-slate-500"
    : "";

  const errorFlag = node.flags?.find((f) => f.kind === "error");
  const warnFlag = node.flags?.find((f) => f.kind === "warning");
  const flagIcon = errorFlag
    ? { Icon: AlertCircle, color: "text-red-600", note: errorFlag.note }
    : warnFlag
    ? { Icon: AlertTriangle, color: "text-amber-600", note: warnFlag.note }
    : null;

  const anchorBucket =
    node.anchors && node.anchors.length > 0
      ? Math.max(
          ...node.anchors.map((a) => {
            const b = anchorStatusBucket(a.status);
            return b === "error" ? 3 : b === "warn" ? 2 : b === "ok" ? 1 : 0;
          })
        )
      : 0;
  const anchorColor =
    anchorBucket === 3
      ? "text-red-600"
      : anchorBucket === 2
      ? "text-amber-700"
      : anchorBucket === 1
      ? "text-slate-500"
      : "text-slate-300";

  // Edit-mode behaviour: drag is enabled when editMode is on AND the lane
  // isn't locked. Click still opens the inspector (we don't gate selection
  // on edit mode — the user might want to inspect while editing).
  const draggable = editMode && !laneLocked;
  const dx = isDragging && dragOffset ? dragOffset.dx : 0;
  const dy = isDragging && dragOffset ? dragOffset.dy : 0;
  const containerProps = {
    onClick: (e) => { e.stopPropagation(); onSelect(node.id); },
    onMouseDown: draggable
      ? (e) => {
          // Left-click only; ignore right-click and don't fight with the
          // delete-x button (button has its own onMouseDown).
          if (e.button !== 0) return;
          if (e.target.closest("[data-edit-action]")) return;
          e.stopPropagation();
          onStartDrag?.(node.id, e);
        }
      : undefined,
    onMouseEnter: () => onHoverEnter && onHoverEnter(node.id),
    onMouseLeave: () => onHoverLeave && onHoverLeave(node.id),
    className: `group absolute transition-[box-shadow,opacity] duration-150 ${dimClass} ${ringClass} ${
      draggable
        ? isDragging
          ? "cursor-grabbing"
          : "cursor-grab"
        : "cursor-pointer"
    }`,
    style: {
      left: node._x + dx,
      top: node._y + dy,
      width: node._w,
      height: node._h,
      // While dragging, the card floats above siblings and dims slightly so
      // the user can see drop zones underneath.
      zIndex: isDragging ? 50 : undefined,
      opacity: isDragging ? 0.85 : undefined,
      pointerEvents: isDragging ? "none" : undefined,
    },
  };
  // The delete-x affordance is rendered by Canvas as an absolute overlay
  // (one handler, no per-node-type render injection). NodeCard only owns
  // drag init via onMouseDown; deletion is decoupled.

  /* ── Source (input — identity stripe + chip on the LEFT) ── */
  if (node.type === "source") {
    const stripe = SOURCE_STRIPES[node.utility] || SOURCE_STRIPES.default;
    const KindIcon = sourceKindIcon(node);
    const kindLabel = SOURCE_KIND[node.sourceKind]?.label || "Source";
    // Canvas headlines the budgeted amount — actual lives in the inspector.
    const headlineAmount = node.budgetedAmount != null ? node.budgetedAmount : node.amount;
    const period = getCostFlow().period;
    return (
      <div {...containerProps} className={`${containerProps.className} flex items-stretch rounded-lg border border-slate-300 bg-white hover:shadow-sm`}>
        <span className={`w-1.5 rounded-l-lg ${stripe}`} aria-hidden />
        <div className="flex-1 min-w-0 px-2.5 py-2 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 h-[18px] rounded text-[10px] uppercase tracking-widest font-semibold text-slate-700 bg-slate-100 border border-slate-200">
              <KindIcon size={10} strokeWidth={2} />
              {kindLabel}
            </span>
            {flagIcon && (
              <span className={flagIcon.color} title={flagIcon.note}>
                <flagIcon.Icon size={12} />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-slate-900 leading-tight truncate">
              {node.label}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium leading-tight">
              Budgeted {period || ""}
            </div>
          </div>
          <div className="text-[12px] font-semibold tabular-nums text-slate-800">
            {fmtEur(headlineAmount)}
          </div>
        </div>
      </div>
    );
  }

  /* ── Settlement (output — audience pill + identity stripe on the RIGHT,
   * subtle slate-50 inner bg to feel like a "destination"). ── */
  if (node.type === "settlement") {
    const stripe = audienceStripeFor(node);
    const flow = getCostFlow();
    const sibling = flow.siblingGroups?.find((g) => g.id === node.groupId);
    const audienceName = sibling?.name || node.groupId;
    const audienceVhe = node.vheCount;
    const audienceKind = sibling?.kind || "subgroup";

    // For the Complex audience the page header already names the building.
    // The pill says just "Complex" + count to avoid redundancy. Other kinds
    // keep their (typically short) name.
    const pillLabel = audienceKind === "complex" ? "Complex" : audienceName;
    const pillTone = AUDIENCE_KIND[audienceKind]?.badge
      || "text-slate-700 bg-slate-50 border-slate-200";

    // External (out-of-scope) settlements use a calmer treatment
    if (node.outOfScope) {
      return (
        <div {...containerProps} className={`${containerProps.className} flex items-stretch rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:shadow-sm`}>
          <div className="flex-1 min-w-0 px-2.5 py-2 flex flex-col justify-between">
            <span className="inline-flex items-center px-1.5 h-[18px] rounded text-[10px] uppercase tracking-widest font-semibold text-slate-500 bg-white border border-slate-200 self-start">
              External
            </span>
            <div className="text-[12px] text-slate-700 leading-tight truncate">{node.label}</div>
            <div className="text-[12px] font-semibold tabular-nums text-slate-700">
              {fmtEur(node.amount)}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div {...containerProps} className={`${containerProps.className} flex items-stretch rounded-lg border border-slate-300 bg-slate-50/50 hover:shadow-sm`}>
        <div className="flex-1 min-w-0 px-2.5 py-2 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            {flagIcon && (
              <span className={`order-2 ${flagIcon.color}`} title={flagIcon.note}>
                <flagIcon.Icon size={12} />
              </span>
            )}
            {/* Audience pill — kind label + VHE count, truncates if long. */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 h-[18px] rounded text-[10px] uppercase tracking-widest font-semibold border ml-auto max-w-[170px] ${pillTone}`}
            >
              <span className={`inline-block w-1 h-2.5 rounded-sm shrink-0 ${stripe}`} aria-hidden />
              <span className="truncate">{pillLabel}</span>
              {audienceVhe != null && (
                <span className="text-slate-400 normal-case tracking-normal font-normal shrink-0">· {audienceVhe} VHE</span>
              )}
            </span>
          </div>
          <div className="min-w-0">
            {node.serviceCode && (
              <span
                className="inline-flex items-center px-1.5 h-[16px] rounded text-[10px] font-mono text-slate-700 bg-slate-100 border border-slate-200"
                title="Service code (links the advance paid to this settlement)"
              >
                {node.serviceCode}
              </span>
            )}
          </div>
          <div className="flex items-end justify-between gap-1.5">
            <div className="text-[12px] font-semibold tabular-nums text-slate-800">
              {fmtEur(node.amount)}
            </div>
            {node.delta != null && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] tabular-nums font-medium ${
                  node.delta > 0
                    ? "text-emerald-700"
                    : node.delta < 0
                    ? "text-amber-700"
                    : "text-slate-400"
                }`}
              >
                {node.delta > 0 ? <TrendingDown size={10} /> : node.delta < 0 ? <TrendingUp size={10} /> : null}
                {fmtSignedEur(node.delta)}
              </span>
            )}
          </div>
        </div>
        <span className={`w-1.5 rounded-r-lg ${stripe}`} aria-hidden />
      </div>
    );
  }

  /* ── Split (compact dashed operator — rule is the headline) ── */
  if (node.type === "split") {
    const ruleSummary =
      node.rule === "fixed_pct"
        ? Object.entries(node.ruleSpec || {})
            .map(([, v]) => `${Math.round(v * 100)}%`)
            .join(" / ")
        : node.rule === "by_count"
        ? `${node.ruleSpec?.denominator ? "n/" + node.ruleSpec.denominator : "by count"}`
        : node.rule === "by_meter"
        ? "by meter"
        : node.rule === "by_area"
        ? "by area"
        : "split";
    return (
      <div {...containerProps} className={`${containerProps.className} rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:shadow-sm`}>
        <div className="h-full flex flex-col px-2.5 py-1.5">
          {/* Chip row — chip left, optional flag right */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-1.5 h-[16px] rounded text-[10px] uppercase tracking-widest font-semibold text-slate-700 bg-white border border-slate-200">
              <Split size={9} strokeWidth={2} /> Split
            </span>
            {flagIcon && (
              <span className={flagIcon.color} title={flagIcon.note}>
                <flagIcon.Icon size={11} />
              </span>
            )}
          </div>
          {/* Rule + sub-label centered in the remaining space */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center">
            <div className="text-[12px] font-semibold text-slate-800 tabular-nums leading-none">
              {ruleSummary}
            </div>
            <div className="text-[11px] text-slate-500 truncate w-full mt-0.5">
              {node.subLabel || node.label}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Adjustment (slim signed chip — sign carried by amount). Replaces the
   * old `addition` and `deduction` types: positive amount renders as Plus
   * (green), negative as Minus (red). ── */
  if (node.type === "adjustment") {
    const isAdd = (node.amount || 0) >= 0;
    const SignIcon = isAdd ? Plus : Minus;

    // For additions/deductions that bridge another lane, surface where the
    // money came from / is going to. We compute this from the live flow
    // since node.laneId only tells us the local side. For an addition,
    // "From" is the cross-lane source; for a deduction, "To" is the
    // cross-lane sink.
    const flowForLanes = getCostFlow();
    const myLaneId = node.laneId;
    let crossLaneInfo = null;
    if (isAdd) {
      const sourceFromOtherLane = flowForLanes.edges
        .map((e) => {
          if (e.to !== node.id) return null;
          const fromN = flowForLanes.nodes.find((n) => n.id === e.from);
          if (!fromN || fromN.laneId === myLaneId) return null;
          const lane = flowForLanes.lanes.find((l) => l.id === fromN.laneId);
          return lane ? { lane, dir: "from" } : null;
        })
        .filter(Boolean)[0];
      crossLaneInfo = sourceFromOtherLane;
    } else {
      const sinkToOtherLane = flowForLanes.edges
        .map((e) => {
          if (e.from !== node.id) return null;
          const toN = flowForLanes.nodes.find((n) => n.id === e.to);
          if (!toN || toN.laneId === myLaneId) return null;
          const lane = flowForLanes.lanes.find((l) => l.id === toN.laneId);
          return lane ? { lane, dir: "to" } : null;
        })
        .filter(Boolean)[0];
      crossLaneInfo = sinkToOtherLane;
    }

    return (
      <div {...containerProps} className={`${containerProps.className} flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white hover:shadow-sm px-2.5`}>
        <span
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
            isAdd
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
          title={isAdd ? "Adjustment (positive)" : "Adjustment (negative)"}
        >
          <SignIcon size={13} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-slate-800 leading-tight truncate font-medium">
            {node.label}
          </div>
          {crossLaneInfo ? (
            <div className="text-[10px] text-slate-500 leading-tight truncate flex items-center gap-1">
              {crossLaneInfo.dir === "from" ? (
                <ArrowLeft size={9} className="text-slate-400 shrink-0" />
              ) : (
                <ChevronRight size={9} className="text-slate-400 shrink-0" />
              )}
              <span className="text-slate-400">
                {crossLaneInfo.dir === "from" ? "From" : "To"}
              </span>
              <span className="truncate">{crossLaneInfo.lane.title}</span>
            </div>
          ) : node.subLabel ? (
            <div className="text-[11px] text-slate-500 leading-tight truncate">
              {node.subLabel}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-800">
          {isAdd ? "+" : "−"}
          {fmtEur(Math.abs(node.amount))}
        </div>
        {flagIcon && (
          <span className={`shrink-0 ${flagIcon.color}`} title={flagIcon.note}>
            <flagIcon.Icon size={12} />
          </span>
        )}
      </div>
    );
  }

  /* ── Marker — checkpoint pill, not a stop. ──
   * A marker applies no transformation; it's a labelled bead on the flow
   * (running total, slice name, or cross-lane bridge marker). Renders as
   * a small pill with a leading dot glyph so it reads as a label, not an
   * operation. The arrowhead on incoming edges is suppressed elsewhere so
   * the line passes through visually. */
  if (node.type === "marker") {
    return (
      <div
        {...containerProps}
        className={`${containerProps.className} inline-flex items-center gap-1.5 px-2.5 rounded-full bg-white border border-slate-200 hover:border-slate-500 hover:shadow-sm transition-all`}
        title={`${node.label} · ${fmtEur2(node.amount)}`}
      >
        <span
          className="w-[7px] h-[7px] rounded-full bg-slate-400 shrink-0"
          aria-hidden
        />
        <div
          className="min-w-0 text-[10px] text-slate-600 truncate leading-none"
        >
          {node.label}
        </div>
        <span className="text-slate-300 text-[10px] leading-none shrink-0">·</span>
        <div className="text-[10px] tabular-nums text-slate-800 font-medium shrink-0 leading-none">
          {fmtEur(node.amount)}
        </div>
      </div>
    );
  }

  return null;
}

function Canvas({
  flow,
  selectedNodeId,
  setSelectedNodeId,
  overlay,
  hoveredNodeId,
  setHoveredNodeId,
  hoverHighlight,
  focusVisibility,
  scopeHighlight, // optional: persistent dim for nodes outside an audience scope
  showEdgeLabels,
  setSelectedLaneId,
  foldedLaneIds,
  toggleLaneFold,
  canvasRef,
  laneRefs,
  onBackgroundClick,
  // ─ Phase 7 — edit mode. When `editMode` is true:
  //    • node cards become draggable (mousedown → start drag, drop snaps
  //      to nearest free slot in the same lane)
  //    • delete-x affordance appears over each non-locked node on hover
  //    • edge-hover surfaces a + button to insert an adjustment node
  //   The host (LaneDetailSheet / FullCanvasSheet) owns the on/off state
  //   and the delete/adjust callbacks; Canvas owns the drag mechanics.
  editMode = false,
  onDeleteNode,
  onInsertAdjustment,
}) {
  const groupId = flow.group?.id;
  // A lane collapses if either:
  //   • focus mode is active and this lane has no visible nodes in the focus subgraph, OR
  //   • the user has manually folded it via the lane title bar.
  const collapsedLaneIds = useMemo(() => {
    const set = new Set(foldedLaneIds || []);
    if (focusVisibility) {
      const activeLanes = new Set();
      for (const n of flow.nodes) {
        if (focusVisibility.nodes.has(n.id)) activeLanes.add(n.laneId);
      }
      for (const lane of flow.lanes) {
        if (!activeLanes.has(lane.id)) set.add(lane.id);
      }
    }
    return set.size > 0 ? set : null;
  }, [flow.lanes, flow.nodes, focusVisibility, foldedLaneIds]);

  const layout = useMemo(
    () => buildLaneLayout(flow, collapsedLaneIds),
    [flow, collapsedLaneIds]
  );

  // Decorate nodes with computed pixel positions and per-type size
  const positionedNodes = useMemo(() => {
    return flow.nodes.map((n) => {
      const pos = nodePosition(n, layout);
      return { ...n, _x: pos.x, _y: pos.y, _w: pos.width, _h: pos.height };
    });
  }, [flow, layout]);

  const nodeById = useMemo(() => {
    const m = {};
    for (const n of positionedNodes) m[n.id] = n;
    return m;
  }, [positionedNodes]);

  // Hover-driven highlight subgraph (passed in from the page)
  const hoverSet = hoverHighlight;

  // ─ Phase 7 — drag state.
  //   `dragState` carries (nodeId, startX/Y, currentX/Y) while a drag is in
  //   flight. Window-level mousemove / mouseup / keydown listeners are
  //   attached only while a drag is active (effect deps include dragState).
  //   On drop we compute the target slot (col, row) from cursor position
  //   relative to the canvas's scrollable container and either commit via
  //   setNodeField or snap back. ESC cancels.
  const [dragState, setDragState] = useState(null);
  // Phase 7 — adjustment-insert popover. When the user clicks the + on an
  // edge, we capture (from, to, midX, midY) so the popover renders at the
  // edge midpoint with enough context to call insertAdjustmentOnEdge.
  const [adjustTarget, setAdjustTarget] = useState(null);

  function startDrag(nodeId, e) {
    if (!editMode) return;
    const node = nodeById[nodeId];
    if (!node) return;
    if (groupId && isLaneFrozen(groupId, node.laneId)) return;
    setDragState({
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  }

  // Compute the target slot under the cursor. Within-lane only — we lock
  // to the dragged node's home lane to keep the math model consistent
  // (a node's `laneId` doesn't change). Returns null when the cursor sits
  // outside any drop zone (cursor outside canvas / past max col).
  function targetSlotFor(node, clientX, clientY) {
    const container = canvasRef?.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const localX = clientX - rect.left + container.scrollLeft;
    const localY = clientY - rect.top + container.scrollTop;
    const lane = layout.lanes[node.laneId];
    if (!lane) return null;
    const laneTop = lane.y + LANE_TITLE_HEIGHT + LANE_PADDING_TOP;
    const laneBottom = lane.y + lane.height - LANE_PADDING_BOTTOM;
    if (localY < lane.y + LANE_TITLE_HEIGHT || localY > laneBottom + ROW_HEIGHT) {
      return null; // outside the lane band
    }
    const col = Math.max(
      0,
      Math.round((localX - CANVAS_LEFT_PAD) / COL_WIDTH)
    );
    const row = Math.max(0, Math.round((localY - laneTop) / ROW_HEIGHT));
    return { col, row };
  }

  // Slot occupied by another node in the same lane?
  function isSlotOccupied(node, col, row) {
    return flow.nodes.some(
      (n) =>
        n.laneId === node.laneId &&
        n.id !== node.id &&
        (n.col ?? 0) === col &&
        (n.row ?? 0) === row
    );
  }

  // Live target while dragging — used for slot highlight + commit on drop.
  const dragTarget = useMemo(() => {
    if (!dragState) return null;
    const node = nodeById[dragState.nodeId];
    if (!node) return null;
    const slot = targetSlotFor(node, dragState.currentX, dragState.currentY);
    if (!slot) return null;
    const occupied = isSlotOccupied(node, slot.col, slot.row);
    return { node, ...slot, occupied };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, nodeById, layout]);

  useEffect(() => {
    if (!dragState) return;
    function onMove(e) {
      setDragState((prev) =>
        prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : prev
      );
    }
    function onUp(e) {
      const node = nodeById[dragState.nodeId];
      if (node) {
        const slot = targetSlotFor(node, e.clientX, e.clientY);
        if (
          slot &&
          !isSlotOccupied(node, slot.col, slot.row) &&
          (slot.col !== (node.col ?? 0) || slot.row !== (node.row ?? 0))
        ) {
          if (groupId) {
            setNodeField(groupId, node.id, "col", slot.col);
            setNodeField(groupId, node.id, "row", slot.row);
          }
        }
      }
      setDragState(null);
    }
    function onKey(e) {
      if (e.key === "Escape") setDragState(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, nodeById, layout, groupId]);

  // Compute canvas width
  const maxCol = positionedNodes.reduce((m, n) => Math.max(m, n.col), 0);
  const canvasWidth = CANVAS_LEFT_PAD + (maxCol + 1) * COL_WIDTH + 80;

  return (
    <div
      ref={canvasRef}
      className="relative flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] [background-size:20px_20px]"
      onClick={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.(); }}
    >
      <div
        className="relative"
        style={{ width: canvasWidth, height: layout.totalHeight, minWidth: "100%" }}
        onClick={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.(); }}
      >
        {/* Lane bands + titles */}
        {flow.lanes.map((lane, i) => {
          const l = layout.lanes[lane.id];
          const summary = summariseLane(lane.id);
          const Icon = categoryIcon[lane.category] || FileText;
          const health = healthBadge[summary.health];

          // Distinguish "user folded this lane" from "focus mode collapsed it":
          // the click action is different in each case.
          const isUserFolded = foldedLaneIds?.has(lane.id);

          if (l.isCollapsed) {
            // Strip rendering. Click action depends on WHY it's collapsed.
            const onStripClick = () => {
              if (isUserFolded) toggleLaneFold?.(lane.id);   // unfold
              else setSelectedLaneId?.(lane.id);             // switch focus
            };
            const stripTitle = isUserFolded
              ? `Click to unfold ${lane.title}`
              : `Switch focus to ${lane.title}`;
            const stripIndicator = isUserFolded ? (
              <ChevronRight size={10} className="text-slate-400 shrink-0" />
            ) : (
              <ChevronRight size={10} className="text-slate-400 shrink-0" />
            );
            return (
              <button
                key={lane.id}
                ref={(el) => (laneRefs.current[lane.id] = el)}
                onClick={onStripClick}
                className="absolute left-0 right-0 px-3 flex items-center gap-1.5 bg-slate-50/60 border-b border-slate-200/60 hover:bg-slate-100/60 group text-left"
                style={{ top: l.y, height: l.height }}
                title={stripTitle}
              >
                {stripIndicator}
                <Icon size={11} strokeWidth={1.5} className="text-slate-400 shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 shrink-0">
                  {lane.title}
                </span>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${health.dot} shrink-0`} />
                <span className="text-[10px] text-slate-400 ml-auto pr-2 tabular-nums shrink-0 group-hover:text-slate-600">
                  {fmtEur(summary.expected)}
                  {summary.netDelta != null && Math.abs(summary.netDelta) > 1 && (
                    <span
                      className={`ml-2 ${
                        summary.netDelta > 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {fmtSignedEur(summary.netDelta)}
                    </span>
                  )}
                </span>
              </button>
            );
          }

          // The lane title bar is clickable (folds the lane) only when a real
          // toggleLaneFold function is supplied. In the L3 sheet we pass null
          // to render a static label instead, since folding a single-lane
          // focus view doesn't serve the user's intent.
          const foldable = typeof toggleLaneFold === "function";
          const HeaderEl = foldable ? "button" : "div";
          const headerProps = foldable
            ? {
                type: "button",
                onClick: () => toggleLaneFold(lane.id),
                title: "Click to fold this lane",
                className:
                  "absolute left-0 right-0 top-0 h-8 px-3 flex items-center gap-2 border-b border-dashed border-slate-200 hover:bg-slate-100/40 transition-colors text-left",
              }
            : {
                className:
                  "absolute left-0 right-0 top-0 h-8 px-3 flex items-center gap-2 border-b border-dashed border-slate-200",
              };

          return (
            <div
              key={lane.id}
              ref={(el) => (laneRefs.current[lane.id] = el)}
              className={`absolute left-0 right-0 ${i % 2 === 0 ? "bg-white/60" : "bg-slate-50/40"}`}
              style={{ top: l.y, height: l.height }}
            >
              <HeaderEl {...headerProps}>
                {foldable && (
                  <ChevronDown size={11} strokeWidth={2} className="text-slate-400 shrink-0" />
                )}
                <Icon size={12} strokeWidth={1.5} className="text-slate-400 shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 shrink-0">
                  {lane.title}
                </span>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${health.dot} shrink-0`} />
                {(() => {
                  const groupId = flow.group?.id;
                  if (groupId && isLaneFrozen(groupId, lane.id)) {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 h-4 rounded text-[9px] uppercase tracking-widest font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 shrink-0"
                        title="Component locked for this period"
                      >
                        <Lock size={9} />
                        Locked
                      </span>
                    );
                  }
                  return null;
                })()}
                {summary.issueCount > 0 && (
                  <span className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold shrink-0">
                    {summary.issueCount} flag{summary.issueCount === 1 ? "" : "s"}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2.5 pr-2 shrink-0">
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {fmtEur(summary.expected)}
                  </span>
                  {summary.netDelta != null && Math.abs(summary.netDelta) > 1 && (
                    <span
                      className={`text-[10px] tabular-nums font-medium ${
                        summary.netDelta > 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {fmtSignedEur(summary.netDelta)}
                    </span>
                  )}
                  {summary.yoyPct != null && Math.abs(summary.yoyPct) >= 0.02 && (
                    <span
                      className={`inline-flex items-center text-[10px] tabular-nums ${
                        summary.yoyPct > 0 ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {summary.yoyPct > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                      {Math.abs(Math.round(summary.yoyPct * 100))}%
                    </span>
                  )}
                </span>
              </HeaderEl>
            </div>
          );
        })}

        {/* SVG edges */}
        <svg
          className="absolute inset-0"
          width={canvasWidth}
          height={layout.totalHeight}
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#94A3B8" />
            </marker>
            <marker
              id="arrowhead-strong"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#1E293B" />
            </marker>
          </defs>
          {flow.edges.map((edge, idx) => {
            const fromNode = nodeById[edge.from];
            const toNode = nodeById[edge.to];
            if (!fromNode || !toNode) return null;

            const visible = !focusVisibility || focusVisibility.edges.has(idx);
            if (!visible) return null;

            // Hide edges that touch a collapsed lane on either end —
            // otherwise they "float" between/across folded strips.
            if (
              collapsedLaneIds &&
              (collapsedLaneIds.has(fromNode.laneId) ||
                collapsedLaneIds.has(toNode.laneId))
            ) {
              return null;
            }

            const isHoverHighlighted = hoverSet ? hoverSet.edges.has(idx) : false;
            const isHoverDimmed = !!hoverSet && !isHoverHighlighted;
            // Edge dim due to scope: dim if EITHER endpoint isn't in the
            // scoped audience subgraph. The line still renders so the math
            // stays visible — just visually de-emphasised.
            const isOutOfScopeEdge =
              scopeHighlight &&
              (!scopeHighlight.nodes.has(edge.from) ||
                !scopeHighlight.nodes.has(edge.to));

            // Show edge label when: toggle is on, edge is in hover path, or
            // one of the endpoints is the selected node.
            const labelVisible =
              !!edge.edgeLabel &&
              (showEdgeLabels ||
                isHoverHighlighted ||
                edge.from === selectedNodeId ||
                edge.to === selectedNodeId);

            const x1 = fromNode._x + fromNode._w;
            const y1 = fromNode._y + fromNode._h / 2;
            const x2 = toNode._x;
            const y2 = toNode._y + toNode._h / 2;
            const midX = (x1 + x2) / 2;

            const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
            const labelX = midX;
            const labelY = (y1 + y2) / 2;

            const stroke = isHoverHighlighted ? "#1E293B" : "#CBD5E1";
            const opacity = isHoverDimmed || isOutOfScopeEdge ? 0.25 : 1;

            // Arrowhead suppressed when the destination is a passthrough —
            // a passthrough is a marker on the flow, not a stop. The line
            // continues through it; the arrowhead lands at the eventual
            // real destination.
            const showArrowhead = toNode.type !== "marker";

            return (
              <g key={idx} opacity={opacity}>
                {/* Visible path */}
                <path
                  d={path}
                  stroke={stroke}
                  strokeWidth={isHoverHighlighted ? "2" : "1.5"}
                  fill="none"
                  markerEnd={
                    !showArrowhead
                      ? undefined
                      : isHoverHighlighted
                      ? "url(#arrowhead-strong)"
                      : "url(#arrowhead)"
                  }
                />
                {/* Wider invisible hit area for hover/click */}
                <path
                  d={path}
                  stroke="transparent"
                  strokeWidth="14"
                  fill="none"
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredNodeId(edge.from)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={(e) => { e.stopPropagation(); setSelectedNodeId(edge.from); }}
                >
                  <title>
                    {edge.edgeLabel ? `${edge.edgeLabel} · ` : ""}{fmtEur2(edge.amount)}
                  </title>
                </path>
                {labelVisible && (() => {
                  // Auto-size the rect to fit the text (was hardcoded to 36px,
                  // which clipped longer labels like "Maslow 7/12"). 6.4 px/char
                  // at 10 px Plus Jakarta Sans + 12 px horizontal padding.
                  const text = edge.edgeLabel || "";
                  const labelW = Math.max(36, text.length * 6.4 + 12);
                  return (
                    <g style={{ pointerEvents: "none" }}>
                      <rect
                        x={labelX - labelW / 2}
                        y={labelY - 8}
                        width={labelW}
                        height="16"
                        rx="3"
                        fill="white"
                        stroke={isHoverHighlighted ? "#1E293B" : "#E2E8F0"}
                        strokeWidth="1"
                      />
                      <text
                        x={labelX}
                        y={labelY + 3}
                        textAnchor="middle"
                        fontSize="10"
                        fill={isHoverHighlighted ? "#1E293B" : "#64748B"}
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: isHoverHighlighted ? 600 : 400 }}
                      >
                        {text}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        {/* Node cards */}
        {positionedNodes.map((node) => {
          const visible = !focusVisibility || focusVisibility.nodes.has(node.id);
          if (!visible) return null;
          // Don't render nodes whose lane is collapsed to a strip.
          if (collapsedLaneIds && collapsedLaneIds.has(node.laneId)) return null;
          const isInHover = hoverSet ? hoverSet.nodes.has(node.id) : false;
          const isOutOfScope = scopeHighlight && !scopeHighlight.nodes.has(node.id);
          const dim = (!!hoverSet && !isInHover) || isOutOfScope;
          // Drag-mode props: when editMode is on and the node is currently
          // being dragged, NodeCard renders translated by (dx, dy) so the
          // user sees the card follow their cursor.
          const isDragging = dragState?.nodeId === node.id;
          const dragOffset = isDragging
            ? {
                dx: dragState.currentX - dragState.startX,
                dy: dragState.currentY - dragState.startY,
              }
            : null;
          const laneLocked = !!groupId && isLaneFrozen(groupId, node.laneId);
          return (
            <NodeCard
              key={node.id}
              node={node}
              overlay={overlay}
              isSelected={selectedNodeId === node.id}
              isHovered={hoveredNodeId === node.id}
              dim={dim}
              onSelect={setSelectedNodeId}
              onHoverEnter={setHoveredNodeId}
              onHoverLeave={(id) => setHoveredNodeId((prev) => (prev === id ? null : prev))}
              editMode={editMode}
              laneLocked={laneLocked}
              isDragging={isDragging}
              dragOffset={dragOffset}
              onStartDrag={startDrag}
            />
          );
        })}

        {/* Phase 7 — drop-target slot ghost (shown while dragging). */}
        {dragState && dragTarget && (() => {
          const lane = layout.lanes[dragTarget.node.laneId];
          if (!lane) return null;
          const slotLeft = CANVAS_LEFT_PAD + dragTarget.col * COL_WIDTH;
          const slotTop =
            lane.y + LANE_TITLE_HEIGHT + LANE_PADDING_TOP + dragTarget.row * ROW_HEIGHT;
          const tone = dragTarget.occupied
            ? "border-rose-300 bg-rose-50/30"
            : "border-emerald-400 bg-emerald-50/30";
          return (
            <div
              className={`absolute rounded-lg border-2 border-dashed ${tone} pointer-events-none transition-colors`}
              style={{
                left: slotLeft + 6,
                top: slotTop + 6,
                width: COL_WIDTH - 12,
                height: ROW_HEIGHT - 12,
              }}
            />
          );
        })()}

        {/* Phase 7 — delete-x overlay per node (edit mode only).
         *  Decoupled from NodeCard's per-type render so we have one
         *  click handler. Hover state is shared via the underlying
         *  group/peer relation: each delete button is positioned over
         *  its node and shows on the node's group hover (CSS handles it
         *  via group-hover:opacity-100 on the absolutely-positioned card,
         *  but here the button isn't inside the card so we just always
         *  render it dim and let pointer-events make it interactive). */}
        {editMode && positionedNodes.map((node) => {
          if (collapsedLaneIds && collapsedLaneIds.has(node.laneId)) return null;
          if (focusVisibility && !focusVisibility.nodes.has(node.id)) return null;
          if (groupId && isLaneFrozen(groupId, node.laneId)) return null;
          if (dragState?.nodeId === node.id) return null; // hide while dragging
          return (
            <button
              key={`del-${node.id}`}
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode?.(node);
              }}
              className="absolute z-20 inline-flex items-center justify-center w-5 h-5 rounded-full border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-400 shadow-sm opacity-60 hover:opacity-100 transition-opacity"
              style={{
                left: node._x + node._w - 8,
                top: node._y - 8,
              }}
              title="Knooppunt verwijderen"
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          );
        })}

        {/* Phase 7 — settlement-prefix + button.
         *  The most common edit users want is "drop a correction right
         *  before this settlement" — i.e. on the largest edge feeding it.
         *  Surface a dedicated + on the settlement's left edge so they
         *  don't have to hunt for the right edge midpoint. The button
         *  opens AdjustmentEditor pointed at (largestIncomingFrom → settlement). */}
        {editMode && positionedNodes.map((node) => {
          if (node.type !== "settlement" || node.outOfScope) return null;
          if (collapsedLaneIds && collapsedLaneIds.has(node.laneId)) return null;
          if (focusVisibility && !focusVisibility.nodes.has(node.id)) return null;
          if (groupId && isLaneFrozen(groupId, node.laneId)) return null;
          // Find the dominant incoming edge — fall back to any edge if
          // none have a stored amount.
          let primary = null;
          for (const e of flow.edges) {
            if (e.to !== node.id) continue;
            if (!primary || (e.amount || 0) > (primary.amount || 0)) primary = e;
          }
          if (!primary) return null;
          const fromN = nodeById[primary.from];
          if (!fromN) return null;
          if (fromN.laneId !== node.laneId) return null; // skip cross-lane edges
          return (
            <button
              key={`settle-add-${node.id}`}
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setAdjustTarget({
                  fromNode: fromN,
                  toNode: node,
                  // Anchor the popover at the settlement's left edge so it
                  // visually attaches to the right thing.
                  midX: node._x - 4,
                  midY: node._y + node._h / 2,
                });
              }}
              className="absolute z-20 inline-flex items-center justify-center w-6 h-6 rounded-full border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500 shadow-sm opacity-90 hover:opacity-100 transition-all"
              style={{
                left: node._x - 12,
                top: node._y + node._h / 2 - 12,
              }}
              title="Correctie toevoegen vóór deze afrekening"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          );
        })}

        {/* Phase 7 — edge-+ overlay (insert adjustment on edge).
         *  One round button per edge midpoint, only in edit mode, only on
         *  edges where both endpoints' lane is unlocked. Click opens the
         *  AdjustmentEditor anchored at the same point. */}
        {editMode && flow.edges.map((edge, idx) => {
          const fromNode = nodeById[edge.from];
          const toNode = nodeById[edge.to];
          if (!fromNode || !toNode) return null;
          if (collapsedLaneIds &&
              (collapsedLaneIds.has(fromNode.laneId) ||
               collapsedLaneIds.has(toNode.laneId))) return null;
          if (focusVisibility && !focusVisibility.edges.has(idx)) return null;
          if (groupId && (isLaneFrozen(groupId, fromNode.laneId) ||
                          isLaneFrozen(groupId, toNode.laneId))) return null;
          // Only allow inserting within the same lane for the prototype —
          // cross-lane adjustments raise math questions we haven't scoped.
          if (fromNode.laneId !== toNode.laneId) return null;
          const x1 = fromNode._x + fromNode._w;
          const y1 = fromNode._y + fromNode._h / 2;
          const x2 = toNode._x;
          const y2 = toNode._y + toNode._h / 2;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <button
              key={`ins-${idx}`}
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setAdjustTarget({
                  fromNode,
                  toNode,
                  midX,
                  midY,
                });
              }}
              className="absolute z-20 inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 shadow-sm opacity-50 hover:opacity-100 transition-all"
              style={{
                left: midX - 10,
                top: midY - 10,
              }}
              title="Correctie toevoegen op deze stroom"
            >
              <Plus size={11} strokeWidth={2.5} />
            </button>
          );
        })}

        {/* Phase 7 — adjustment editor popover. Anchored at the edge
         *  midpoint of the chosen target. */}
        {adjustTarget && (
          <AdjustmentEditor
            anchor={{ x: adjustTarget.midX, y: adjustTarget.midY }}
            fromLabel={adjustTarget.fromNode.label || adjustTarget.fromNode.supplier || adjustTarget.fromNode.id}
            toLabel={adjustTarget.toNode.label || adjustTarget.toNode.supplier || adjustTarget.toNode.id}
            onClose={() => setAdjustTarget(null)}
            onCommit={({ amount, reason }) => {
              if (!groupId) return;
              const fromN = adjustTarget.fromNode;
              const toN = adjustTarget.toNode;
              // Placement model: an adjustment sits visually between two
              // existing columns. We make space by shifting the to-node
              // (and every node to its right within the same lane) by +1,
              // then place the adjustment in the column the to-node just
              // vacated. Same row as the to-node so the edge runs straight.
              const targetCol = toN.col ?? 0;
              const targetRow = toN.row ?? 0;
              for (const n of flow.nodes) {
                if (
                  n.laneId === fromN.laneId &&
                  (n.col ?? 0) >= targetCol &&
                  n.id !== fromN.id // never shift the from-node
                ) {
                  setNodeField(groupId, n.id, "col", (n.col ?? 0) + 1);
                }
              }
              insertAdjustmentOnEdge(
                groupId,
                fromN.id,
                toN.id,
                fromN.laneId,
                { amount, reason, col: targetCol, row: targetRow }
              );
              setAdjustTarget(null);
            }}
          />
        )}

        {/* Distribution-method chips — HTML overlay positioned at the bezier
         * midpoint of the settlement's primary incoming edge. Centred on the
         * arrow's length (translateX(-50%)) and dropped 14 px below the line
         * so it doesn't collide with edge labels (e.g. "Maslow 7/12"), reads
         * as a label hanging from the arrow midline. */}
        {positionedNodes.map((node) => {
          if (node.type !== "settlement" || node.outOfScope) return null;
          if (collapsedLaneIds && collapsedLaneIds.has(node.laneId)) return null;
          if (focusVisibility && !focusVisibility.nodes.has(node.id)) return null;
          const r = resolveDistribution(node);
          if (!r) return null;

          // Find the primary incoming edge (largest amount) — chip describes
          // the destination's distribution, but we centre it on whichever
          // arrow visually carries the most cost into this settlement.
          let primary = null;
          for (const e of flow.edges) {
            if (e.to !== node.id) continue;
            if (!primary || (e.amount || 0) > (primary.amount || 0)) primary = e;
          }
          if (!primary) return null;
          const fromNode = nodeById[primary.from];
          if (!fromNode) return null;
          // If either end is hidden by focus, hide the chip too.
          if (focusVisibility && !focusVisibility.nodes.has(fromNode.id)) return null;

          const x1 = fromNode._x + fromNode._w;
          const y1 = fromNode._y + fromNode._h / 2;
          const x2 = node._x;
          const y2 = node._y + node._h / 2;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          const isInfo = r.tone === "info";
          const tone = isInfo
            ? "text-sky-700 bg-sky-50 border-sky-200"
            : "text-slate-700 bg-white border-slate-200";
          const isInHover = hoverSet ? hoverSet.nodes.has(node.id) : false;
          const isOutOfScope = scopeHighlight && !scopeHighlight.nodes.has(node.id);
          const dim = (!!hoverSet && !isInHover) || isOutOfScope;
          return (
            <div
              key={`dist-${node.id}`}
              className="absolute pointer-events-none"
              style={{
                left: midX,
                top: midY + 14,
                transform: "translateX(-50%)",
                opacity: dim ? 0.4 : 1,
                transition: "opacity 120ms",
              }}
              title={r.long}
            >
              <span
                className={`inline-flex items-center px-2 h-[18px] rounded text-[10px] font-medium border whitespace-nowrap ${tone}`}
              >
                {r.inline}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* LaneDetailSheet — L3 right-anchored slide-out                 */
/* ──────────────────────────────────────────────────────────── */
/* Renders the full canvas detail for a single lane (plus any cross-lane
 * neighbours via getSingleLaneFlow) inside an overlay sheet. Click the
 * backdrop or press ESC to dismiss. Self-contained inspector state. */
function LaneDetailSheet({ laneId, scopeAudienceId, onClearScope, onClose, onJumpToLane, onJumpToMeters, onJumpToBookkeeping, onJumpToTenants }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [overlay, setOverlay] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [activeTab, setActiveTab] = useState("settle"); // "settle" or "canvas"
  // Phase 7 — canvas edit mode toggle. Off by default so the canvas
  // behaves as a read-mostly view; flipping on enables drag, delete-x,
  // and the edge-+ adjustment affordance.
  const [canvasEditMode, setCanvasEditMode] = useState(false);

  // Scope-derived data: when the user came in via an audience filter, we
  // honour that filter inside the sheet too. Settle tab hard-filters its
  // settlements list to the scoped audience; Canvas tab soft-dims nodes /
  // edges / chips that don't reach the audience.
  const scopedAudience = useMemo(() => {
    if (!scopeAudienceId) return null;
    const flow = getCostFlow();
    return (flow.siblingGroups || []).find((g) => g.id === scopeAudienceId) || null;
  }, [scopeAudienceId]);
  const scopeSubgraph = useMemo(
    () => (scopeAudienceId ? getAudienceSubgraph(scopeAudienceId) : null),
    [scopeAudienceId]
  );

  // Switching lanes: clear stale node selection from the previous lane.
  useEffect(() => {
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  }, [laneId]);

  const flow = useMemo(() => getSingleLaneFlow(laneId), [laneId]);
  const lane = flow?.lanes.find((l) => l.id === laneId);
  const summary = lane ? summariseLane(laneId) : null;
  const Icon = lane ? (categoryIcon[lane.category] || FileText) : FileText;

  const hoverHighlight = useMemo(() => {
    if (hoveredNodeId) return getConnectedSubgraph(hoveredNodeId);
    return null;
  }, [hoveredNodeId]);

  const canvasRef = useRef(null);
  const laneRefs = useRef({});

  // ESC: nested unwind — clear hover, then selection, then close sheet
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (hoveredNodeId) setHoveredNodeId(null);
        else if (selectedNodeId) setSelectedNodeId(null);
        else onClose?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredNodeId, selectedNodeId, onClose]);

  if (!flow || !lane) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/35 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-y-0 right-0 z-50 bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(92%, 1400px)" }}
      >
        {/* Sheet header */}
        <div className="flex items-start gap-3 px-5 py-3.5 border-b border-slate-200 shrink-0 bg-white">
          <div className="w-9 h-9 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
            <Icon size={16} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Componentdetail
            </div>
            <div className="text-[14px] font-semibold text-slate-900 leading-tight truncate">
              {lane.title}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
              {lane.category} · {lane.complexity === "simple" ? "eenvoudig" : lane.complexity || "eenvoudig"}
              <span className="text-slate-400 ml-2">
                {fmtEur(summary.expected)} verwacht · {fmtEur(summary.settled)} afgerekend
              </span>
              {summary.issueCount > 0 && (
                <span className="ml-2 text-amber-700 normal-case">
                  · {summary.issueCount} aandachtspunt{summary.issueCount === 1 ? "" : "en"}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
            title="Sluiten (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab strip — Settle is the workflow page (Phase 2 default), Canvas
         * is the visual flow detail. */}
        <div className="flex items-center gap-0 px-5 border-b border-slate-200 shrink-0 bg-white">
          {[
            { id: "settle", label: "Afrekenproces" },
            { id: "canvas", label: "Canvas" },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={`relative inline-flex items-center px-3 h-9 text-[12px] transition-colors ${
                  active
                    ? "text-slate-900 font-medium"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-slate-900" />
                )}
              </button>
            );
          })}
        </div>

        {/* Audience-scope banner — shown on both tabs when the user came in
         * via an audience filter from the L1 Sankey or Overview. Settle tab
         * hard-filters its settlements list to this audience; Canvas tab
         * soft-dims nodes that don't reach it. */}
        {scopedAudience && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-200 bg-slate-50/60 shrink-0">
            <Filter size={11} className="text-slate-500 shrink-0" />
            <div className="text-[11px] text-slate-700 flex-1 min-w-0">
              <span className="text-slate-500">Gefilterd op</span>{" "}
              <span className="font-semibold text-slate-900">
                {scopedAudience.name}
              </span>
              {scopedAudience.vheCount != null && (
                <span className="text-slate-400">
                  {" · "}
                  {scopedAudience.vheCount} VHE
                </span>
              )}
            </div>
            {onClearScope && (
              <button
                onClick={onClearScope}
                className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 shrink-0"
              >
                Alle doelgroepen tonen <ChevronRight size={11} />
              </button>
            )}
          </div>
        )}

        {/* Phase 7 — canvas edit toolbar (only on the Canvas tab). The
         * toggle separates "I'm reading the flow" from "I'm rearranging
         * the flow", so users don't accidentally drag while exploring. */}
        {activeTab === "canvas" && (
          <div className="flex items-center gap-2 px-5 py-1.5 border-b border-slate-200 bg-white shrink-0">
            <span className="text-[11px] text-slate-500">
              {canvasEditMode
                ? "Sleep knooppunten om te ordenen, klik × om te verwijderen, of klik + op een lijn om een correctie toe te voegen."
                : "Klik nodes om te bekijken, of zet bewerken aan om de stroom te wijzigen."}
            </span>
            <button
              type="button"
              onClick={() => setCanvasEditMode((v) => !v)}
              className={`ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors ${
                canvasEditMode
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
              title={canvasEditMode ? "Bewerken afsluiten" : "Stroom bewerken"}
            >
              {canvasEditMode ? (
                <>
                  <X size={11} strokeWidth={2.5} />
                  Klaar met bewerken
                </>
              ) : (
                <>
                  <Pencil size={11} />
                  Bewerken
                </>
              )}
            </button>
          </div>
        )}

        {/* Sheet body */}
        <div className="flex flex-1 min-h-0">
          {activeTab === "canvas" ? (
            <>
              <Canvas
                flow={flow}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
                overlay={overlay}
                hoveredNodeId={hoveredNodeId}
                setHoveredNodeId={setHoveredNodeId}
                hoverHighlight={hoverHighlight}
                focusVisibility={null}
                scopeHighlight={scopeSubgraph}
                showEdgeLabels={showEdgeLabels}
                setSelectedLaneId={() => {}}
                foldedLaneIds={null}
                toggleLaneFold={null}
                canvasRef={canvasRef}
                laneRefs={laneRefs}
                onBackgroundClick={() => setSelectedNodeId(null)}
                editMode={canvasEditMode}
                onDeleteNode={(node) => {
                  const groupId = flow.group?.id;
                  if (!groupId) return;
                  if (typeof window !== "undefined" &&
                      !window.confirm(
                        `"${node.label || node.id}" verwijderen uit de kostenstroom?`
                      )) return;
                  // Selected/hovered state stale-clean so the inspector
                  // doesn't try to render a deleted node.
                  if (selectedNodeId === node.id) setSelectedNodeId(null);
                  if (hoveredNodeId === node.id) setHoveredNodeId(null);
                  deleteNodeAction(groupId, node.id, node.laneId);
                }}
              />
              {selectedNodeId ? (
                <Inspector
                  nodeId={selectedNodeId}
                  onClose={() => setSelectedNodeId(null)}
                  onJumpToMeters={onJumpToMeters}
                  onJumpToLane={onJumpToLane}
                  currentLaneId={laneId}
                />
              ) : null}
            </>
          ) : (
            <LaneWorkflowView
              laneId={laneId}
              scopeAudienceId={scopeAudienceId}
              onJumpToBookkeeping={onJumpToBookkeeping}
              onJumpToTenants={onJumpToTenants}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* FullCanvasSheet — all lanes on one screen (overlay variant)   */
/* ──────────────────────────────────────────────────────────── */
/* Same shape as LaneDetailSheet but renders the full multi-lane Canvas
 * unfiltered. For users who want to see the entire complex's flow at once
 * rather than drilling lane-by-lane. Lane folding is enabled here (multi-lane
 * makes it useful) and inspector cross-lane links work because the full graph
 * is visible. */
function FullCanvasSheet({ onClose, onJumpToMeters }) {
  const flow = getCostFlow();
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [overlay, setOverlay] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [foldedLaneIds, setFoldedLaneIds] = useState(() => new Set());

  function toggleLaneFold(laneId) {
    setFoldedLaneIds((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  }

  const hoverHighlight = useMemo(() => {
    if (hoveredNodeId) return getConnectedSubgraph(hoveredNodeId);
    return null;
  }, [hoveredNodeId]);

  const canvasRef = useRef(null);
  const laneRefs = useRef({});

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (hoveredNodeId) setHoveredNodeId(null);
        else if (selectedNodeId) setSelectedNodeId(null);
        else onClose?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredNodeId, selectedNodeId, onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/35 z-40" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-50 bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(96%, 1700px)" }}
      >
        <div className="flex items-start gap-3 px-5 py-3.5 border-b border-slate-200 shrink-0 bg-white">
          <div className="w-9 h-9 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
            <Layers size={16} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Full canvas
            </div>
            <div className="text-[14px] font-semibold text-slate-900 leading-tight truncate">
              {flow.group?.name || "All lanes"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {flow.lanes.length} lane{flow.lanes.length === 1 ? "" : "s"} · period {flow.period}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <Canvas
            flow={flow}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            overlay={overlay}
            hoveredNodeId={hoveredNodeId}
            setHoveredNodeId={setHoveredNodeId}
            hoverHighlight={hoverHighlight}
            focusVisibility={null}
            showEdgeLabels={showEdgeLabels}
            setSelectedLaneId={() => {}}
            foldedLaneIds={foldedLaneIds}
            toggleLaneFold={toggleLaneFold}
            canvasRef={canvasRef}
            laneRefs={laneRefs}
            onBackgroundClick={() => setSelectedNodeId(null)}
          />
          {selectedNodeId ? (
            <Inspector
              nodeId={selectedNodeId}
              onClose={() => setSelectedNodeId(null)}
              onJumpToMeters={onJumpToMeters}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Inspector (right)                                            */
/* ──────────────────────────────────────────────────────────── */
function StatusPill({ status }) {
  const map = {
    matched:         { color: "text-slate-700",  bg: "bg-slate-100",  label: "Matched" },
    matched_partial: { color: "text-amber-700",  bg: "bg-amber-50",   label: "Partially matched" },
    wrong_account:   { color: "text-red-700",    bg: "bg-red-50",     label: "Wrong account" },
    duplicate:       { color: "text-amber-700",  bg: "bg-amber-50",   label: "Duplicate" },
    missing:         { color: "text-red-700",    bg: "bg-red-50",     label: "Missing" },
  };
  const cfg = map[status] || { color: "text-slate-500", bg: "bg-slate-50", label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function LaneOverview({ flow, laneId, onClose, onPickNode }) {
  const lane = flow.lanes.find((l) => l.id === laneId);
  if (!lane) return null;
  const nodes = flow.nodes.filter((n) => n.laneId === laneId);
  const summary = summariseLane(laneId);
  const sources = nodes.filter((n) => n.type === "source");
  const settlements = nodes.filter((n) => n.type === "settlement");
  const splits = nodes.filter((n) => n.type === "split");
  const adjustments = nodes.filter((n) => n.type === "adjustment");
  const serviceCodes = getLaneServiceCodes(laneId);
  const Icon = categoryIcon[lane.category] || FileText;
  const health = healthBadge[summary.health];

  return (
    <aside className="w-[380px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
      {/* Sticky header */}
      <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <div className="mt-0.5 w-7 h-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
            <Icon size={14} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Lane overview
            </div>
            <div className="text-sm font-semibold text-slate-900 leading-tight">
              {lane.title}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
              {lane.category} · {lane.complexity} flow
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Health + totals */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${health.dot}`} />
            <span className="text-[11px] text-slate-700">{health.label}</span>
            {summary.issueCount > 0 && (
              <span className="ml-auto text-[10px] text-amber-700 uppercase tracking-widest">
                {summary.issueCount} flag{summary.issueCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-slate-100 p-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                Source total
              </div>
              <div className="text-slate-800 font-semibold tabular-nums">
                {fmtEur(summary.expected)}
              </div>
            </div>
            <div className="rounded border border-slate-100 p-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                Settled total
              </div>
              <div className="text-slate-800 font-semibold tabular-nums">
                {fmtEur(summary.settled)}
              </div>
            </div>
          </div>
        </div>

        {/* Service codes — quiet bridge to the bookkeeping vocabulary */}
        {serviceCodes.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Service code{serviceCodes.length === 1 ? "" : "s"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {serviceCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-mono text-slate-700 bg-slate-100 border border-slate-200"
                >
                  {code}
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400">
              ERP-side codes for this lane's settlements
            </div>
          </div>
        )}

        {/* Composition */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            Composition
          </div>
          <ul className="space-y-1.5 text-[11px]">
            <li className="flex justify-between">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <CircleDot size={10} /> Sources
              </span>
              <span className="text-slate-700">{sources.length}</span>
            </li>
            {splits.length > 0 && (
              <li className="flex justify-between">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Split size={10} /> Splits
                </span>
                <span className="text-slate-700">{splits.length}</span>
              </li>
            )}
            {adjustments.length > 0 && (
              <li className="flex justify-between">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Plus size={10} /> Adjustments
                </span>
                <span className="text-slate-700">{adjustments.length}</span>
              </li>
            )}
            <li className="flex justify-between">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Users size={10} /> Settlements
              </span>
              <span className="text-slate-700">{settlements.length}</span>
            </li>
          </ul>
        </div>

        {/* Quick-pick nodes */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            Open a node
          </div>
          <ul className="space-y-1">
            {nodes.map((n) => {
              const TIcon = getTypeIcon(n);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => onPickNode(n.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left text-[11px]"
                  >
                    <TIcon size={11} className="text-slate-400 shrink-0" />
                    <span className="text-slate-700 truncate flex-1">{n.label}</span>
                    <span className="text-slate-500 tabular-nums shrink-0">
                      {n.type === "adjustment"
                        ? (n.amount || 0) >= 0
                          ? `+${fmtEur(n.amount)}`
                          : `−${fmtEur(Math.abs(n.amount))}`
                        : fmtEur(n.amount)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Help / glossary panel                                        */
/* ──────────────────────────────────────────────────────────── */
function HelpPanel({ onClose }) {
  const Item = ({ Icon, label, children }) => (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center text-slate-600 shrink-0">
        <Icon size={12} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-slate-800 leading-tight">{label}</div>
        <div className="text-[11px] text-slate-600 leading-snug mt-0.5">{children}</div>
      </div>
    </li>
  );

  return (
    <aside className="w-[380px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
      <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <div className="mt-0.5 w-7 h-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
            <HelpCircle size={14} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              How to read this
            </div>
            <div className="text-sm font-semibold text-slate-900 leading-tight">
              Cost flow vocabulary
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">
            Read it like a story
          </div>
          <div className="text-[11px] text-slate-700 leading-snug">
            Costs come in from <strong>sources on the left</strong> — meters, contracts,
            invoices, recurring fees. They flow through <strong>splits and adjustments</strong>
            in the middle until they land on <strong>settlements on the right</strong>: the
            (Service × Audience) buckets where tenants actually pay.
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            What you'll see on the canvas
          </div>
          <ul className="space-y-2.5">
            <Item Icon={CircleDot} label="Source">
              Where money enters. Five kinds: <em>Metered</em> (utility meter readings × tariff),
              <em> Contract</em> (fixed service contract like cleaning),
              <em> Pass-through</em> (variable per-incident invoices like sewer unblocking),
              <em> Recurring</em> (annual fee like glass insurance), and
              <em> Internal</em> (in-house labour or computed surcharge).
            </Item>
            <Item Icon={Split} label="Split rule">
              How a cost gets divided. The dashed card shows the rule itself —
              "80%/20%", "96/108", or a per-meter measurement.
            </Item>
            <Item Icon={Plus} label="Adjustment">
              Modifies the flow up (positive amount, green Plus) or down
              (negative amount, red Minus). Used for refunds, transfers in
              from another lane, late-booked invoices, or carve-outs the
              bookkeeping doesn't see.
            </Item>
            <Item Icon={CircleDot} label="Marker">
              A labelled checkpoint on the flow — running total, slice name,
              or cross-lane bridge. No transformation; just an annotation so
              you can read what's flowing where.
            </Item>
            <Item Icon={Users} label="Settlement target">
              Where money lands. Each one is a <em>(Service × Audience × Period)</em>
              — what the tenants actually settle against. Carries the advance,
              the actual cost, and the delta.
            </Item>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            Audiences
          </div>
          <div className="text-[11px] text-slate-600 leading-snug mb-2">
            Groups of VHEs that share a charge. Three kinds:
          </div>
          <ul className="space-y-1.5 text-[11px]">
            <li className="flex items-baseline gap-2">
              <span className="inline-block w-1 h-3 bg-slate-700 rounded-sm shrink-0" />
              <strong className="text-slate-700">Complex</strong>
              <span className="text-slate-500">— the whole 216-VHE building</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="inline-block w-1 h-3 bg-slate-500 rounded-sm shrink-0" />
              <strong className="text-slate-700">Block</strong>
              <span className="text-slate-500">— a sub-group like Blok 1 or Blok 2</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="inline-block w-1 h-3 bg-amber-500 rounded-sm shrink-0" />
              <strong className="text-slate-700">Ad-hoc</strong>
              <span className="text-slate-500">— a custom set, e.g. the 117 VHEs that share a sewer stack</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            What the dots mean
          </div>
          <ul className="space-y-1.5 text-[11px]">
            <li className="flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
              <span className="text-slate-700">Reconciled — matches the bookkeeping cleanly</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-700">Has warnings — partial match or manual adjustment</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-slate-700">Has errors — wrong account, missing entries, etc.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            Quick interactions
          </div>
          <ul className="space-y-1 text-[11px] text-slate-700">
            <li><strong>Hover</strong> a node to highlight its full upstream and downstream path.</li>
            <li><strong>Click</strong> a node to open the details panel on the right.</li>
            <li><strong>Click an audience card</strong> to filter to costs that audience pays.</li>
            <li><strong>Search by name or service code</strong> in the rail.</li>
            <li><strong>View options</strong> turns the bookkeeping overlay or focus mode on/off.</li>
            <li><strong>ESC</strong> walks back through hover → selection.</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}

function Inspector({ nodeId, onClose, onJumpToMeters, onJumpToLane, currentLaneId = null }) {
  if (!nodeId) return null;
  const node = getNodeById(nodeId);
  if (!node) return null;

  const { incoming, outgoing } = getEdgesForNode(nodeId);
  const isSource = node.type === "source";
  // Cross-lane neighbours — only meaningful when we have a sheet context with
  // a focal lane to navigate FROM. Without `currentLaneId`/`onJumpToLane` the
  // section is suppressed.
  const crossLane =
    currentLaneId && onJumpToLane ? getCrossLaneNeighbors(nodeId) : { incoming: [], outgoing: [] };
  const hasCrossLane = crossLane.incoming.length > 0 || crossLane.outgoing.length > 0;

  return (
    <aside className="w-[380px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
      {/* Sticky header */}
      <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            {node.type}
          </div>
          <div className="text-sm font-semibold text-slate-900 leading-tight">
            {node.label}
          </div>
          {node.subLabel && (
            <div className="text-[11px] text-slate-500 mt-0.5">{node.subLabel}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Cross-lane connections — surfaced near the top because they're
         * navigation, not detail. Click swaps the sheet to the other lane. */}
        {hasCrossLane && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Connected to other lanes
            </div>
            <ul className="space-y-1">
              {crossLane.incoming.map((c) => (
                <li key={`in-${c.lane.id}`}>
                  <button
                    onClick={() => onJumpToLane?.(c.lane.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left text-[11px]"
                    title={`Jump to ${c.lane.title}`}
                  >
                    <ArrowLeft size={11} className="text-slate-400 shrink-0" />
                    <span className="text-slate-500 shrink-0">From</span>
                    <span className="font-medium text-slate-800 truncate flex-1">
                      {c.lane.title}
                    </span>
                    <span className="tabular-nums text-slate-600 shrink-0">
                      {fmtEur(c.amount)}
                    </span>
                    <ChevronRight size={11} className="text-slate-400 shrink-0" />
                  </button>
                </li>
              ))}
              {crossLane.outgoing.map((c) => (
                <li key={`out-${c.lane.id}`}>
                  <button
                    onClick={() => onJumpToLane?.(c.lane.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left text-[11px]"
                    title={`Jump to ${c.lane.title}`}
                  >
                    <ChevronRight size={11} className="text-slate-400 shrink-0 rotate-180 invisible" />
                    <span className="text-slate-500 shrink-0">To</span>
                    <span className="font-medium text-slate-800 truncate flex-1">
                      {c.lane.title}
                    </span>
                    <span className="tabular-nums text-slate-600 shrink-0">
                      {fmtEur(c.amount)}
                    </span>
                    <ChevronRight size={11} className="text-slate-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Amount panel. Sources headline budgeted (matches canvas) and show
         * actual + variance subtly underneath. Other types show their amount
         * straight (sign-aware for adjustments). */}
        <div className="rounded-lg border border-slate-200 p-3">
          {node.type === "source" && node.budgetedAmount != null ? (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                Budgeted {getCostFlow().period || ""}
              </div>
              <div className="text-2xl font-semibold text-slate-900 tabular-nums">
                {fmtEur2(node.budgetedAmount)}
              </div>
              {node.amount != null && (() => {
                const v = node.amount - node.budgetedAmount;
                const vPct = node.budgetedAmount !== 0 ? (v / node.budgetedAmount) * 100 : 0;
                const over = v > 0.5;
                const under = v < -0.5;
                return (
                  <div className="mt-1.5 flex items-baseline gap-2 text-[11px]">
                    <span className="text-slate-500">Actual</span>
                    <span className="text-slate-700 tabular-nums">{fmtEur2(node.amount)}</span>
                    {(over || under) && (
                      <span className={over ? "text-amber-700" : "text-emerald-700"}>
                        {over ? "+" : ""}{vPct.toFixed(1)}% {over ? "over" : "under"}
                      </span>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                Conceptual amount
              </div>
              <div className="text-2xl font-semibold text-slate-900 tabular-nums">
                {node.type === "adjustment"
                  ? (node.amount || 0) >= 0
                    ? `+${fmtEur2(node.amount)}`
                    : `−${fmtEur2(Math.abs(node.amount))}`
                  : fmtEur2(node.amount)}
              </div>
            </>
          )}
          {node.consumptionUnit && (
            <div className="text-[11px] text-slate-500 mt-1">
              {node.expectedConsumption?.toLocaleString("nl-NL")} {node.consumptionUnit} from metering
            </div>
          )}
        </div>

        {/* Type-specific content */}
        {node.type === "source" && (
          <SourceInspectorBody
            node={node}
            edges={{ incoming, outgoing }}
            onJumpToMeters={onJumpToMeters}
          />
        )}

        {node.type === "split" && (
          <SplitInspectorBody node={node} outgoing={outgoing} />
        )}

        {node.type === "adjustment" && (
          <AdjustmentInspectorBody node={node} />
        )}

        {node.type === "settlement" && (
          <SettlementInspectorBody node={node} />
        )}

        {/* Flags — universal but only for adjustment + marker since source
         * surfaces them via NeedsAttentionPanel and settlement folds them into
         * MoreDetails. The canvas + per-type body cover the rest. */}
        {(node.type === "adjustment" || node.type === "marker") &&
          node.flags && node.flags.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Reconciliation flags
            </div>
            <ul className="space-y-1.5">
              {node.flags.map((f, idx) => (
                <li
                  key={idx}
                  className={`flex items-start gap-2 text-[11px] ${
                    f.kind === "error" ? "text-red-700" : "text-amber-800"
                  }`}
                >
                  {f.kind === "error" ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
                  <span>{f.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

function YoyTrend({ yoy }) {
  if (!yoy || yoy.length < 2) return null;
  const sorted = [...yoy].sort((a, b) => a.year - b.year);
  const max = Math.max(...sorted.map((y) => y.amount));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const pct = prev && prev.amount > 0 ? (latest.amount - prev.amount) / prev.amount : 0;
  const trendIcon = pct > 0.02 ? TrendingUp : pct < -0.02 ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendColor =
    pct > 0.02 ? "text-amber-700" : pct < -0.02 ? "text-emerald-700" : "text-slate-500";

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
          Year over year
        </div>
        <div className={`inline-flex items-center gap-1 text-[11px] ${trendColor}`}>
          <TrendIcon size={11} />
          <span className="tabular-nums">
            {pct > 0 ? "+" : ""}
            {Math.round(pct * 100)}% vs {prev.year}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {sorted.map((y) => {
          const w = max > 0 ? (y.amount / max) * 100 : 0;
          const isLatest = y.year === latest.year;
          return (
            <div key={y.year} className="flex items-center gap-2 text-[11px]">
              <span className={`w-9 ${isLatest ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                {y.year}
              </span>
              <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded ${isLatest ? "bg-slate-700" : "bg-slate-300"}`}
                  style={{ width: `${w}%` }}
                />
              </div>
              <span className={`tabular-nums ${isLatest ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                {fmtEur(y.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupplierBreakdown({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Supplier breakdown
      </div>
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li key={i} className="text-[11px]">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="min-w-0 flex-1">
                <div className="text-slate-800 truncate">{s.name}</div>
                {s.role && (
                  <div className="text-[10px] text-slate-400 truncate">{s.role}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-slate-700 tabular-nums">{fmtEur(s.amount)}</div>
                <div className="text-[10px] text-slate-400">{s.evidenceCount} boekstuk</div>
              </div>
            </div>
            {s.status && s.status !== "matched" && (
              <div className="mt-1">
                <StatusPill status={s.status} />
              </div>
            )}
            {s.note && (
              <div className="text-[10px] text-slate-500 italic mt-1">{s.note}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function TemporalCoverage({ coverage }) {
  if (!coverage) return null;
  const cadence = coverage.cadence || "monthly";
  const missing = new Set(coverage.missing || []);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
          Temporal coverage
        </div>
        <div className="text-[10px] text-slate-500 capitalize">{cadence.replace("_", " ")}</div>
      </div>

      {cadence === "monthly" && (
        <div>
          <div className="grid grid-cols-12 gap-1 mb-1.5">
            {MONTHS_SHORT.map((m) => {
              const isMissing = missing.has(m);
              return (
                <div
                  key={m}
                  title={`${m} ${isMissing ? "— missing" : "— booked"}`}
                  className={`h-5 rounded-sm flex items-center justify-center text-[9px] tabular-nums ${
                    isMissing
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {m[0]}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] text-slate-600">
            {coverage.bookedMonths} of {coverage.expectedMonths} months booked
            {coverage.missing && coverage.missing.length > 0 && (
              <span className="text-amber-700"> · missing {coverage.missing.join(", ")}</span>
            )}
          </div>
        </div>
      )}

      {cadence === "quarterly" && (
        <div>
          <div className="grid grid-cols-4 gap-1 mb-1.5">
            {["Q1", "Q2", "Q3", "Q4"].map((q, i) => {
              const isMissing = (coverage.bookedQuarters || 0) <= i;
              return (
                <div
                  key={q}
                  className={`h-5 rounded-sm flex items-center justify-center text-[9px] ${
                    isMissing
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {q}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] text-slate-600">
            {coverage.bookedQuarters} of {coverage.expectedQuarters} quarters booked
          </div>
        </div>
      )}

      {(cadence === "annual" || cadence === "ad_hoc") && (
        <div className="text-[11px] text-slate-600">{coverage.note}</div>
      )}

      {coverage.note && cadence !== "annual" && cadence !== "ad_hoc" && (
        <div className="text-[10px] text-slate-500 italic mt-1.5">{coverage.note}</div>
      )}
    </div>
  );
}

function ManualNotes({ notes }) {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Notes
      </div>
      <ul className="space-y-1.5">
        {notes.map((n, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-[11px] ${
              n.kind === "warn" ? "text-amber-800" : "text-slate-600"
            }`}
          >
            {n.kind === "warn" ? (
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            ) : (
              <Info size={11} className="mt-0.5 shrink-0 text-slate-400" />
            )}
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Plain-language one-line description per source kind */
const KIND_EXPLANATION = {
  metered:      "Cost = metered consumption × tariff.",
  contracted:   "Cost = fixed contractual fee on the agreed cadence.",
  pass_through: "Cost = sum of incident-driven invoices in the period.",
  recurring:    "Cost = recurring fixed fee booked once per cadence.",
  internal:     "Cost = allocated internally (labour or surcharge).",
};

/* ─── Needs attention ── consolidates flags, missing months, wrong-account,
 * cross-complex warnings into one prominent panel. Renders only when there
 * is something to surface. */
function NeedsAttentionPanel({ node }) {
  const items = [];

  for (const a of node.anchors || []) {
    if (a.status === "wrong_account") {
      items.push({
        kind: "error",
        title: `Wrong account · ${fmtEur(a.amount)}`,
        detail: a.note || `Booked on ${a.ledgerAccount}`,
      });
    } else if (a.status === "missing") {
      items.push({
        kind: "error",
        title: `Missing in ledger · ${fmtEur(a.amount)}`,
        detail: a.note || `Expected on ${a.ledgerAccount}`,
      });
    } else if (a.status === "duplicate") {
      items.push({
        kind: "warn",
        title: `Possible duplicate · ${fmtEur(a.amount)}`,
        detail: a.note || `Check ${a.ledgerAccount}`,
      });
    } else if (a.status === "matched_partial" && a.note) {
      items.push({ kind: "warn", title: "Partially anchored", detail: a.note });
    }
  }

  // Missing periods from ledger
  if (node.temporalCoverage?.missing && node.temporalCoverage.missing.length > 0) {
    const missing = node.temporalCoverage.missing;
    const cadence = node.temporalCoverage.cadence || "monthly";
    const unit = cadence === "monthly" ? "month" : cadence === "quarterly" ? "quarter" : "period";
    items.push({
      kind: "warn",
      title: `${missing.length} ${unit}${missing.length === 1 ? "" : "s"} missing from ledger`,
      detail:
        `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not yet booked` +
        (node.temporalCoverage.note ? ` — ${node.temporalCoverage.note.toLowerCase()}` : ""),
    });
  }

  // Cross-complex
  if (node.crossesComplex) {
    items.push({
      kind: "warn",
      title: "Crosses bookkeeping complex",
      detail: "This meter feeds VHEs in another complex too — settlement uses a cross-complex split downstream.",
    });
  }

  // Manual flags + warning notes
  for (const f of node.flags || []) {
    items.push({ kind: f.kind === "error" ? "error" : "warn", title: f.note });
  }
  for (const n of node.manualNotes || []) {
    if (n.kind === "warn") items.push({ kind: "warn", title: n.text });
  }

  if (items.length === 0) return null;

  // Dedupe by title
  const seen = new Set();
  const unique = items.filter((i) => {
    if (seen.has(i.title)) return false;
    seen.add(i.title);
    return true;
  });

  const hasError = unique.some((i) => i.kind === "error");
  const containerClass = hasError
    ? "border-red-200 bg-red-50/40"
    : "border-amber-200 bg-amber-50/40";
  const headingClass = hasError ? "text-red-800" : "text-amber-800";

  return (
    <div className={`rounded-lg border p-3 ${containerClass}`}>
      <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${headingClass}`}>
        Needs attention · {unique.length}
      </div>
      <ul className="space-y-2">
        {unique.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px]">
            {it.kind === "error" ? (
              <AlertCircle size={12} className="text-red-700 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={12} className="text-amber-700 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <div className={`${it.kind === "error" ? "text-red-800" : "text-amber-900"} font-medium leading-tight`}>
                {it.title}
              </div>
              {it.detail && (
                <div className="text-slate-600 mt-0.5 leading-snug">{it.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Source details — kind-aware brief ──
 * Metered: EAN / supplier / consumption / cost  + link to Meters tab
 * Contracted: contract / supplier / cadence / cost
 * Pass-through: counterparty / cadence / cost
 * Recurring: issuer / cadence / cost
 * Internal: basis / cadence / cost
 */
const PANEL_TITLE_BY_KIND = {
  metered: "Consumption",
  contracted: "Contract",
  pass_through: "Invoices",
  recurring: "Recurring fee",
  internal: "Calculation",
};
const ID_LABEL_BY_KIND = {
  metered: "EAN",
  contracted: "Contract",
  pass_through: "Reference",
  recurring: "Reference",
  internal: "Reference",
};

function SourceDetailsPanel({ node, onJumpToMeters }) {
  const KindIcon = sourceKindIcon(node);
  const kindLabel = SOURCE_KIND[node.sourceKind]?.label || "Source";
  const panelTitle = PANEL_TITLE_BY_KIND[node.sourceKind] || "Source";
  const idLabel = ID_LABEL_BY_KIND[node.sourceKind] || "ID";

  // For metered, strip the "EAN " prefix so the row label carries that
  const idValue =
    node.sourceKind === "metered" && node.identifier?.startsWith("EAN ")
      ? node.identifier.replace(/^EAN\s+/, "")
      : node.identifier;

  const supplierLabel =
    node.supplier === "multi"
      ? `Multiple (${node.supplierBreakdown?.length || "?"})`
      : node.supplier;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
          {panelTitle}
        </div>
        <span className="inline-flex items-center gap-1 px-1.5 h-4 rounded text-[9px] uppercase tracking-widest font-semibold text-slate-700 bg-slate-100 border border-slate-200">
          <KindIcon size={9} strokeWidth={2} />
          {kindLabel}
        </span>
      </div>

      <div className="text-[11px] text-slate-600 leading-snug mb-2.5">
        {KIND_EXPLANATION[node.sourceKind] || ""}
      </div>

      <div className="space-y-1 text-[11px]">
        {idValue && (
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 shrink-0">{idLabel}</span>
            <span className="text-slate-800 font-mono text-[10px] break-all text-right">
              {idValue}
            </span>
          </div>
        )}
        {supplierLabel && supplierLabel !== "Internal" && (
          <div className="flex justify-between">
            <span className="text-slate-500">Supplier</span>
            <span className="text-slate-800">{supplierLabel}</span>
          </div>
        )}
        {node.sourceKind === "metered" && node.expectedConsumption != null && (
          <div className="flex justify-between">
            <span className="text-slate-500">Annual consumption</span>
            <span className="text-slate-800 tabular-nums">
              {node.expectedConsumption.toLocaleString("nl-NL")} {node.consumptionUnit}
            </span>
          </div>
        )}
        {node.cadence && (
          <div className="flex justify-between">
            <span className="text-slate-500">Cadence</span>
            <span className="text-slate-800">{CADENCE_LABEL[node.cadence] || node.cadence}</span>
          </div>
        )}
        <div className="h-px bg-slate-100 my-1.5" />
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Annual cost</span>
          <span className="text-slate-800 tabular-nums font-semibold">{fmtEur2(node.amount)}</span>
        </div>
      </div>

      {/* Submeter / informational notes (small, secondary) */}
      {node.manualNotes?.some((n) => n.kind === "info") && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
          {node.manualNotes
            .filter((n) => n.kind === "info")
            .map((n, i) => (
              <div key={i} className="text-[10px] text-slate-500 leading-snug">
                {n.text}
              </div>
            ))}
        </div>
      )}

      {node.sourceKind === "metered" && onJumpToMeters && (
        <button
          onClick={onJumpToMeters}
          className="mt-3 w-full h-7 rounded-md border border-slate-200 bg-slate-50 text-[11px] text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5"
        >
          View in Meters tab <ChevronRight size={11} />
        </button>
      )}
    </div>
  );
}

/* ─── Bookkeeping reconciliation ── booked vs expected, anchor list,
 * coverage strip showing booked/missing periods. */
function BookkeepingPanel({ node }) {
  const anchors = node.anchors || [];
  const totalBooked = anchors.reduce((s, a) => s + (a.amount || 0), 0);
  const expected = Math.abs(node.amount || 0);
  const diff = totalBooked - expected;
  const coverage = node.temporalCoverage;

  const noAnchors = anchors.length === 0;
  if (noAnchors && !coverage) return null;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Bookkeeping
      </div>

      {anchors.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="rounded border border-slate-100 p-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Booked</div>
              <div className="text-[12px] font-semibold tabular-nums text-slate-800">
                {fmtEur(totalBooked)}
              </div>
            </div>
            <div className="rounded border border-slate-100 p-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Expected</div>
              <div className="text-[12px] font-semibold tabular-nums text-slate-800">
                {fmtEur(expected)}
              </div>
            </div>
          </div>

          {Math.abs(diff) > 1 && (
            <div className={`text-[11px] mb-2 ${diff < 0 ? "text-amber-800" : "text-slate-700"}`}>
              {diff < 0
                ? `${fmtEur(Math.abs(diff))} not yet anchored to the ledger`
                : `${fmtEur(diff)} booked over expected`}
            </div>
          )}

          <ul className="space-y-2">
            {anchors.map((a, idx) => (
              <li key={idx} className="text-[11px]">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <code className="text-[10px] text-slate-700 font-mono break-all">
                    {a.ledgerAccount}
                  </code>
                  <StatusPill status={a.status} />
                </div>
                <div className="text-slate-600 tabular-nums">{fmtEur2(a.amount)}</div>
                {a.note && (
                  <div className="text-[10px] text-slate-500 italic mt-0.5">{a.note}</div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {coverage && coverage.cadence === "monthly" && coverage.expectedMonths && (
        <div className={`${anchors.length > 0 ? "mt-3 pt-2.5 border-t border-slate-100" : ""}`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Month coverage
            </div>
            <div className="text-[10px] text-slate-500">
              {coverage.bookedMonths} of {coverage.expectedMonths} booked
              {coverage.missing?.length > 0 && (
                <span className="text-amber-700"> · missing {coverage.missing.join(", ")}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-12 gap-0.5">
            {MONTHS_SHORT.map((m) => {
              const isMissing = (coverage.missing || []).includes(m);
              return (
                <div
                  key={m}
                  title={`${m} ${isMissing ? "— missing" : "— booked"}`}
                  className={`h-4 rounded-sm flex items-center justify-center text-[8px] ${
                    isMissing
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {m[0]}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {coverage && coverage.cadence === "quarterly" && coverage.expectedQuarters && (
        <div className={`${anchors.length > 0 ? "mt-3 pt-2.5 border-t border-slate-100" : ""}`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Quarter coverage
            </div>
            <div className="text-[10px] text-slate-500">
              {coverage.bookedQuarters} of {coverage.expectedQuarters} booked
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {["Q1", "Q2", "Q3", "Q4"].map((q, i) => {
              const isMissing = (coverage.bookedQuarters || 0) <= i;
              return (
                <div
                  key={q}
                  className={`h-5 rounded-sm flex items-center justify-center text-[9px] ${
                    isMissing
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {q}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Where does this flow to? — outgoing connections, plain-language ── */
function FlowConnectionsPanel({ node, edges }) {
  const outgoing = edges?.outgoing || [];
  if (outgoing.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Where does this flow to?
      </div>
      <ul className="space-y-1">
        {outgoing.map((e, i) => {
          const target = getNodeById(e.to);
          return (
            <li key={i} className="text-[11px] flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-slate-700 truncate min-w-0">
                <ChevronRight size={11} className="text-slate-400 shrink-0" />
                <span className="truncate">{target?.label || e.to}</span>
              </span>
              <span className="tabular-nums text-slate-500 shrink-0">
                {fmtEur(e.amount)}
                {e.edgeLabel ? ` · ${e.edgeLabel}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── MoreDetails — Notion-style collapsible disclosure ──────
 * Wraps audit/secondary content so the inspector defaults to a calm
 * always-visible top-of-fold. Click the header to expand. */
function MoreDetails({ children, label = "More details", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  // Don't render the toggle if there's no content — children may all be null.
  const hasContent = React.Children.toArray(children).some(Boolean);
  if (!hasContent) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 rounded-lg"
      >
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          {label}
        </span>
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="px-1 pb-1 space-y-3">{children}</div>}
    </div>
  );
}

function SourceInspectorBody({ node, edges, onJumpToMeters }) {
  // Always-visible: anything actionable + suppliers (the "where did the money
  // come from" answer). Everything audit-flavoured collapses into More details.
  const supplierItems = node.supplierBreakdown && node.supplierBreakdown.length > 0
    ? node.supplierBreakdown
    : node.supplier && node.supplier !== "Internal" && node.amount != null
    ? [{ name: node.supplier, amount: node.amount, status: "matched" }]
    : null;

  return (
    <>
      <NeedsAttentionPanel node={node} />
      {supplierItems && <SupplierBreakdown items={supplierItems} />}
      <MoreDetails label="More details">
        <SourceDetailsPanel node={node} onJumpToMeters={onJumpToMeters} />
        {node.anchors && node.anchors.length > 0 && (
          <BookkeepingPanel node={node} />
        )}
        {node.yoyComparison && node.yoyComparison.length > 1 && (
          <YoyTrend yoy={node.yoyComparison} />
        )}
      </MoreDetails>
    </>
  );
}

function SplitInspectorBody({ node, outgoing }) {
  const ruleLabel = {
    fixed_pct: "Fixed percentage",
    by_count: "By VHE count",
    by_meter: "By submeter reading",
    by_area: "By floor area",
  }[node.rule] || node.rule;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Rule
      </div>
      <div className="text-[11px] text-slate-700 mb-2">{ruleLabel}</div>
      <pre className="text-[10px] text-slate-500 bg-slate-50 rounded p-2 overflow-x-auto">
{JSON.stringify(node.ruleSpec, null, 2)}
      </pre>
      <div className="mt-3 text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
        Outputs
      </div>
      <ul className="space-y-1">
        {outgoing.map((e, i) => {
          const n = getNodeById(e.to);
          return (
            <li key={i} className="text-[11px] flex items-center justify-between">
              <span className="text-slate-700 truncate">{n?.label}</span>
              <span className="tabular-nums text-slate-500">{fmtEur(e.amount)}{e.edgeLabel ? ` · ${e.edgeLabel}` : ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AdjustmentInspectorBody({ node }) {
  const isAdd = (node.amount || 0) >= 0;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
        Adjustment {isAdd ? "(positive)" : "(negative)"}
      </div>
      <p className="text-[11px] text-slate-600">
        {isAdd
          ? "Adds cost into the flow — typically a transfer in from another lane, or a related ledger account folded back here."
          : "Subtracts from the flow — a refund, transfer out to another lane, or a manual carve-out the bookkeeping doesn't see."}
      </p>
    </div>
  );
}

/* Settlement direction. delta = advance − actual:
 *   delta > 0 → tenant overpaid → REFUND (back to tenant)
 *   delta < 0 → tenant underpaid → COLLECT (claim from tenant) */
function settlementDirection(delta) {
  if (delta == null) return null;
  if (delta > 1) return "refund";
  if (delta < -1) return "collect";
  return "balanced";
}

const directionConfig = {
  collect:  { label: "Collect from tenants", color: "text-amber-800", bg: "bg-amber-50",  border: "border-amber-200",  Icon: TrendingUp },
  refund:   { label: "Refund to tenants",    color: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200", Icon: TrendingDown },
  balanced: { label: "Balanced — no settlement", color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200", Icon: Minus },
};

const settlementStatusConfig = {
  draft:     { label: "Draft",            dot: "bg-slate-300" },
  proposed:  { label: "Ready for review", dot: "bg-slate-500" },
  finalised: { label: "Finalised",        dot: "bg-slate-700" },
  closed:    { label: "Closed",           dot: "bg-slate-900" },
  blocked:   { label: "Blocked",          dot: "bg-amber-500" },
};

function PerVhe({ amount, vheCount, label, color }) {
  if (amount == null || !vheCount) return null;
  const per = amount / vheCount;
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${color || "text-slate-700"}`}>
        {fmtEur2(per)} <span className="text-[10px] text-slate-400">/ VHE</span>
      </span>
    </div>
  );
}

function SettlementYoy({ yoy }) {
  if (!yoy || yoy.length === 0) return null;
  const sorted = [...yoy].sort((a, b) => a.year - b.year);
  const allDeltasNull = sorted.every((y) => y.delta == null);
  const max = Math.max(
    ...sorted.flatMap((y) => [y.actual || 0, y.advance || 0])
  );
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Year-over-year settlement
      </div>
      <div className="space-y-2">
        {sorted.map((y) => {
          const isLatest = y.year === sorted[sorted.length - 1].year;
          const advW = max > 0 && y.advance != null ? (y.advance / max) * 100 : 0;
          const actW = max > 0 && y.actual != null ? (y.actual / max) * 100 : 0;
          const dir = settlementDirection(y.delta);
          return (
            <div key={y.year} className="text-[11px]">
              <div className="flex items-center justify-between mb-0.5">
                <span className={isLatest ? "text-slate-700 font-medium" : "text-slate-500"}>
                  {y.year}
                </span>
                {y.delta != null ? (
                  <span
                    className={`tabular-nums text-[10px] ${
                      dir === "collect" ? "text-amber-700" : dir === "refund" ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {fmtSignedEur(y.delta)}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">—</span>
                )}
              </div>
              <div className="space-y-0.5">
                {y.advance != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 w-12">Adv</span>
                    <div className="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden">
                      <div className="h-full bg-slate-300" style={{ width: `${advW}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-slate-500 w-16 text-right">
                      {fmtEur(y.advance)}
                    </span>
                  </div>
                )}
                {y.actual != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 w-12">Act</span>
                    <div className="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden">
                      <div className={`h-full ${isLatest ? "bg-slate-700" : "bg-slate-400"}`} style={{ width: `${actW}%` }} />
                    </div>
                    <span className={`text-[10px] tabular-nums w-16 text-right ${isLatest ? "text-slate-700" : "text-slate-500"}`}>
                      {fmtEur(y.actual)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {allDeltasNull && (
        <div className="mt-2 text-[10px] text-slate-500 italic">
          Advance paid is not tracked at this settlement target — see Ista per-VHE allocation.
        </div>
      )}
    </div>
  );
}

function NewAdvancePanel({ rec, vheCount }) {
  if (!rec) return null;
  const stepUp = rec.perVheJul != null && rec.perVheJan != null && rec.perVheJul !== rec.perVheJan;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Recommended advance for next period
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-slate-100 p-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Per VHE / month</div>
          <div className="text-slate-800 font-semibold tabular-nums">
            {fmtEur2(rec.perVheJan)}
            {stepUp && (
              <span className="text-[10px] text-slate-500">
                {" → "}{fmtEur2(rec.perVheJul)}
              </span>
            )}
          </div>
          {stepUp && (
            <div className="text-[10px] text-slate-400">Jan → Jul step-up</div>
          )}
        </div>
        <div className="rounded border border-slate-100 p-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Total annual</div>
          <div className="text-slate-800 font-semibold tabular-nums">{fmtEur(rec.totalAnnual)}</div>
          {rec.expectedCost2025 != null && (
            <div className="text-[10px] text-slate-400">
              vs. expected {fmtEur(rec.expectedCost2025)}
            </div>
          )}
        </div>
      </div>
      {rec.generalIncrease != null && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-500">
          <span className="uppercase tracking-widest">Index</span>
          <span className={`tabular-nums ${rec.generalIncrease > 0 ? "text-amber-700" : rec.generalIncrease < 0 ? "text-emerald-700" : "text-slate-500"}`}>
            {rec.generalIncrease > 0 ? "+" : ""}
            {Math.round(rec.generalIncrease * 100)}%
          </span>
        </div>
      )}
      {rec.rationale && (
        <div className="mt-2 text-[10px] text-slate-600">{rec.rationale}</div>
      )}
      {rec.marginNote && (
        <div className="mt-1.5 text-[10px] text-amber-800 italic flex items-start gap-1">
          <Info size={10} className="mt-0.5 shrink-0" />
          <span>{rec.marginNote}</span>
        </div>
      )}
    </div>
  );
}

function SiblingSettlements({ node }) {
  const siblings = getSettlementsByGroup(node.groupId, node.id);
  if (siblings.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Other charges for this Group
      </div>
      <ul className="space-y-1">
        {siblings.map((s) => {
          const dir = settlementDirection(s.delta);
          return (
            <li key={s.id} className="text-[11px] flex items-center justify-between">
              <span className="text-slate-700 truncate">
                {s.label}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="tabular-nums text-slate-500">
                  {fmtEur(s.amount)}
                </span>
                {s.delta != null && dir && (
                  <span className={`text-[10px] tabular-nums ${
                    dir === "collect" ? "text-amber-700" : dir === "refund" ? "text-emerald-700" : "text-slate-400"
                  }`}>
                    {fmtSignedEur(s.delta)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AudienceComposition({ composition }) {
  if (!composition) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
        Audience composition
      </div>
      <ul className="space-y-1.5">
        {composition.byBlock?.map((b) => {
          const pct = b.vheTotal > 0 ? (b.vheInGroup / b.vheTotal) * 100 : 0;
          return (
            <li key={b.blockId} className="text-[11px]">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-slate-700">{b.blockName}</span>
                <span className="text-slate-500 tabular-nums">
                  {b.vheInGroup} of {b.vheTotal}
                </span>
              </div>
              <div className="h-1.5 rounded bg-slate-100 overflow-hidden">
                <div className="h-full bg-slate-400" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {composition.rationale && (
        <div className="mt-2 text-[10px] text-slate-500 italic">{composition.rationale}</div>
      )}
    </div>
  );
}

function SettlementInspectorBody({ node }) {
  if (node.outOfScope) {
    return (
      <div className="rounded-lg border border-slate-200 p-3 text-[11px] text-slate-600">
        This share settles outside the current Group ({node.groupId}). Open the
        target Group to view its full cost flow.
      </div>
    );
  }

  if (node.settlesViaIsta) {
    return (
      <>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <div className="text-[10px] uppercase tracking-widest text-amber-800 font-semibold mb-1">
            Settled via Ista
          </div>
          <div className="text-[11px] text-amber-900">
            {node.audienceNote || "Per-VHE allocation handled by external metering — not a flat per-VHE charge."}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            Settlement
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Audience</span>
              <span className="text-slate-800">{node.subLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Service code</span>
              <span className="text-slate-800 font-mono text-[10px]">{node.serviceCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VHE count</span>
              <span className="text-slate-800">{node.vheCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total cost</span>
              <span className="text-slate-800 tabular-nums">{fmtEur2(node.amount)}</span>
            </div>
          </div>
        </div>
        <SettlementYoy yoy={node.yoyComparison} />
        <SiblingSettlements node={node} />
      </>
    );
  }

  const dir = settlementDirection(node.delta);
  const dCfg = dir ? directionConfig[dir] : null;
  const sCfg = node.settlementStatus ? settlementStatusConfig[node.settlementStatus] : null;
  const DirIcon = dCfg?.Icon;

  return (
    <>
      {/* Direction + status banner */}
      {(dCfg || sCfg) && (
        <div className={`rounded-lg border p-3 ${dCfg ? `${dCfg.border} ${dCfg.bg}` : "border-slate-200"}`}>
          <div className="flex items-center justify-between gap-2">
            {dCfg && (
              <div className={`inline-flex items-center gap-1.5 ${dCfg.color}`}>
                <DirIcon size={14} />
                <span className="text-[12px] font-semibold">{dCfg.label}</span>
              </div>
            )}
            {sCfg && (
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
                {sCfg.label}
              </span>
            )}
          </div>
          {node.delta != null && (
            <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${dCfg?.color || "text-slate-700"}`}>
              {fmtSignedEur(node.delta)}
            </div>
          )}
        </div>
      )}

      {/* Per-VHE breakdown */}
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
          Per VHE
        </div>
        <div className="space-y-1">
          <PerVhe amount={node.amount} vheCount={node.vheCount} label="Actual cost" color="text-slate-800" />
          {node.advance != null && (
            <PerVhe amount={node.advance} vheCount={node.vheCount} label="Advance paid" />
          )}
          {node.delta != null && (
            <PerVhe
              amount={node.delta}
              vheCount={node.vheCount}
              label="Delta to settle"
              color={dir === "collect" ? "text-amber-700" : dir === "refund" ? "text-emerald-700" : "text-slate-700"}
            />
          )}
        </div>
      </div>

      {/* Audience — compact identity facts. Service code lives on the canvas
       * card now, so we don't repeat it here. */}
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
          Audience
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Who pays</span>
            <span className="text-slate-800">{node.subLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">VHE count</span>
            <span className="text-slate-800">{node.vheCount}</span>
          </div>
        </div>
      </div>

      {node.newAdvanceRecommendation && (
        <NewAdvancePanel rec={node.newAdvanceRecommendation} vheCount={node.vheCount} />
      )}

      {/* Audit-flavoured detail collapsed by default. */}
      <MoreDetails label="More details">
        {node.yoyComparison && node.yoyComparison.length > 1 && (
          <SettlementYoy yoy={node.yoyComparison} />
        )}
        <AudienceComposition composition={node.audienceComposition} />
        <SiblingSettlements node={node} />
        {(node.regulation || node.audienceNote) && (
          <div className="rounded-lg border border-slate-200 p-3 space-y-1.5 text-[11px]">
            {node.regulation && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 shrink-0">Regulation</span>
                <span className="text-slate-700 text-[10px] text-right">{node.regulation}</span>
              </div>
            )}
            {node.audienceNote && (
              <div className="text-[10px] text-slate-600 leading-snug italic">
                {node.audienceNote}
              </div>
            )}
          </div>
        )}
        {node.anchors && node.anchors.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Bookkeeping anchors
            </div>
            <ul className="space-y-2">
              {node.anchors.map((anchor, idx) => (
                <li key={idx} className="text-[11px]">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <code className="text-[10px] text-slate-700 font-mono break-all">
                      {anchor.ledgerAccount}
                    </code>
                    <StatusPill status={anchor.status} />
                  </div>
                  <div className="text-slate-600 tabular-nums">{fmtEur2(anchor.amount)}</div>
                  {anchor.note && (
                    <div className="text-[10px] text-slate-500 italic mt-0.5">{anchor.note}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </MoreDetails>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Page                                                          */
/* ──────────────────────────────────────────────────────────── */
/* CostFlowView — the embeddable body. Used standalone via CostFlowPage and
 * embedded via GroupDetailPage's "Cost flow" tab. When `compact` is true the
 * Header skips the identity / period (those live in the wrapping shell).
 *
 * Progressive disclosure model:
 *   L1 (default) = CategoryFlowView — proportional sankey of categories ↔
 *                  audiences. Bands are clickable; a category opens in place
 *                  to expose its lanes (L2).
 *   L3          = LaneDetailSheet — slide-out sheet showing the full
 *                  per-lane canvas, opened by clicking a lane.
 *
 * `initialLaneId` (e.g. from Overview's "needs attention") deep-links straight
 * to L3 by opening the sheet on that lane. */
export function CostFlowView({
  compact = false,
  onBack,
  initialLaneId = null,
  initialGroupId = null, // audience scope: filter L1 to flows ending at this audience
  onJumpToMeters = null,
  onJumpToBookkeeping = null,
  onJumpToTenants = null,
} = {}) {
  // Subscribe to edits — re-render whenever the user edits a cost source or
  // freezes a component, so the canvas + Sankey + sheet all see the merged
  // state from costFlow.js's active().
  useEditsVersion();
  const flow = getCostFlow();
  const [helpOpen, setHelpOpen] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(() => new Set());
  const [sheetLaneId, setSheetLaneId] = useState(initialLaneId || null);
  const [scopeAudienceId, setScopeAudienceId] = useState(initialGroupId || null);
  const [fullCanvasOpen, setFullCanvasOpen] = useState(false);

  function toggleCategory(catId) {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  // Batch toggle: open every category id, or clear the set entirely.
  function toggleAllCategories(shouldOpen) {
    if (shouldOpen) {
      // Read categories from the live flow each time so newly added
      // categories pick up automatically.
      setExpandedCategoryIds(
        new Set((flow.lanes || []).map((l) => l.category || "other"))
      );
    } else {
      setExpandedCategoryIds(new Set());
    }
  }

  // Honour incoming initialLaneId on mount or when it changes — this opens
  // the sheet directly. We also expand the parent category in the L1 view so
  // the lane is visible "underneath" the sheet.
  useEffect(() => {
    if (initialLaneId) {
      const lane = flow.lanes.find((l) => l.id === initialLaneId);
      if (lane?.category) {
        setExpandedCategoryIds((prev) => {
          if (prev.has(lane.category)) return prev;
          const next = new Set(prev);
          next.add(lane.category);
          return next;
        });
      }
      setSheetLaneId(initialLaneId);
    }
  }, [initialLaneId, flow.lanes]);

  // Note: we used to mirror initialGroupId into scopeAudienceId via an
  // effect, but CostFlowView already remounts on pendingFocus.key change
  // (parent passes key={pendingFocus?.key}), so the useState initializer
  // above handles deep-link entry. Re-asserting through an effect risked
  // clobbering a user's "See all audiences" click whenever the prop's
  // identity appeared to change.

  // ESC closes help (sheet handles its own ESC)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && helpOpen) setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <Header
        flow={flow}
        overlay={false}
        setOverlay={() => {}}
        focusMode={false}
        setFocusMode={() => {}}
        focusActive={false}
        showEdgeLabels={false}
        setShowEdgeLabels={() => {}}
        onOpenHelp={() => setHelpOpen(true)}
        onBack={onBack}
        compact={compact}
      />

      {/* Slim utility bar in compact mode — Help button only. The period
       * lives in the ShellHeader as "{year} distribution"; we don't repeat
       * it here. */}
      {compact && (
        <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-200 bg-slate-50/40">
          <span className="text-[11px] text-slate-500">
            {flow.lanes.length} lane{flow.lanes.length === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              title="How to read this"
            >
              <HelpCircle size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <CategoryFlowView
          expandedCategoryIds={expandedCategoryIds}
          toggleCategory={toggleCategory}
          toggleAllCategories={toggleAllCategories}
          onSelectLane={(laneId) => setSheetLaneId(laneId)}
          scopeAudienceId={scopeAudienceId}
          onScopeAudience={(id) => setScopeAudienceId(id)}
          onClearScope={() => setScopeAudienceId(null)}
          onOpenFullCanvas={() => setFullCanvasOpen(true)}
        />
        {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      </div>

      {sheetLaneId && (
        <LaneDetailSheet
          laneId={sheetLaneId}
          scopeAudienceId={scopeAudienceId}
          onClearScope={() => setScopeAudienceId(null)}
          onClose={() => setSheetLaneId(null)}
          onJumpToLane={(laneId) => setSheetLaneId(laneId)}
          onJumpToMeters={onJumpToMeters}
          onJumpToBookkeeping={onJumpToBookkeeping}
          onJumpToTenants={onJumpToTenants}
        />
      )}

      {fullCanvasOpen && (
        <FullCanvasSheet
          onClose={() => setFullCanvasOpen(false)}
          onJumpToMeters={onJumpToMeters}
        />
      )}
    </div>
  );
}

/* Thin wrapper preserving the legacy /:orgId/cost-flow standalone route. */
export default function CostFlowPage() {
  const navigate = useNavigate();
  return <CostFlowView compact={false} onBack={() => navigate(-1)} />;
}
