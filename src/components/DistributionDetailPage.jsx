import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Send,
  ShieldCheck,
  Flag,
  Users,
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Lock,
  FileCheck,
  ArrowUpRight,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import { brand } from "@/lib/brand";
import {
  getDistributionById,
  getBuilding,
  getService,
  getDistributionModel,
  getCostCategoriesByService,
  getLedgerByServiceAndBuilding,
} from "@/lib/mockData";
import { useOrg } from "@/lib/OrgContext";
import { useLang } from "@/lib/i18n";
import { STEP_ORDER, STEP_CONFIG } from "@/lib/data/distributions";
import Breadcrumbs from "./Breadcrumbs";
import { Card, CardContent } from "./ui/card";

/* ── Deep copy helper ── */
const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

/* ── Mock users available for approval requests ── */
const MOCK_USERS = [
  { id: "user-lisa",  name: "Lisa" },
  { id: "user-peter", name: "Peter" },
];

/* ── Today as ISO date string ── */
const today = () => new Date().toISOString().split("T")[0];

/* ── Formatters ── */
const fmtEur = (v, decimals = 0) =>
  v == null ? "—" :
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v);
const fmtPct = (v) => v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/* ── Step status config ── */
const STEP_STATUS = {
  complete:    { icon: CheckCircle2, color: "#16A34A", bg: "#F0FDF4", label: { en: "Complete",    nl: "Afgerond"      } },
  in_progress: { icon: Clock,        color: "#2563EB", bg: "#EFF6FF", label: { en: "In progress", nl: "In uitvoering" } },
  pending:     { icon: Circle,       color: "#94A3B8", bg: "#F8FAFC", label: { en: "Pending",     nl: "In afwachting" } },
  flagged:     { icon: AlertTriangle,color: "#D97706", bg: "#FFFBEB", label: { en: "Flagged",     nl: "Aandacht"      } },
};

function StepStatusBadge({ status, lang }) {
  const cfg = STEP_STATUS[status] || STEP_STATUS.pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={12} />
      {cfg.label[lang] || cfg.label.en}
    </span>
  );
}

/* ── Variance badge ── */
function VarianceBadge({ pct, threshold = 10 }) {
  if (pct == null) return <span className="text-xs text-slate-400">—</span>;
  const exceeded = Math.abs(pct) > threshold;
  const color = exceeded ? "#D97706" : pct > 0 ? "#64748B" : "#16A34A";
  const bg    = exceeded ? "#FFFBEB" : pct > 0 ? "#F8FAFC" : "#F0FDF4";
  const Icon  = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: bg, color }}>
      <Icon size={11} />
      {fmtPct(pct)}
      {exceeded && <Flag size={10} />}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP ACTION FOOTER
   Renders at the bottom of every step panel:
   - isComplete  → green "Completed" stamp
   - !isActive   → grey "Complete previous steps" lock
   - isActive    → primary CTA button (enabled/disabled)
   ══════════════════════════════════════════════════════════════ */
