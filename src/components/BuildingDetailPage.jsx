import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Hash,
  Home,
  Wrench,
  Gauge,
  Activity,
  Flame,
  Droplets,
  Zap,
  Sparkles,
  HardHat,
  FolderOpen,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  HelpCircle,
  Send,
  Flag,
  LayoutList,
  CreditCard,
  Search,
  ArrowUpDown,
  Link2,
  Radio,
  StickyNote,
  Plus,
  CalendarDays,
  CircleDot,
  ListChecks,
} from "lucide-react";
import { brand } from "@/lib/brand";
import {
  getBuilding,
  getService,
  getBuildingServices,
  getVhesByBuilding,
  getMetersByBuilding,
  getActivitiesByBuilding,
  getDistributionMethod,
  getServiceCategories,
  getLedgerSummaryByBuilding,
  getLedgerGroupedByCostCategory,
  getMeters,
  getVhe,
  getCostCategoriesByService,
  getDistributionModel,
  isFeatureEnabled,
  getFieldSource,
  getDistributionModelsByBuilding,
  getTasksByBuilding,
  getNotesByBuilding,
  getActiveDistribution,
  getDistributionsByBuilding,
  addRuntimeDistribution,
  buildDistributionFromData,
} from "@/lib/mockData";
import { STEP_CONFIG, STEP_ORDER, getStepIndex, getFlaggedServiceCount } from "@/lib/data/distributions";
import { useOrg } from "@/lib/OrgContext";
import { t, useLang } from "@/lib/i18n";
import Breadcrumbs from "./Breadcrumbs";
import { Card, CardContent } from "./ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  AttributePanel,
  AttrSection,
  AttrRow,
  AttrBadge,
} from "./ui/attribute-panel";
import { StatusBadge } from "./ui/status-badge";

/* ── Category icon + color config (all neutral — differentiate by icon shape + label) ── */
const categoryConfig = {
  energy:        { icon: Zap,        color: "#64748B", bg: "#F8FAFC" },
  installations: { icon: Wrench,     color: "#64748B", bg: "#F8FAFC" },
  cleaning:      { icon: Sparkles,   color: "#64748B", bg: "#F8FAFC" },
  management:    { icon: HardHat,    color: "#64748B", bg: "#F8FAFC" },
  other:         { icon: FolderOpen, color: "#64748B", bg: "#F8FAFC" },
};

/* ── Ledger formatters ── */
const fmtEur2 = (v) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const fmtDate = (d) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
};

const fmt = (v) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

/* ── Ledger status config ── */
const ledgerStatusCfg = {
  booked:  { color: "#64748B", bg: "#F8FAFC", label: { en: "Booked", nl: "Geboekt" }, icon: CheckCircle2 },
  pending: { color: "#F59E0B", bg: "#F8FAFC", label: { en: "Pending", nl: "In afwachting" }, icon: Clock },
  flagged: { color: "#EF4444", bg: "#F8FAFC", label: { en: "Flagged", nl: "Gemarkeerd" }, icon: AlertTriangle },
};

function LedgerStatusBadge({ status, lang }) {
  const cfg = ledgerStatusCfg[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon size={14} />
      {cfg.label[lang]}
    </span>
  );
}

/* ── Utility icon — tinted per utility type ── */
const utilityIcon = {
  heat: { icon: Flame, color: "#EF4444", bg: "#FEE2E2" },
  water: { icon: Droplets, color: "#3B82F6", bg: "#DBEAFE" },
  electricity: { icon: Zap, color: "#F59E0B", bg: "#FEF3C7" },
  gas: { icon: Flame, color: "#F97316", bg: "#FFF7ED" },
  "water-hot": { icon: Droplets, color: "#EC4899", bg: "#FCE7F3" },
};

/* ── Activity icon ── */
const activityIcons = {
  meter_reading: { icon: Gauge, color: brand.blue },
  ledger_entry: { icon: FileText, color: brand.blue },
  distribution: { icon: Activity, color: brand.amber },
  contract_change: { icon: Users, color: brand.blue },
  alert: { icon: AlertTriangle, color: brand.red },
};






/* ══════════════════════════════════════════════════════════════ */
/* ██  MAIN COMPONENT                                          ██ */
/* ══════════════════════════════════════════════════════════════ */

