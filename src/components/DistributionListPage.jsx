import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Building2,
  CalendarDays,
  Flag,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { getDistributions, getBuilding, getService } from "@/lib/mockData";
import { useOrg } from "@/lib/OrgContext";
import { useLang } from "@/lib/i18n";
import { STEP_ORDER, STEP_CONFIG, getStepIndex, getFlaggedServiceCount } from "@/lib/data/distributions";
import Breadcrumbs from "./Breadcrumbs";

/* ── Step status badge ── */
const stepStatusColor = {
  complete:    { bg: "#F0FDF4", color: "#16A34A" },
  in_progress: { bg: "#EFF6FF", color: "#2563EB" },
  pending:     { bg: "#F8FAFC", color: "#94A3B8" },
  flagged:     { bg: "#FEF2F2", color: "#DC2626" },
};

function StepPill({ stepKey, status, lang }) {
  const cfg = STEP_CONFIG[stepKey];
  const colors = stepStatusColor[status] || stepStatusColor.pending;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: colors.bg, color: colors.color }}
    >
      {cfg?.label?.[lang] || cfg?.label?.en || stepKey}
    </span>
  );
}

/* ── Workflow progress bar ── */
function WorkflowBar({ distribution }) {
  const stepIdx = getStepIndex(distribution);
  const isComplete = distribution.currentStep === "complete";

  return (
    <div className="flex items-center gap-0.5">
      {STEP_ORDER.map((step, i) => {
        const done = isComplete || i < stepIdx;
        const active = !isComplete && i === stepIdx;
        const stepStatus = distribution.steps?.[step]?.status;
        const isFlagged = stepStatus === "in_progress" && getFlaggedServiceCount(distribution) > 0 && active;

        return (
          <div
            key={step}
            className="h-1.5 rounded-full flex-1"
            style={{
              background: done
                ? brand.teal || "#3EB1C8"
                : active
                ? isFlagged ? "#F59E0B" : "#93C5FD"
                : "#E2E8F0",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Current step label ── */
function CurrentStepLabel({ distribution, lang }) {
  if (distribution.currentStep === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
        <CheckCircle2 size={12} />
        {lang === "nl" ? "Afgerond" : "Complete"}
      </span>
    );
  }
  const stepCfg = STEP_CONFIG[distribution.currentStep];
  const flagged = getFlaggedServiceCount(distribution);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
      <Clock size={12} />
      {stepCfg?.label?.[lang] || distribution.currentStep}
      {flagged > 0 && (
        <span className="inline-flex items-center gap-0.5 ml-1 text-amber-600">
          <Flag size={10} />
          {flagged}
        </span>
      )}
    </span>
  );
}

export default function DistributionListPage() {
  const navigate = useNavigate();
  const { orgId } = useOrg();
  const lang = useLang();

  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const allDistributions = getDistributions();

  // Derive available periods
  const periods = useMemo(() => {
    const ps = [...new Set(allDistributions.map((d) => d.period))].sort((a, b) => b - a);
    return ps;
  }, [allDistributions]);

  // Filter
  const filtered = useMemo(() => {
    return allDistributions.filter((d) => {
      if (filterPeriod !== "all" && d.period !== Number(filterPeriod)) return false;
      if (filterStatus === "complete" && d.currentStep !== "complete") return false;
      if (filterStatus === "in_progress" && d.currentStep === "complete") return false;
      if (filterStatus === "flagged" && getFlaggedServiceCount(d) === 0) return false;
      return true;
    });
  }, [allDistributions, filterPeriod, filterStatus]);

  // Sort: in-progress first, then by period desc
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aComplete = a.currentStep === "complete";
      const bComplete = b.currentStep === "complete";
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return b.period - a.period;
    });
  }, [filtered]);

  const inProgressCount = allDistributions.filter((d) => d.currentStep !== "complete").length;
  const flaggedCount = allDistributions.filter((d) => getFlaggedServiceCount(d) > 0).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-5 pb-4 border-b border-slate-200 bg-white">
        <Breadcrumbs items={[{ label: lang === "nl" ? "Verdeling" : "Distribution" }]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {lang === "nl" ? "Verdeling" : "Distribution"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === "nl"
                ? "Jaarlijkse afrekening van servicekosten per gebouw"
                : "Annual billing cycle for service costs per building"}
            </p>
          </div>
          {/* Summary pills */}
          <div className="hidden sm:flex items-center gap-3">
            {inProgressCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
                <Clock size={13} className="text-blue-500" />
                <span className="text-xs font-medium text-blue-700">{inProgressCount} {lang === "nl" ? "in uitvoering" : "in progress"}</span>
              </div>
            )}
            {flaggedCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                <AlertTriangle size={13} className="text-amber-500" />
                <span className="text-xs font-medium text-amber-700">{flaggedCount} {lang === "nl" ? "aandachtspunten" : "flagged"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none px-6 py-3 border-b border-slate-100 bg-white flex items-center gap-3 flex-wrap">
        {/* Period filter */}
        <div className="flex items-center gap-1.5">
          <CalendarDays size={13} className="text-slate-400" />
          <span className="text-xs text-slate-400">{lang === "nl" ? "Periode" : "Period"}:</span>
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
            <button
              onClick={() => setFilterPeriod("all")}
              className={`px-2.5 h-6 rounded-md text-xs font-medium transition-colors ${filterPeriod === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {lang === "nl" ? "Alle" : "All"}
            </button>
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setFilterPeriod(String(p))}
                className={`px-2.5 h-6 rounded-md text-xs font-medium transition-colors ${filterPeriod === String(p) ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
          {[
            { value: "all",         label: { en: "All",         nl: "Alle" } },
            { value: "in_progress", label: { en: "In progress", nl: "In uitvoering" } },
            { value: "flagged",     label: { en: "Flagged",     nl: "Aandacht" } },
            { value: "complete",    label: { en: "Complete",    nl: "Afgerond" } },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-2.5 h-6 rounded-md text-xs font-medium transition-colors ${filterStatus === opt.value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {opt.label[lang] || opt.label.en}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 ml-auto">
          {sorted.length} {lang === "nl" ? "verdelingen" : "distributions"}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-2">
          {sorted.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Send size={24} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">{lang === "nl" ? "Geen verdelingen gevonden" : "No distributions found"}</p>
            </div>
          )}
          {sorted.map((dist) => {
            const building = getBuilding(dist.buildingId);
            const isComplete = dist.currentStep === "complete";
            const flagged = getFlaggedServiceCount(dist);
            const stepIdx = getStepIndex(dist);
            const completedSteps = isComplete ? 6 : stepIdx;

            return (
              <div
                key={dist.id}
                onClick={() => navigate(`/${orgId}/distribution/${dist.id}`)}
                className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Left: icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-none mt-0.5"
                    style={{ background: isComplete ? "#F0FDF4" : flagged > 0 ? "#FFFBEB" : "#EFF6FF" }}
                  >
                    {isComplete ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : flagged > 0 ? (
                      <AlertTriangle size={16} className="text-amber-500" />
                    ) : (
                      <Clock size={16} className="text-blue-500" />
                    )}
                  </div>

                  {/* Middle: content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {building?.complex || dist.buildingId}
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs font-medium text-slate-500">{dist.period}</span>
                      {flagged > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                          <Flag size={9} />
                          {flagged} {lang === "nl" ? "aandacht" : "flagged"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mb-3">
                      <Building2 size={11} className="text-slate-300 flex-none" />
                      <span className="text-[11px] text-slate-400">{building?.location}</span>
                      <span className="text-slate-300 text-[11px]">·</span>
                      <span className="text-[11px] text-slate-400">{dist.services.length} {lang === "nl" ? "diensten" : "services"}</span>
                    </div>

                    {/* Workflow progress */}
                    <WorkflowBar distribution={dist} />

                    <div className="flex items-center justify-between mt-1.5">
                      <CurrentStepLabel distribution={dist} lang={lang} />
                      <span className="text-[10px] text-slate-300 tabular-nums">
                        {completedSteps}/6 {lang === "nl" ? "stappen" : "steps"}
                      </span>
                    </div>
                  </div>

                  {/* Right: totals + chevron */}
                  <div className="flex-none text-right hidden sm:block">
                    {dist.totals?.totalCost != null && (
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">
                        {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(dist.totals.totalCost)}
                      </p>
                    )}
                    {dist.totals?.netResult != null && (
                      <p className={`text-[11px] tabular-nums ${dist.totals.netResult >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {dist.totals.netResult >= 0 ? "+" : ""}
                        {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(dist.totals.netResult)}
                      </p>
                    )}
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors mt-2 ml-auto" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
