import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import {
  Zap,
  Sparkles,
  HardHat,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Users,
  Building2,
  Boxes,
  Filter,
  X,
  ChevronsDown,
  ChevronsUp,
  Layers,
} from "lucide-react";
import {
  getCategoryFlowSummary,
  getAllAudiences,
  fmtEur,
  fmtSignedEur,
} from "@/lib/costFlow";

/* ──────────────────────────────────────────────────────────────
 * CategoryFlowView — the progressive cost-flow Sankey.
 *
 * Three layers of detail unfold in place:
 *   L1: Categories on the left, Audiences on the right, ribbons between.
 *       Bands are sized proportionally to € share.
 *   L2: Click a category → it opens inline. The category band is replaced
 *       by a header + lane sub-bands (still proportional to lane amounts
 *       within the category). Ribbons re-attach to individual lane bands.
 *   L3: Click a lane → fires onSelectLane(laneId). The parent decides
 *       what to do (typically open LaneDetailSheet).
 *
 * Truth: total settlement € on the left equals total settlement € on the
 * right by construction (they're two groupings of the same nodes), and
 * each ribbon's height is proportional to its € amount on the same scale.
 * ─────────────────────────────────────────────────────────── */

const categoryIcon = {
  energy:     Zap,
  cleaning:   Sparkles,
  management: HardHat,
  other:      FileText,
};
const categoryLabel = {
  energy:     "Energie",
  cleaning:   "Schoonmaak",
  management: "Beheer",
  other:      "Overig",
};

const audienceKindStripe = {
  complex:    "bg-slate-700",
  block:      "bg-slate-500",
  commercial: "bg-amber-500",
  subgroup:   "bg-slate-400",
  external:   "bg-slate-300",
};
const audienceKindIcon = {
  complex:    Building2,
  block:      Boxes,
  commercial: Boxes,
  subgroup:   Users,
  external:   Users,
};

/* ── Layout constants ── */
const COL_W      = 268;   // category / audience column width
const BASE_H     = 480;   // proportional total height target
const MIN_H      = 44;    // minimum band height for legibility
const LANE_MIN_H = 28;    // min lane sub-band — softens L2 expansion jump
const HEADER_H   = 26;    // category-header strip height when expanded
const COL_GAP    = 8;     // breathing room between column edge and SVG

/* ─── Layout helpers ─────────────────────────────────────────────
 * Sankey layout sizes by *magnitude* (sum of |amount|), not signed amount.
 * A refund-driven negative settlement still represents money that moved;
 * sizing on signed values would visually cancel it against other flows in
 * the same category. Labels still display signed amounts. */

// Pull a sizing weight from a category, lane, or audience object. Falls
// back to whatever `amount` field is present so this works for audiences
// (which use `settled`) and any pre-existing data.
function weightOf(obj) {
  if (obj == null) return 0;
  if (obj.magnitude != null) return obj.magnitude;
  if (obj.settled != null) return Math.abs(obj.settled);
  if (obj.amount != null) return Math.abs(obj.amount);
  return 0;
}

function buildLeftLayout(categories, expandedSet, total) {
  const items = [];
  const leaves = {};   // id → { y, h, audiences } — ribbon attachment points
  let y = 0;

  for (const cat of categories) {
    const catProportional = BASE_H * (weightOf(cat) / total);
    const catH = Math.max(MIN_H, catProportional);

    if (expandedSet.has(cat.id)) {
      // Header strip
      items.push({
        kind: "categoryHeader",
        id: `header:${cat.id}`,
        catId: cat.id,
        y, h: HEADER_H,
        item: cat,
      });
      y += HEADER_H;

      // Lane sub-bands split the original proportional height
      const laneTotal = cat.lanes.reduce((s, l) => s + weightOf(l), 0) || 1;
      const laneSpace = Math.max(catH, cat.lanes.length * LANE_MIN_H);
      for (const lane of cat.lanes) {
        const laneH = Math.max(LANE_MIN_H, laneSpace * (weightOf(lane) / laneTotal));
        items.push({
          kind: "lane",
          id: `lane:${lane.laneId}`,
          catId: cat.id,
          laneId: lane.laneId,
          y, h: laneH,
          item: lane,
        });
        leaves[`lane:${lane.laneId}`] = {
          y, h: laneH,
          audiences: lane.audiences || {},
        };
        y += laneH;
      }
    } else {
      items.push({
        kind: "category",
        id: `cat:${cat.id}`,
        catId: cat.id,
        y, h: catH,
        item: cat,
      });
      leaves[`cat:${cat.id}`] = {
        y, h: catH,
        audiences: cat.audiences || {},
      };
      y += catH;
    }
  }
  return { items, leaves, totalHeight: y };
}

