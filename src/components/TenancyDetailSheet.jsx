import React, { useEffect, useMemo } from "react";
import {
  X,
  Home,
  Lock,
  Zap,
  Sparkles,
  HardHat,
  FileText,
  ChevronRight,
} from "lucide-react";
import { fmtEur, fmtSignedEur } from "@/lib/costFlow";
import { getTenancyOutcome } from "@/lib/perTenant";
import { useEditsVersion } from "@/lib/costFlowEdits";

/* TenancyDetailSheet — slide-out for one tenancy's full breakdown.
 *
 * This is the per-apartment view: every component the tenancy is
 * responsible for, calc vs advance vs Δ, with a subtotal that mirrors
 * the "Subtotaal (Verhuurcontract …)" rows in the source Excel. It's
 * shown either:
 *
 *   • from the Tenants tab when the user clicks a row, or
 *   • from the slim Step-5 preview inside a lane's Settle workflow.
 *
 * Stack-friendly: when the parent is itself a sheet (LaneDetailSheet at
 * z-50), this one renders at z-60/70 and uses CAPTURE-phase ESC handling
 * with stopImmediatePropagation so dismissing only closes the topmost
 * sheet — the user has to press ESC twice to exit both, matching native
 * stacked-modal expectations.
 */

const CATEGORY_ICON = {
  energy:     Zap,
  cleaning:   Sparkles,
  management: HardHat,
  other:      FileText,
};