export default function BuildingDetailPage() {
  const { buildingId } = useParams();
  const navigate = useNavigate();
  const lang = useLang();
  const { data, orgId } = useOrg();
  const year = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedVhe, setExpandedVhe] = useState(null);
  const [expandedService, setExpandedService] = useState(null);
  // VHE tab state
  const [vheSortField, setVheSortField] = useState("unit");
  const [vheSortDir, setVheSortDir] = useState("asc");
  const [vheContractFilter, setVheContractFilter] = useState("all"); // all | active | ended | vacant
  const [vheSearch, setVheSearch] = useState("");
  const [expandedCostCats, setExpandedCostCats] = useState({});  // { [ccId]: true }
  const toggleCostCat = (ccId) => setExpandedCostCats((prev) => ({ ...prev, [ccId]: !prev[ccId] }));
  const [showDismounted, setShowDismounted] = useState(false);

  // Distribution process objects for this building
  const activeDistribution = useMemo(() => getActiveDistribution(buildingId), [buildingId]);
  const buildingDistributions = useMemo(() => getDistributionsByBuilding(buildingId), [buildingId]);

  // "New distribution" popover state
  const [showDistPopover, setShowDistPopover] = useState(false);
  const currentYear = new Date().getFullYear();
  const eligiblePeriods = useMemo(() => {
    const existing = new Set(buildingDistributions.map((d) => d.period));
    return [currentYear - 1, currentYear - 2, currentYear - 3].filter((y) => !existing.has(y));
  }, [buildingDistributions, currentYear]);
  const [newDistPeriod, setNewDistPeriod] = useState(null);
  const hasActiveDistribution = activeDistribution && activeDistribution.currentStep !== "complete";
  const canStartNewDistribution = !hasActiveDistribution && eligiblePeriods.length > 0 && isFeatureEnabled("ledger");

  function handleCreateDistribution() {
    const period = newDistPeriod ?? eligiblePeriods[0];
    if (!period) return;
    const dist = buildDistributionFromData(buildingId, period);
    addRuntimeDistribution(dist);
    setShowDistPopover(false);
    navigate(`/distribution/${dist.id}`, { state: { distribution: dist } });
  }

  const building = getBuilding(buildingId);

  // Related data
  const bsRelations = useMemo(
    () => getBuildingServices(buildingId, year),
    [buildingId, year]
  );
  const vheList = useMemo(() => getVhesByBuilding(buildingId), [buildingId]);
  const allMeters = useMemo(
    () =>
      getMetersByBuilding(buildingId).map((m) => {
        const r = m.readings?.[year];
        return {
          ...m,
          lastReading: r?.end ?? 0,
          previousReading: r?.start ?? 0,
          consumption: r?.consumption ?? 0,
          readingDate: r?.readingDate ?? "—",
        };
      }),
    [buildingId, year]
  );
  const meterList = useMemo(
    () => showDismounted ? allMeters : allMeters.filter(m => !m.dismounted),
    [allMeters, showDismounted]
  );
  const dismountedCount = useMemo(
    () => allMeters.filter(m => m.dismounted).length,
    [allMeters]
  );
  // ── Right panel computed values ──────────────────────────────
  const activeContracts = useMemo(
    () => vheList.filter((v) => v.contract?.status === "active").length,
    [vheList]
  );
  const avgAdvance = useMemo(() => {
    const withAdvance = vheList.filter((v) => v.voorschot > 0);
    return withAdvance.length > 0
      ? withAdvance.reduce((s, v) => s + v.voorschot, 0) / withAdvance.length
      : 0;
  }, [vheList]);
  const totalResidentialM2 = useMemo(
    () => vheList.reduce((s, v) => s + (v.m2 || 0), 0),
    [vheList]
  );
  const primaryAddress = useMemo(() => {
    if (vheList.length > 0 && vheList[0].address) return vheList[0].address;
    return building.complex;
  }, [vheList, building]);

  const activityList = useMemo(
    () => getActivitiesByBuilding(buildingId),
    [buildingId]
  );
  const buildingTasks = useMemo(
    () => getTasksByBuilding(buildingId),
    [buildingId]
  );
  const buildingNotes = useMemo(
    () => getNotesByBuilding(buildingId),
    [buildingId]
  );
  const ledgerByService = useMemo(
    () => getLedgerSummaryByBuilding(buildingId, year),
    [buildingId, year]
  );
  // Derived KPIs
  const avgCompleteness =
    bsRelations.length > 0
      ? Math.round(
          bsRelations.reduce((s, bs) => s + bs.completeness, 0) /
            bsRelations.length
        )
      : 0;
  const completeCount = bsRelations.filter(
    (bs) => bs.status === "complete"
  ).length;
  const activeVhe = vheList.filter((v) => v.status === "active").length;
  const vacantVhe = vheList.filter((v) => v.status === "vacant").length;
  const mainMeters = meterList.filter((m) => m.type === "main");
  const subMeters = meterList.filter((m) => m.type === "sub");

  // Kostenverdeler map: serviceId (e.g. "SVC-108") → [{id, name, shortName}]
  const kostenverdelerMap = useMemo(() => {
    const map = {};
    (data.suppliers || []).forEach((s) => {
      if (s.kostenverdeler && s.serviceIds) {
        const shortName = s.name
          .replace(/\s+(BV|B\.V\.|NV|N\.V\.)$/i, "")
          .replace(/\s+Energy Services$/i, "");
        s.serviceIds.forEach((sid) => {
          if (!map[sid]) map[sid] = [];
          map[sid].push({ id: s.id, name: s.name, shortName });
        });
      }
    });
    return map;
  }, [data.suppliers]);

  if (!building)
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        {t("noResults", lang)}
      </div>
    );

  const crumbs = [
    { label: t("buildings", lang), to: `/${orgId}/buildings` },
    { label: building.complex },
  ];

  // Enrich services with names
  const enrichedBs = bsRelations.map((bs) => {
    const svc = getService(bs.serviceId);
    const dm = getDistributionMethod(bs.distributionMethod);
    return { ...bs, service: svc, distMethod: dm };
  });

  // Calculate year KPIs for monitoring cockpit
  const totalBudget = enrichedBs.reduce((s, bs) => s + bs.budget, 0);
  const totalActual = enrichedBs.reduce((s, bs) => s + bs.actual, 0);
  const variance = totalBudget - totalActual;

  // Budget progress tracking
  const now = new Date();
  const thisYear = now.getFullYear();
  const currentMonth = year < thisYear ? 12 : year === thisYear ? now.getMonth() : 0;

  const flaggedCount = enrichedBs.reduce((s, bs) => {
    const ledger = ledgerByService[bs.serviceId];
    return s + (ledger?.flagged || 0);
  }, 0);

  // Per-service budget status
  const budgetPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const yearPct = Math.round((currentMonth / 12) * 100);
  const isOnPace = budgetPct <= yearPct + 10;

  const servicesUnderBudget = enrichedBs.filter((bs) => {
    const pct = bs.budget > 0 ? (bs.actual / bs.budget) * 100 : 0;
    return pct <= yearPct + 10;
  }).length;
  const servicesOverBudget = enrichedBs.filter((bs) => {
    const pct = bs.budget > 0 ? (bs.actual / bs.budget) * 100 : 0;
    return pct > yearPct + 10;
  }).length;

  // Overall building health verdict (budget-based)
  const verdictStatus = servicesOverBudget > 2 || flaggedCount > 2
    ? "attention"
    : servicesOverBudget > 0 || flaggedCount > 0
      ? "review"
      : "on_track";

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
      {/* ── Sticky header zone ── */}
      <div className="shrink-0 max-w-[1400px] w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <Breadcrumbs items={crumbs} />

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: brand.navy + "10" }}
            >
              <Building2 size={20} style={{ color: brand.navy }} />
            </div>
            <div className="min-w-0 flex items-center gap-3 flex-wrap">
              <h1
                className="text-xl font-semibold truncate"
                style={{ color: brand.navy }}
              >
                {building.complex}
              </h1>
              <StatusBadge status={building.dataQuality} size="xs" />
            </div>
          </div>

          {/* ── Header action zone (Attio-style: workflow commands live here) ── */}
          <div className="relative flex-shrink-0 flex items-center">
            {hasActiveDistribution ? (
              /* Distribution in progress → chip linking to detail page */
              <button
                onClick={() => navigate(`/distribution/${activeDistribution.id}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:shadow-sm"
                style={{
                  borderColor: brand.teal + "40",
                  background: brand.teal + "08",
                  color: brand.teal,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: brand.teal }}
                />
                {lang === "nl" ? "Verdeling loopt" : "Distribution in progress"}
                <ChevronRight size={12} />
              </button>
            ) : canStartNewDistribution ? (
              /* No active distribution → "New distribution" button + popover */
              <>
                <button
                  onClick={() => setShowDistPopover((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:shadow-sm border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                >
                  <Plus size={13} />
                  {lang === "nl" ? "Nieuwe verdeling" : "New distribution"}
                  <ChevronDown size={12} className={`transition-transform ${showDistPopover ? "rotate-180" : ""}`} />
                </button>

                {/* Popover */}
                {showDistPopover && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-slate-200 bg-white shadow-lg z-30 overflow-hidden"
                    style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.10)" }}
                  >
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        {lang === "nl" ? "Selecteer jaar" : "Select period"}
                      </p>
                    </div>
                    <div className="py-1">
                      {eligiblePeriods.map((yr) => (
                        <button
                          key={yr}
                          onClick={() => setNewDistPeriod(yr)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                          style={{
                            color: (newDistPeriod ?? eligiblePeriods[0]) === yr ? brand.navy : "#374151",
                            fontWeight: (newDistPeriod ?? eligiblePeriods[0]) === yr ? 600 : 400,
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <CalendarDays size={13} className="text-slate-400" />
                            {yr}
                          </span>
                          {(newDistPeriod ?? eligiblePeriods[0]) === yr && (
                            <CheckCircle2 size={13} style={{ color: brand.teal }} />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="px-3 py-2.5 border-t border-slate-100">
                      <button
                        onClick={handleCreateDistribution}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                        style={{ background: brand.navy }}
                      >
                        {lang === "nl" ? "Start verdeling" : "Start distribution"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>


      </div>{/* end sticky header zone */}

      {/* ── Scrollable content: left tab content + right attribute panel ── */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[1100px] px-4 sm:px-6 pb-6">

          {/* ── Tab bar (Attio-style: icon + label + count badge) ── */}
          <TabsList className="bg-transparent h-10 gap-1 p-0 border-b border-slate-200 w-full justify-start rounded-none overflow-x-auto mb-0">
            {[
              { value: "overview", label: t("overview", lang), icon: LayoutList },
              isFeatureEnabled("consumptionControl") && {
                value: "consumption",
                label: lang === "nl" ? "Verbruik" : "Consumption",
                icon: Flame,
              },
              {
                value: "services",
                label: t("services", lang),
                icon: Wrench,
                count: bsRelations.length,
              },
              isFeatureEnabled("ledger") && {
                value: "distributions",
                label: lang === "nl" ? "Verdelingen" : "Distributions",
                icon: Send,
                count: buildingDistributions.length || undefined,
              },
              isFeatureEnabled("consumption") && {
                value: "meters",
                label: t("meters", lang),
                icon: Gauge,
                count: meterList.length,
              },
              {
                value: "vhe",
                label: "VHE",
                icon: Home,
                count: vheList.length,
              },
              { value: "activity", label: t("activity", lang), icon: Activity },
            ].filter(Boolean).map((tab) => {
              const TabIcon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none px-4 h-10 text-sm text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap flex items-center gap-2"
                >
                  <TabIcon size={14} strokeWidth={1.5} />
                  {tab.label}
                  {tab.count != null && (
                    <span className="min-w-[20px] h-5 px-1 rounded bg-slate-100 text-[11px] text-slate-500 font-medium tabular-nums inline-flex items-center justify-center">{tab.count}</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

              {/* ═══ OVERVIEW TAB — BUILDING HOME PAGE ═══ */}
              <TabsContent value="overview">
                {(() => {
                  /* ── Compute warnings (system-generated attention items) ── */
                  const warnings = [];

                  // Budget pace warnings
                  enrichedBs.forEach((bs) => {
                    const bsPct = bs.budget > 0 ? (bs.actual / bs.budget) * 100 : 0;
                    if (bsPct > yearPct + 10) {
                      const overBy = Math.round(bsPct - yearPct);
                      warnings.push({
                        id: `budget-${bs.serviceId}`,
                        severity: bsPct > 100 ? "error" : "warning",
                        icon: AlertTriangle,
                        text: {
                          en: `${bs.service?.name.en || bs.serviceId} is ${overBy}pp ahead of budget pace`,
                          nl: `${bs.service?.name.nl || bs.serviceId} loopt ${overBy}pp voor op budgettempo`,
                        },
                        action: () => { setActiveTab("services"); setExpandedService(bs.serviceId); },
                      });
                    }
                  });

                  // Flagged ledger entries
                  const totalFlaggedEntries = Object.entries(ledgerByService).reduce((sum, [, l]) => sum + (l.flagged || 0), 0);
                  if (isFeatureEnabled("ledger") && totalFlaggedEntries > 0) {
                    warnings.push({
                      id: "flagged-ledger", severity: "error", icon: Flag,
                      text: { en: `${totalFlaggedEntries} ledger ${totalFlaggedEntries === 1 ? "entry" : "entries"} flagged`, nl: `${totalFlaggedEntries} ${totalFlaggedEntries === 1 ? "boeking" : "boekingen"} gemarkeerd` },
                      action: () => setActiveTab("services"),
                    });
                  }

                  // Overdue meter readings
                  const overdueMeters = meterList.filter((m) => m.status === "warning");
                  if (overdueMeters.length > 0) {
                    warnings.push({
                      id: "overdue-meters", severity: "warning", icon: Gauge,
                      text: { en: `${overdueMeters.length} meter ${overdueMeters.length === 1 ? "reading" : "readings"} overdue`, nl: `${overdueMeters.length} meter${overdueMeters.length === 1 ? "stand" : "standen"} achterstallig` },
                      action: () => setActiveTab("meters"),
                    });
                  }

                  // Consumption vs cost variance
                  if (isFeatureEnabled("consumptionControl")) {
                    const utilityMap = {
                      "SVC-108": "heat", "SVC-107": "heat",
                      "SVC-102": "water", "SVC-104": "water",
                      "SVC-105": "electricity", "SVC-106": "electricity",
                      "SVC-110": "electricity", "SVC-133": "electricity",
                    };
                    enrichedBs.filter((bs) => bs.service?.metered).forEach((bs) => {
                      const utilType = utilityMap[bs.serviceId];
                      if (!utilType) return;
                      const svcMeters = meterList.filter((m) => m.utility === utilType && m.type === "main");
                      const totalConsumption = svcMeters.reduce((s, m) => s + (m.consumption || 0), 0);
                      const meteredCats = getCostCategoriesByService(bs.serviceId).filter((cc) => cc.unit && cc.unitPrice);
                      const avgUnitPrice = meteredCats.length > 0
                        ? meteredCats.reduce((s, cc) => s + Math.abs(cc.unitPrice) * cc.budgetShare, 0) / meteredCats.reduce((s, cc) => s + cc.budgetShare, 0)
                        : 0;
                      if (totalConsumption === 0 || avgUnitPrice === 0) return;
                      const expectedCost = totalConsumption * avgUnitPrice;
                      const variancePct = Math.round(((bs.actual - expectedCost) / expectedCost) * 100);
                      if (Math.abs(variancePct) > 20) {
                        warnings.push({
                          id: `consumption-${bs.serviceId}`,
                          severity: Math.abs(variancePct) > 50 ? "error" : "warning",
                          icon: Activity,
                          text: {
                            en: `${bs.service?.name.en}: cost ${variancePct > 0 ? "+" : ""}${variancePct}% vs consumption estimate`,
                            nl: `${bs.service?.name.nl}: kosten ${variancePct > 0 ? "+" : ""}${variancePct}% t.o.v. verbruiksschatting`,
                          },
                          action: () => { setActiveTab("services"); setExpandedService(bs.serviceId); },
                        });
                      }
                    });
                  }

                  // Sort: errors first
                  const sevOrder = { error: 0, warning: 1, info: 2 };
                  warnings.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

                  // Open tasks for this building
                  const openTasks = buildingTasks.filter((t) => t.status === "open")
                    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
                  const overdueTasks = openTasks.filter((t) => new Date(t.dueDate) < new Date());

                  // Merge action queue (tasks + warnings only — distribution lives in header + its own tab)
                  const actionQueue = [];
                  overdueTasks.forEach((t) => actionQueue.push({ type: "task", severity: "error", item: t }));
                  warnings.forEach((w) => actionQueue.push({ type: "warning", severity: w.severity, item: w }));
                  openTasks.filter((t) => !overdueTasks.includes(t)).forEach((t) => actionQueue.push({ type: "task", severity: "info", item: t }));

                  // Notes
                  const pinnedNotes = buildingNotes.filter((n) => n.pinned).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                  const unpinnedNotes = buildingNotes.filter((n) => !n.pinned).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                  const allNotes = [...pinnedNotes, ...unpinnedNotes];

                  const sevStyles = {
                    error:   { bg: "bg-red-50/60",   iconColor: brand.red },
                    warning: { bg: "bg-amber-50/60", iconColor: brand.amber },
                    info:    { bg: "bg-white",       iconColor: brand.muted },
                  };

                  const priorityDot = { high: brand.red, medium: brand.amber, low: brand.muted };

                  const fmtRelDate = (d) => {
                    const dt = new Date(d);
                    const now = new Date();
                    const diff = Math.round((dt - now) / 86400000);
                    if (diff === 0) return lang === "nl" ? "vandaag" : "today";
                    if (diff === 1) return lang === "nl" ? "morgen" : "tomorrow";
                    if (diff === -1) return lang === "nl" ? "gisteren" : "yesterday";
                    if (diff < -1) return `${Math.abs(diff)}d ${lang === "nl" ? "geleden" : "ago"}`;
                    if (diff > 1 && diff <= 7) return `${diff}d`;
                    return dt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
                  };

                  return (
                <div className="mt-4 space-y-4">

                  {/* 1. Budget */}
                  <Card className="border-slate-200 bg-white overflow-hidden">
                      <CardContent className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2.5">
                          <CreditCard size={13} className="text-slate-400" />
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Budget {year}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                            style={{
                              background: verdictStatus === "on_track" ? "#F0FDFA"
                                : verdictStatus === "review" ? "#FFFBEB"
                                : "#FEF2F2",
                            }}
                          >
                            {verdictStatus === "on_track" ? (
                              <CheckCircle2 size={15} style={{ color: brand.blue }} />
                            ) : verdictStatus === "review" ? (
                              <Clock size={15} style={{ color: brand.amber }} />
                            ) : (
                              <AlertTriangle size={15} style={{ color: brand.red }} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: brand.navy }}>
                              {verdictStatus === "on_track"
                                ? (lang === "nl" ? "Op koers" : "On track")
                                : verdictStatus === "review"
                                  ? (lang === "nl" ? "Aandacht nodig" : "Needs review")
                                  : (lang === "nl" ? "Boven budget" : "Over budget")}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              {fmt(totalActual)} / {fmt(totalBudget)} ({budgetPct}%)
                              <span className="mx-1.5 text-slate-300">·</span>
                              {lang === "nl" ? "jaar" : "year"} {yearPct}%
                            </p>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(budgetPct, 100)}%`,
                              background: budgetPct > 100 ? brand.red : budgetPct > yearPct + 10 ? brand.amber : brand.blue,
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: brand.blue }} />
                            {servicesUnderBudget} {lang === "nl" ? "op koers" : "on track"}
                          </span>
                          {servicesOverBudget > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: brand.amber }} />
                              {servicesOverBudget} {lang === "nl" ? "boven budget" : "over budget"}
                            </span>
                          )}
                          {flaggedCount > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: brand.red }} />
                              {flaggedCount} {lang === "nl" ? "gemarkeerd" : "flagged"}
                            </span>
                          )}
                          <button
                            onClick={() => setActiveTab("services")}
                            className="ml-auto text-[11px] font-medium hover:underline"
                            style={{ color: brand.blue }}
                          >
                            Details →
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                  {/* 2. Tasks */}
                  {openTasks.length > 0 ? (
                    <Card className="border-slate-200 bg-white overflow-hidden">
                      <CardContent className="p-0">
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                          <ListChecks size={13} className="text-slate-400" />
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {lang === "nl" ? "Taken" : "Tasks"}
                            <span className="ml-1.5 text-slate-300">({openTasks.length})</span>
                          </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {openTasks.map((task) => {
                            const isOverdue = new Date(task.dueDate) < new Date();
                            return (
                              <div key={task.id} className={`flex items-center gap-3 px-4 py-2.5 ${isOverdue ? "bg-red-50/40" : ""}`}>
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: priorityDot[task.priority] || brand.muted }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-700 truncate">
                                    {task.title[lang] || task.title.en}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                                    style={{ background: brand.navy + "80" }}
                                    title={task.assignee}
                                  >
                                    {task.assigneeInitials}
                                  </span>
                                  <span className={`text-[11px] tabular-nums ${isOverdue ? "text-red-600 font-medium" : "text-slate-400"}`}>
                                    {fmtRelDate(task.dueDate)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-4 rounded-lg border border-slate-200 bg-white">
                      <CheckCircle2 size={15} style={{ color: brand.blue }} className="shrink-0" />
                      <p className="text-xs text-slate-500">
                        {lang === "nl" ? "Geen openstaande taken" : "No open tasks"}
                      </p>
                    </div>
                  )}

                  {/* 3. Warnings (auto-generated alerts) */}
                  {warnings.length > 0 && (
                    <Card className="border-slate-200 bg-white overflow-hidden">
                      <CardContent className="p-0">
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                          <AlertTriangle size={13} className="text-slate-400" />
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {lang === "nl" ? "Waarschuwingen" : "Warnings"}
                            <span className="ml-1.5 text-slate-300">({warnings.length})</span>
                          </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {warnings.map((w) => {
                            const sty = sevStyles[w.severity] || sevStyles.info;
                            const WIcon = w.icon;
                            return (
                              <div key={w.id} className={`flex items-center gap-3 px-4 py-2.5 ${sty.bg}`}>
                                <WIcon size={13} className="shrink-0" style={{ color: sty.iconColor }} />
                                <p className="flex-1 min-w-0 text-xs text-slate-700 truncate">
                                  {w.text[lang] || w.text.en}
                                </p>
                                {w.action && (
                                  <button
                                    onClick={w.action}
                                    className="text-[11px] font-medium shrink-0 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
                                    style={{ color: brand.blue }}
                                  >
                                    {lang === "nl" ? "Bekijk" : "View"} →
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 4. Notes */}
                  <Card className="border-slate-200 bg-white overflow-hidden">
                    <CardContent className="p-0">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StickyNote size={13} className="text-slate-400" />
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {lang === "nl" ? "Notities" : "Notes"}
                            {allNotes.length > 0 && <span className="ml-1 text-slate-300">({allNotes.length})</span>}
                          </p>
                        </div>
                        <button
                          className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80"
                          style={{ color: brand.blue }}
                        >
                          <Plus size={12} />
                          {lang === "nl" ? "Toevoegen" : "Add"}
                        </button>
                      </div>
                      {allNotes.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {allNotes.slice(0, 4).map((note) => (
                            <div key={note.id} className="flex items-start gap-3 px-4 py-2.5">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0 mt-0.5"
                                style={{ background: brand.navy + "70" }}
                                title={note.author}
                              >
                                {note.authorInitials}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {note.text[lang] || note.text.en}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {new Date(note.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                                  {note.pinned && (
                                    <span className="ml-1.5 text-slate-300">📌</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                          {allNotes.length > 4 && (
                            <div className="px-4 py-2 text-center">
                              <button className="text-[11px] font-medium" style={{ color: brand.blue }}>
                                {lang === "nl" ? `Toon alle ${allNotes.length} notities` : `Show all ${allNotes.length} notes`}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-slate-400">
                            {lang === "nl" ? "Nog geen notities" : "No notes yet"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </div>
                );
                })()}
              </TabsContent>

              {/* ═══ SERVICES TAB — DETAIL & INVESTIGATION ═══ */}
              <TabsContent value="services">
                {/* ── Distribution is now handled by the dedicated Distribution page ── */}
                {false ? (() => {
                  const dm = null;
                  const svc = null;
                  const svcName = null;

                  // Resolve intermediate values from the split tree
                  const resolveValue = (outputId) => {
                    // Check inputs first
                    const input = dm?.inputs?.find(i => i.id === outputId);
                    if (input) return input.resolvedValue;
                    // Check splits
                    const split = dm?.splits?.find(s => s.output === outputId);
                    if (!split) return 0;
                    const sourceVal = resolveValue(split.source);
                    if (split.additionalSources) {
                      const extra = split.additionalSources.reduce((sum, sid) => sum + resolveValue(sid), 0);
                      return (sourceVal + extra) * split.ratio;
                    }
                    return sourceVal * split.ratio;
                  };

                  const totalDistributed = dm?.invoiceLines?.reduce((sum, line) => sum + resolveValue(line.source), 0) || 0;

                  return (
                    <div className="mt-4 space-y-5">
                      {/* Back navigation */}
                      <button
                        onClick={() => null}
                        className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                        style={{ color: brand.blue }}
                      >
                        <ArrowLeft size={14} />
                        {lang === "nl" ? "Terug naar diensten" : "Back to services"}
                      </button>

                      {/* Header */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">
                          {lang === "nl" ? "Verdelingsmodel" : "Distribution Model"}: {svcName}
                        </h3>
                        {dm && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            {dm.provider || (lang === "nl" ? "Standaard" : "Standard")} · v{dm.formulaVersion} · {lang === "nl" ? "Laatst bijgewerkt" : "Last updated"}: {new Date(dm.lastUpdated).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>

                      {!dm ? (
                        <Card className="border-slate-200 bg-white">
                          <CardContent className="py-8 text-center">
                            <HelpCircle size={20} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-xs text-slate-400">
                              {lang === "nl" ? "Geen verdelingsmodel beschikbaar voor deze dienst" : "No distribution model available for this service"}
                            </p>
                          </CardContent>
                        </Card>
                      ) : dm && !dm.inputs ? (
                        // Simple energy distribution model view
                        <Card className="border-slate-200 bg-white">
                          <CardContent className="py-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <Gauge size={16} className="text-slate-500" />
                              <span className="text-xs font-semibold text-slate-700">
                                {dm.description?.[lang] || dm.description?.en || "Metered distribution"}
                              </span>
                            </div>
                            {dm.provider && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">{lang === "nl" ? "Meetbedrijf" : "Metering provider"}</span>
                                <span className="font-medium text-slate-700">{dm.provider}</span>
                              </div>
                            )}
                            {dm.meterTypes && dm.meterTypes.length > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">{lang === "nl" ? "Metertypes" : "Meter types"}</span>
                                <span className="font-medium text-slate-700">{dm.meterTypes.join(", ")}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          {/* ── LANE 1: Cost Inputs ── */}
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                              {lang === "nl" ? "1. Kostenopbouw" : "1. Cost Inputs"}
                            </p>
                            <Card className="border-slate-200 bg-white">
                              <CardContent className="py-0">
                                {dm.inputs.map((input, idx) => (
                                  <div key={input.id} className={`flex items-center justify-between py-3 ${idx < dm.inputs.length - 1 ? "border-b border-slate-100" : ""}`}>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-slate-700">
                                        {input.label[lang] || input.label.en}
                                      </p>
                                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
                                        {input.formula}
                                      </p>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-800 tabular-nums ml-4">
                                      {fmt(input.resolvedValue)}
                                    </span>
                                  </div>
                                ))}
                                {/* Total inputs */}
                                <div className="flex items-center justify-between py-2 border-t border-slate-200 bg-slate-50/50">
                                  <p className="text-[11px] font-medium text-slate-500">
                                    {lang === "nl" ? "Totaal invoer" : "Total inputs"}
                                  </p>
                                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                    {fmt(dm.inputs.reduce((s, i) => s + i.resolvedValue, 0))}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* ── LANE 2: Component Split ── */}
                          {dm.splits.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                {lang === "nl" ? "2. Componentensplitsing" : "2. Component Split"}
                              </p>
                              <Card className="border-slate-200 bg-white">
                                <CardContent className="py-0">
                                  {dm.splits.map((split, idx) => {
                                    const sourceLabel = dm.inputs.find(i => i.id === split.source)?.label
                                      || dm.splits.find(s => s.output === split.source)?.label
                                      || { en: split.source, nl: split.source };
                                    const resolvedAmt = resolveValue(split.output);

                                    return (
                                      <div key={idx} className={`py-3 ${idx < dm.splits.length - 1 ? "border-b border-slate-100" : ""}`}>
                                        <div className="flex items-center justify-between">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-slate-700">
                                              {split.label[lang] || split.label.en}
                                            </p>
                                            <div className="flex items-center gap-1 mt-0.5">
                                              <span className="text-[11px] text-slate-400">
                                                {(split.ratio * 100).toFixed(1)}% {lang === "nl" ? "van" : "of"} {sourceLabel[lang] || sourceLabel.en}
                                              </span>
                                              {split.method === "meter_based" && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-medium bg-slate-50" style={{ color: "#64748B" }}>
                                                  <Gauge size={9} />
                                                  {lang === "nl" ? "meter" : "metered"}
                                                </span>
                                              )}
                                              {split.method === "meter_ratio" && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-medium bg-slate-50" style={{ color: "#64748B" }}>
                                                  <Gauge size={9} />
                                                  {lang === "nl" ? "verhouding" : "ratio"}
                                                </span>
                                              )}
                                            </div>
                                            {split.note && (
                                              <p className="text-[11px] text-slate-400 mt-0.5 italic">
                                                {split.note[lang] || split.note.en}
                                              </p>
                                            )}
                                          </div>
                                          <span className="text-xs font-semibold text-slate-700 tabular-nums ml-4">
                                            {fmt(resolvedAmt)}
                                          </span>
                                        </div>
                                        {/* Mini progress bar */}
                                        <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${Math.min(split.ratio * 100, 100)}%`,
                                              background: split.method === "meter_based" || split.method === "meter_ratio" ? brand.blue : brand.navy,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </CardContent>
                              </Card>
                            </div>
                          )}

                          {/* ── LANE 3: Invoice Lines ── */}
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                              {dm.splits.length > 0
                                ? (lang === "nl" ? "3. Verdeelregels" : "3. Invoice Lines")
                                : (lang === "nl" ? "2. Verdeelregels" : "2. Invoice Lines")}
                            </p>
                            <Card className="border-slate-200 bg-white">
                              <CardContent className="py-0">
                                {dm.invoiceLines.map((line, idx) => {
                                  const lineAmt = resolveValue(line.source);
                                  const pct = totalDistributed > 0 ? (lineAmt / totalDistributed) * 100 : 0;

                                  return (
                                    <div key={idx} className={`py-3 ${idx < dm.invoiceLines.length - 1 ? "border-b border-slate-100" : ""}`}>
                                      <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-medium text-slate-700">
                                            {line.label[lang] || line.label.en}
                                          </p>
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-medium bg-slate-100 text-slate-500">
                                              {line.keyLabel[lang] || line.keyLabel.en}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right ml-4">
                                          <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmt(lineAmt)}</span>
                                          <p className="text-[11px] text-slate-400 tabular-nums">{pct.toFixed(1)}%</p>
                                        </div>
                                      </div>
                                      {/* Proportion bar */}
                                      <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                          className="h-full rounded-full"
                                          style={{ width: `${pct}%`, background: brand.navy }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Total distributed */}
                                <div className="flex items-center justify-between py-2 border-t border-slate-200 bg-slate-50/50">
                                  <p className="text-[11px] font-medium text-slate-500">
                                    {lang === "nl" ? "Totaal verdeeld" : "Total distributed"}
                                  </p>
                                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                    {fmt(totalDistributed)}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* ── Distribution key legend ── */}
                          <div className="px-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                              {lang === "nl" ? "Verdeelsleutels" : "Distribution Keys"}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {[...new Set(dm.invoiceLines.map(l => l.distributionKey))].map(key => {
                                const line = dm.invoiceLines.find(l => l.distributionKey === key);
                                return (
                                  <span key={key} className="text-[11px] text-slate-400">
                                    <span className="font-mono text-slate-500">{key.replace("cost_key_", "")}</span>
                                    {" = "}{line.keyLabel[lang] || line.keyLabel.en}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })() : (
                <div className="mt-4 space-y-2">
                  {(() => {
                    const visibleCategories = isFeatureEnabled("nonUtilityServices")
                      ? data.serviceCategories
                      : data.serviceCategories.filter((c) => c.id === "energy");

                    // Split: external services first, then internal grouped by category
                    const visibleCatIds = new Set(visibleCategories.map((c) => c.id));
                    const allVisible = enrichedBs.filter((bs) => visibleCatIds.has(bs.service?.category));
                    const externalItems = allVisible.filter((bs) => kostenverdelerMap[bs.serviceId]);
                    const internalItems = allVisible.filter((bs) => !kostenverdelerMap[bs.serviceId]);

                    if (allVisible.length === 0)
                      return (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">
                          {t("noResults", lang)}
                        </div>
                      );

                    // Build external supplier label
                    const kvSuppliers = [...new Set(externalItems.flatMap((bs) =>
                      (kostenverdelerMap[bs.serviceId] || []).map((k) => k.shortName)
                    ))];

                    // Group internal items by category (preserving category order from visibleCategories)
                    const categoryIconMap = { energy: Zap, installations: Wrench, cleaning: Sparkles, management: HardHat, other: FolderOpen };
                    const internalByCategory = visibleCategories
                      .map((cat) => ({
                        ...cat,
                        items: internalItems.filter((bs) => bs.service?.category === cat.id),
                      }))
                      .filter((cat) => cat.items.length > 0);

                    // Build a combined render list: external items flat, then internal grouped
                    const renderServiceCard = (bs) => {
                              const isExpanded = expandedService === bs.serviceId;
                              const v = bs.budget - bs.actual;
                              const ledger = ledgerByService[bs.serviceId];
                              const costCats = getCostCategoriesByService(bs.serviceId);
                              const { grouped: ledgerByCc, unassigned: unassignedEntries } = isExpanded
                                ? getLedgerGroupedByCostCategory(bs.serviceId, buildingId, year)
                                : { grouped: {}, unassigned: [] };

                              // Row status (budget-based)
                              const hasFlagged = (ledger?.flagged || 0) > 0;
                              const overBudget = v < 0;
                              const svcPct = bs.budget > 0 ? (bs.actual / bs.budget) * 100 : 0;
                              const svcAheadOfPace = svcPct > yearPct + 10;
                              return (
                              <React.Fragment key={bs.id}>
                                <Card
                                  className={`bg-white transition-shadow border-slate-200 ${isExpanded ? "shadow-md ring-1 ring-slate-200" : "hover:shadow-md cursor-pointer"}`}
                                >
                                  <CardContent className="p-0">
                                    {/* Summary row — always visible */}
                                    <div
                                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                                      onClick={() =>
                                        setExpandedService(isExpanded ? null : bs.serviceId)
                                      }
                                    >
                                      {(() => {
                                        const CatIcon = categoryIconMap[bs.service?.category] || FolderOpen;
                                        return <CatIcon size={14} style={{ color: brand.blue }} className="shrink-0" />;
                                      })()}
                                      <ChevronRight
                                        size={14}
                                        className={`text-slate-400 transition-transform duration-150 shrink-0 -ml-1.5 ${isExpanded ? "rotate-90" : ""}`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-semibold text-slate-800">
                                            {bs.service?.name[lang] || bs.serviceId}
                                          </span>
                                          <span className="text-[11px] font-mono text-slate-400">
                                            {bs.service?.code}
                                          </span>
                                          {(bs.consumption?.mainMeterId || bs.consumption?.meterCount > 0) && (
                                            <Gauge size={13} className="text-slate-400 shrink-0" />
                                          )}
                                        </div>
                                        {/* Budget progress indicator */}
                                        {(() => {
                                          const pct = bs.budget > 0 ? Math.round((bs.actual / bs.budget) * 100) : 0;
                                          const barCol = overBudget ? "#DC2626" : brand.blue;
                                          return (
                                            <div className="flex items-center gap-2 mt-1 max-w-[140px]">
                                              <div className="flex-1 h-[3px] rounded-full bg-slate-100 overflow-hidden">
                                                <div
                                                  className="h-full rounded-full"
                                                  style={{ width: `${Math.min(pct, 100)}%`, background: barCol }}
                                                />
                                              </div>
                                              <span className="text-[11px] text-slate-400 tabular-nums">{pct}%</span>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right">
                                          <p className="text-xs tabular-nums font-medium" style={{ color: brand.navy }}>
                                            {fmt(bs.actual)}
                                          </p>
                                          <p className="text-[11px] text-slate-400 tabular-nums">
                                            {lang === "nl" ? "van" : "of"} {fmt(bs.budget)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Expanded detail — progressive disclosure */}
                                    {isExpanded && (
                                      <div className="border-t border-slate-100 px-4 py-4 space-y-5 bg-slate-50/30">
                                        {/* ── Budget progress (financial only) ── */}
                                        {(() => {
                                          const budgetPct = bs.budget > 0 ? Math.round((bs.actual / bs.budget) * 100) : 0;
                                          // Muted, professional bar colors — only slate/navy tones, red only for over-budget
                                          const barCol = overBudget ? "#DC2626" : "#64748B";

                                          return (
                                            <div>
                                              {/* Budget vs actual — clean, single-line */}
                                              <div className="flex items-center gap-2 mb-1.5">
                                                <div className="flex-1 h-[4px] rounded-full bg-slate-100 overflow-hidden relative">
                                                  <div className="h-full rounded-full" style={{ width: `${Math.min(budgetPct, 100)}%`, background: barCol }} />
                                                  {yearPct > 0 && yearPct < 100 && (
                                                    <div className="absolute top-[-1.5px] w-[1.5px] h-[7px] rounded-full bg-slate-300" style={{ left: `${yearPct}%` }} />
                                                  )}
                                                </div>
                                                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{budgetPct}%</span>
                                              </div>
                                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>{bs.ledgerEntries || 0} / {bs.expectedEntries || 12} {lang === "nl" ? "facturen" : "invoices"}</span>
                                                {overBudget && <span className="text-red-600 font-medium">{lang === "nl" ? "Over budget" : "Over budget"}</span>}
                                                {!overBudget && svcAheadOfPace && <span className="text-slate-500">{lang === "nl" ? "Voor op schema" : "Ahead of pace"}</span>}
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        {/* Section B: Consumption cost estimate (metered services only) */}
                                        {bs.consumption?.mainMeterId && (() => {
                                          const c = bs.consumption;
                                          const linkedMeter = allMeters.find((m) => m.id === c.mainMeterId);
                                          const fmtNum = (n) => Math.round(n).toLocaleString("nl-NL");
                                          const consCostPct = (c.endCost || 0) > 0 ? Math.round(((c.ytdCost || 0) / c.endCost) * 100) : 0;
                                          const costDiffVsBudget = (c.endCost || 0) - bs.budget;
                                          const costDiffPct = bs.budget > 0 ? Math.round((costDiffVsBudget / bs.budget) * 100) : 0;
                                          return (
                                            <div className="rounded-lg border border-slate-100 bg-white p-3">
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                  <Gauge size={12} className="text-slate-400" />
                                                  <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                                                    {lang === "nl" ? "Verbruikskosten" : "Consumption cost"}
                                                  </span>
                                                </div>
                                                <button
                                                  className="text-[11px] font-medium flex items-center gap-1 hover:underline"
                                                  style={{ color: brand.blue }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveTab("consumption");
                                                  }}
                                                >
                                                  <Flame size={11} />
                                                  {linkedMeter?.meterNumber || c.mainMeterNumber || c.mainMeterId}
                                                  <ArrowUpRight size={11} />
                                                </button>
                                              </div>
                                              <div className="grid grid-cols-2 gap-3 text-[11px] mb-2">
                                                <div>
                                                  <p className="text-slate-400 mb-0.5">{lang === "nl" ? "Huidige kosten" : "Current cost"}</p>
                                                  <p className="text-sm font-bold tabular-nums" style={{ color: brand.navy }}>{fmt(c.ytdCost || 0)}</p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-400 mb-0.5">{lang === "nl" ? "Verwachte eindkosten" : "Expected end cost"}</p>
                                                  <p className="text-sm font-bold tabular-nums text-slate-500">{fmt(Math.round(c.endCost || 0))}</p>
                                                </div>
                                              </div>
                                              {/* Comparison with budget */}
                                              {bs.budget > 0 && (c.endCost || 0) > 0 && (
                                                <div className="flex items-center gap-2 text-[11px] mb-2 px-2 py-1.5 rounded bg-slate-50">
                                                  <span className="text-slate-400">{lang === "nl" ? "vs. budget" : "vs. budget"}</span>
                                                  <span className="font-medium tabular-nums text-slate-500">{fmt(bs.budget)}</span>
                                                  <span className="text-slate-300">→</span>
                                                  <span className={`font-semibold tabular-nums ${Math.abs(costDiffPct) > 10 ? (costDiffVsBudget > 0 ? "text-red-600" : "text-emerald-600") : "text-slate-500"}`}>
                                                    {costDiffVsBudget > 0 ? "+" : ""}{fmt(costDiffVsBudget)} ({costDiffPct > 0 ? "+" : ""}{costDiffPct}%)
                                                  </span>
                                                </div>
                                              )}
                                              {/* Physical consumption context */}
                                              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                                <span className="tabular-nums">{fmtNum(c.ytdConsumption)} / {fmtNum(c.endConsumption)} {c.unit}</span>
                                                {c.unitPrice > 0 && (
                                                  <>
                                                    <span className="w-px h-3 bg-slate-200" />
                                                    <span className="font-mono tabular-nums">€{c.unitPrice?.toFixed(2)}/{c.unit}</span>
                                                  </>
                                                )}
                                                {c.meterCount > 0 && (
                                                  <>
                                                    <span className="w-px h-3 bg-slate-200" />
                                                    <span>{c.meterCount} {lang === "nl" ? "submeters" : "sub-meters"}</span>
                                                  </>
                                                )}
                                                {c.tenantExceedingBudget > 0 && (
                                                  <span className="text-amber-600 font-medium">
                                                    · {c.tenantExceedingBudget} {lang === "nl" ? "boven voorschot" : "over advance"}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        {/* Section C: Cost Categories with nested Ledger Entries */}
                                        <div>
                                          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-2">
                                            {lang === "nl" ? "Kostensoorten" : "Cost Categories"} ({costCats.length + (unassignedEntries.length > 0 ? 1 : 0)})
                                          </p>
                                          {costCats.length === 0 && unassignedEntries.length === 0 ? (
                                            <p className="text-[11px] text-slate-400 italic">
                                              {lang === "nl" ? "Geen kostensoorten geconfigureerd" : "No cost categories configured"}
                                            </p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {costCats.map((cc) => {
                                                const ccEntries = (ledgerByCc[cc.id] || []).sort((a, b) => b.date.localeCompare(a.date));
                                                const ccActual = ccEntries.reduce((s, e) => s + e.amount, 0);
                                                const ccBudget = bs.budget * cc.budgetShare;
                                                const ccPct = ccBudget > 0 ? Math.round((ccActual / ccBudget) * 100) : 0;
                                                const ccOver = ccActual > ccBudget;
                                                const ccAhead = ccPct > yearPct + 10;
                                                const ccBarCol = ccOver ? "#DC2626" : "#64748B";
                                                const isCcExpanded = expandedCostCats[cc.id];
                                                const ccFlagged = ccEntries.filter((e) => e.status === "flagged").length;

                                                const freqLabel = {
                                                  monthly: lang === "nl" ? "mnd" : "mo",
                                                  quarterly: lang === "nl" ? "kw" : "qtr",
                                                  annual: lang === "nl" ? "jr" : "yr",
                                                  irregular: lang === "nl" ? "onr" : "irr",
                                                }[cc.invoiceFrequency] || cc.invoiceFrequency;

                                                return (
                                                  <div key={cc.id} className="rounded-lg bg-white border border-slate-100 overflow-hidden">
                                                    {/* Cost Category header row — clickable */}
                                                    <div
                                                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                                      onClick={() => toggleCostCat(cc.id)}
                                                    >
                                                      {isCcExpanded
                                                        ? <ChevronDown size={12} className="text-slate-400 shrink-0" />
                                                        : <ChevronRight size={12} className="text-slate-400 shrink-0" />
                                                      }
                                                      <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-[11px] font-medium text-slate-700">{(cc.name || cc.label)?.[lang] || (cc.name || cc.label)?.en || cc.id}</span>
                                                          {cc.supplier && (
                                                            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">· {cc.supplier}</span>
                                                          )}
                                                          {ccFlagged > 0 && (
                                                            <span className="text-[11px] px-1.5 py-1 rounded bg-red-50 font-medium" style={{ color: brand.red }}>
                                                              {ccFlagged} ⚑
                                                            </span>
                                                          )}
                                                        </div>
                                                        {/* Mini progress bar */}
                                                        <div className="flex items-center gap-1 mt-1 max-w-[120px]">
                                                          <div className="flex-1 h-[2px] rounded-full bg-slate-100 overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${Math.min(ccPct, 100)}%`, background: ccBarCol }} />
                                                          </div>
                                                          <span className="text-[11px] text-slate-400 tabular-nums">{ccPct}%</span>
                                                        </div>
                                                      </div>
                                                      <div className="flex items-center gap-2.5 shrink-0 text-[11px]">
                                                        <span className="text-slate-400 tabular-nums hidden sm:inline">{freqLabel}</span>
                                                        {cc.unit && cc.unitPrice && (
                                                          <span className="text-slate-400 tabular-nums hidden sm:inline">€{Math.abs(cc.unitPrice).toFixed(2)}/{cc.unit}</span>
                                                        )}
                                                        <span className="font-medium tabular-nums" style={{ color: ccOver ? brand.red : brand.navy }}>
                                                          {fmtEur2(ccActual)}
                                                        </span>
                                                        <span className="text-slate-400 tabular-nums">
                                                          / {fmtEur2(ccBudget)}
                                                        </span>
                                                      </div>
                                                    </div>

                                                    {/* Expanded: nested ledger entries */}
                                                    {isCcExpanded && ccEntries.length > 0 && (
                                                      <div className="border-t border-slate-100 bg-slate-50/30">
                                                        {ccEntries.slice(0, 8).map((entry) => (
                                                          <div key={entry.id} className="flex items-center justify-between text-[11px] px-3 py-1.5 pl-8 border-b border-slate-50 last:border-b-0">
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                              <span className="text-slate-400 tabular-nums shrink-0">{fmtDate(entry.date)}</span>
                                                              <span className="text-slate-600 truncate">
                                                                {typeof entry.description === "object" ? (entry.description[lang] || entry.description.en) : entry.description}
                                                              </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                              <span className="text-slate-700 tabular-nums">{fmtEur2(entry.amount)}</span>
                                                              <LedgerStatusBadge status={entry.status} lang={lang} />
                                                            </div>
                                                          </div>
                                                        ))}
                                                        {ccEntries.length > 8 && (
                                                          <p className="text-[11px] text-slate-400 italic px-3 pl-8 py-1.5">
                                                            + {ccEntries.length - 8} {lang === "nl" ? "meer" : "more"}
                                                          </p>
                                                        )}
                                                      </div>
                                                    )}
                                                    {isCcExpanded && ccEntries.length === 0 && (
                                                      <div className="border-t border-slate-100 bg-slate-50/30 px-3 pl-8 py-2">
                                                        <p className="text-[11px] text-slate-400 italic">
                                                          {lang === "nl" ? "Geen boekingen gevonden" : "No entries found"}
                                                        </p>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                              {/* Uncategorized entries — same style as cost categories */}
                                              {unassignedEntries.length > 0 && (() => {
                                                const ucActual = unassignedEntries.reduce((s, e) => s + e.amount, 0);
                                                const ucFlagged = unassignedEntries.filter((e) => e.status === "flagged").length;
                                                const isUcExpanded = expandedCostCats["__uncategorized__"];
                                                const ucSorted = [...unassignedEntries].sort((a, b) => b.date.localeCompare(a.date));
                                                return (
                                                  <div className="rounded-lg bg-white border border-slate-100 overflow-hidden">
                                                    <div
                                                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                                      onClick={() => toggleCostCat("__uncategorized__")}
                                                    >
                                                      {isUcExpanded
                                                        ? <ChevronDown size={12} className="text-slate-400 shrink-0" />
                                                        : <ChevronRight size={12} className="text-slate-400 shrink-0" />
                                                      }
                                                      <div className="flex-1 min-w-0">
                                                        <span className="text-[11px] font-medium text-slate-500">
                                                          {lang === "nl" ? "Niet gecategoriseerd" : "Uncategorized"}
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center gap-2.5 shrink-0 text-[11px]">
                                                        {ucFlagged > 0 && (
                                                          <span className="text-[11px] px-1.5 py-1 rounded bg-red-50 font-medium" style={{ color: brand.red }}>
                                                            {ucFlagged} ⚑
                                                          </span>
                                                        )}
                                                        <span className="font-medium tabular-nums" style={{ color: brand.navy }}>
                                                          {fmtEur2(ucActual)}
                                                        </span>
                                                      </div>
                                                    </div>
                                                    {isUcExpanded && (
                                                      <div className="border-t border-slate-100 bg-slate-50/30">
                                                        {ucSorted.slice(0, 8).map((entry) => (
                                                          <div key={entry.id} className="flex items-center justify-between text-[11px] px-3 py-1.5 pl-8 border-b border-slate-50 last:border-b-0">
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                              <span className="text-slate-400 tabular-nums shrink-0">{fmtDate(entry.date)}</span>
                                                              <span className="text-slate-600 truncate">
                                                                {typeof entry.description === "object" ? (entry.description[lang] || entry.description.en) : entry.description}
                                                              </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                              <span className="text-slate-700 tabular-nums">{fmtEur2(entry.amount)}</span>
                                                              <LedgerStatusBadge status={entry.status} lang={lang} />
                                                            </div>
                                                          </div>
                                                        ))}
                                                        {ucSorted.length > 8 && (
                                                          <p className="text-[11px] text-slate-400 italic px-3 pl-8 py-1.5">
                                                            + {ucSorted.length - 8} {lang === "nl" ? "meer" : "more"}
                                                          </p>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          )}
                                        </div>

                                        {/* Footer: Distribution link + cross-navigation */}
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                          {(() => {
                                            const dist = activeDistribution;
                                            return dist ? (
                                              <button
                                                className="text-[11px] font-medium flex items-center gap-1 transition-colors hover:underline"
                                                style={{ color: brand.blue }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  navigate(`/${orgId}/distribution/${dist.id}`);
                                                }}
                                              >
                                                <Send size={12} />
                                                {lang === "nl" ? "Bekijk verdeling" : "View distribution"}
                                                <ChevronRight size={12} />
                                              </button>
                                            ) : (
                                              <span className="text-[11px] text-slate-300">
                                                {lang === "nl" ? "Geen verdeling" : "No distribution"}
                                              </span>
                                            );
                                          })()}
                                          <button
                                            className="text-[11px] font-medium flex items-center gap-1 hover:underline"
                                            style={{ color: brand.blue }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`/${orgId}/services/${bs.serviceId}`);
                                            }}
                                          >
                                            {lang === "nl" ? "Alle complexen" : "All buildings"}
                                            <ArrowUpRight size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </React.Fragment>
                              );
                    };

                    return (
                      <>
                        {/* External services */}
                        {externalItems.length > 0 && (
                          <>
                            <div className="flex items-center gap-2 pt-1 pb-1">
                              <span className="text-[11px] font-medium text-slate-400 tracking-wide">
                                {lang === "nl" ? "Extern" : "External"} · {kvSuppliers.join(", ")}
                              </span>
                              <div className="flex-1 h-px bg-slate-200" />
                            </div>
                            {externalItems.map(renderServiceCard)}
                          </>
                        )}

                        {/* Internal services — grouped by category */}
                        {internalByCategory.length > 0 && (
                          <>
                            <div className="flex items-center gap-2 pt-3 pb-1">
                              <span className="text-[11px] font-medium text-slate-400 tracking-wide">
                                {lang === "nl" ? "Intern" : "Internal"}
                              </span>
                              <div className="flex-1 h-px bg-slate-200" />
                            </div>
                            {internalByCategory.map((cat) => {
                              const CatIcon = categoryIconMap[cat.id] || FolderOpen;
                              return (
                                <div key={cat.id}>
                                  <div className="flex items-center gap-1.5 pt-2 pb-1">
                                    <CatIcon size={12} className="text-slate-400" />
                                    <span className="text-[11px] font-medium text-slate-500">
                                      {cat.label?.[lang] || cat.label?.en || cat.id}
                                    </span>
                                    <span className="text-[11px] text-slate-300">{cat.items.length}</span>
                                  </div>
                                  <div className="space-y-2">
                                    {cat.items.map(renderServiceCard)}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </>
                    );

                  })()}
                </div>
                )}
              </TabsContent>

              {/* ═══ DISTRIBUTIONS TAB ═══ */}
              <TabsContent value="distributions">
                <div className="mt-4">
                  {buildingDistributions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      {lang === "nl" ? "Geen verdelingen beschikbaar." : "No distributions available."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...buildingDistributions]
                        .sort((a, b) => b.period - a.period)
                        .map((dist) => {
                          const isComplete = dist.currentStep === "complete";
                          const stepIdx = getStepIndex(dist);
                          const stepCfg = STEP_CONFIG[dist.currentStep];
                          const flaggedSvcs = dist.services.filter((s) => s.status === "flagged").length;
                          return (
                            <Card
                              key={dist.id}
                              className="border-slate-200 bg-white hover:border-slate-300 transition-colors cursor-pointer"
                              onClick={() => navigate(`/${orgId}/distribution/${dist.id}`)}
                            >
                              <CardContent className="px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold" style={{ color: brand.navy }}>
                                      {dist.period}
                                    </span>
                                    {isComplete ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 size={10} />
                                        {lang === "nl" ? "Afgerond" : "Complete"}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                        <Clock size={10} />
                                        {stepCfg?.label[lang] || dist.currentStep}
                                      </span>
                                    )}
                                    {flaggedSvcs > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                        <Flag size={9} />
                                        {flaggedSvcs}
                                      </span>
                                    )}
                                  </div>
                                  <ChevronRight size={14} className="text-slate-300" />
                                </div>
                                {/* 6-step mini progress bar */}
                                <div className="flex items-center gap-0.5 mb-2">
                                  {STEP_ORDER.map((step, i) => {
                                    const done = isComplete || i < stepIdx;
                                    const active = !isComplete && i === stepIdx;
                                    return (
                                      <div
                                        key={step}
                                        className="h-1 rounded-full flex-1"
                                        style={{ background: done ? (brand.teal || "#3EB1C8") : active ? "#93C5FD" : "#E2E8F0" }}
                                      />
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                  <span>{dist.services.length} {lang === "nl" ? "diensten" : "services"}</span>
                                  {dist.totals?.totalCost != null && (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <span className="tabular-nums">{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(dist.totals.totalCost)}</span>
                                    </>
                                  )}
                                  {dist.totals?.netResult != null && (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <span className="tabular-nums font-medium" style={{ color: dist.totals.netResult >= 0 ? brand.blue : "#EF4444" }}>
                                        {dist.totals.netResult >= 0 ? "+" : ""}{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(dist.totals.netResult)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ═══ CONSUMPTION TAB — Meter-centric physical view ═══ */}
              {isFeatureEnabled("consumptionControl") && (
              <TabsContent value="consumption">
                <div className="mt-4 space-y-3">
                  {(() => {
                    // Group by Main Meter (physical), not by service (bookkeeping)
                    const meterConsumption = mainMeters.map((meter) => {
                      // Find buildingServices linked to this meter via consumption.mainMeterId
                      const linkedBs = enrichedBs.filter(
                        (bs) => bs.consumption && bs.consumption.mainMeterId === meter.id
                      );
                      // Aggregate consumption from meter readings
                      const reading = meter.readings?.[year];
                      const ytdConsumption = reading?.consumption || linkedBs.reduce((s, bs) => s + (bs.consumption?.ytdConsumption || 0), 0);
                      const endConsumption = linkedBs.reduce((s, bs) => s + (bs.consumption?.endConsumption || 0), 0) || (ytdConsumption * (100 / Math.max(yearPct, 1)));
                      const ytdCost = reading?.cost || linkedBs.reduce((s, bs) => s + (bs.consumption?.ytdCost || 0), 0);
                      const endCost = linkedBs.reduce((s, bs) => s + (bs.consumption?.endCost || 0), 0) || ytdCost;
                      const unitPrice = linkedBs[0]?.consumption?.unitPrice || 0;

                      return { meter, linkedBs, ytdConsumption, endConsumption, ytdCost, endCost, unitPrice };
                    });

                    if (meterConsumption.length === 0) {
                      return (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                            <Radio size={18} className="text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-500">
                            {lang === "nl"
                              ? "Geen hoofdmeters geregistreerd"
                              : "No main meters registered"}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {lang === "nl"
                              ? "Verbruiksgegevens worden zichtbaar zodra meters zijn gekoppeld"
                              : "Consumption data will appear once meters are linked"}
                          </p>
                        </div>
                      );
                    }

                    const fmtNum = (n) => Math.round(n).toLocaleString("nl-NL");

                    const utilLabels = {
                      electricity: { icon: Zap, label: lang === "nl" ? "Elektriciteit" : "Electricity", color: "#F59E0B", bg: "#FEF3C7" },
                      heat: { icon: Flame, label: lang === "nl" ? "Warmte" : "Heat", color: "#EF4444", bg: "#FEE2E2" },
                      gas: { icon: Flame, label: "Gas", color: "#F97316", bg: "#FFF7ED" },
                      water: { icon: Droplets, label: "Water", color: "#3B82F6", bg: "#DBEAFE" },
                      "water-hot": { icon: Droplets, label: lang === "nl" ? "Warm water" : "Hot water", color: "#EC4899", bg: "#FCE7F3" },
                    };

                    return meterConsumption.map(({ meter, linkedBs, ytdConsumption, endConsumption, ytdCost, endCost, unitPrice }) => {
                      const consPct = endConsumption > 0 ? Math.round((ytdConsumption / endConsumption) * 100) : 0;
                      const consOver = consPct > 100;
                      const consAhead = consPct > yearPct + 10;
                      const barCol = consOver ? "#DC2626" : consAhead ? "#F59E0B" : brand.blue;
                      const util = utilLabels[meter.utility] || { icon: Gauge, label: meter.utility, color: "#64748B", bg: "#F1F5F9" };
                      const UtilIcon = util.icon;

                      return (
                        <div key={meter.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                          {/* Meter header — physical info */}
                          <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                                style={{ background: util.bg, color: util.color }}
                              >
                                <UtilIcon size={14} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold" style={{ color: brand.navy }}>{util.label}</span>
                                  <span className="text-[11px] text-slate-400 font-mono">{meter.meterNumber}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                  {meter.ean && <span>EAN {meter.ean}</span>}
                                  {meter.provider && (
                                    <>
                                      {meter.ean && <span className="text-slate-200">·</span>}
                                      <span>{meter.provider}</span>
                                    </>
                                  )}
                                  {meter.latestDate && (
                                    <>
                                      <span className="text-slate-200">·</span>
                                      <span>{lang === "nl" ? "Laatste aflezing" : "Last reading"} {fmtDate(meter.latestDate)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-sm font-bold tabular-nums" style={{ color: brand.navy }}>
                                {fmtNum(ytdConsumption)} <span className="text-xs font-normal text-slate-400">{meter.unit}</span>
                              </p>
                              <p className="text-[11px] text-slate-400 tabular-nums">
                                {lang === "nl" ? "van" : "of"} {fmtNum(Math.round(endConsumption))} {lang === "nl" ? "verwacht" : "expected"}
                              </p>
                            </div>
                          </div>

                          {/* Consumption progress */}
                          <div className="px-4 pb-3 space-y-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="flex-1 h-[5px] rounded-full bg-slate-100 overflow-hidden relative">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(consPct, 100)}%`, background: barCol }} />
                                  {yearPct > 0 && yearPct < 100 && (
                                    <div className="absolute top-[-2px] w-[2px] h-[9px] rounded-full bg-slate-300" style={{ left: `${yearPct}%` }} />
                                  )}
                                </div>
                                <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: barCol }}>{consPct}%</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-3 text-slate-400">
                                  <span className="inline-flex items-center gap-1">
                                    <span className="font-medium text-slate-600 tabular-nums">{fmt(ytdCost)}</span>
                                    {lang === "nl" ? "kosten" : "cost"}
                                  </span>
                                  <span className="w-px h-3 bg-slate-200" />
                                  <span className="inline-flex items-center gap-1">
                                    <span className="tabular-nums">{fmt(Math.round(endCost))}</span>
                                    {lang === "nl" ? "verwacht" : "expected"}
                                  </span>
                                  {unitPrice > 0 && (
                                    <>
                                      <span className="w-px h-3 bg-slate-200" />
                                      <span className="font-mono tabular-nums">€{unitPrice.toFixed(2)}/{meter.unit}</span>
                                    </>
                                  )}
                                </div>
                                {consOver && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">
                                    {lang === "nl" ? "Boven verwachting" : "Above expected"}
                                  </span>
                                )}
                                {!consOver && consAhead && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                                    {lang === "nl" ? "Voor op schema" : "Ahead of pace"}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Linked services */}
                            {linkedBs.length > 0 && (
                              <div className="pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Link2 size={11} className="text-slate-300" />
                                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                                    {lang === "nl" ? "Gekoppelde diensten" : "Linked services"}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {linkedBs.map((bs) => {
                                    const share = bs.consumption?.allocationShare || 1;
                                    const allocCost = (bs.consumption?.endCost || 0);
                                    return (
                                      <div key={bs.id} className="flex items-center justify-between text-[11px] pl-4 py-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-slate-600">{bs.service?.name?.[lang] || bs.serviceCode}</span>
                                          {share < 1 && (
                                            <span className="text-slate-300 font-mono">({Math.round(share * 100)}%)</span>
                                          )}
                                        </div>
                                        <span className="text-slate-600 font-medium tabular-nums">{fmt(allocCost)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {/* Year progress context */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-2">
                    <div className="w-20 h-[3px] rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${yearPct}%`, background: brand.blue }} />
                    </div>
                    <span className="tabular-nums font-medium">{lang === "nl" ? "Jaar" : "Year"} {yearPct}%</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400">{lang === "nl" ? "De staande streep toont de jaarpositie" : "Tick mark shows year position"}</span>
                  </div>
                </div>
              </TabsContent>
              )}

              {/* ═══ METERS TAB — Physical meter inventory ═══ */}
              {isFeatureEnabled("consumption") && <TabsContent value="meters">
                <div className="mt-4 space-y-4">
                  {/* Summary strip */}
                  {(() => {
                    const totalMain = mainMeters.length;
                    const totalSub = subMeters.length;
                    const overdueMain = mainMeters.filter((m) => {
                      const d = m.latestDate ? Math.floor((new Date() - new Date(m.latestDate)) / 86400000) : 999;
                      return d >= 90;
                    }).length;
                    const staleMain = mainMeters.filter((m) => {
                      const d = m.latestDate ? Math.floor((new Date() - new Date(m.latestDate)) / 86400000) : 999;
                      return d >= 30 && d < 90;
                    }).length;
                    const uniqueUtils = [...new Set(mainMeters.map((m) => m.utility))];

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Hoofdmeters" : "Main meters"}</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-lg font-bold tabular-nums" style={{ color: brand.navy }}>{totalMain}</p>
                            <div className="flex items-center gap-1">
                              {uniqueUtils.map((u) => {
                                const uCfg = utilityIcon[u] || {};
                                const UIcon = uCfg.icon || Gauge;
                                return <UIcon key={u} size={12} style={{ color: uCfg.color || "#94A3B8" }} />;
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Submeters" : "Sub meters"}</p>
                          <p className="text-lg font-bold tabular-nums" style={{ color: brand.navy }}>{totalSub}</p>
                        </div>
                        <div className={`rounded-lg border px-3 py-2.5 ${overdueMain > 0 ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"}`}>
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Achterstallig" : "Overdue"}</p>
                          <p className={`text-lg font-bold tabular-nums ${overdueMain > 0 ? "text-red-600" : "text-slate-400"}`}>{overdueMain}</p>
                        </div>
                        <div className={`rounded-lg border px-3 py-2.5 ${staleMain > 0 ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"}`}>
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Verouderd" : "Stale"}</p>
                          <p className={`text-lg font-bold tabular-nums ${staleMain > 0 ? "text-amber-600" : "text-slate-400"}`}>{staleMain}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dismounted meter filter */}
                  {dismountedCount > 0 && (
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setShowDismounted(!showDismounted)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <span className={`w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center ${showDismounted ? 'border-[#3EB1C8] bg-[#3EB1C8]' : 'border-slate-300'}`}>
                          {showDismounted && <CheckCircle2 size={10} className="text-white" />}
                        </span>
                        {lang === "nl" ? `Gedemonteerde meters tonen (${dismountedCount})` : `Show dismounted meters (${dismountedCount})`}
                      </button>
                    </div>
                  )}

                  {/* ── Main Meters ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {lang === "nl" ? "Hoofdmeters" : "Main Meters"}
                      </h3>
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-[11px] text-slate-400">{mainMeters.length}</span>
                    </div>
                    {mainMeters.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                          <Gauge size={18} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">
                          {lang === "nl" ? "Geen hoofdmeters geregistreerd" : "No main meters registered"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {mainMeters.map((m) => {
                          const ui = utilityIcon[m.utility] || {};
                          const Icon = ui.icon || Gauge;
                          // Data quality: derive from latestDate recency
                          const daysSinceReading = m.latestDate ? Math.floor((new Date() - new Date(m.latestDate)) / 86400000) : 999;
                          const quality = daysSinceReading < 30 ? "good" : daysSinceReading < 90 ? "warning" : "overdue";
                          const qualityCfg = {
                            good: { color: "#16A34A", bg: "bg-emerald-50", label: lang === "nl" ? "Actueel" : "Up to date" },
                            warning: { color: "#F59E0B", bg: "bg-amber-50", label: lang === "nl" ? "Verouderd" : "Stale" },
                            overdue: { color: "#EF4444", bg: "bg-red-50", label: lang === "nl" ? "Achterstallig" : "Overdue" },
                          }[quality];

                          return (
                            <div key={m.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                              <div className="p-4">
                                {/* Row 1: Meter identity */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                                      style={{ background: ui.bg || "#F1F5F9", color: ui.color || "#64748B" }}
                                    >
                                      <Icon size={15} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold" style={{ color: brand.navy }}>{m.meterNumber}</p>
                                        <span className="text-[11px] text-slate-400">
                                          {t(m.utility, lang)} · {m.unit}
                                          {m.meterType && <> · {m.meterType}</>}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                        {m.ean && <span>EAN <span className="font-mono text-slate-500">{m.ean}</span></span>}
                                        {m.provider && (
                                          <>
                                            {m.ean && <span className="w-px h-2.5 bg-slate-200" />}
                                            <span>{m.provider}</span>
                                          </>
                                        )}
                                        {m.vendorId && (
                                          <>
                                            <span className="w-px h-2.5 bg-slate-200" />
                                            <span className="font-mono">{m.vendorId}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2">
                                    {m.dismounted && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-400">
                                        {lang === "nl" ? "Gedemonteerd" : "Dismounted"}
                                      </span>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${qualityCfg.bg}`} style={{ color: qualityCfg.color }}>
                                      {qualityCfg.label}
                                    </span>
                                  </div>
                                </div>

                                {/* Reading values */}
                                <div className="grid grid-cols-3 gap-3 px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50/50 ml-10">
                                  <div>
                                    <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Meterstand" : "Reading"}</p>
                                    <p className="text-sm font-bold tabular-nums" style={{ color: brand.navy }}>
                                      {(m.lastReading || 0).toLocaleString("nl-NL")}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Verbruik" : "Consumption"}</p>
                                    <p className="text-sm font-bold tabular-nums" style={{ color: brand.navy }}>
                                      {(m.consumption || 0).toLocaleString("nl-NL")} <span className="text-xs font-normal text-slate-400">{m.unit}</span>
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Aflees­datum" : "Reading date"}</p>
                                    <p className="text-sm font-medium text-slate-600">{m.readingDate || "—"}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Sub Meters — table format for scalability ── */}
                  {subMeters.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          {lang === "nl" ? "Submeters" : "Sub Meters"}
                        </h3>
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[11px] text-slate-400">{subMeters.length}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="w-5 px-2 py-2.5"></th>
                                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 text-[11px]">{lang === "nl" ? "Meter" : "Meter"}</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 text-[11px]">VHE</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 text-[11px] hidden sm:table-cell">{lang === "nl" ? "Utiliteit" : "Utility"}</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 text-[11px] hidden md:table-cell">{lang === "nl" ? "Type" : "Type"}</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 text-[11px] hidden md:table-cell">{lang === "nl" ? "Leverancier" : "Supplier"}</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-500 text-[11px]">{lang === "nl" ? "Verbruik" : "Consumption"}</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 text-[11px] hidden sm:table-cell">{lang === "nl" ? "Aflezing" : "Reading"}</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-slate-500 text-[11px] hidden lg:table-cell">{lang === "nl" ? "Status" : "Status"}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {(() => {
                                const SUB_LIMIT = 50;
                                const [showAllSubs, setShowAll] = [subMeters.length <= SUB_LIMIT, null]; // Show all if under limit
                                const visibleSubs = subMeters.slice(0, showAllSubs ? subMeters.length : SUB_LIMIT);
                                return visibleSubs.map((m) => {
                                  const vhe = m.vheId ? getVhe(m.vheId) : null;
                                  const daysSince = m.latestDate ? Math.floor((new Date() - new Date(m.latestDate)) / 86400000) : 999;
                                  const qCfg = daysSince < 30
                                    ? { color: "#16A34A", bg: "bg-emerald-50", label: "OK" }
                                    : daysSince < 90
                                    ? { color: "#F59E0B", bg: "bg-amber-50", label: lang === "nl" ? "Verouderd" : "Stale" }
                                    : { color: "#EF4444", bg: "bg-red-50", label: lang === "nl" ? "Achterstallig" : "Overdue" };
                                  const subUi = utilityIcon[m.utility] || {};
                                  const SubIcon = subUi.icon || Gauge;
                                  return (
                                    <tr key={m.id} className="hover:bg-slate-50/50">
                                      <td className="px-2 py-2.5">
                                        <SubIcon size={12} style={{ color: subUi.color || "#94A3B8" }} />
                                      </td>
                                      <td className="px-3 py-2.5 font-mono text-[11px]" style={{ color: brand.navy }}>{m.meterNumber}</td>
                                      <td className="px-3 py-2.5 text-slate-600 text-[11px] max-w-[160px] truncate font-medium">
                                        {vhe ? `${vhe.unit} · ${vhe.address}` : (m.vheId || "—")}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-500 text-[11px] hidden sm:table-cell">{t(m.utility, lang)}</td>
                                      <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono hidden md:table-cell">{m.meterType || "—"}</td>
                                      <td className="px-3 py-2.5 text-slate-500 text-[11px] hidden md:table-cell">{m.provider || "—"}</td>
                                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[11px]" style={{ color: brand.navy }}>
                                        {(m.consumption || 0).toLocaleString("nl-NL")} <span className="text-slate-400 font-normal">{m.unit}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-500 text-[11px] hidden sm:table-cell">{m.readingDate || "—"}</td>
                                      <td className="px-3 py-2.5 hidden lg:table-cell text-center">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${qCfg.bg}`} style={{ color: qCfg.color }}>{qCfg.label}</span>
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                        {subMeters.length > 50 && (
                          <div className="px-3 py-2.5 border-t border-slate-100 text-center bg-slate-50/50">
                            <span className="text-[11px] text-slate-500 font-medium">
                              {lang === "nl" ? `Eerste 50 van ${subMeters.length} submeters getoond` : `Showing first 50 of ${subMeters.length} sub meters`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>}

              {/* ═══ VHE TAB — Enhanced table with sort/filter ═══ */}
              <TabsContent value="vhe">
                {(() => {
                  // Get season start (current year heating season start date)
                  const seasonStart = null;

                  // Compute derived fields for each VHE
                  const enrichedVheList = vheList.map((vhe) => {
                    // Contract status
                    const contractStatus = vhe.contract?.status === "active" ? "Active"
                      : vhe.contract?.status === "ended" ? "Ended"
                      : "Vacant";

                    // Since: effective start date in this heating season
                    let since = null;
                    if (vhe.contract?.startDate) {
                      since = seasonStart && vhe.contract.startDate < seasonStart
                        ? seasonStart
                        : vhe.contract.startDate;
                    }

                    // Expected: sum of building-service endCostPerVhe for services this VHE participates in
                    const expected = vhe.suggestedBreakdown
                      ? vhe.suggestedBreakdown.reduce((s, item) => {
                          // Find the BS to get endCostPerVhe
                          const bs = enrichedBs.find((b) => b.serviceId === item.s);
                          return s + (bs?.consumption?.endCostPerVhe || 0);
                        }, 0)
                      : 0;

                    // Advance (monthly)
                    const advance = vhe.voorschot || 0;

                    // Suggested (monthly)
                    const suggested = vhe.suggestedTotal || advance;

                    // Diff
                    const diff = Math.round((suggested - advance) * 100) / 100;

                    return { ...vhe, contractStatus, since, expected, advance, suggested, diff };
                  });

                  // Filter
                  let filtered = enrichedVheList;
                  if (vheContractFilter !== "all") {
                    filtered = filtered.filter((v) => v.contractStatus.toLowerCase() === vheContractFilter);
                  }
                  if (vheSearch.trim()) {
                    const q = vheSearch.toLowerCase();
                    filtered = filtered.filter((v) => v.address?.toLowerCase().includes(q) || v.unit?.toLowerCase().includes(q));
                  }

                  // Sort
                  const sortedVhes = [...filtered].sort((a, b) => {
                    const dir = vheSortDir === "asc" ? 1 : -1;
                    switch (vheSortField) {
                      case "unit": return dir * String(a.unit).localeCompare(String(b.unit), "nl", { numeric: true });
                      case "address": return dir * (a.address || "").localeCompare(b.address || "");
                      case "m2": return dir * ((a.m2 || 0) - (b.m2 || 0));
                      case "contract": return dir * a.contractStatus.localeCompare(b.contractStatus);
                      case "advance": return dir * (a.advance - b.advance);
                      case "suggested": return dir * (a.suggested - b.suggested);
                      case "diff": return dir * (a.diff - b.diff);
                      default: return 0;
                    }
                  });

                  const toggleSort = (field) => {
                    if (vheSortField === field) setVheSortDir(vheSortDir === "asc" ? "desc" : "asc");
                    else { setVheSortField(field); setVheSortDir("asc"); }
                  };

                  const SortHeader = ({ field, children, align }) => (
                    <th
                      className={`px-3 py-2 font-semibold text-slate-500 text-[11px] cursor-pointer hover:text-slate-700 select-none ${align === "right" ? "text-right" : "text-left"}`}
                      onClick={() => toggleSort(field)}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {children}
                        {vheSortField === field && (
                          <ArrowUpDown size={10} className="text-slate-400" />
                        )}
                      </span>
                    </th>
                  );

                  const activeCount = enrichedVheList.filter((v) => v.contractStatus === "Active").length;
                  const endedCount = enrichedVheList.filter((v) => v.contractStatus === "Ended").length;
                  const vacantCount = enrichedVheList.filter((v) => v.contractStatus === "Vacant").length;

                  // Summary stats
                  const totalAdvance = enrichedVheList.reduce((s, v) => s + (v.advance || 0), 0);
                  const totalSuggested = enrichedVheList.reduce((s, v) => s + (v.suggested || 0), 0);
                  const totalDiff = totalSuggested - totalAdvance;
                  const needsAdjustment = enrichedVheList.filter((v) => Math.abs(v.diff) > 5).length;

                  return (
                    <>
                      {/* Summary strip */}
                      <div className="mt-4 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Eenheden" : "Units"}</p>
                          <p className="text-lg font-bold tabular-nums" style={{ color: brand.navy }}>{enrichedVheList.length}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Voorschot / mnd" : "Advance / mo"}</p>
                          <p className="text-lg font-bold tabular-nums" style={{ color: brand.navy }}>{fmt(totalAdvance)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Advies / mnd" : "Suggested / mo"}</p>
                          <p className="text-lg font-bold tabular-nums text-slate-500">{fmt(totalSuggested)}</p>
                        </div>
                        <div className={`rounded-lg border px-3 py-2.5 ${Math.abs(totalDiff) > 50 ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"}`}>
                          <p className="text-[11px] text-slate-400 font-medium">{lang === "nl" ? "Aanpassing nodig" : "Needs adjustment"}</p>
                          <div className="flex items-baseline gap-2">
                            <p className={`text-lg font-bold tabular-nums ${totalDiff > 5 ? "text-red-600" : totalDiff < -5 ? "text-emerald-600" : "text-slate-400"}`}>
                              {totalDiff > 0 ? "+" : ""}{fmt(totalDiff)}
                            </p>
                            {needsAdjustment > 0 && (
                              <span className="text-[11px] text-slate-400">{needsAdjustment} {lang === "nl" ? "eenheden" : "units"}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Toolbar: search + filter */}
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[160px] max-w-xs">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input
                            type="text"
                            value={vheSearch}
                            onChange={(e) => setVheSearch(e.target.value)}
                            placeholder={lang === "nl" ? "Zoek adres of eenheid..." : "Search address or unit..."}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#3EB1C8]/30 focus:border-[#3EB1C8]"
                          />
                        </div>
                        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
                          {[
                            { key: "all", label: `${lang === "nl" ? "Alle" : "All"} (${enrichedVheList.length})` },
                            { key: "active", label: `${lang === "nl" ? "Actief" : "Active"} (${activeCount})` },
                            { key: "ended", label: `${lang === "nl" ? "Beëindigd" : "Ended"} (${endedCount})` },
                            { key: "vacant", label: `${lang === "nl" ? "Leeg" : "Vacant"} (${vacantCount})` },
                          ].map((f) => (
                            <button
                              key={f.key}
                              onClick={() => setVheContractFilter(f.key)}
                              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                                vheContractFilter === f.key
                                  ? "bg-[#3EB1C8]/10 text-[#3EB1C8] font-semibold"
                                  : "text-slate-400 hover:text-slate-600"
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {sortedVhes.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                          {t("noResults", lang)}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                  <th className="w-6 px-2 py-2"></th>
                                  <SortHeader field="unit">{t("unit", lang)}</SortHeader>
                                  <SortHeader field="address">{lang === "nl" ? "Adres" : "Address"}</SortHeader>
                                  <SortHeader field="m2">m²</SortHeader>
                                  <SortHeader field="contract">{lang === "nl" ? "Contract" : "Contract"}</SortHeader>
                                  <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] hidden lg:table-cell">{lang === "nl" ? "Sinds" : "Since"}</th>
                                  <SortHeader field="advance" align="right">{lang === "nl" ? "Voorschot" : "Advance"}</SortHeader>
                                  <SortHeader field="suggested" align="right">{lang === "nl" ? "Advies" : "Suggested"}</SortHeader>
                                  <SortHeader field="diff" align="right">{lang === "nl" ? "Verschil" : "Diff"}</SortHeader>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {sortedVhes.map((vhe) => {
                                  const isExp = expandedVhe === vhe.id;
                                  const contractCfg = {
                                    Active: { bg: "bg-emerald-50", text: "text-emerald-700", label: lang === "nl" ? "Actief" : "Active" },
                                    Ended: { bg: "bg-slate-100", text: "text-slate-500", label: lang === "nl" ? "Beëindigd" : "Ended" },
                                    Vacant: { bg: "bg-amber-50", text: "text-amber-700", label: lang === "nl" ? "Leeg" : "Vacant" },
                                  }[vhe.contractStatus] || { bg: "bg-slate-100", text: "text-slate-500", label: vhe.contractStatus };
                                  const diffColor = vhe.diff > 5 ? "text-red-600" : vhe.diff < -5 ? "text-emerald-600" : "text-slate-400";
                                  const diffBg = Math.abs(vhe.diff) > 5 ? (vhe.diff > 5 ? "bg-red-50" : "bg-emerald-50") : "";

                                  return (
                                    <React.Fragment key={vhe.id}>
                                      <tr
                                        className={`cursor-pointer transition-colors ${isExp ? "bg-slate-50" : "hover:bg-slate-50/50"}`}
                                        onClick={() => setExpandedVhe(isExp ? null : vhe.id)}
                                      >
                                        <td className="px-2 py-2.5">
                                          <ChevronRight
                                            size={12}
                                            className={`text-slate-400 transition-transform duration-150 ${isExp ? "rotate-90" : ""}`}
                                          />
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-600 font-mono tabular-nums">{vhe.unit}</td>
                                        <td className="px-3 py-2.5 font-medium max-w-[180px] truncate" style={{ color: brand.navy }}>{vhe.address}</td>
                                        <td className="px-3 py-2.5 text-slate-500 tabular-nums">{vhe.m2 || "—"}</td>
                                        <td className="px-3 py-2.5">
                                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${contractCfg.bg} ${contractCfg.text}`}>
                                            {contractCfg.label}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-500 text-[11px] hidden lg:table-cell">
                                          {vhe.since ? fmtDate(vhe.since) : "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: brand.navy }}>{fmt(vhe.advance)}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmt(vhe.suggested)}</td>
                                        <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${diffColor}`}>
                                          <span className={`inline-flex px-1.5 py-0.5 rounded ${diffBg}`}>
                                            {vhe.diff > 0 ? "+" : ""}{fmt(vhe.diff)}
                                          </span>
                                        </td>
                                      </tr>
                                      {isExp && (
                                        <tr>
                                          <td colSpan={9} className="p-0">
                                            <div className="px-5 py-3 bg-white border-t border-slate-100">
                                              {/* Per-service breakdown */}
                                              {vhe.suggestedBreakdown?.length > 0 ? (
                                                <div>
                                                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                                    {lang === "nl" ? "Voorschot per dienst" : "Advance per service"}
                                                  </h4>
                                                  <div className="rounded-lg border border-slate-100 overflow-hidden">
                                                    <table className="w-full text-[11px]">
                                                      <thead>
                                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                                          <th className="text-left px-3 py-1.5 text-slate-400 font-semibold">{lang === "nl" ? "Dienst" : "Service"}</th>
                                                          <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">{lang === "nl" ? "Huidig" : "Current"}</th>
                                                          <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">{lang === "nl" ? "Advies" : "Suggested"}</th>
                                                          <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">{lang === "nl" ? "Verschil" : "Diff"}</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-slate-50">
                                                        {vhe.suggestedBreakdown.map((item) => {
                                                          const svc = getService(item.s);
                                                          const itemDiffColor = item.diff > 2 ? "text-red-600" : item.diff < -2 ? "text-emerald-600" : "text-slate-400";
                                                          return (
                                                            <tr key={item.s} className="hover:bg-slate-50/50">
                                                              <td className="px-3 py-1.5 text-slate-600 font-medium">
                                                                {svc?.name?.[lang] || item.s}
                                                              </td>
                                                              <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: brand.navy }}>{fmtEur2(item.current)}</td>
                                                              <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{fmtEur2(item.suggested)}</td>
                                                              <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${itemDiffColor}`}>
                                                                {item.diff > 0 ? "+" : ""}{fmtEur2(item.diff)}
                                                              </td>
                                                            </tr>
                                                          );
                                                        })}
                                                      </tbody>
                                                      <tfoot>
                                                        <tr className="border-t border-slate-200 bg-slate-50/80">
                                                          <td className="px-3 py-2 font-bold text-slate-700">{lang === "nl" ? "Totaal" : "Total"}</td>
                                                          <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: brand.navy }}>{fmtEur2(vhe.advance)}</td>
                                                          <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-500">{fmtEur2(vhe.suggested)}</td>
                                                          <td className={`px-3 py-2 text-right font-bold tabular-nums ${diffColor}`}>
                                                            {vhe.diff > 0 ? "+" : ""}{fmtEur2(vhe.diff)}
                                                          </td>
                                                        </tr>
                                                      </tfoot>
                                                    </table>
                                                  </div>
                                                </div>
                                              ) : vhe.voorschotBreakdown?.length > 0 ? (
                                                <div>
                                                  <h4 className="text-[11px] font-semibold text-slate-500 mb-2">
                                                    {lang === "nl" ? "Voorschot per dienst" : "Advance per service"}
                                                  </h4>
                                                  <div className="rounded-lg border border-slate-100 bg-white divide-y divide-slate-50">
                                                    {vhe.voorschotBreakdown.map((item) => {
                                                      const svc = getService(item.s);
                                                      return (
                                                        <div key={item.s} className="flex items-center justify-between px-3 py-1.5">
                                                          <span className="text-[11px] text-slate-600">{svc?.name?.[lang] || item.s}</span>
                                                          <span className="text-[11px] font-medium text-slate-700 tabular-nums">{fmtEur2(item.a)}</span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              ) : (
                                                <p className="text-[11px] text-slate-400">{lang === "nl" ? "Geen voorschot gegevens" : "No advance data available"}</p>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-50 border-t-2 border-slate-200">
                                  <td colSpan={6} className="px-3 py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    {filtered.length === enrichedVheList.length
                                      ? `${lang === "nl" ? "Totaal" : "Total"} (${enrichedVheList.length})`
                                      : `${filtered.length} / ${enrichedVheList.length} ${lang === "nl" ? "eenheden" : "units"}`
                                    }
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums" style={{ color: brand.navy }}>
                                    {fmt(sortedVhes.reduce((s, v) => s + (v.advance || 0), 0))}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-500">
                                    {fmt(sortedVhes.reduce((s, v) => s + (v.suggested || 0), 0))}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                                    {(() => {
                                      const fDiff = sortedVhes.reduce((s, v) => s + (v.diff || 0), 0);
                                      return <span className={fDiff > 5 ? "text-red-600" : fDiff < -5 ? "text-emerald-600" : "text-slate-500"}>{fDiff > 0 ? "+" : ""}{fmt(fDiff)}</span>;
                                    })()}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </TabsContent>

              {/* ═══ ACTIVITY TAB ═══ */}
              <TabsContent value="activity">
                <div className="mt-4 space-y-2">
                  {activityList.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                      {t("noResults", lang)}
                    </div>
                  ) : (
                    activityList.map((activity) => {
                      const cfg = activityIcons[activity.type] || {};
                      const Icon = cfg.icon || Activity;
                      return (
                        <Card key={activity.id} className="border-slate-200 bg-white">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                style={{ background: (cfg.color || brand.blue) + "15" }}
                              >
                                <Icon size={14} style={{ color: cfg.color || brand.blue }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-700 font-medium">
                                  {typeof activity.description === "object" ? (activity.description[lang] || activity.description.en) : activity.description}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  {fmtDate(activity.date)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>
          </div>{/* close max-w-[1100px] inner wrapper */}
        </div>{/* close left scroll column */}

        {/* ── Attribute panel (right sidebar — independent scroll) ── */}
        <div className="hidden xl:block w-80 shrink-0 border-l border-slate-200 overflow-y-auto">
          <AttributePanel>
              {/* ── Complex ── */}
              <AttrSection title="Complex" first>
                <AttrRow
                  label={lang === "nl" ? "Adres" : "Address"}
                  value={primaryAddress}
                />
                <AttrRow
                  label={lang === "nl" ? "Locatie" : "Location"}
                  value={building.location}
                />
                <AttrRow label="Complex ID" value={building.complexId} mono />
                <AttrRow
                  label={lang === "nl" ? "Objectcode" : "Object code"}
                  value={building.id}
                  mono
                />
                <AttrRow
                  label={lang === "nl" ? "Woon m²" : "Residential m²"}
                  value={totalResidentialM2 > 0 ? `${totalResidentialM2.toLocaleString()} m²` : "—"}
                />
                <AttrRow
                  label={lang === "nl" ? "Algemeen m²" : "Common space m²"}
                  value="—"
                  muted
                />
              </AttrSection>

              {/* ── Relationships ── */}
              <AttrSection title={lang === "nl" ? "Relaties" : "Relationships"}>
                <AttrRow
                  label={lang === "nl" ? "Diensten" : "Services"}
                  value={bsRelations.length}
                  onClick={() => setActiveTab("services")}
                />
                <AttrRow
                  label={lang === "nl" ? "Hoofdmeters" : "Main meters"}
                  value={mainMeters.length}
                  onClick={() => setActiveTab("meters")}
                />
                <AttrRow
                  label={lang === "nl" ? "Submeters" : "Submeters"}
                  value={subMeters.length}
                  onClick={() => setActiveTab("meters")}
                />
              </AttrSection>

              {/* ── Tenants ── */}
              <AttrSection title={lang === "nl" ? "Huurders" : "Tenants"}>
                <AttrRow
                  label={lang === "nl" ? "Actieve contracten" : "Active contracts"}
                  value={activeContracts}
                  onClick={() => setActiveTab("vhe")}
                />
                <AttrRow
                  label={lang === "nl" ? "Gem. voorschot" : "Avg. advance"}
                  value={avgAdvance > 0 ? `€ ${avgAdvance.toFixed(2)}` : "—"}
                />
                <AttrBadge
                  label="Tenant app"
                  active
                  text={lang === "nl" ? "Actief" : "Active"}
                />
                <AttrRow
                  label={lang === "nl" ? "App gebruikers" : "App users"}
                  value={activeContracts > 0 ? Math.round(activeContracts * 0.7) : 0}
                />
                <AttrRow
                  label={lang === "nl" ? "Waarschuwingsbrieven" : "Warning letters"}
                  value="0"
                />
              </AttrSection>
            </AttributePanel>
          </div>
        </div>{/* close scrollable row */}
    </Tabs>
  );
}