function buildRightLayout(audiences, total) {
  const items = [];
  let y = 0;
  for (const aud of audiences) {
    const proportional = BASE_H * (weightOf(aud) / total);
    const h = Math.max(MIN_H, proportional);
    items.push({
      kind: "audience",
      id: `aud:${aud.id}`,
      audId: aud.id,
      y, h,
      item: aud,
    });
    y += h;
  }
  return { items, totalHeight: y };
}

function buildRibbons(leaves, rightItems, total) {
  const ribbons = [];
  const leftOff = {};
  const rightOff = {};
  for (const id in leaves) leftOff[id] = 0;
  for (const r of rightItems) rightOff[r.id] = 0;

  const leafOrdered = Object.entries(leaves)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => a.y - b.y);
  const audOrdered = [...rightItems].sort((a, b) => a.y - b.y);

  for (const leaf of leafOrdered) {
    for (const aud of audOrdered) {
      const amount = leaf.audiences[aud.audId] || 0;
      if (amount <= 0) continue;
      const ribbonH = BASE_H * (amount / total);
      ribbons.push({
        id: `${leaf.id}→${aud.id}`,
        leafId: leaf.id,
        audId: aud.id,
        leftY: leaf.y + leftOff[leaf.id],
        rightY: aud.y + rightOff[aud.id],
        h: ribbonH,
        amount,
      });
      leftOff[leaf.id] += ribbonH;
      rightOff[aud.id] += ribbonH;
    }
  }
  return ribbons;
}

function ribbonPath(x1, x2, leftY, rightY, h) {
  const midX = (x1 + x2) / 2;
  return `
    M ${x1} ${leftY}
    C ${midX} ${leftY}, ${midX} ${rightY}, ${x2} ${rightY}
    L ${x2} ${rightY + h}
    C ${midX} ${rightY + h}, ${midX} ${leftY + h}, ${x1} ${leftY + h}
    Z
  `;
}

/* ─── Component ──────────────────────────────────────────────── */

