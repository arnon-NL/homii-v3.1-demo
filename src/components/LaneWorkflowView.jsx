import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Receipt,
  Zap,
  FileText,
  Repeat,
  Gauge,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Building2,
  Boxes,
  Users,
  AlertTriangle,
  CheckCircle2,
  Divide,
  Percent,
  Square,
  User,
  Lock,
  Unlock,
  RotateCcw,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Pencil,
} from "lucide-react";
import {
  getCostFlow,
  getEdgesForNode,
  fmtEur,
  fmtEur2,
  fmtSignedEur,
} from "@/lib/costFlow";
import {
  setNodeField,
  setSettlementAdvance,
  isLaneFrozen,
  freezeLane,
  unfreezeLane,
  hasEditsForLane,
  clearLaneEdits,
  addCostSource,
  deleteNode,
  useEditsVersion,
} from "@/lib/costFlowEdits";
import { getLaneTenancyOutcomes } from "@/lib/perTenant";
// (TenancyDetailSheet entry point lives in the Huurders-tab now —
//  the lane workflow no longer needs it inline.)

/* ──────────────────────────────────────────────────────────────
 * LaneWorkflowView — the cost-component workflow page (Phase 2)
 *
 * Mirrors the steps a service-charges employee follows in Excel:
 *   1. Cost sources — fill in costs per supplier (read-only here; edit
 *      surface arrives in Phase 4).
 *   2. Ledger comparison — entered total vs ERP-booked total. Drill into
 *      the Bookkeeping tab for invoice-level audit.
 *   3. YoY — verify cost is in line with prior years.
 *   4. Distribution & settlements — outcome per audience after applying
 *      the distribution method.
 *
 * Component-level properties (service code, ledger account) are derived
 * from the lane's source/settlement nodes — they're effectively the
 * "header" of the workflow page.
 * ─────────────────────────────────────────────────────────────── */

const sourceKindIcon = {
  metered: Zap,
  contracted: FileText,
  pass_through: ChevronRight,
  recurring: Repeat,
  internal: FileText,
};

const sourceKindLabel = {
  metered: "Metered",
  contracted: "Contracted",
  pass_through: "Pass-through",
  recurring: "Recurring",
  internal: "Internal",
};

const audienceKindIcon = {
  complex: Building2,
  block: Boxes,
  commercial: Boxes,
  subgroup: Users,
};

const distributionConfig = {
  per_vhe:          { Icon: Divide, short: (d) => `÷ ${d.denominator} ${d.unit || "VHE"}` },
  metered_ista:     { Icon: Gauge,  short: () => "Metered (Ista)" },
  metered_internal: { Icon: Gauge,  short: () => "Metered" },
  by_m2:            { Icon: Square, short: (d) => (d.denominator ? `÷ ${d.denominator} m²` : "by m²") },
  fixed_pct:        { Icon: Percent,short: (d) => (d.pct != null ? `${Math.round(d.pct * 100)}%` : "Fixed %") },
  single:           { Icon: User,   short: () => "Direct" },
};

/* ─── EditableCurrencyCell — click to edit, Enter/blur commits, Esc cancels.
 * Disabled when `disabled=true` (frozen state). */