function StepActionFooter({ isActive, isComplete, completedAt, completedBy, canAdvance, onAdvance, advanceLabel, blockReason, lang }) {
  if (isComplete) {
    return (
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
        <CheckCircle2 size={13} className="text-green-500 flex-none" />
        <span className="text-xs text-green-700 font-medium">
          {lang === "nl" ? "Afgerond" : "Completed"}
          {completedAt ? ` · ${fmtDate(completedAt)}` : ""}
          {completedBy ? ` · ${completedBy}` : ""}
        </span>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
        <Lock size={12} className="text-slate-300 flex-none" />
        <span className="text-xs text-slate-400">
          {lang === "nl" ? "Voltooi de vorige stappen eerst" : "Complete previous steps first"}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        {blockReason ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle size={12} className="flex-none" />
            {blockReason}
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            {lang === "nl" ? "Klaar voor de volgende stap" : "Ready to proceed"}
          </span>
        )}
      </div>
      <button
        onClick={canAdvance ? onAdvance : undefined}
        disabled={!canAdvance}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex-none ${
          canAdvance
            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
        }`}
      >
        {advanceLabel || (lang === "nl" ? "Bevestigen & verder" : "Confirm & proceed")}
        {canAdvance && <ChevronRight size={13} />}
      </button>
    </div>
  );
}

/* ── Step navigator (vertical left panel) ── */
function StepNavigator({ distribution, activeStep, onSelectStep, lang }) {
  const currentIdx = distribution.currentStep === "complete" ? 6 : STEP_ORDER.indexOf(distribution.currentStep);
  const isComplete = distribution.currentStep === "complete";

  return (
    <div className="flex flex-col gap-1">
      {STEP_ORDER.map((step, i) => {
        const stepData = distribution.steps?.[step];
        const done = isComplete || i < currentIdx;
        const active = step === activeStep;
        const isCurrent = !isComplete && i === currentIdx;
        const stepCfg = STEP_CONFIG[step];
        const status = stepData?.status || (done ? "complete" : "pending");
        const hasFlagged = status === "in_progress" && step === "control" && (distribution.steps?.control?.excesses || []).some(e => e.exceeded);
        const hasFlaggedCheck = status === "in_progress" && step === "check" && (distribution.steps?.check?.tenantOutcomes || []).some(t => t.status === "flagged");

        return (
          <button
            key={step}
            onClick={() => onSelectStep(step)}
            disabled={!done && !isCurrent}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
              active
                ? "bg-slate-100 text-slate-900"
                : done || isCurrent
                ? "hover:bg-slate-50 text-slate-600 cursor-pointer"
                : "text-slate-300 cursor-not-allowed"
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center flex-none">
              {done ? (
                <CheckCircle2 size={16} style={{ color: brand.teal || "#3EB1C8" }} />
              ) : isCurrent ? (
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: "#2563EB" }}>
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-200 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-slate-300">{i + 1}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium leading-tight ${active ? "text-slate-900" : done ? "text-slate-600" : isCurrent ? "text-slate-800" : "text-slate-300"}`}>
                {stepCfg.label[lang] || stepCfg.label.en}
              </p>
              {stepData?.completedAt && done && (
                <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(stepData.completedAt)}</p>
              )}
              {isCurrent && (
                <p className="text-[10px] text-blue-500 mt-0.5">{lang === "nl" ? "Actief" : "Active"}</p>
              )}
            </div>

            {(hasFlagged || hasFlaggedCheck) && (
              <Flag size={11} className="text-amber-500 flex-none" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP PANELS
   Each receives: distribution (local state), lang, isActive, onAdvance
   ══════════════════════════════════════════════════════════════ */

/* ── Step 1: Validation ── */
function ValidationPanel({ distribution, lang, isActive, onAdvance }) {
  const step = distribution.steps?.validation;
  const issues = step?.issues || [];
  const isComplete = step?.status === "complete";
  const allComplete = distribution.services.every(s => (s.completeness ?? 0) === 100);
  const canAdvance = allComplete && issues.length === 0;
  const [expandedSvc, setExpandedSvc] = useState(null);

  return (
    <div className="space-y-4">
      <StepHeader
        title={lang === "nl" ? "Validatie" : "Validation"}
        description={lang === "nl"
          ? "Controleer of alle kosten per dienst volledig zijn ingeboekt voor deze periode."
          : "Verify that all costs per service are fully booked for this period."}
        status={step?.status}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        lang={lang}
      />

      <Card className="border-slate-200 bg-white">
        <CardContent className="py-0">
          {distribution.services.map((svc, idx) => {
            const service = getService(svc.serviceId);
            const name = service?.name?.[lang] || service?.name?.en || svc.serviceId;
            const completeness = svc.completeness ?? 0;
            const isOk = completeness === 100;
            const isExpanded = expandedSvc === svc.serviceId;

            // Ledger data for drill-down
            const ledgerEntries = getLedgerByServiceAndBuilding(svc.serviceId, distribution.buildingId)
              .filter(e => e.year === distribution.period);
            const costCats = getCostCategoriesByService(svc.serviceId)
              .filter(cc => cc.id.startsWith(`CC-${distribution.buildingId}`) || !cc.id.includes("-8"));
            // Group ledger entries by cost category
            const byCat = {};
            for (const e of ledgerEntries) {
              const key = e.costCategoryId || "_none";
              if (!byCat[key]) byCat[key] = [];
              byCat[key].push(e);
            }

            return (
              <div key={svc.serviceId} className={idx < distribution.services.length - 1 ? "border-b border-slate-100" : ""}>
                <button
                  onClick={() => setExpandedSvc(isExpanded ? null : svc.serviceId)}
                  className="w-full flex items-center gap-3 py-3 hover:bg-slate-50/50 transition-colors text-left"
                >
                  <ChevronDown
                    size={13}
                    className={`text-slate-300 shrink-0 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
                    <p className="text-[11px] text-slate-400">
                      {svc.serviceId}
                      {ledgerEntries.length > 0 && (
                        <span className="ml-2 text-slate-300">
                          · {ledgerEntries.length} {lang === "nl" ? "boekingen" : "entries"}
                          · {fmtEur(svc.actual)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="w-32 hidden sm:block">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${completeness}%`, background: isOk ? "#3EB1C8" : "#F59E0B" }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-slate-500 w-8 text-right">{completeness}%</span>
                    </div>
                  </div>
                  <div className="flex-none">
                    {isOk ? <CheckCircle2 size={15} className="text-green-500" /> : <AlertTriangle size={15} className="text-amber-500" />}
                  </div>
                </button>

                {/* Expanded: Cost categories and ledger entries */}
                {isExpanded && (
                  <div className="pl-7 pr-3 pb-3">
                    {Object.keys(byCat).length > 0 ? (
                      <div className="rounded-lg border border-slate-100 overflow-hidden">
                        {Object.entries(byCat).map(([catId, entries], catIdx) => {
                          const catObj = costCats.find(cc => cc.id === catId);
                          const catName = catObj?.name?.[lang] || catObj?.name?.en || (catId === "_none" ? (lang === "nl" ? "Overig" : "Other") : catId);
                          const catTotal = entries.reduce((s, e) => s + (e.amount || 0), 0);
                          return (
                            <div key={catId} className={catIdx > 0 ? "border-t border-slate-100" : ""}>
                              {/* Category header */}
                              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80">
                                <FolderOpen size={11} className="text-slate-400 shrink-0" />
                                <span className="text-[11px] font-semibold text-slate-600 flex-1 truncate">{catName}</span>
                                <span className="text-[11px] font-medium tabular-nums text-slate-500">{fmtEur(catTotal)}</span>
                                <span className="text-[10px] text-slate-400">({entries.length}×)</span>
                              </div>
                              {/* Individual entries */}
                              <div className="divide-y divide-slate-50">
                                {entries
                                  .sort((a, b) => a.month - b.month || a.date.localeCompare(b.date))
                                  .map((entry) => (
                                  <div key={entry.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                                    <span className="w-16 shrink-0 text-slate-400 tabular-nums">{entry.date}</span>
                                    <span className="flex-1 text-slate-600 truncate">{entry.description}</span>
                                    {entry.supplier && (
                                      <span className="hidden sm:block text-[10px] text-slate-400 truncate max-w-[120px]">{entry.supplier}</span>
                                    )}
                                    <span className="shrink-0 tabular-nums font-medium text-slate-700 text-right w-16">{fmtEur(entry.amount, 2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 py-2">
                        {lang === "nl" ? "Geen boekingen gevonden voor deze periode." : "No entries found for this period."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{lang === "nl" ? "Aandachtspunten" : "Issues"}</p>
          {issues.map((issue, i) => {
            const svc = getService(issue.serviceId);
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <AlertTriangle size={14} className="text-amber-500 flex-none mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-800">{svc?.name?.[lang] || issue.serviceId}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">{issue.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {issues.length === 0 && allComplete && !isComplete && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
          <CheckCircle2 size={14} className="text-green-500 flex-none" />
          <p className="text-xs text-green-700">
            {lang === "nl" ? "Alle kosten volledig ingeboekt. Klaar voor de volgende stap." : "All costs fully booked. Ready for next step."}
          </p>
        </div>
      )}

      <StepActionFooter
        isActive={isActive}
        isComplete={isComplete}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        canAdvance={canAdvance}
        onAdvance={() => onAdvance()}
        advanceLabel={lang === "nl" ? "Validatie bevestigen" : "Confirm validation"}
        blockReason={!canAdvance && isActive ? (lang === "nl" ? "Niet alle diensten zijn 100% compleet" : "Not all services are 100% complete") : null}
        lang={lang}
      />
    </div>
  );
}

/* ── Step 2: Comparison ── */
function ComparisonPanel({ distribution, lang, isActive, onAdvance }) {
  const step = distribution.steps?.comparison;
  const deviations = step?.deviations || [];
  const isComplete = step?.status === "complete";

  return (
    <div className="space-y-4">
      <StepHeader
        title={lang === "nl" ? "Vergelijking" : "Comparison"}
        description={lang === "nl"
          ? "Vergelijk de werkelijke kosten per dienst met het voorgaande jaar."
          : "Compare actual costs per service against the previous year."}
        status={step?.status}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        lang={lang}
      />

      <Card className="border-slate-200 bg-white">
        <CardContent className="py-0">
          <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="col-span-2">{lang === "nl" ? "Dienst" : "Service"}</span>
            <span className="text-right">{lang === "nl" ? "Vorig jaar" : "Prev. year"}</span>
            <span className="text-right">{lang === "nl" ? "Dit jaar" : "This year"}</span>
            <span className="text-right">{lang === "nl" ? "Verschil" : "Variance"}</span>
          </div>
          {distribution.services.map((svc, idx) => {
            const service = getService(svc.serviceId);
            const name = service?.name?.[lang] || service?.name?.en || svc.serviceId;
            return (
              <div key={svc.serviceId} className={`grid grid-cols-5 gap-2 items-center px-3 py-3 ${idx < distribution.services.length - 1 ? "border-b border-slate-100" : ""}`}>
                <div className="col-span-2 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
                </div>
                <span className="text-xs text-right text-slate-500 tabular-nums">{fmtEur(svc.previousActual)}</span>
                <span className="text-xs text-right font-medium text-slate-800 tabular-nums">{fmtEur(svc.actual)}</span>
                <div className="flex justify-end">
                  <VarianceBadge pct={svc.variancePct} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <StepActionFooter
        isActive={isActive}
        isComplete={isComplete}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        canAdvance={true}
        onAdvance={() => onAdvance()}
        advanceLabel={lang === "nl" ? "Vergelijking bevestigen" : "Confirm comparison"}
        lang={lang}
      />
    </div>
  );
}

/* ── Step 3: Control ── */
function ControlPanel({ distribution, lang, isActive, onAdvance }) {
  const step = distribution.steps?.control;
  const excesses = step?.excesses || [];
  const threshold = step?.threshold || 10;
  const isComplete = step?.status === "complete";

  /* Local state for editing notes on exceeded services */
  const [notes, setNotes] = useState(() => {
    const n = {};
    for (const e of excesses) n[e.serviceId] = e.note || "";
    return n;
  });

  const exceededWithoutNotes = excesses.filter(e => e.exceeded && !(notes[e.serviceId] || "").trim());
  const canAdvance = exceededWithoutNotes.length === 0;

  const handleAdvance = () => {
    onAdvance({
      excesses: excesses.map(e => ({
        ...e,
        note: (notes[e.serviceId] !== undefined ? notes[e.serviceId] : e.note) || "",
      })),
    });
  };

  return (
    <div className="space-y-4">
      <StepHeader
        title={lang === "nl" ? "Controle" : "Control"}
        description={lang === "nl"
          ? `Controleer diensten waarvan de kosten meer dan ${threshold}% zijn gestegen ten opzichte van vorig jaar.`
          : `Review services whose costs increased by more than ${threshold}% compared to the previous year.`}
        status={step?.status}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        lang={lang}
      />

      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <Gauge size={14} className="text-slate-400 flex-none" />
        <span className="text-xs text-slate-500">
          {lang === "nl" ? "Drempelwaarde" : "Threshold"}:
          <span className="font-semibold text-slate-700 ml-1">{threshold}%</span>
        </span>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardContent className="py-0">
          {distribution.services.map((svc, idx) => {
            const service = getService(svc.serviceId);
            const name = service?.name?.[lang] || service?.name?.en || svc.serviceId;
            const excess = excesses.find(e => e.serviceId === svc.serviceId);
            const exceeded = excess?.exceeded || false;
            const pct = svc.variancePct;
            const noteVal = notes[svc.serviceId] !== undefined ? notes[svc.serviceId] : (excess?.note || "");
            const needsNote = exceeded && isActive && !isComplete;

            return (
              <div key={svc.serviceId} className={`flex items-start gap-3 py-3 px-3 ${idx < distribution.services.length - 1 ? "border-b border-slate-100" : ""} ${exceeded ? "bg-amber-50/40" : ""}`}>
                <div className="flex-none mt-0.5">
                  {exceeded ? <AlertTriangle size={15} className="text-amber-500" /> : <CheckCircle2 size={15} className="text-green-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-700">{name}</p>
                    <VarianceBadge pct={pct} threshold={threshold} />
                  </div>
                  {exceeded && (
                    needsNote ? (
                      <div className="mt-2">
                        <textarea
                          value={noteVal}
                          onChange={(e) => setNotes(prev => ({ ...prev, [svc.serviceId]: e.target.value }))}
                          placeholder={lang === "nl" ? "Voeg een toelichting toe voor deze overschrijding…" : "Add a note explaining this excess…"}
                          rows={2}
                          className={`w-full text-[11px] text-slate-700 placeholder-slate-400 bg-white border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                            !noteVal.trim() ? "border-amber-200 bg-amber-50/60" : "border-slate-200"
                          }`}
                        />
                        {!noteVal.trim() && (
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            {lang === "nl" ? "Toelichting verplicht" : "Note required to proceed"}
                          </p>
                        )}
                      </div>
                    ) : (excess?.note || noteVal) ? (
                      <p className="text-[11px] text-amber-700 mt-1 bg-amber-50 rounded px-2 py-1 border border-amber-100">
                        {excess?.note || noteVal}
                      </p>
                    ) : null
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtEur(svc.actual)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {excesses.length === 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
          <CheckCircle2 size={14} className="text-green-500 flex-none" />
          <p className="text-xs text-green-700">
            {lang === "nl" ? `Geen diensten overschrijden de ${threshold}% drempelwaarde.` : `No services exceed the ${threshold}% threshold.`}
          </p>
        </div>
      )}

      <StepActionFooter
        isActive={isActive}
        isComplete={isComplete}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        canAdvance={canAdvance}
        onAdvance={handleAdvance}
        advanceLabel={lang === "nl" ? "Controle bevestigen" : "Confirm control"}
        blockReason={!canAdvance && isActive
          ? (lang === "nl"
              ? `${exceededWithoutNotes.length} overschrijding(en) vereist een toelichting`
              : `${exceededWithoutNotes.length} excess(es) require a note`)
          : null}
        lang={lang}
      />
    </div>
  );
}

/* ── Step 4: Check ── */
function CheckPanel({ distribution, lang, isActive, onAdvance }) {
  const step = distribution.steps?.check;
  const outcomes = step?.tenantOutcomes || [];
  const hasTenants = outcomes.length > 0;
  const isComplete = step?.status === "complete";

  const totalRefund  = outcomes.filter(t => t.delta < 0).reduce((s, t) => s + t.delta, 0);
  const totalOwed    = outcomes.filter(t => t.delta > 0).reduce((s, t) => s + t.delta, 0);
  const flaggedTenants = outcomes.filter(t => t.status === "flagged");

  return (
    <div className="space-y-4">
      <StepHeader
        title={lang === "nl" ? "Check" : "Check"}
        description={lang === "nl"
          ? "Controleer per huurder het resultaat van de servicekosten versus het betaalde voorschot."
          : "Review per tenant the outcome of service costs versus the advance payment (voorschot) paid."}
        status={step?.status}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        lang={lang}
      />

      {hasTenants && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <p className="text-[11px] text-slate-400 mb-1">{lang === "nl" ? "Huurders" : "Tenants"}</p>
            <p className="text-lg font-bold text-slate-800">{outcomes.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-center">
            <p className="text-[11px] text-green-600 mb-1">{lang === "nl" ? "Teruggave" : "Refund"}</p>
            <p className="text-lg font-bold text-green-700 tabular-nums">{fmtEur(totalRefund)}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <p className="text-[11px] text-slate-500 mb-1">{lang === "nl" ? "Bijbetaling" : "To collect"}</p>
            <p className="text-lg font-bold text-slate-700 tabular-nums">+{fmtEur(totalOwed)}</p>
          </div>
        </div>
      )}

      {flaggedTenants.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <p className="text-xs font-semibold text-amber-800">
              {flaggedTenants.length} {lang === "nl" ? "huurder(s) met hoog uitstaand bedrag" : "tenant(s) with high outstanding amount"}
            </p>
          </div>
          {flaggedTenants.map((t) => (
            <div key={t.vheId} className="flex items-center justify-between text-xs mt-1">
              <span className="text-amber-700">{t.address}</span>
              <span className="font-semibold text-amber-800 tabular-nums">+{fmtEur(t.delta)}</span>
            </div>
          ))}
        </div>
      )}

      {hasTenants && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="py-0">
            <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="col-span-2">{lang === "nl" ? "Adres" : "Address"}</span>
              <span className="text-right">{lang === "nl" ? "Voorschot" : "Advance"}</span>
              <span className="text-right">{lang === "nl" ? "Resultaat" : "Outcome"}</span>
            </div>
            {outcomes.map((tenant, idx) => {
              const positive = tenant.delta > 0;
              return (
                <div
                  key={tenant.vheId}
                  className={`grid grid-cols-4 gap-2 items-center px-3 py-2.5 ${idx < outcomes.length - 1 ? "border-b border-slate-100" : ""} ${tenant.status === "flagged" ? "bg-amber-50/30" : ""}`}
                >
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    {tenant.status === "flagged" && <Flag size={10} className="text-amber-500 flex-none" />}
                    <span className="text-xs text-slate-700 truncate">{tenant.address}</span>
                  </div>
                  <span className="text-xs text-right text-slate-500 tabular-nums">{fmtEur(tenant.voorschot)}</span>
                  <div className="flex items-center justify-end gap-1">
                    <span className={`text-xs font-semibold tabular-nums ${positive ? "text-slate-700" : "text-green-600"}`}>
                      {positive ? "+" : ""}{fmtEur(tenant.delta)}
                    </span>
                    {positive
                      ? <TrendingUp size={11} className="text-slate-400" />
                      : <TrendingDown size={11} className="text-green-500" />
                    }
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!hasTenants && step?.status !== "complete" && (
        <div className="text-center py-8 text-slate-400">
          <Users size={20} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">{lang === "nl" ? "Huurderuitkomsten worden berekend zodra vorige stappen zijn afgerond." : "Tenant outcomes are calculated once previous steps are completed."}</p>
        </div>
      )}

      <StepActionFooter
        isActive={isActive}
        isComplete={isComplete}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        canAdvance={true}
        onAdvance={() => onAdvance()}
        advanceLabel={
          flaggedTenants.length > 0
            ? (lang === "nl" ? "Bevestigen (gemarkeerde huurders bekeken)" : "Confirm (flagged tenants reviewed)")
            : (lang === "nl" ? "Check bevestigen" : "Confirm check")
        }
        lang={lang}
      />
    </div>
  );
}

/* ── Step 5: Approval ── */
function ApprovalPanel({ distribution, lang, isActive, onAdvance, onRequestApproval }) {
  const step = distribution.steps?.approval;
  const isComplete = step?.status === "complete";
  const isInProgress = step?.status === "in_progress";
  const hasRequest = !!step?.requestedFrom;

  const [selectedUser, setSelectedUser] = useState(MOCK_USERS[0].id);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      <StepHeader
        title={lang === "nl" ? "Goedkeuring" : "Approval"}
        description={lang === "nl"
          ? "Vraag goedkeuring aan een andere gebruiker voordat de verdeling definitief wordt gemaakt."
          : "Request approval from another user before the distribution is finalised."}
        status={step?.status}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        lang={lang}
      />

      <Card className="border-slate-200 bg-white">
        <CardContent className="py-4 space-y-3">

          {/* ─ No request yet: show request form ─ */}
          {!hasRequest && isActive && !isComplete && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {lang === "nl" ? "Goedkeuring aanvragen" : "Request approval"}
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-slate-500 mb-1 block">{lang === "nl" ? "Aan" : "To"}</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {MOCK_USERS.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 mb-1 block">{lang === "nl" ? "Notitie (optioneel)" : "Note (optional)"}</label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={lang === "nl" ? "Voeg een bericht toe voor de goedkeurder…" : "Add a message for the approver…"}
                    rows={2}
                    className="w-full text-xs text-slate-700 placeholder-slate-400 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              <button
                onClick={() => onRequestApproval(selectedUser, note)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Send size={12} />
                {lang === "nl" ? "Verzoek versturen" : "Send request"}
              </button>
            </>
          )}

          {/* ─ Request sent / in progress / complete ─ */}
          {hasRequest && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{lang === "nl" ? "Aangevraagd bij" : "Requested from"}</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                    <Users size={11} className="text-slate-500" />
                  </div>
                  <span className="font-medium text-slate-700">
                    {MOCK_USERS.find(u => u.id === step.requestedFrom)?.name || step.requestedFrom}
                  </span>
                </div>
              </div>
              {step?.requestedAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{lang === "nl" ? "Aangevraagd op" : "Requested on"}</span>
                  <span className="font-medium text-slate-700">{fmtDate(step.requestedAt)}</span>
                </div>
              )}
              {step?.note && (
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 italic">
                  "{step.note}"
                </div>
              )}
              {isInProgress && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
                  <Clock size={12} />
                  {lang === "nl" ? "Wacht op goedkeuring…" : "Waiting for approval…"}
                </div>
              )}
              {step?.approvedBy && (
                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                  <span className="text-slate-400">{lang === "nl" ? "Goedgekeurd door" : "Approved by"}</span>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={13} className="text-green-500" />
                    <span className="font-medium text-slate-700">
                      {MOCK_USERS.find(u => u.id === step.approvedBy)?.name || step.approvedBy}
                    </span>
                    <span className="text-slate-400">{fmtDate(step.approvedAt)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─ No request, not active: empty state ─ */}
          {!hasRequest && !isActive && !isComplete && (
            <div className="text-center py-4">
              <Users size={20} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-400">
                {lang === "nl" ? "Nog geen goedkeuringsverzoek verstuurd." : "No approval request sent yet."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* In-progress → show "Simulate approval" */}
      {isInProgress && isActive ? (
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock size={12} />
            {lang === "nl" ? "Wacht op goedkeuring van " : "Awaiting approval from "}
            <span className="font-medium text-slate-600">
              {MOCK_USERS.find(u => u.id === step?.requestedFrom)?.name || step?.requestedFrom}
            </span>
          </span>
          <button
            onClick={() => onAdvance({ approvedBy: step?.requestedFrom, approvedAt: today() })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors"
          >
            <ShieldCheck size={13} />
            {lang === "nl" ? "Goedkeuring simuleren ✓" : "Simulate approval ✓"}
          </button>
        </div>
      ) : (
        <StepActionFooter
          isActive={isActive && !isInProgress}
          isComplete={isComplete}
          completedAt={step?.completedAt}
          completedBy={step?.completedBy}
          canAdvance={false}
          onAdvance={() => {}}
          advanceLabel={lang === "nl" ? "Stuur eerst een verzoek" : "Send a request first"}
          lang={lang}
        />
      )}
    </div>
  );
}

/* ── Step 6: Distribution ── */
function DistributionPanel({ distribution, lang, isActive, onAdvance }) {
  const step = distribution.steps?.distribution;
  const isComplete = step?.status === "complete";
  const [confirming, setConfirming] = useState(false);

  const handleConfirmERP = () => {
    const year = new Date().getFullYear();
    const ref = `ERP-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    onAdvance({ sentToErp: true, erpReference: ref });
    setConfirming(false);
  };

  return (
    <div className="space-y-4">
      <StepHeader
        title={lang === "nl" ? "Verdeling" : "Distribution"}
        description={lang === "nl"
          ? "Definitieve verdeling — finaliseer en stuur de afrekening terug naar het ERP-systeem."
          : "Final distribution — finalise and send the billing back to the ERP system."}
        status={step?.status}
        completedAt={step?.completedAt}
        completedBy={step?.completedBy}
        lang={lang}
      />

      {/* Summary totals */}
      {distribution.totals?.totalCost != null && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="py-4 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
              {lang === "nl" ? "Samenvatting" : "Summary"}
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{lang === "nl" ? "Totale kosten" : "Total costs"}</span>
              <span className="font-semibold text-slate-800 tabular-nums">{fmtEur(distribution.totals.totalCost)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{lang === "nl" ? "Totaal voorschot" : "Total advance"}</span>
              <span className="font-medium text-slate-600 tabular-nums">{fmtEur(distribution.totals.totalVoorschot)}</span>
            </div>
            {distribution.totals?.netResult != null && (
              <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2.5">
                <span className="font-semibold text-slate-600">{lang === "nl" ? "Nettoresultaat" : "Net result"}</span>
                <span className={`font-bold tabular-nums text-sm ${distribution.totals.netResult >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {distribution.totals.netResult >= 0 ? "+" : ""}{fmtEur(distribution.totals.netResult, 2)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Services breakdown */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="py-0">
          <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="col-span-2">{lang === "nl" ? "Dienst" : "Service"}</span>
            <span className="text-right">{lang === "nl" ? "Werkelijk" : "Actual"}</span>
            <span className="text-right">{lang === "nl" ? "Methode" : "Method"}</span>
          </div>
          {distribution.services.map((svc, idx) => {
            const service = getService(svc.serviceId);
            const name = service?.name?.[lang] || service?.name?.en || svc.serviceId;
            return (
              <div key={svc.serviceId} className={`grid grid-cols-4 gap-2 items-center px-3 py-2.5 ${idx < distribution.services.length - 1 ? "border-b border-slate-100" : ""}`}>
                <div className="col-span-2 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
                </div>
                <span className="text-xs text-right font-medium text-slate-700 tabular-nums">{fmtEur(svc.actual)}</span>
                <span className="text-xs text-right text-slate-500 capitalize">{svc.distributionMethod}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ERP export status (completed state) */}
      {isComplete && (
        <Card className="border-green-100 bg-green-50">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} className="text-green-600" />
              <p className="text-xs font-semibold text-green-800">{lang === "nl" ? "Verzonden naar ERP" : "Sent to ERP"}</p>
            </div>
            {step?.erpReference && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-700">{lang === "nl" ? "Referentie" : "Reference"}</span>
                <span className="font-mono font-bold text-green-900">{step.erpReference}</span>
              </div>
            )}
            {step?.completedAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-700">{lang === "nl" ? "Datum" : "Date"}</span>
                <span className="font-medium text-green-900">{fmtDate(step.completedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inline confirmation card */}
      {confirming && isActive && !isComplete && (
        <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50 space-y-3">
          <div className="flex items-start gap-3">
            <Send size={16} className="text-blue-600 flex-none mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-900">
                {lang === "nl" ? "Definitieve verdeling bevestigen?" : "Confirm final distribution?"}
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                {lang === "nl"
                  ? `Periode ${distribution.period} wordt afgerekend en verzonden naar het ERP-systeem. Dit kan niet ongedaan worden gemaakt.`
                  : `Period ${distribution.period} will be finalised and sent to the ERP system. This cannot be undone.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleConfirmERP}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
            >
              <CheckCircle2 size={13} />
              {lang === "nl" ? "Ja, verstuur naar ERP" : "Yes, send to ERP"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {lang === "nl" ? "Annuleren" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {!confirming && (
        <StepActionFooter
          isActive={isActive}
          isComplete={isComplete}
          completedAt={step?.completedAt}
          completedBy={step?.completedBy}
          canAdvance={true}
          onAdvance={() => setConfirming(true)}
          advanceLabel={lang === "nl" ? "Verstuur naar ERP" : "Send to ERP"}
          lang={lang}
        />
      )}
    </div>
  );
}

/* ── Shared step header ── */
function StepHeader({ title, description, status, completedAt, completedBy, lang }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5 max-w-lg">{description}</p>
      </div>
      <div className="flex-none">
        <StepStatusBadge status={status || "pending"} lang={lang} />
        {completedAt && (
          <p className="text-[10px] text-slate-400 mt-1 text-right">{fmtDate(completedAt)}</p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function DistributionDetailPage() {
  const { distributionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId } = useOrg();
  const lang = useLang();

  // Prefer distribution passed via navigation state (newly created runtime dists)
  // so they work even before addRuntimeDistribution has had time to propagate.
  const sourceDist = location.state?.distribution || getDistributionById(distributionId);
  const building = sourceDist ? getBuilding(sourceDist.buildingId) : null;

  /* ── Local mutable copy of distribution (prototype state) ── */
  const [localDist, setLocalDist] = useState(() =>
    sourceDist ? deepCopy(sourceDist) : null
  );

  const defaultStep = sourceDist?.currentStep === "complete"
    ? "distribution"
    : (sourceDist?.currentStep || "validation");
  const [activeStep, setActiveStep] = useState(defaultStep);

  if (!localDist) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p className="text-sm">{lang === "nl" ? "Verdeling niet gevonden" : "Distribution not found"}</p>
      </div>
    );
  }

  const isComplete = localDist.currentStep === "complete";
  const currentStepIdx = isComplete ? 6 : STEP_ORDER.indexOf(localDist.currentStep);
  const flaggedCount = localDist.services.filter(s => s.status === "flagged").length;

  /* ── Advance a step to complete, mutate local state, auto-navigate ── */
  const advanceStep = (stepName, patches = {}) => {
    const stepIdx = STEP_ORDER.indexOf(stepName);
    const nextStep = stepIdx < STEP_ORDER.length - 1 ? STEP_ORDER[stepIdx + 1] : "complete";
    setLocalDist(prev => ({
      ...prev,
      currentStep: nextStep,
      steps: {
        ...prev.steps,
        [stepName]: {
          ...prev.steps[stepName],
          status: "complete",
          completedAt: today(),
          completedBy: "user-arnon",
          ...patches,
        },
      },
    }));
    setActiveStep(nextStep === "complete" ? "distribution" : nextStep);
  };

  /* ── Set approval step to in_progress (request sent, not yet approved) ── */
  const requestApproval = (requestedFrom, note) => {
    setLocalDist(prev => ({
      ...prev,
      steps: {
        ...prev.steps,
        approval: {
          ...prev.steps.approval,
          status: "in_progress",
          requestedFrom,
          requestedAt: today(),
          note: note || null,
        },
      },
    }));
  };

  const isStepActive = (step) => !isComplete && localDist.currentStep === step;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-none px-6 pt-5 pb-4 border-b border-slate-200 bg-white">
        <Breadcrumbs
          items={[
            { label: lang === "nl" ? "Verdeling" : "Distribution", href: `/${orgId}/distribution` },
            { label: `${building?.complex || localDist.buildingId} · ${localDist.period}` },
          ]}
        />
        <div className="flex items-start justify-between mt-3 gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{building?.complex || localDist.buildingId}</h1>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarDays size={12} className="text-slate-400" />
                {localDist.period}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Building2 size={12} className="text-slate-400" />
                {building?.location}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                {localDist.services.length} {lang === "nl" ? "diensten" : "services"}
              </div>
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  <Flag size={9} />
                  {flaggedCount} {lang === "nl" ? "aandacht" : "flagged"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            {isComplete ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-xs font-semibold text-green-700">
                <CheckCircle2 size={13} />
                {lang === "nl" ? "Afgerond" : "Complete"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700">
                <Clock size={13} />
                {lang === "nl" ? "Stap" : "Step"} {currentStepIdx + 1}/6
              </span>
            )}
            <button
              onClick={() => navigate(`/${orgId}/buildings/${localDist.buildingId}`)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: left nav + right panel ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: step navigator */}
        <div className="w-52 flex-none border-r border-slate-200 bg-slate-50 px-3 py-4 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 mb-3">
            {lang === "nl" ? "Stappen" : "Steps"}
          </p>
          <StepNavigator
            distribution={localDist}
            activeStep={activeStep}
            onSelectStep={setActiveStep}
            lang={lang}
          />

          {localDist.totals?.totalCost != null && (
            <div className="mt-4 pt-4 border-t border-slate-200 px-3 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">{lang === "nl" ? "Totaal" : "Total"}</span>
                <span className="font-semibold text-slate-700 tabular-nums">{fmtEur(localDist.totals.totalCost)}</span>
              </div>
              {localDist.totals.netResult != null && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{lang === "nl" ? "Resultaat" : "Result"}</span>
                  <span className={`font-bold tabular-nums ${localDist.totals.netResult >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {localDist.totals.netResult >= 0 ? "+" : ""}{fmtEur(localDist.totals.netResult)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: active step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeStep === "validation" && (
            <ValidationPanel
              distribution={localDist}
              lang={lang}
              isActive={isStepActive("validation")}
              onAdvance={(patches) => advanceStep("validation", patches)}
            />
          )}
          {activeStep === "comparison" && (
            <ComparisonPanel
              distribution={localDist}
              lang={lang}
              isActive={isStepActive("comparison")}
              onAdvance={(patches) => advanceStep("comparison", patches)}
            />
          )}
          {activeStep === "control" && (
            <ControlPanel
              distribution={localDist}
              lang={lang}
              isActive={isStepActive("control")}
              onAdvance={(patches) => advanceStep("control", patches)}
            />
          )}
          {activeStep === "check" && (
            <CheckPanel
              distribution={localDist}
              lang={lang}
              isActive={isStepActive("check")}
              onAdvance={(patches) => advanceStep("check", patches)}
            />
          )}
          {activeStep === "approval" && (
            <ApprovalPanel
              distribution={localDist}
              lang={lang}
              isActive={isStepActive("approval")}
              onAdvance={(patches) => advanceStep("approval", patches)}
              onRequestApproval={requestApproval}
            />
          )}
          {activeStep === "distribution" && (
            <DistributionPanel
              distribution={localDist}
              lang={lang}
              isActive={isStepActive("distribution")}
              onAdvance={(patches) => advanceStep("distribution", patches)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