export default function TenancyDetailSheet({
  groupId,
  tenancyId,
  onClose,
  onJumpToCostFlow,
}) {
  // Subscribe so per-component numbers move when the user edits a cost
  // source upstream — this is the "ripple" surface for one apartment.
  useEditsVersion();

  const outcome = useMemo(
    () => (groupId && tenancyId ? getTenancyOutcome(groupId, tenancyId) : null),
    [groupId, tenancyId]
  );

  // ESC closes — but only this sheet, even when a parent sheet is open
  // behind. Capture-phase + stopImmediatePropagation keeps the parent's
  // window-level handler from also firing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (!outcome) return null;

  const { vhe, tenancy, byLane, netCalc, netAdvance, netDelta } = outcome;
  const allCells = Object.values(byLane);
  const applicable = allCells.filter((c) => c.applicable);
  const inapplicableCount = allCells.length - applicable.length;
  const directionLabel =
    netDelta < -1 ? "te innen van huurder"
    : netDelta > 1  ? "te restitueren aan huurder"
    :                 "sluitend";
  const directionTone =
    netDelta < -1 ? "text-amber-700"
    : netDelta > 1  ? "text-emerald-700"
    :                 "text-slate-700";

  // Group applicable rows by category for visual grouping. Keeps the
  // breakdown readable when the same group has 12+ components.
  const grouped = useMemo(() => {
    const m = {};
    for (const c of applicable) {
      const cat = c.laneCategory || "other";
      if (!m[cat]) m[cat] = [];
      m[cat].push(c);
    }
    // Stable sort: largest |delta| first within a category — the rows
    // most likely to have moved.
    for (const cat in m) {
      m[cat].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    }
    return m;
  }, [applicable]);
  const categoryOrder = ["energy", "cleaning", "management", "other"];
  const orderedCats = [
    ...categoryOrder.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
  ];

  return (
    <>
      {/* Backdrop — z-60 sits above the L3 sheet (z-50) and below the
       * sheet panel itself (z-70). Click dismisses. */}
      <div
        className="fixed inset-0 bg-slate-900/35 z-[60]"
        onClick={onClose}
      />

      <div
        className="fixed inset-y-0 right-0 z-[70] bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(94%, 720px)" }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-3.5 border-b border-slate-200 shrink-0 bg-white">
          <div className="w-9 h-9 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
            <Home size={16} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Huurder-overzicht
            </div>
            <div className="text-[14px] font-semibold text-slate-900 leading-tight truncate">
              {vhe.address}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {tenancy.tenantName}
              <span className="text-slate-300"> · </span>
              <span className="font-mono">{tenancy.contractCode}</span>
              <span className="text-slate-300"> · </span>
              <span>
                {new Date(tenancy.start).toLocaleDateString("nl-NL", {
                  day: "numeric", month: "short",
                })}
                {" – "}
                {new Date(tenancy.end).toLocaleDateString("nl-NL", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
              {tenancy.coverage !== "full" && (
                <span className="text-amber-700 ml-1.5 font-medium">· deel jaar</span>
              )}
              <span className="text-slate-300"> · </span>
              <span>{vhe.m2} m²</span>
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

        {/* Net subtotal hero */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Werkelijke kosten
              </div>
              <div className="text-[16px] font-semibold tabular-nums text-slate-900 mt-0.5">
                {fmtEur(netCalc)}
              </div>
              <div className="text-[10px] text-slate-500">
                over {applicable.length} component{applicable.length === 1 ? "" : "en"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Voorschot
              </div>
              <div className="text-[16px] font-semibold tabular-nums text-slate-900 mt-0.5">
                {fmtEur(netAdvance)}
              </div>
              <div className="text-[10px] text-slate-500">
                {tenancy.coverage === "full" ? "heel jaar" : "naar rato"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Saldo Δ
              </div>
              <div className={`text-[16px] font-semibold tabular-nums mt-0.5 ${directionTone}`}>
                {fmtSignedEur(netDelta)}
              </div>
              <div className="text-[10px] text-slate-500">{directionLabel}</div>
            </div>
          </div>
        </div>

        {/* Per-component breakdown */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between mb-2.5">
              <h3 className="text-[12px] font-semibold text-slate-900">
                Per kostencomponent
              </h3>
              <span className="text-[11px] text-slate-500">
                {applicable.length} van {allCells.length} van toepassing
              </span>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-50/60 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Component</th>
                    <th className="text-right font-semibold px-3 py-2 w-24">Kosten</th>
                    <th className="text-right font-semibold px-3 py-2 w-24">Voorschot</th>
                    <th className="text-right font-semibold px-3 py-2 w-28">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedCats.map((cat) => {
                    const Icon = CATEGORY_ICON[cat] || FileText;
                    const rows = grouped[cat];
                    return (
                      <React.Fragment key={cat}>
                        <tr className="bg-slate-50/40 border-y border-slate-100">
                          <td colSpan={4} className="px-3 py-1.5">
                            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                              <Icon size={10} strokeWidth={1.6} />
                              {cat}
                            </span>
                          </td>
                        </tr>
                        {rows.map((c) => {
                          const dirClass =
                            c.delta < -1 ? "text-amber-700"
                          : c.delta > 1  ? "text-emerald-700"
                          :                "text-slate-400";
                          return (
                            <tr
                              key={c.laneId}
                              className="border-b border-slate-100 hover:bg-slate-50/60 group"
                            >
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => onJumpToCostFlow?.(c.laneId)}
                                  disabled={!onJumpToCostFlow}
                                  className={`text-left text-slate-900 font-medium inline-flex items-center gap-1.5 ${
                                    onJumpToCostFlow
                                      ? "hover:underline cursor-pointer"
                                      : "cursor-default"
                                  }`}
                                  title={onJumpToCostFlow ? "Openen in Kostenstroom" : c.laneTitle}
                                >
                                  {c.locked && (
                                    <Lock size={10} className="text-emerald-600 shrink-0" />
                                  )}
                                  <span className="truncate">{c.laneTitle}</span>
                                </button>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                                {fmtEur(c.calcCost)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                {fmtEur(c.advance)}
                              </td>
                              <td className={`px-3 py-2 text-right tabular-nums font-medium ${dirClass}`}>
                                {fmtSignedEur(c.delta)}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-slate-50 border-t-2 border-slate-300">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      Subtotaal
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-900 font-semibold">
                      {fmtEur(netCalc)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-900 font-semibold">
                      {fmtEur(netAdvance)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${directionTone}`}>
                      {fmtSignedEur(netDelta)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {inapplicableCount > 0 && (
              <p className="text-[11px] text-slate-400 italic mt-2.5">
                {inapplicableCount} component{inapplicableCount === 1 ? "" : "en"} {inapplicableCount === 1 ? "is" : "zijn"} niet van toepassing op deze huurder
                {" "}(andere doelgroep).
              </p>
            )}

            {onJumpToCostFlow && (
              <div className="mt-3 text-[10px] text-slate-400 inline-flex items-center gap-1">
                Klik op een componentnaam om te openen in Kostenstroom
                <ChevronRight size={9} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