export default function CategoryFlowView({
  expandedCategoryIds = new Set(),
  toggleCategory,
  toggleAllCategories,
  onSelectLane,
  scopeAudienceId = null,
  onScopeAudience,
  onClearScope,
  onOpenFullCanvas,
}) {
  const categories = useMemo(
    () => getCategoryFlowSummary({ scopeAudienceId }),
    [scopeAudienceId]
  );
  const audiences = useMemo(() => {
    const all = getAllAudiences();
    if (scopeAudienceId) return all.filter((a) => a.id === scopeAudienceId);
    return all;
  }, [scopeAudienceId]);
  const scopedAudience = scopeAudienceId
    ? getAllAudiences().find((a) => a.id === scopeAudienceId)
    : null;

  // We track two totals:
  //   • totalMagnitude — used to size everything (band heights, ribbon
  //     widths). Magnitude treats a refund as money-moved, so a negative
  //     settlement still occupies space proportional to its absolute size.
  //   • totalAmount — signed sum, what users see in the headline ("€X
  //     across N categories"). This matches the per-band labels that show
  //     signed sums, keeping the math visible even when refunds are
  //     present.
  const totalMagnitude = useMemo(
    () =>
      Math.max(
        categories.reduce((s, c) => s + weightOf(c), 0),
        audiences.reduce((s, a) => s + weightOf(a), 0),
        1
      ),
    [categories, audiences]
  );
  const totalAmount = useMemo(
    () => categories.reduce((s, c) => s + (c.amount || 0), 0),
    [categories]
  );
  const total = totalMagnitude;

  // Container width for SVG ribbon X coordinates
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(0);
  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setWrapW(entry.contentRect.width);
    });
    ro.observe(wrapRef.current);
    setWrapW(wrapRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const left  = useMemo(
    () => buildLeftLayout(categories, expandedCategoryIds, total),
    [categories, expandedCategoryIds, total]
  );
  const right = useMemo(
    () => buildRightLayout(audiences, total),
    [audiences, total]
  );
  const totalHeight = Math.max(left.totalHeight, right.totalHeight);

  const ribbons = useMemo(
    () => buildRibbons(left.leaves, right.items, total),
    [left, right.items, total]
  );

  // Hover-based highlight
  const [hoverLeafId, setHoverLeafId] = useState(null);
  const [hoverAudId, setHoverAudId]   = useState(null);

  const isHighlighted = (r) => {
    if (hoverLeafId) return r.leafId === hoverLeafId;
    if (hoverAudId)  return r.audId  === hoverAudId;
    return null; // no hover active
  };

  // Ribbon X coordinates
  const x1 = COL_W + COL_GAP;
  const x2 = (wrapW || 0) - COL_W - COL_GAP;
  const ribbonsReady = wrapW > 2 * (COL_W + COL_GAP) + 80;

  return (
    <div className="flex-1 overflow-auto overflow-x-hidden bg-white min-w-0">
      <div className="px-6 py-6 mx-auto w-full max-w-[1240px]">
        {/* Headline summary line + Expand all toggle */}
        <div className="mb-4 flex items-baseline gap-3 flex-wrap">
          <h2 className="text-[15px] font-semibold text-slate-900">Kostenstroom</h2>
          <p className="text-[12px] text-slate-500 flex-1 min-w-0">
            {fmtEur(totalAmount)} verdeeld over {categories.length} categori
            {categories.length === 1 ? "e" : "eën"} → {audiences.length} doelgroep
            {audiences.length === 1 ? "" : "en"}.{" "}
            <span className="text-slate-400">
              Klik op een categorie om uit te klappen. Klik op een doelgroep om te filteren.
            </span>
          </p>
          {toggleAllCategories && categories.length > 0 && (() => {
            const allOpen = categories.every((c) =>
              expandedCategoryIds.has(c.id)
            );
            const Icon = allOpen ? ChevronsUp : ChevronsDown;
            return (
              <button
                onClick={() => toggleAllCategories(!allOpen)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                title={allOpen ? "Alle categorieën inklappen" : "Alle categorieën openen tot hun componenten"}
              >
                <Icon size={12} className="text-slate-500" />
                {allOpen ? "Alles inklappen" : "Alles uitklappen"}
              </button>
            );
          })()}
          {onOpenFullCanvas && (
            <button
              onClick={onOpenFullCanvas}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              title="Alle componenten op één canvas openen"
            >
              <Layers size={12} className="text-slate-500" />
              Volledig canvas
            </button>
          )}
        </div>

        {/* Scope chip — visible when filtered to a single audience */}
        {scopedAudience && (
          <div className="mb-4 inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full border border-slate-300 bg-slate-50 text-[11px]">
            <Filter size={11} className="text-slate-500" />
            <span className="text-slate-500">Alleen stromen naar:</span>
            <span className="font-semibold text-slate-900">
              {scopedAudience.name}
            </span>
            {scopedAudience.vheCount != null && (
              <span className="text-slate-400 normal-case">
                · {scopedAudience.vheCount} VHE
              </span>
            )}
            <button
              onClick={() => onClearScope?.()}
              className="ml-1 w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center"
              title="Filter wissen"
            >
              <X size={11} className="text-slate-500" />
            </button>
          </div>
        )}

        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden"
          style={{ height: totalHeight }}
        >
          {/* SVG ribbon underlay */}
          {ribbonsReady && (
            <svg
              className="absolute inset-0"
              width="100%"
              height={totalHeight}
              style={{ pointerEvents: "none" }}
            >
              <defs>
                <linearGradient id="ribbon-grad" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.32" />
                </linearGradient>
                <linearGradient id="ribbon-grad-hi" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#0F172A" stopOpacity="0.36" />
                  <stop offset="100%" stopColor="#0F172A" stopOpacity="0.48" />
                </linearGradient>
                <linearGradient id="ribbon-grad-dim" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.10" />
                </linearGradient>
              </defs>
              {ribbons.map((r) => {
                const hi = isHighlighted(r);
                const fill =
                  hi === true  ? "url(#ribbon-grad-hi)"
                : hi === false ? "url(#ribbon-grad-dim)"
                :                 "url(#ribbon-grad)";
                return (
                  <path
                    key={r.id}
                    d={ribbonPath(x1, x2, r.leftY, r.rightY, r.h)}
                    fill={fill}
                    style={{ pointerEvents: "auto" }}
                    onMouseEnter={() => {
                      setHoverLeafId(r.leafId);
                      setHoverAudId(null);
                    }}
                    onMouseLeave={() => setHoverLeafId(null)}
                  >
                    <title>{fmtEur(r.amount)}</title>
                  </path>
                );
              })}
            </svg>
          )}

          {/* Left column — categories / lanes */}
          <div className="absolute left-0 top-0" style={{ width: COL_W }}>
            {left.items.map((it) => {
              if (it.kind === "categoryHeader") {
                const cat = it.item;
                const Icon = categoryIcon[cat.id] || FileText;
                return (
                  <button
                    key={it.id}
                    onClick={() => toggleCategory?.(cat.id)}
                    className="absolute left-0 right-2 px-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-semibold hover:text-slate-900"
                    style={{ top: it.y, height: it.h }}
                    title="Click to collapse"
                  >
                    <ChevronDown size={11} className="text-slate-400 shrink-0" />
                    <Icon size={11} strokeWidth={1.5} className="text-slate-400 shrink-0" />
                    <span className="truncate">{categoryLabel[cat.id] || cat.id}</span>
                    <span className="ml-auto text-slate-400 normal-case tracking-normal text-[11px] tabular-nums">
                      {fmtEur(cat.amount)}
                    </span>
                  </button>
                );
              }

              if (it.kind === "lane") {
                const lane = it.item;
                const isHover = hoverLeafId === it.id;
                const dimmed  = (hoverLeafId || hoverAudId) && !isHover;
                return (
                  <button
                    key={it.id}
                    onClick={() => onSelectLane?.(lane.laneId)}
                    onMouseEnter={() => {
                      setHoverLeafId(it.id);
                      setHoverAudId(null);
                    }}
                    onMouseLeave={() => setHoverLeafId(null)}
                    className={`absolute left-3 right-2 rounded-md border bg-white text-left transition-all
                      ${isHover
                        ? "border-slate-900 shadow-sm"
                        : dimmed
                        ? "border-slate-200/60 opacity-50"
                        : "border-slate-200 hover:border-slate-400"}
                    `}
                    style={{ top: it.y + 1, height: it.h - 2 }}
                  >
                    <div className="flex items-center gap-2 px-2.5 h-full">
                      <span
                        className={`inline-block w-1 h-1 rounded-full shrink-0 ${
                          lane.health === "error"   ? "bg-red-500"   :
                          lane.health === "warning" ? "bg-amber-500" :
                                                       "bg-slate-300"
                        }`}
                      />
                      <span className="text-[12px] font-medium text-slate-800 truncate flex-1 leading-tight">
                        {lane.title}
                      </span>
                      {lane.issueCount > 0 && (
                        <span className="text-[10px] text-amber-700 tabular-nums font-medium">
                          {lane.issueCount}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                        {fmtEur(lane.amount)}
                      </span>
                      <ChevronRight size={11} className="text-slate-400 shrink-0" />
                    </div>
                  </button>
                );
              }

              // Collapsed category band
              const cat = it.item;
              const Icon = categoryIcon[cat.id] || FileText;
              const isHover = hoverLeafId === it.id;
              const dimmed  = (hoverLeafId || hoverAudId) && !isHover;
              return (
                <button
                  key={it.id}
                  onClick={() => toggleCategory?.(cat.id)}
                  onMouseEnter={() => {
                    setHoverLeafId(it.id);
                    setHoverAudId(null);
                  }}
                  onMouseLeave={() => setHoverLeafId(null)}
                  className={`absolute left-0 right-2 rounded-md border bg-white text-left transition-all group
                    ${isHover
                      ? "border-slate-900 shadow-sm"
                      : dimmed
                      ? "border-slate-200/60 opacity-50"
                      : "border-slate-200 hover:border-slate-400"}
                  `}
                  style={{ top: it.y + 2, height: it.h - 4 }}
                  title={`Open ${categoryLabel[cat.id] || cat.id}`}
                >
                  <div className="flex items-center gap-2 px-3 h-full">
                    <ChevronRight size={12} className="text-slate-400 shrink-0 group-hover:text-slate-700" />
                    <span className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                      <Icon size={14} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-slate-900 truncate">
                          {categoryLabel[cat.id] || cat.id}
                        </span>
                        {cat.flagCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 font-medium">
                            <AlertTriangle size={9} />
                            {cat.flagCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">
                        {cat.lanes.length} lane{cat.lanes.length === 1 ? "" : "s"}
                        {cat.hasDelta && Math.abs(cat.netDelta) > 1 && (
                          <span
                            className={`ml-2 ${
                              cat.netDelta > 0 ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            {fmtSignedEur(cat.netDelta)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold text-slate-900 tabular-nums shrink-0">
                      {fmtEur(cat.amount)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right column — audiences. Clickable to scope: click an audience
           * to filter the L1 to flows reaching it; click the currently-scoped
           * audience again to clear the filter. */}
          <div className="absolute right-0 top-0" style={{ width: COL_W }}>
            {right.items.map((it) => {
              const aud = it.item;
              const stripe = audienceKindStripe[aud.kind] || "bg-slate-400";
              const Icon = audienceKindIcon[aud.kind] || Users;
              const isHover = hoverAudId === aud.id;
              const dimmed  = (hoverLeafId || hoverAudId) && !isHover;
              const isScoped = scopeAudienceId === aud.id;
              const handleClick = () => {
                if (!onScopeAudience) return;
                onScopeAudience(isScoped ? null : aud.id);
              };
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={handleClick}
                  onMouseEnter={() => {
                    setHoverAudId(aud.id);
                    setHoverLeafId(null);
                  }}
                  onMouseLeave={() => setHoverAudId(null)}
                  className={`absolute left-2 right-0 rounded-md border bg-white transition-all overflow-hidden text-left cursor-pointer
                    ${isScoped
                      ? "border-slate-900 ring-1 ring-slate-900/20 shadow-sm"
                      : isHover
                      ? "border-slate-900 shadow-sm"
                      : dimmed
                      ? "border-slate-200/60 opacity-50"
                      : "border-slate-200 hover:border-slate-400"}
                  `}
                  style={{ top: it.y + 2, height: it.h - 4 }}
                  title={isScoped ? "Click to clear filter" : `Filter to ${aud.name}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripe}`} />
                  <div className="flex items-center gap-2 pl-3 pr-3 h-full">
                    <span className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                      <Icon size={14} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-900 truncate">
                        {aud.name}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight capitalize">
                        {aud.kind}
                        {aud.vheCount != null && (
                          <span className="text-slate-400">
                            {" · "}
                            {aud.vheCount} VHE
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold text-slate-900 tabular-nums shrink-0">
                      {fmtEur(aud.settled)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