function EditableCurrencyCell({ value, onCommit, disabled, alignRight = true }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  function start() {
    if (disabled) return;
    setDraft(value != null ? String(value) : "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const num = parseFloat(draft.replace(/[^0-9.\-]/g, ""));
    if (isFinite(num) && num !== value) onCommit(num);
  }

  function cancel() {
    setEditing(false);
    setDraft("");
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        className={`w-full px-1.5 py-0.5 rounded border border-slate-400 bg-white text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 ${
          alignRight ? "text-right" : ""
        }`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className={`w-full text-[11px] tabular-nums px-1.5 py-0.5 rounded transition-colors ${
        alignRight ? "text-right" : "text-left"
      } ${
        disabled
          ? "text-slate-700 cursor-default"
          : "text-slate-900 hover:bg-slate-100 hover:ring-1 hover:ring-slate-200 cursor-text"
      }`}
      title={disabled ? "Component is locked — unlock to edit" : "Click to edit"}
    >
      {value != null ? fmtEur(value) : "—"}
    </button>
  );
}

/* ─── EditableTextCell — same UX as the currency cell, plain text input.
 * Used for supplier names. Empty trim-result is rejected (treated as cancel)
 * because a sourceless supplier label is worse than the previous value. */
function EditableTextCell({ value, onCommit, disabled, placeholder = "—" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  function start() {
    if (disabled) return;
    setDraft(value || "");
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== (value || "")) onCommit(next);
  }
  function cancel() {
    setEditing(false);
    setDraft("");
  }

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        className="w-full px-1.5 py-0.5 rounded border border-slate-400 bg-white text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className={`text-left text-[12px] px-1.5 py-0.5 rounded transition-colors ${
        disabled
          ? "text-slate-900 cursor-default"
          : "text-slate-900 font-medium hover:bg-slate-100 hover:ring-1 hover:ring-slate-200 cursor-text"
      }`}
      title={disabled ? "Component is locked — unlock to edit" : "Click to edit"}
    >
      {value || placeholder}
    </button>
  );
}

/* ─── KindPickerCell — inline dropdown of source kinds.
 * Frozen mode falls through to the same icon+label render the table used
 * before Phase 5, so the read-only view is unchanged. */
function KindPickerCell({ value, onCommit, disabled }) {
  const KindIcon = sourceKindIcon[value] || FileText;
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
        <KindIcon size={11} className="text-slate-400" />
        {sourceKindLabel[value] || "Source"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <KindIcon size={11} className="text-slate-400" />
      <select
        value={value || "contracted"}
        onChange={(e) => onCommit(e.target.value)}
        className="text-[11px] bg-transparent border border-transparent hover:border-slate-200 focus:border-slate-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
        title="Edit cost source kind"
      >
        <option value="metered">Metered</option>
        <option value="contracted">Contracted</option>
        <option value="pass_through">Pass-through</option>
        <option value="recurring">Recurring</option>
        <option value="internal">Internal</option>
      </select>
    </span>
  );
}

/* ─── DistributionEditor — popover form for editing a settlement's
 * distribution method + parameters. Mounted absolutely under the
 * distribution chip in the settlements row; click-outside closes it.
 *
 * The shapes per method match the data convention used elsewhere:
 *   per_vhe          → { denominator, unit }
 *   by_m2            → { denominator }   (unit is fixed "m²")
 *   fixed_pct        → { pct }           (stored as 0..1, displayed 0..100)
 *   metered_*        → { }               (no params; calc pulls from meters)
 *   single           → { }               (no params; one recipient)
 */
function DistributionEditor({ value, onCommit, onClose }) {
  const [method, setMethod] = useState(value?.method || "single");
  const [denom, setDenom] = useState(
    value?.denominator != null ? String(value.denominator) : ""
  );
  const [unit, setUnit] = useState(value?.unit || "VHE");
  const [pct, setPct] = useState(
    value?.pct != null ? String(Math.round(value.pct * 1000) / 10) : ""
  );
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  function save() {
    let next = { method };
    if (method === "per_vhe") {
      next = {
        method,
        denominator: Number(denom) || 0,
        unit: unit.trim() || "VHE",
      };
    } else if (method === "by_m2") {
      next = { method, denominator: Number(denom) || 0 };
    } else if (method === "fixed_pct") {
      const p = Number(pct);
      next = { method, pct: isFinite(p) ? p / 100 : 0 };
    }
    onCommit(next);
    onClose();
  }

  return (
    <div
      ref={ref}
      className="absolute z-30 top-full left-0 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg p-3 space-y-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] font-semibold text-slate-700">
        Distribution method
      </div>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="w-full text-[11px] border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-500"
      >
        <option value="single">Direct (single recipient)</option>
        <option value="per_vhe">Per VHE (÷ N units)</option>
        <option value="by_m2">By m² (÷ N m²)</option>
        <option value="fixed_pct">Fixed percentage</option>
        <option value="metered_ista">Metered (Ista)</option>
        <option value="metered_internal">Metered (internal)</option>
      </select>

      {method === "per_vhe" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Units
            </label>
            <input
              type="number"
              value={denom}
              onChange={(e) => setDenom(e.target.value)}
              className="mt-0.5 w-full text-[11px] border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Unit label
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="mt-0.5 w-full text-[11px] border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>
      )}

      {method === "by_m2" && (
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Surface (m²)
          </label>
          <input
            type="number"
            value={denom}
            onChange={(e) => setDenom(e.target.value)}
            className="mt-0.5 w-full text-[11px] border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500 tabular-nums"
          />
        </div>
      )}

      {method === "fixed_pct" && (
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Percentage
          </label>
          <div className="relative mt-0.5">
            <input
              type="number"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="w-full text-[11px] border border-slate-200 rounded px-2 py-1 pr-7 focus:outline-none focus:ring-1 focus:ring-slate-500 tabular-nums"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
              %
            </span>
          </div>
        </div>
      )}

      {(method === "metered_ista" ||
        method === "metered_internal" ||
        method === "single") && (
        <div className="text-[10px] text-slate-500 italic px-0.5">
          {method === "single"
            ? "Whole amount goes to a single recipient."
            : "Per-meter readings drive the split — no parameters here."}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={onClose}
          className="h-7 px-2.5 rounded-md text-[11px] text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="h-7 px-3 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/* ─── Section wrapper ── */
function Section({ title, subtitle, children, action }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        {children}
      </div>
    </section>
  );
}

/* ─── Cost sources table ──
 *
 * Phase 5 additions:
 *   • Supplier name and kind are editable inline.
 *   • Each row reveals a delete-affordance on hover (trash icon).
 *   • A footer "+ Add cost source" row appends a new node into the lane and,
 *     if any existing source has an outgoing edge, wires the new node into
 *     that same downstream target so it participates in the Sankey.
 */
/* ─── ReadOnlyCurrencyCell — voor Werkelijk-bedragen die uit het
 * grootboek komen. Geen klik-affordance, geen hover-state — duidelijk
 * een uitkomst, geen invoerveld. */
function ReadOnlyCurrencyCell({ value, hint = "Uit grootboek" }) {
  return (
    <div
      className="text-right text-[11px] tabular-nums text-slate-900 cursor-default px-1.5 py-0.5"
      title={hint}
    >
      {value != null ? fmtEur(value) : "—"}
    </div>
  );
}

function CostSourcesTable({ sources, adjustments = [], groupId, laneId, frozen }) {
  // Drie subtotalen — gespiegeld aan de structuur in het hoofdcomponent
  // (LaneWorkflowView): grootboek-bronnen vs buiten-grootboek bronnen +
  // correcties. Begroting telt alleen grootboek-bronnen (buiten-grootboek
  // posten zijn per definitie unbudgeted).
  const grootboekSources = sources.filter((n) => !n.addedByUser);
  const manualSources = sources.filter((n) => n.addedByUser);
  const totalGrootboekActual = grootboekSources.reduce(
    (s, n) => s + (n.amount || 0),
    0
  );
  const totalManualActual = manualSources.reduce(
    (s, n) => s + (n.amount || 0),
    0
  );
  const totalAdjustmentsActual = adjustments.reduce(
    (s, n) => s + (n.amount || 0),
    0
  );
  const totalBuitenGrootboekActual = totalManualActual + totalAdjustmentsActual;
  const totalActual = totalGrootboekActual + totalBuitenGrootboekActual;
  const totalBudgeted = grootboekSources.reduce(
    (s, n) => s + (n.budgetedAmount || 0),
    0
  );
  const hasBuitenGrootboek =
    manualSources.length > 0 || adjustments.length > 0;

  function handleAdd() {
    if (!groupId || !laneId) return;

    // Pick the column existing sources sit in (the source column for this
    // lane — usually 0). Falling back to 0 keeps lanes that started empty
    // working too.
    let col = 0;
    if (sources.length > 0) {
      // Use the most-common col among sources, in case a lane has sources
      // staggered across columns.
      const counts = {};
      for (const s of sources) {
        const c = s.col ?? 0;
        counts[c] = (counts[c] || 0) + 1;
      }
      col = Number(
        Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      );
    }

    // Pick the next free row in that column. We scan ALL nodes in the lane
    // (not just sources) so the new card never lands on top of a split,
    // marker, or settlement that shares the same row index.
    const occupied = new Set();
    const allFlow = getCostFlow();
    for (const n of allFlow.nodes) {
      if (n.laneId === laneId && (n.col ?? 0) === col) {
        occupied.add(n.row ?? 0);
      }
    }
    let row = 0;
    while (occupied.has(row)) row++;

    // Wire to the same downstream target as an existing source so the new
    // node participates in the Sankey rather than dangling.
    let downstreamTargetId = null;
    for (const src of sources) {
      const { outgoing } = getEdgesForNode(src.id);
      if (outgoing && outgoing.length > 0) {
        downstreamTargetId = outgoing[0].to;
        break;
      }
    }

    addCostSource(groupId, laneId, { downstreamTargetId, col, row });
  }

  function handleDelete(node) {
    if (!groupId) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete cost source "${node.supplier || node.id}" from this component?`
      )
    ) {
      return;
    }
    deleteNode(groupId, node.id, laneId);
  }

  return (
    <table className="w-full text-[11px]">
      <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-50/60">
        <tr>
          <th className="text-left font-semibold px-3 py-2">Leverancier</th>
          <th className="text-left font-semibold px-3 py-2">Soort</th>
          <th className="text-right font-semibold px-3 py-2 w-32">
            <div className="flex items-center justify-end gap-1">
              <span>Begroting</span>
              <span
                className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-semibold tracking-wider text-slate-500 bg-slate-100 border border-slate-200 normal-case"
                title="Wordt jaarlijks vastgesteld door admin — organisatiebreed"
              >
                Admin
              </span>
            </div>
          </th>
          <th className="text-right font-semibold px-3 py-2 w-32">
            <div className="flex items-center justify-end gap-1">
              <span>Werkelijk</span>
              <span
                className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-semibold tracking-wider text-slate-500 bg-slate-100 border border-slate-200 normal-case"
                title="Uitkomst uit het grootboek — niet bewerkbaar"
              >
                Grootboek
              </span>
            </div>
          </th>
          <th className="text-right font-semibold px-3 py-2 w-24">Afwijking</th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sources.length === 0 && (
          <tr>
            <td
              colSpan={6}
              className="px-4 py-5 text-center text-[11px] text-slate-500 italic"
            >
              Nog geen kostenposten ingevoerd.
            </td>
          </tr>
        )}
        {sources.map((s) => {
          const v =
            s.budgetedAmount && s.amount != null
              ? (s.amount - s.budgetedAmount) / s.budgetedAmount
              : null;
          const overrun = v != null && v > 0.005;
          const under = v != null && v < -0.005;
          const isManual = !!s.addedByUser;
          // Buiten-grootboek bronnen krijgen dezelfde violet rij-tint als
          // correcties — visueel één laag "wat is buiten het grootboek
          // toegevoegd?" Begroting "—" want unbudgeted, Werkelijk wél
          // bewerkbaar (geen grootboek-bron achter de waarde).
          const rowClass = isManual
            ? "group hover:bg-violet-50/40 bg-violet-50/20"
            : "group hover:bg-slate-50/60";
          return (
            <tr key={s.id} className={rowClass}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <EditableTextCell
                    value={s.supplier}
                    disabled={frozen}
                    placeholder="—"
                    onCommit={(val) =>
                      setNodeField(groupId, s.id, "supplier", val)
                    }
                  />
                  {isManual && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-[9px] font-semibold uppercase tracking-wider"
                      title="Handmatig toegevoegd buiten het grootboek om — vereist toestemming teamleider"
                    >
                      <Sparkles size={9} />
                      Buiten grootboek
                    </span>
                  )}
                </div>
                {s.subLabel && (
                  <div className="text-[10px] text-slate-500 mt-0.5 px-1.5">
                    {s.subLabel}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-slate-600">
                <KindPickerCell
                  value={s.sourceKind}
                  disabled={frozen}
                  onCommit={(val) =>
                    setNodeField(groupId, s.id, "sourceKind", val)
                  }
                />
              </td>
              <td className="px-3 py-2">
                {isManual ? (
                  // Posten buiten grootboek staan niet in de jaarlijkse
                  // begroting — toon nadrukkelijk "—".
                  <div className="text-right text-[11px] tabular-nums text-slate-300 px-1.5 py-0.5">—</div>
                ) : (
                  <EditableCurrencyCell
                    value={s.budgetedAmount}
                    disabled={frozen}
                    onCommit={(val) =>
                      setNodeField(groupId, s.id, "budgetedAmount", val)
                    }
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {isManual ? (
                  // Buiten-grootboek bron — handmatig ingevoerd bedrag,
                  // dus wél bewerkbaar (in tegenstelling tot grootboek-bronnen).
                  <EditableCurrencyCell
                    value={s.amount}
                    disabled={frozen}
                    onCommit={(val) =>
                      setNodeField(groupId, s.id, "amount", val)
                    }
                  />
                ) : (
                  // Grootboek-bron — werkelijk komt uit het grootboek,
                  // niet bewerkbaar.
                  <ReadOnlyCurrencyCell value={s.amount} />
                )}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums text-[11px] ${
                  overrun
                    ? "text-amber-700"
                    : under
                    ? "text-emerald-700"
                    : "text-slate-400"
                }`}
              >
                {v != null
                  ? `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`
                  : "—"}
              </td>
              <td className="px-1.5 py-2 text-right">
                {!frozen && (
                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-rose-300"
                    title="Kostenpost verwijderen"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </td>
            </tr>
          );
        })}

        {/* Adjustment rows — corrections inserted on edges via the canvas.
         *  Different visual treatment so the user can tell at a glance
         *  these are signed corrections, not regular suppliers: violet
         *  accent, +/− chip in the Soort column, signed amount in the
         *  Werkelijk column tinted by direction, no Begroting/Afwijking. */}
        {adjustments.map((a) => {
          const isPositive = (a.amount || 0) >= 0;
          const SignIcon = isPositive ? Plus : Minus;
          return (
            <tr key={a.id} className="group hover:bg-violet-50/40 bg-violet-50/20">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-[9px] font-semibold uppercase tracking-wider shrink-0">
                    <Sparkles size={9} />
                    Correctie
                  </span>
                  <EditableTextCell
                    value={a.label}
                    disabled={frozen}
                    placeholder="Reden van correctie"
                    onCommit={(val) =>
                      setNodeField(groupId, a.id, "label", val)
                    }
                  />
                </div>
              </td>
              <td className="px-3 py-2 text-slate-600">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] ${
                    isPositive ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  <SignIcon size={11} strokeWidth={2.5} />
                  {isPositive ? "Bijtelling" : "Aftrek"}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                —
              </td>
              <td className="px-3 py-2">
                <EditableCurrencyCell
                  value={a.amount}
                  disabled={frozen}
                  onCommit={(val) =>
                    setNodeField(groupId, a.id, "amount", val)
                  }
                />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                —
              </td>
              <td className="px-1.5 py-2 text-right">
                {!frozen && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(
                          `Correctie "${a.label || a.id}" verwijderen?`
                        )
                      )
                        return;
                      deleteNode(groupId, a.id, laneId);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-rose-300"
                    title="Correctie verwijderen"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </td>
            </tr>
          );
        })}

        {!frozen && (
          <tr className="border-t border-slate-100">
            <td colSpan={6} className="px-3 py-1.5">
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors"
                title="Voor kosten buiten het grootboek om — vereist toestemming van de teamleider"
              >
                <Plus size={12} />
                Kostenpost buiten grootboek toevoegen
                <span className="text-slate-400 font-normal">·</span>
                <span className="text-[10px] text-slate-500">vereist goedkeuring</span>
              </button>
            </td>
          </tr>
        )}
        {/* Subtotalen — gegroepeerd. Tonen we alleen wanneer er
         *   daadwerkelijk buiten-grootboek posten zijn; anders is het ene
         *   eindtotaal voldoende en is de breakdown alleen ruis. */}
        {hasBuitenGrootboek && (
          <>
            <tr className="border-t border-slate-200 text-slate-500">
              <td className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold" colSpan={2}>
                Subtotaal grootboek
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {fmtEur(totalBudgeted)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {fmtEur(totalGrootboekActual)}
              </td>
              <td colSpan={2} />
            </tr>
            <tr className="text-violet-700 bg-violet-50/30">
              <td className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold" colSpan={2}>
                Subtotaal buiten grootboek
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">
                —
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {fmtSignedEur(totalBuitenGrootboekActual)}
              </td>
              <td colSpan={2} />
            </tr>
          </>
        )}
        <tr className="bg-slate-50/60 border-t border-slate-200">
          <td className="px-3 py-2 text-slate-700 font-semibold" colSpan={2}>
            Totaal werkelijk
          </td>
          <td className="px-3 py-2 text-right tabular-nums text-slate-700 font-semibold">
            {fmtEur(totalBudgeted)}
          </td>
          <td className="px-3 py-2 text-right tabular-nums text-slate-900 font-semibold">
            {fmtEur(totalActual)}
          </td>
          <td colSpan={2} />
        </tr>
      </tbody>
    </table>
  );
}

/* ─── Ledger comparison panel ── */
function LedgerComparisonPanel({ ledgerAccount, enteredTotal, bookedTotal, buitenGrootboekTotal = 0, onOpenBookkeeping }) {
  if (!ledgerAccount) {
    return (
      <div className="px-4 py-3 text-[11px] text-slate-500 italic">
        Nog geen grootboekrekening gekoppeld aan dit component.
      </div>
    );
  }
  const drift = (bookedTotal || 0) - (enteredTotal || 0);
  const matches = Math.abs(drift) < 1;
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className="text-slate-500">Grootboek</span>
        <code className="font-mono text-[10px] text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
          {ledgerAccount}
        </code>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-slate-200 p-2.5">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Ingevoerd
          </div>
          <div className="text-[14px] font-semibold tabular-nums text-slate-900">
            {fmtEur(enteredTotal)}
          </div>
          <div className="text-[10px] text-slate-500">som van de kostenposten</div>
        </div>
        <div className="rounded border border-slate-200 p-2.5">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Geboekt in ERP
          </div>
          <div className="text-[14px] font-semibold tabular-nums text-slate-900">
            {fmtEur(bookedTotal)}
          </div>
          <div className="text-[10px] text-slate-500">gepost op grootboekrekening</div>
        </div>
      </div>
      <div
        className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded border text-[11px] ${
          matches
            ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
            : "border-amber-200 bg-amber-50/60 text-amber-800"
        }`}
      >
        <div className="flex items-center gap-2">
          {matches ? (
            <CheckCircle2 size={13} />
          ) : (
            <AlertTriangle size={13} />
          )}
          <span className="font-medium">
            {matches
              ? "Sluit aan — ingevoerd totaal en geboekt totaal komen overeen."
              : Math.abs(buitenGrootboekTotal - drift) < 1
              ? `Verschil ${fmtSignedEur(drift)} — verklaard door ${fmtSignedEur(buitenGrootboekTotal)} aan posten buiten het grootboek.`
              : `Verschil ${fmtSignedEur(drift)} tussen ingevoerd en geboekt totaal.`}
          </span>
        </div>
        {onOpenBookkeeping && (
          <button
            onClick={onOpenBookkeeping}
            className="inline-flex items-center gap-1 text-[11px] hover:underline"
          >
            Openen in Boekhouding <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── YoY table ── */
function YoYTable({ byYear }) {
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  if (years.length === 0) {
    return (
      <div className="px-4 py-3 text-[11px] text-slate-500 italic">
        Geen historische data beschikbaar.
      </div>
    );
  }
  return (
    <table className="w-full text-[11px]">
      <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-50/60">
        <tr>
          <th className="text-left font-semibold px-3 py-2">Jaar</th>
          <th className="text-right font-semibold px-3 py-2">Totaal</th>
          <th className="text-right font-semibold px-3 py-2 w-24">Δ t.o.v. vorig</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {years.map((y, idx) => {
          const amt = byYear[y];
          const prev = idx < years.length - 1 ? byYear[years[idx + 1]] : null;
          const delta = prev != null && prev !== 0 ? (amt - prev) / prev : null;
          const overrun = delta != null && delta > 0.05;
          const under = delta != null && delta < -0.05;
          return (
            <tr key={y}>
              <td className="px-3 py-2 text-slate-700">{y}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                {fmtEur(amt)}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${
                  overrun ? "text-amber-700" : under ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {delta != null ? (
                  <span className="inline-flex items-center justify-end gap-1">
                    {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : null}
                    {`${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── DistributionCell — chip in the settlements row that opens the
 * DistributionEditor popover. Frozen mode renders a plain chip without
 * affordance. */
function DistributionCell({ value, onCommit, disabled }) {
  const [open, setOpen] = useState(false);
  const distCfg = distributionConfig[value?.method];
  const DistIcon = distCfg?.Icon;
  const distLabel = distCfg && value ? distCfg.short(value) : null;

  if (disabled) {
    return distLabel ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
        {DistIcon && <DistIcon size={10} className="text-slate-400" />}
        {distLabel}
      </span>
    ) : (
      <span className="text-slate-400">—</span>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 transition-colors ${
          distLabel
            ? "text-slate-700 hover:bg-slate-100 hover:ring-1 hover:ring-slate-200"
            : "text-slate-500 hover:bg-slate-100 hover:ring-1 hover:ring-slate-200"
        }`}
        title="Edit distribution method"
      >
        {DistIcon && <DistIcon size={10} className="text-slate-400" />}
        {distLabel || "Set method"}
        <Pencil size={9} className="text-slate-300" />
      </button>
      {open && (
        <DistributionEditor
          value={value}
          onCommit={onCommit}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/* ─── Distribution & settlements list ── */
function SettlementsList({ settlements, siblingGroups, groupId, frozen }) {
  if (settlements.length === 0) {
    return (
      <div className="px-4 py-3 text-[11px] text-slate-500 italic">
        No settlements configured for this component.
      </div>
    );
  }
  return (
    <table className="w-full text-[11px]">
      <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-50/60">
        <tr>
          <th className="text-left font-semibold px-3 py-2">Doelgroep</th>
          <th className="text-left font-semibold px-3 py-2">Verdeelsleutel</th>
          <th className="text-right font-semibold px-3 py-2 w-28">Werkelijk</th>
          <th className="text-right font-semibold px-3 py-2 w-28">Voorschot</th>
          <th className="text-right font-semibold px-3 py-2 w-32">Verschil</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {settlements.map((s) => {
          const audience = siblingGroups.find((g) => g.id === s.groupId);
          const AudIcon = audienceKindIcon[audience?.kind] || Users;
          const isCollect = s.delta != null && s.delta < -1;
          const isRefund = s.delta != null && s.delta > 1;
          return (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AudIcon size={12} className="text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] text-slate-900 font-medium truncate">
                      {audience?.name || s.groupId}
                    </div>
                    {audience?.vheCount != null && (
                      <div className="text-[10px] text-slate-500">
                        {audience.vheCount} VHE
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2 text-slate-600 overflow-visible">
                <DistributionCell
                  value={s.distribution}
                  disabled={frozen}
                  onCommit={(next) =>
                    setNodeField(groupId, s.id, "distribution", next)
                  }
                />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-900 font-medium">
                {fmtEur(s.amount || 0)}
              </td>
              <td className="px-3 py-2">
                <EditableCurrencyCell
                  value={s.advance}
                  disabled={frozen}
                  onCommit={(val) =>
                    setSettlementAdvance(groupId, s.id, val, s.amount || 0)
                  }
                />
              </td>
              <td className="px-3 py-2 text-right">
                {s.delta != null ? (
                  <div
                    className={`inline-flex flex-col items-end tabular-nums leading-tight ${
                      isCollect ? "text-amber-700" : isRefund ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    <span className="font-medium text-[11px]">
                      {fmtSignedEur(s.delta)}
                    </span>
                    {(isCollect || isRefund) && (
                      <span className="text-[10px]">
                        {isCollect ? "te innen" : "te restitueren"}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── Step 5 — slim per-tenant preview ──
 *
 * Auto-curated representatives drawn from the lane's tenancy outcomes:
 * the biggest collect, the biggest refund, three rows around the median
 * to show typical tenants, plus one partial-period (handover) tenancy if
 * any exist. Five-to-six rows max. The user clicks any row → opens the
 * full per-apartment breakdown in TenancyDetailSheet (the Excel
 * subtotaal block). Edits in steps 1–4 ripple through `active()` →
 * recomputes here → numbers move under the cursor.
 *
 * Why curated rows instead of a full table? The Tenants tab is the
 * deliverable — this step is a SANITY CHECK ("did my config produce
 * sensible per-tenant numbers?"), not the destination. Five rows tell
 * the story without re-creating the master grid inside the workflow.
 */

function pickRepresentativeTenancies(rows, count = 5) {
  if (rows.length <= count) return [...rows].sort((a, b) => a.cell.delta - b.cell.delta);
  const sorted = [...rows].sort((a, b) => a.cell.delta - b.cell.delta);
  const n = sorted.length;
  const seen = new Set();
  const picks = [];
  const add = (r) => {
    if (r && !seen.has(r.tenancy.id)) {
      picks.push(r);
      seen.add(r.tenancy.id);
    }
  };
  add(sorted[0]);                                   // biggest collect
  add(sorted[Math.floor(0.25 * (n - 1))]);
  add(sorted[Math.floor(0.5 * (n - 1))]);
  add(sorted[Math.floor(0.75 * (n - 1))]);
  add(sorted[n - 1]);                               // biggest refund
  if (picks.length < count + 1) {
    const partial = sorted.find((r) => r.tenancy.coverage !== "full");
    if (partial) add(partial);
  }
  // Final order: biggest collect → median → biggest refund.
  return picks.sort((a, b) => a.cell.delta - b.cell.delta);
}

function PerTenantPreview({
  groupId,
  laneId,
  scopeAudienceId,
  onOpenTenancy,
  onJumpToTenants,
}) {
  const rows = useMemo(
    () =>
      groupId ? getLaneTenancyOutcomes(groupId, laneId, scopeAudienceId) : [],
    [groupId, laneId, scopeAudienceId]
  );
  const picks = useMemo(() => pickRepresentativeTenancies(rows, 5), [rows]);

  if (picks.length === 0) {
    return (
      <div className="px-4 py-3 text-[11px] text-slate-500 italic">
        Geen huurperiodes worden door dit component gefactureerd
        {scopeAudienceId ? " voor de gefilterde doelgroep" : ""}.
      </div>
    );
  }

  return (
    <table className="w-full text-[11px]">
      <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-50/60">
        <tr>
          <th className="text-left font-semibold px-3 py-2">Huurperiode</th>
          <th className="text-right font-semibold px-3 py-2 w-24">Kosten</th>
          <th className="text-right font-semibold px-3 py-2 w-24">Voorschot</th>
          <th className="text-right font-semibold px-3 py-2 w-28">Δ</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {picks.map((p) => {
          const dirClass =
            p.cell.delta < -1 ? "text-amber-700"
          : p.cell.delta > 1  ? "text-emerald-700"
          :                     "text-slate-400";
          return (
            <tr
              key={p.tenancy.id}
              className="hover:bg-slate-50/60 cursor-pointer group"
              onClick={() => onOpenTenancy?.(p.tenancy.id)}
              title="Klik voor volledig overzicht per woning"
            >
              <td className="px-3 py-1.5">
                <div className="text-[12px] text-slate-900 font-medium leading-tight truncate">
                  {p.vhe.address}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
                  {p.tenancy.tenantName}
                  {p.tenancy.coverage !== "full" && (
                    <span className="text-amber-700 ml-1.5">· deel jaar</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-900">
                {fmtEur(p.cell.calcCost)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                {fmtEur(p.cell.advance)}
              </td>
              <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${dirClass}`}>
                {fmtSignedEur(p.cell.delta)}
              </td>
            </tr>
          );
        })}
        {rows.length > picks.length && onJumpToTenants && (
          <tr className="bg-slate-50/30">
            <td colSpan={4} className="px-3 py-1.5">
              <button
                type="button"
                onClick={onJumpToTenants}
                className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
              >
                Bekijk alle {rows.length.toLocaleString("nl-NL")} huurperiodes voor dit component
                <ChevronRight size={11} />
              </button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ─── Main ── */
export default function LaneWorkflowView({ laneId, scopeAudienceId, onJumpToBookkeeping, onJumpToTenants }) {
  // Subscribe to edits — re-render whenever the user changes anything.
  useEditsVersion();

  const flow = getCostFlow();
  const lane = flow.lanes.find((l) => l.id === laneId);
  const groupId = flow.group?.id;
  // The store still exposes "freeze/frozen"; we keep the variable name
  // here so child props stay stable, but every user-visible string says
  // "lock"/"locked".
  const frozen = groupId ? isLaneFrozen(groupId, laneId) : false;

  const sources = useMemo(
    () =>
      flow.nodes.filter((n) => n.type === "source" && n.laneId === laneId),
    [flow, laneId]
  );
  // Adjustments inserted on edges (Phase 7) are also cost line-items
  // with a sign; they belong in Step 1's Kostenposten list alongside the
  // sources so the user sees the full picture of what makes up the total.
  const adjustments = useMemo(
    () =>
      flow.nodes.filter(
        (n) => n.type === "adjustment" && n.laneId === laneId
      ),
    [flow, laneId]
  );
  const allSettlements = useMemo(
    () =>
      flow.nodes.filter(
        (n) =>
          n.type === "settlement" && n.laneId === laneId && !n.outOfScope
      ),
    [flow, laneId]
  );
  // When the user came in via an audience filter, the workflow's step 4
  // narrows to the scoped audience's settlement(s). Steps 1-3 stay
  // full-lane because cost sources, ledger, and YoY are upstream of the
  // audience split — narrowing them would lie about the supplier-side data.
  const settlements = useMemo(
    () =>
      scopeAudienceId
        ? allSettlements.filter((s) => s.groupId === scopeAudienceId)
        : allSettlements,
    [allSettlements, scopeAudienceId]
  );

  const hasEdits = groupId
    ? hasEditsForLane(
        groupId,
        [...sources, ...adjustments, ...allSettlements],
        laneId
      )
    : false;

  // Werkelijk-totaal in drie lagen:
  //   • Grootboek          — alleen sources die uit het grootboek komen
  //                           (addedByUser !== true). Dit is het bedrag
  //                           dat de Grootboek-controle moet zien als
  //                           "Geboekt in ERP" — buiten-grootboek items
  //                           tellen hier dus NIET mee.
  //   • Buiten grootboek   — handmatig toegevoegde sources + correcties.
  //   • Totaal werkelijk   — som van beide. Mirror van wat active() in
  //                           costFlow.js in de settlement-amount vouwt.
  const totalGrootboek = sources
    .filter((n) => !n.addedByUser)
    .reduce((s, n) => s + (n.amount || 0), 0);
  const totalManualSources = sources
    .filter((n) => n.addedByUser)
    .reduce((s, n) => s + (n.amount || 0), 0);
  const totalAdjustments = adjustments.reduce(
    (s, n) => s + (n.amount || 0),
    0
  );
  const totalBuitenGrootboek = totalManualSources + totalAdjustments;
  const totalActual = totalGrootboek + totalBuitenGrootboek;
  const totalBudgeted = sources
    .filter((n) => !n.addedByUser)
    .reduce((s, n) => s + (n.budgetedAmount || 0), 0);

  // Component-level identity is derived: service code from settlements,
  // ledger account from the first source's anchor.
  const serviceCode = settlements[0]?.serviceCode || null;
  const ledgerAccount = sources[0]?.anchors?.[0]?.ledgerAccount || null;

  // Aggregate YoY per year across all sources of this component.
  const yoyByYear = useMemo(() => {
    const m = {};
    for (const s of sources) {
      for (const y of s.yoyComparison || []) {
        if (y.year != null && y.amount != null) {
          m[y.year] = (m[y.year] || 0) + y.amount;
        }
      }
    }
    return m;
  }, [sources]);

  // ERP-booked total = alleen wat in het grootboek staat. Handmatig
  // toegevoegde kostenposten en correcties zitten per definitie NIET in
  // het ERP, dus die mogen niet meetellen — anders verbergt de
  // Grootboek-controle juist de drift die hij hoort te tonen.
  const bookedTotal = totalGrootboek;

  if (!lane) {
    return (
      <div className="px-6 py-8 text-[12px] text-slate-500">Lane not found.</div>
    );
  }

  const variancePct =
    totalBudgeted !== 0 ? (totalActual - totalBudgeted) / totalBudgeted : 0;

  return (
    <div className="overflow-y-auto h-full bg-slate-50/30">
      <div className="px-6 py-5 max-w-[900px] mx-auto space-y-5">
        {/* Hero */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Kostencomponent
            </div>
            <h1 className="text-xl font-semibold text-slate-900 leading-tight mt-0.5">
              {lane.title}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
              {serviceCode && (
                <code className="font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px]">
                  {serviceCode}
                </code>
              )}
              <span>Afrekening {flow.period}</span>
              {ledgerAccount && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>GB {ledgerAccount}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Werkelijke kosten
            </div>
            <div className="text-[18px] font-semibold tabular-nums text-slate-900">
              {fmtEur(totalActual)}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              begroting {fmtEur(totalBudgeted)}{" "}
              {Math.abs(variancePct) > 0.005 && (
                <span
                  className={
                    variancePct > 0 ? "text-amber-700" : "text-emerald-700"
                  }
                >
                  ({variancePct > 0 ? "+" : ""}
                  {(variancePct * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Vergrendeld-banner */}
        {frozen && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 flex items-center gap-2.5 text-[12px] text-emerald-800">
            <Lock size={14} className="shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Vergrendeld voor {flow.period}</span>
              <span className="text-emerald-700">
                {" "}
                — dit component is goedgekeurd en alleen-lezen. Ontgrendel om te wijzigen.
              </span>
            </div>
            <button
              onClick={() => unfreezeLane(groupId, laneId)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-emerald-300 bg-white text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <Unlock size={12} />
              Ontgrendelen
            </button>
          </div>
        )}

        {/* Stap 1 — Kostenposten */}
        <Section
          title="1 · Kostenposten"
          subtitle="Eén rij per leverancier die bijdraagt aan dit component, plus eventuele correcties. Klik op een veld om te wijzigen."
        >
          <CostSourcesTable
            sources={sources}
            adjustments={adjustments}
            groupId={groupId}
            laneId={laneId}
            frozen={frozen}
          />
        </Section>

        {/* Stap 2 — Grootboek-controle */}
        <Section
          title="2 · Grootboek-controle"
          subtitle="Controleer het ingevoerde totaal tegen het geboekte ERP-totaal op deze grootboekrekening"
        >
          <LedgerComparisonPanel
            ledgerAccount={ledgerAccount}
            enteredTotal={totalActual}
            bookedTotal={bookedTotal}
            buitenGrootboekTotal={totalBuitenGrootboek}
            onOpenBookkeeping={onJumpToBookkeeping}
          />
        </Section>

        {/* Stap 3 — Jaar-op-jaar */}
        <Section
          title="3 · Jaar-op-jaar"
          subtitle="Wijkt het totaal significant af ten opzichte van voorgaande jaren?"
        >
          <YoYTable byYear={yoyByYear} />
        </Section>

        {/* Verwijzing naar de Huurders-tab — dáár staat het resultaat per
         * huurperiode en de verdeelsleutel-uitkomst. Geen Step 4 of 5 in
         * het afrekenproces zelf: die zijn dubbel met de Huurders-tab en
         * de canvas. */}
        {onJumpToTenants && (
          <button
            type="button"
            onClick={onJumpToTenants}
            className="w-full text-left rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors p-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-slate-900">
                Bekijk de uitkomst per huurder →
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Het resultaat per VHE en huurperiode — kosten, voorschot en
                saldo voor elk component — staat in de Huurders-tab.
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-400 shrink-0" />
          </button>
        )}

        {/* Goedkeuren & vergrendelen action bar */}
        {!frozen && groupId && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-slate-900">
                Klaar om dit component af te rekenen?
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Vergrendelen legt de ingevoerde waarden voor {flow.period} vast als
                de goedgekeurde versie. Je kunt later altijd ontgrendelen om aanpassingen te maken.
              </div>
            </div>
            {hasEdits && (
              <button
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm(
                      "Alle wijzigingen aan dit component verwerpen en terug naar de oorspronkelijke waarden?"
                    )
                  )
                    return;
                  clearLaneEdits(
                    groupId,
                    [...sources, ...adjustments, ...allSettlements],
                    laneId
                  );
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                <RotateCcw size={12} />
                Wijzigingen verwerpen
              </button>
            )}
            <button
              onClick={() => freezeLane(groupId, laneId)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-emerald-300 bg-emerald-50 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <Lock size={12} />
              Goedkeuren &amp; vergrendelen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
