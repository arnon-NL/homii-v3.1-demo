import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Building2,
  FileText,
  TrendingUp,
  TrendingDown,
  Filter,
  BarChart3,
  Gauge,
  Info,
  Link2,
  Unlink,
  X,
  Zap,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { t, useLang } from "@/lib/i18n";
import {
  getServices,
  getBuildings,
  getServiceCategories,
  getLedgerByService,
  getLedgerSummaryByService,
  getBuildingServicesByService,
  getMetersByBuilding,
  isFeatureEnabled,
  getHeatingSeasonsByBuilding,
  getCostCategoriesByService,
  getLedgerGroupedByCostCategory,
  getMeterLink,
  addMeterLink,
  removeMeterLink,
} from "@/lib/mockData";
import { useOrg } from "@/lib/OrgContext";

/* ── Formatters ── */
const fmtEur = (v) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

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

/* ── Status config ── */
const statusConfig = {
  booked:  { color: brand.blue, bg: "#F0FAFB", label: { en: "Booked", nl: "Geboekt" }, icon: CheckCircle2 },
  pending: { color: brand.amber, bg: "#FFFBEB", label: { en: "Pending", nl: "In afwachting" }, icon: Clock },
  flagged: { color: brand.red, bg: "#FEF2F2", label: { en: "Flagged", nl: "Gemarkeerd" }, icon: AlertTriangle },
};

function LedgerStatusBadge({ status }) {
  const cfg = statusConfig[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const lang = useLang();
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

/* ── Mini bar chart for monthly totals ── */
function MonthlyBarChart({ entries, budgetPerMonth }) {
  const monthTotals = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return entries
      .filter((e) => e.month === month)
      .reduce((sum, e) => sum + e.amount, 0);
  });
  const maxVal = Math.max(...monthTotals, budgetPerMonth || 1);
  const monthLabels = ["J","F","M","A","M","J","J","A","S","O","N","D"];

  return (
    <div className="flex items-end gap-1 h-[48px]">
      {monthTotals.map((val, i) => {
        const h = maxVal > 0 ? (val / maxVal) * 44 : 0;
        const overBudget = budgetPerMonth && val > budgetPerMonth * 1.15;
        return (
          <div key={i} className="flex flex-col items-center gap-1" style={{ width: 18 }}>
            <div
              className="w-3 rounded-lg transition-colors"
              style={{
                height: Math.max(2, h),
                background: overBudget ? brand.red : val > 0 ? brand.blue : "#E2E8F0",
              }}
            />
            <span className="text-[11px] text-slate-400">{monthLabels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Comparison bar chart: ledger vs consumption per month ── */
function ComparisonBarChart({ ledgerEntries, meterReadings, unitPrice, year }) {
  const monthLabels = ["J","F","M","A","M","J","J","A","S","O","N","D"];

  // Ledger totals per month
  const ledgerByMonth = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return ledgerEntries
      .filter((e) => e.month === month && e.year === year)
      .reduce((sum, e) => sum + e.amount, 0);
  });

  // Consumption costs per month (distributed evenly across year for now)
  const totalConsumption = meterReadings?.consumption || 0;
  const totalConsumptionCost = totalConsumption * (unitPrice || 0);
  const monthlyConsumptionCost = totalConsumptionCost / 12;
  const consumptionByMonth = Array.from({ length: 12 }, () => monthlyConsumptionCost);

  const maxVal = Math.max(...ledgerByMonth, ...consumptionByMonth, 1);

  return (
    <div className="flex items-end gap-1 h-[56px]">
      {ledgerByMonth.map((ledgerVal, i) => {
        const consVal = consumptionByMonth[i];
        const lH = maxVal > 0 ? (ledgerVal / maxVal) * 48 : 0;
        const cH = maxVal > 0 ? (consVal / maxVal) * 48 : 0;
        return (
          <div key={i} className="flex flex-col items-center gap-1" style={{ width: 28 }}>
            <div className="flex items-end gap-[2px]">
              <div
                className="w-[5px] rounded-lg"
                style={{
                  height: Math.max(2, lH),
                  background: brand.navy,
                  opacity: 0.7,
                }}
                title={`Ledger: €${Math.round(ledgerVal)}`}
              />
              <div
                className="w-[5px] rounded-lg"
                style={{
                  height: Math.max(2, cH),
                  background: brand.blue,
                  opacity: 0.5,
                }}
                title={`Consumption: €${Math.round(consVal)}`}
              />
            </div>
            <span className="text-[10px] text-slate-400">{monthLabels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Cost Category Meter Section: connect + reconciliation ── */
function CostCategoryMeterSection({ serviceId, buildingId, year, lang }) {
  const costCategories = useMemo(() => getCostCategoriesByService(serviceId), [serviceId]);
  const allBuildingMeters = useMemo(() => getMetersByBuilding(buildingId), [buildingId]);
  const mainMeters = useMemo(() => allBuildingMeters.filter((m) => m.type === "main"), [allBuildingMeters]);
  const { grouped, unassigned } = useMemo(
    () => getLedgerGroupedByCostCategory(serviceId, buildingId, year),
    [serviceId, buildingId, year]
  );

  const [connectingCatId, setConnectingCatId] = useState(null);
  const [expandedCatId, setExpandedCatId] = useState(null);
  const [, forceUpdate] = useState(0);

  const handleConnect = useCallback((costCategoryId, meterId) => {
    addMeterLink({ costCategoryId, meterId, buildingId: String(buildingId), serviceId });
    setConnectingCatId(null);
    forceUpdate((n) => n + 1);
  }, [buildingId, serviceId]);

  const handleDisconnect = useCallback((costCategoryId) => {
    removeMeterLink(costCategoryId, buildingId);
    forceUpdate((n) => n + 1);
  }, [buildingId]);

  if (costCategories.length === 0) return null;

  // Utility mapping: cost category unit → meter utility filter
  const unitToUtility = { "m³": ["water", "gas"], "kWh": ["electricity"], "GJ": ["heat"] };

  return (
    <div className="border-t border-slate-100">
      <div className="px-4 py-2 bg-slate-50/40 border-b border-slate-100">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {lang === "nl" ? "Kostensoorten" : "Cost Categories"}
        </span>
      </div>

      {costCategories.map((cc) => {
        const link = getMeterLink(cc.id, buildingId);
        const isMeterable = cc.unit && cc.unitPrice;
        const isConnecting = connectingCatId === cc.id;
        const isExpanded = expandedCatId === cc.id;
        const catEntries = grouped[cc.id] || [];
        const catTotal = catEntries.reduce((s, e) => s + e.amount, 0);

        // Find the linked meter object
        const linkedMeter = link ? mainMeters.find((m) => m.id === link.meterId) || allBuildingMeters.find((m) => m.id === link.meterId) : null;
        const meterReadings = linkedMeter?.readings?.[year] || linkedMeter?.readings?.[String(year)] || null;

        // Calculate consumption-based cost
        const consumption = meterReadings?.consumption || 0;
        const consumptionCostYTD = consumption * (cc.unitPrice || 0);

        // Calculate year-end expected
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(year, 0, 1)) / 86400000);
        const yearProgress = Math.max(0.01, Math.min(1, dayOfYear / 365));
        const isCurrentYear = year === now.getFullYear();
        const yearEndExpected = isCurrentYear ? consumptionCostYTD / yearProgress : consumptionCostYTD;

        // Variance
        const variance = catTotal > 0 && consumptionCostYTD > 0
          ? ((catTotal - consumptionCostYTD) / consumptionCostYTD) * 100
          : 0;
        const absVariance = Math.abs(variance);
        const varianceColor = absVariance > 20 ? brand.red : absVariance > 10 ? brand.amber : brand.subtle;

        // Available meters to connect (filtered by matching utility)
        const matchingMeters = isMeterable
          ? mainMeters.filter((m) => {
              const utilities = unitToUtility[cc.unit] || [];
              return utilities.includes(m.utility);
            })
          : [];

        return (
          <div key={cc.id} className="border-b border-slate-50 last:border-b-0">
            {/* Cost category row */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Expand toggle for connected categories */}
                {link && linkedMeter ? (
                  <button
                    onClick={() => setExpandedCatId(isExpanded ? null : cc.id)}
                    className="flex items-center justify-center w-4 shrink-0"
                  >
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-400" />
                      : <ChevronRight size={14} className="text-slate-400" />
                    }
                  </button>
                ) : (
                  <div className="w-4 shrink-0" />
                )}

                {/* Category info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate">{cc.name[lang] || cc.name.en}</span>
                    <span className="text-[11px] text-slate-400">{cc.supplier}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{Math.round(cc.budgetShare * 100)}%</span>
                    {cc.unit && cc.unitPrice && (
                      <>
                        <span className="text-slate-200">·</span>
                        <span>€{cc.unitPrice.toFixed(2)}/{cc.unit}</span>
                      </>
                    )}
                    <span className="text-slate-200">·</span>
                    <span>{cc.invoiceFrequency}</span>
                  </div>
                </div>

                {/* Meter connection state */}
                <div className="flex items-center gap-2 shrink-0">
                  {link && linkedMeter ? (
                    /* Connected state: show meter badge */
                    <div className="group relative flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
                        style={{ background: `${brand.blue}10`, color: brand.blue }}
                      >
                        <Zap size={12} />
                        {linkedMeter.meterNumber}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDisconnect(cc.id); }}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-red-50 transition-all"
                        title={lang === "nl" ? "Ontkoppelen" : "Disconnect"}
                      >
                        <Unlink size={12} className="text-red-400" />
                      </button>
                    </div>
                  ) : isMeterable && !isConnecting ? (
                    /* Unconnected + connectable: show connect button */
                    <button
                      onClick={() => setConnectingCatId(cc.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <Link2 size={12} />
                      {lang === "nl" ? "Koppel meter" : "Connect meter"}
                    </button>
                  ) : null}
                </div>

                {/* Ledger total for this category */}
                <div className="text-right shrink-0 min-w-[80px]">
                  <div className="text-xs font-medium tabular-nums" style={{ color: brand.navy }}>
                    {fmtEur(catTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {catEntries.length} {lang === "nl" ? "boekingen" : "entries"}
                  </div>
                </div>
              </div>

              {/* Inline meter selector */}
              {isConnecting && (
                <div className="mt-3 ml-7 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-slate-500">
                      {lang === "nl" ? "Selecteer hoofdmeter" : "Select main meter"}
                    </span>
                    <button
                      onClick={() => setConnectingCatId(null)}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-200 transition-colors"
                    >
                      <X size={12} className="text-slate-400" />
                    </button>
                  </div>
                  {matchingMeters.length > 0 ? (
                    <div className="space-y-1">
                      {matchingMeters.map((m) => {
                        const mReading = m.readings?.[year] || m.readings?.[String(year)];
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleConnect(cc.id, m.id)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                          >
                            <Zap size={14} style={{ color: brand.blue }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-700">{m.meterNumber}</div>
                              <div className="text-[11px] text-slate-400">{m.utility} · {m.unit}</div>
                            </div>
                            {mReading && (
                              <div className="text-right text-[11px] text-slate-400 tabular-nums">
                                {Math.round(mReading.consumption).toLocaleString("nl-NL")} {m.unit}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 py-2">
                      {lang === "nl"
                        ? "Geen overeenkomende hoofdmeters gevonden voor dit complex"
                        : "No matching main meters found for this building"}
                    </div>
                  )}
                </div>
              )}

              {/* Comparison strip: only when connected and has data */}
              {link && linkedMeter && consumptionCostYTD > 0 && (
                <div className="mt-3 ml-7 grid grid-cols-4 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">
                      {lang === "nl" ? "Grootboek (YTD)" : "Ledger (YTD)"}
                    </div>
                    <div className="text-xs font-medium tabular-nums" style={{ color: brand.navy }}>
                      {fmtEur(catTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">
                      {lang === "nl" ? "Verbruik (YTD)" : "Consumption (YTD)"}
                    </div>
                    <div className="text-xs font-medium tabular-nums" style={{ color: brand.blue }}>
                      {fmtEur(consumptionCostYTD)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">
                      {lang === "nl" ? "Verwacht jaareinde" : "Year-End Expected"}
                    </div>
                    <div className="text-xs font-medium tabular-nums text-slate-600">
                      {fmtEur(yearEndExpected)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">
                      {lang === "nl" ? "Afwijking" : "Variance"}
                    </div>
                    <div
                      className="text-xs font-medium tabular-nums"
                      style={{ color: varianceColor }}
                    >
                      {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Connected but no consumption data */}
              {link && linkedMeter && consumptionCostYTD === 0 && (
                <div className="mt-2 ml-7 text-[11px] text-slate-400">
                  {lang === "nl"
                    ? `Geen verbruiksdata voor ${year}`
                    : `No consumption data for ${year}`}
                </div>
              )}
            </div>

            {/* Expanded: monthly comparison chart */}
            {isExpanded && link && linkedMeter && (
              <div className="mx-4 mb-3 ml-11 p-3 rounded-lg border border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={12} className="text-slate-400" />
                  <span className="text-[11px] font-medium text-slate-500">
                    {lang === "nl" ? "Maandvergelijking" : "Monthly Comparison"}
                  </span>
                  <span className="text-[10px] text-slate-300 ml-auto flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: brand.navy, opacity: 0.7 }} />
                    {lang === "nl" ? "Grootboek" : "Ledger"}
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: brand.blue, opacity: 0.5 }} />
                    {lang === "nl" ? "Verbruik" : "Consumption"}
                  </span>
                </div>
                <ComparisonBarChart
                  ledgerEntries={catEntries}
                  meterReadings={meterReadings}
                  unitPrice={cc.unitPrice}
                  year={year}
                />
                {/* Consumption detail */}
                {meterReadings && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
                    <span>
                      {lang === "nl" ? "Verbruik" : "Consumption"}: <span className="font-medium text-slate-600 tabular-nums">{Math.round(consumption).toLocaleString("nl-NL")} {linkedMeter.unit}</span>
                    </span>
                    <span className="text-slate-200">·</span>
                    <span>
                      {lang === "nl" ? "Tarief" : "Rate"}: <span className="font-medium text-slate-600 tabular-nums">€{cc.unitPrice.toFixed(2)}/{cc.unit}</span>
                    </span>
                    <span className="text-slate-200">·</span>
                    <span>
                      {lang === "nl" ? "Verwachte kosten" : "Expected cost"}: <span className="font-medium text-slate-600 tabular-nums">{fmtEur(consumptionCostYTD)}</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned entries */}
      {unassigned.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100">
          <div className="flex items-center gap-3 ml-4">
            <div className="flex-1">
              <span className="text-xs text-slate-400 italic">
                {lang === "nl" ? "Niet toegewezen" : "Unassigned"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium tabular-nums text-slate-500">
                {fmtEur(unassigned.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Settlement status labels ── */
const settlementStatusLabels = {
  monitoring:  { en: "Monitoring", nl: "Monitoring" },
  in_review:   { en: "In review", nl: "In controle" },
  approved:    { en: "Approved", nl: "Goedgekeurd" },
  distributed: { en: "Distributed", nl: "Afgerekend" },
};
const settlementStatusColors = {
  monitoring: "#94A3B8",
  in_review: "#F59E0B",
  approved: "#3EB1C8",
  distributed: "#3EB1C8",
};

/* ── Utility config for energy view ── */
const utilityConfig = {
  heat: { label: { en: "Heat", nl: "Warmte" }, unit: "GJ", color: "#EF4444" },
  gas: { label: { en: "Gas", nl: "Gas" }, unit: "m³", color: "#F59E0B" },
  water: { label: { en: "Water", nl: "Water" }, unit: "m³", color: "#3B82F6" },
  warmWater: { label: { en: "Warm Water", nl: "Warm Water" }, unit: "m³", color: "#8B5CF6" },
  electricity: { label: { en: "Electricity", nl: "Elektriciteit" }, unit: "kWh", color: "#F59E0B" },
};

/* ── Main component ── */
export default function ServiceDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const lang = useLang();
  const { data: orgData, orgId } = useOrg();

  const service = orgData.services.find((s) => s.id === serviceId);
  const category = orgData.serviceCategories.find((c) => c.id === service?.category);

  const hasLedger = isFeatureEnabled("ledger");
  const availableYears = [2024, 2025];
  const [year, setYear] = useState(() => {
    const currentYear = new Date().getFullYear();
    if (availableYears.includes(currentYear)) return currentYear;
    return availableYears.length > 0 ? availableYears[availableYears.length - 1] : 2025;
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedBuilding, setExpandedBuilding] = useState(null);

  // ── Energy mode: building-service rows from buildingServices ──
  const energyBuildingRows = useMemo(() => {
    if (hasLedger) return [];
    const bsList = getBuildingServicesByService(serviceId, year);
    return bsList
      .map((bs) => {
        const bld = orgData.buildings.find((b) => b.id === bs.buildingId);
        if (!bld) return null;
        // Get meters for this building matching this service's utility
        const util = service?.utility;
        const allBuildingMeters = getMetersByBuilding(bs.buildingId);
        const serviceMeters = util
          ? allBuildingMeters.filter((m) => m.utility === util && !m.dismounted)
          : allBuildingMeters.filter((m) => !m.dismounted);
        const mainMeters = serviceMeters.filter((m) => m.type === "main");
        const subMeters = serviceMeters.filter((m) => m.type === "sub");
        // Heating season info
        const seasons = getHeatingSeasonsByBuilding(bs.buildingId);
        const currentSeason = seasons.find((s) => s.yearKey === year);
        return {
          bs,
          building: bld,
          mainMeters,
          subMeters,
          meterCount: serviceMeters.length,
          budget: bs.budget || 0,
          actual: bs.actual || 0,
          variance: (bs.actual || 0) - (bs.budget || 0),
          variancePct: bs.budget > 0 ? (((bs.actual || 0) - (bs.budget || 0)) / bs.budget) * 100 : 0,
          season: currentSeason,
          yearLabel: bs.yearLabel,
        };
      })
      .filter(Boolean)
      .filter((row) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          row.building.complex.toLowerCase().includes(q) ||
          row.building.complexId?.toLowerCase().includes(q) ||
          row.building.location?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.meterCount - a.meterCount);
  }, [serviceId, year, search, hasLedger, orgData, service]);

  // ── Ledger mode: original data ──
  const allEntries = useMemo(() => hasLedger ? getLedgerByService(serviceId, year) : [], [serviceId, year, hasLedger]);
  const summary = useMemo(() => hasLedger ? getLedgerSummaryByService(serviceId, year) : {}, [serviceId, year, hasLedger]);

  const buildingRows = useMemo(() => {
    if (!hasLedger) return [];
    return Object.entries(summary)
      .map(([bldId, data]) => {
        const bld = orgData.buildings.find((b) => b.id === bldId);
        if (!bld) return null;
        const budgetForService = (service?.avgCostPerVhe || 0) * bld.vhe;
        const variance = data.total - budgetForService;
        const variancePct = budgetForService > 0 ? (variance / budgetForService) * 100 : 0;
        return {
          ...data,
          building: bld,
          budgetForService,
          variance,
          variancePct,
        };
      })
      .filter(Boolean)
      .filter((row) => {
        if (statusFilter === "flagged") return row.flagged > 0;
        if (statusFilter === "pending") return row.pending > 0;
        if (statusFilter === "issues") return row.flagged > 0 || row.pending > 0 || Math.abs(row.variancePct) > 15;
        return true;
      })
      .filter((row) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          row.building.complex.toLowerCase().includes(q) ||
          row.building.complexId.toLowerCase().includes(q) ||
          row.building.location.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aIssues = a.flagged + a.pending;
        const bIssues = b.flagged + b.pending;
        if (aIssues !== bIssues) return bIssues - aIssues;
        return b.total - a.total;
      });
  }, [summary, statusFilter, search, service, orgData, hasLedger]);

  // Totals (ledger mode)
  const totalBooked = allEntries.reduce((s, e) => s + e.amount, 0);
  const totalBudget = buildingRows.reduce((s, r) => s + r.budgetForService, 0);
  const totalFlagged = allEntries.filter((e) => e.status === "flagged").length;
  const totalPending = allEntries.filter((e) => e.status === "pending").length;
  const completeness = allEntries.length > 0 ? Math.round(
    (allEntries.filter((e) => e.status === "booked").length / allEntries.length) * 100
  ) : 0;

  // Totals (energy mode)
  const energyTotalBudget = energyBuildingRows.reduce((s, r) => s + r.budget, 0);
  const energyTotalActual = energyBuildingRows.reduce((s, r) => s + r.actual, 0);
  const energyTotalMeters = energyBuildingRows.reduce((s, r) => s + r.meterCount, 0);
  const energyMainMeters = energyBuildingRows.reduce((s, r) => s + r.mainMeters.length, 0);

  if (!service) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        Service not found
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* ── Back + Title ── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(`/${orgId}/services`)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={16} className="text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-mono text-slate-400">{service.code}</span>
              {category && (
                <span
                  className="text-[11px] font-medium px-2 py-1 rounded-full"
                  style={{ background: "#F1F5F9", color: brand.subtle }}
                >
                  {category.label[lang]}
                </span>
              )}
            </div>
            <h1 className="text-lg font-semibold truncate" style={{ color: brand.navy }}>
              {service.name[lang] || service.name.en}
            </h1>
          </div>
          {/* Year selector */}
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 h-7 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                  year === y
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Settlement context strip removed — not a current use case */}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ENERGY MODE — building-service overview with meters */}
        {/* ═══════════════════════════════════════════════════ */}
        {!hasLedger ? (
          <>
            {/* Energy summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                {
                  label: { en: "Buildings", nl: "Complexen" },
                  value: energyBuildingRows.length,
                  sub: lang === "nl" ? "Actieve complexen" : "Active complexes",
                  color: brand.navy,
                },
                {
                  label: { en: "Total Budget", nl: "Totaal budget" },
                  value: fmtEur(energyTotalBudget),
                  sub: `${lang === "nl" ? "Verwacht" : "Expected"}: ${fmtEur(energyTotalActual)}`,
                  color: brand.navy,
                },
                {
                  label: { en: "Variance", nl: "Afwijking" },
                  value: fmtEur(energyTotalActual - energyTotalBudget),
                  sub: energyTotalBudget > 0 ? `${(((energyTotalActual - energyTotalBudget) / energyTotalBudget) * 100).toFixed(1)}% · ${lang === "nl" ? "prognose" : "forecast"}` : "—",
                  color: energyTotalActual > energyTotalBudget ? brand.red : brand.blue,
                },
                {
                  label: { en: "Meters", nl: "Meters" },
                  value: energyTotalMeters,
                  sub: `${energyMainMeters} ${lang === "nl" ? "hoofdmeters" : "main meters"}`,
                  color: brand.blue,
                },
              ].map((card, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500 font-medium mb-1">{card.label[lang]}</div>
                  <div className="text-base font-semibold tabular-nums" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`${t("search", lang)} ${lang === "nl" ? "complexen" : "complexes"}...`}
                  className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3EB1C8]/30 focus:border-[#3EB1C8] transition-colors"
                />
              </div>
              <span className="text-xs text-slate-400 ml-auto">
                {energyBuildingRows.length} {lang === "nl" ? "complexen" : "complexes"}
              </span>
            </div>

            {/* Energy building rows */}
            <div className="space-y-2">
              {energyBuildingRows.map((row) => {
                const isExpanded = expandedBuilding === row.building.id;
                const utilCfg = utilityConfig[service.utility] || { label: { en: service.utility, nl: service.utility }, unit: "", color: "#64748B" };

                return (
                  <div
                    key={row.building.id}
                    className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedBuilding(isExpanded ? null : row.building.id)}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-center justify-center w-5">
                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400 shrink-0" />
                          <span className="text-sm font-medium truncate" style={{ color: brand.navy }}>{row.building.complex}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">{row.building.complexId}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 pl-5">
                          {row.building.location} · {row.building.vhe} VHE · {row.meterCount} {lang === "nl" ? "meters" : "meters"}
                          {row.yearLabel && row.yearLabel !== String(year) ? ` · ${lang === "nl" ? "Seizoen" : "Season"} ${row.yearLabel}` : ""}
                        </div>
                      </div>
                      {/* Meter counts */}
                      <div className="hidden sm:flex items-center gap-3 shrink-0 text-[11px]">
                        {row.mainMeters.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium" style={{ background: `${utilCfg.color}10`, color: utilCfg.color }}>
                            {row.mainMeters.length} {lang === "nl" ? "hoofd" : "main"}
                          </span>
                        )}
                        <span className="text-slate-400">{row.subMeters.length} sub</span>
                      </div>
                      {/* Expected cost */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums" style={{ color: brand.navy }}>
                          {fmtEur(row.actual)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {lang === "nl" ? "verwacht" : "expected"}
                        </div>
                        {row.budget > 0 && (
                          <div
                            className="text-[11px] tabular-nums flex items-center justify-end gap-1"
                            style={{ color: row.variance > 0 ? brand.red : brand.blue }}
                          >
                            {row.variance > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {row.variancePct > 0 ? "+" : ""}{row.variancePct.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expanded: meter details */}
                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        {/* Main meters */}
                        {row.mainMeters.length > 0 && (
                          <div className="px-4 py-3 border-b border-slate-50">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                              {lang === "nl" ? "Hoofdmeters" : "Main Meters"}
                            </p>
                            <div className="space-y-2">
                              {row.mainMeters.map((m) => (
                                <div key={m.id} className="flex items-center gap-3 text-xs">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: utilCfg.color }} />
                                  <span className="font-mono text-slate-500 min-w-[120px]">{m.meterNumber}</span>
                                  <span className="text-slate-400">{m.meterType}</span>
                                  <span className="ml-auto font-medium text-slate-600">{m.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Sub meter summary */}
                        {row.subMeters.length > 0 && (
                          <div className="px-4 py-3 border-b border-slate-50">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              {lang === "nl" ? "Submeters" : "Sub Meters"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {row.subMeters.length} {lang === "nl" ? "actieve submeters" : "active sub meters"}
                              {(() => {
                                const types = {};
                                for (const m of row.subMeters) { types[m.meterType] = (types[m.meterType] || 0) + 1; }
                                return ` (${Object.entries(types).map(([k, v]) => `${v}× ${k}`).join(", ")})`;
                              })()}
                            </p>
                          </div>
                        )}
                        {/* Season info */}
                        {row.season && (
                          <div className="px-4 py-3 border-b border-slate-50">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              {lang === "nl" ? "Stookseizoen" : "Heating Season"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(row.season.seasonStart).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                              {" – "}
                              {new Date(row.season.seasonEnd).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          </div>
                        )}
                        {/* Consumption progress — uses service-level data from bs.consumption */}
                        {row.bs.consumption && row.bs.consumption.ytdConsumption != null && row.bs.consumption.unitPrice > 0 && (() => {
                          const cons = row.bs.consumption;
                          const fmtNum = (n) => Math.round(n).toLocaleString("nl-NL");

                          // Season progress
                          const now = new Date();
                          const start = new Date(row.bs.seasonStart);
                          const end = new Date(row.bs.seasonEnd);
                          const totalDays = Math.max(1, (end - start) / 86400000);
                          const elapsedDays = Math.max(0, Math.min(totalDays, (now - start) / 86400000));
                          const seasonPct = Math.round((elapsedDays / totalDays) * 100);

                          const consPct = cons.endConsumption > 0 ? Math.round((cons.ytdConsumption / cons.endConsumption) * 100) : 0;
                          const consAhead = consPct > seasonPct + 10;
                          const consOver = consPct > 100;
                          const barCol = consOver ? "#DC2626" : "#64748B";

                          return (
                            <div className="px-4 py-3 border-b border-slate-50">
                              {/* Header with meter reference — muted */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                  <Gauge size={12} className="text-slate-400" />
                                  <span>{lang === "nl" ? "Verbruik" : "Consumption"}</span>
                                  {cons.mainMeterNumber && (
                                    <span>· {cons.mainMeterNumber}{cons.allocationShare < 1 && ` (${Math.round(cons.allocationShare * 100)}%)`}</span>
                                  )}
                                </div>
                                {consOver && <span className="text-[10px] text-red-600 font-medium">{lang === "nl" ? "Boven verwachting" : "Above expected"}</span>}
                                {!consOver && consAhead && <span className="text-[10px] text-slate-500">{lang === "nl" ? "Voor op schema" : "Ahead of pace"}</span>}
                              </div>

                              {/* Main consumption display */}
                              <div className="flex items-baseline gap-2 mb-1.5">
                                <span className="text-sm font-medium tabular-nums text-slate-700">
                                  {fmtNum(cons.ytdConsumption)} {cons.unit}
                                </span>
                                <span className="text-[11px] text-slate-400 tabular-nums">
                                  → {fmtEur2(cons.ytdCost)}
                                </span>
                              </div>

                              {/* Progress bar with pace marker */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="flex-1 h-[4px] rounded-full bg-slate-100 overflow-hidden relative">
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(consPct, 100)}%`, background: barCol }} />
                                  {seasonPct > 0 && seasonPct < 100 && (
                                    <div className="absolute top-[-1.5px] w-[1.5px] h-[7px] rounded-full bg-slate-300" style={{ left: `${seasonPct}%` }} />
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{consPct}%</span>
                              </div>

                              {/* End-of-year projection + rate */}
                              <div className="text-[11px] text-slate-400">
                                {lang === "nl" ? "Verwacht" : "Expected"}: {fmtNum(cons.endConsumption)} {cons.unit} → {fmtEur2(cons.endCost)}
                                {cons.unitPrice > 0 && <span className="text-slate-300 ml-2">€{cons.unitPrice.toFixed(2)}/{cons.unit}</span>}
                              </div>

                              {/* Tenant impact */}
                              {cons.avgAdvance > 0 && (
                                <div className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                                  <span>{lang === "nl" ? "Gem. voorschot" : "Avg. advance"}: <span className="font-medium text-slate-600">{fmtEur2(cons.avgAdvance)}/{lang === "nl" ? "mnd" : "mo"}</span></span>
                                  {cons.endDebtorRisk > 0 && (
                                    <>
                                      <span className="text-slate-200">·</span>
                                      <span className="text-slate-500">{lang === "nl" ? "Debiteurrisico" : "Debtor risk"}: {fmtEur(cons.endDebtorRisk)}</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* View building */}
                        <div className="px-4 py-3 bg-slate-50/30">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/${orgId}/buildings/${row.building.id}`); }}
                            className="text-xs font-medium hover:underline transition-colors"
                            style={{ color: brand.blue }}
                          >
                            {lang === "nl" ? `Bekijk ${row.building.complex} →` : `View ${row.building.complex} →`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {energyBuildingRows.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                  {t("noResults", lang)}
                </div>
              )}
            </div>
          </>
        ) : (
        <>
        {/* ═══════════════════════════════════════════════════ */}
        {/* LEDGER MODE — original summary + ledger entries    */}
        {/* ═══════════════════════════════════════════════════ */}

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            {
              label: { en: "Total Booked", nl: "Totaal geboekt" },
              value: fmtEur(totalBooked),
              sub: `${lang === "nl" ? "Budget" : "Budget"}: ${fmtEur(totalBudget)}`,
              color: brand.navy,
            },
            {
              label: { en: "Variance", nl: "Afwijking" },
              value: fmtEur(totalBooked - totalBudget),
              sub: `${totalBudget > 0 ? (((totalBooked - totalBudget) / totalBudget) * 100).toFixed(1) : 0}%`,
              color: totalBooked > totalBudget ? brand.red : brand.blue,
            },
            {
              label: { en: "Completeness", nl: "Volledigheid" },
              value: `${completeness}%`,
              sub: `${allEntries.length} ${lang === "nl" ? "boekingen" : "entries"}`,
              color: completeness >= 90 ? brand.blue : completeness >= 70 ? brand.amber : brand.red,
            },
          ].map((card, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="text-[11px] text-slate-500 font-medium mb-1">
                {card.label[lang]}
              </div>
              <div
                className="text-base font-semibold tabular-nums"
                style={{ color: card.color }}
              >
                {card.value}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Monthly overview all complexes bar removed */}

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t("search", lang)} ${lang === "nl" ? "complexen" : "complexes"}...`}
              className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3EB1C8]/30 focus:border-[#3EB1C8] transition-colors"
            />
          </div>

          <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
            {[
              { value: "all", label: { en: "All", nl: "Alle" } },
              { value: "issues", label: { en: "Issues", nl: "Aandachtspunten" } },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 h-7 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === f.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f.label[lang]}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 ml-auto">
            {buildingRows.length} {lang === "nl" ? "complexen" : "complexes"}
          </span>
        </div>

        {/* ── Building ledger rows ── */}
        <div className="space-y-2">
          {buildingRows.map((row) => {
            const isExpanded = expandedBuilding === row.building.id;
            const entries = isExpanded
              ? allEntries
                  .filter((e) => e.buildingId === row.building.id)
                  .sort((a, b) => b.date.localeCompare(a.date))
              : [];
            return (
              <div
                key={row.building.id}
                className="rounded-lg border border-slate-200 bg-white overflow-hidden transition-colors"
              >
                {/* Building summary row */}
                <button
                  onClick={() =>
                    setExpandedBuilding(isExpanded ? null : row.building.id)
                  }
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center justify-center w-5">
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={14} className="text-slate-400" />
                    )}
                  </div>

                  {/* Building info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400 shrink-0" />
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: brand.navy }}
                      >
                        {row.building.complex}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {row.building.complexId}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 pl-5">
                      {row.building.location} · {row.building.vhe} VHE · {row.count}{" "}
                      {lang === "nl" ? "boekingen" : "entries"}
                    </div>
                  </div>

                  {/* Status indicators removed */}

                  {/* Amounts */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums" style={{ color: brand.navy }}>
                      {fmtEur(row.total)}
                    </div>
                    <div
                      className="text-[11px] tabular-nums flex items-center justify-end gap-1"
                      style={{ color: row.variance > 0 ? brand.red : brand.blue }}
                    >
                      {row.variance > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {row.variancePct > 0 ? "+" : ""}
                      {row.variancePct.toFixed(1)}%
                    </div>
                  </div>
                </button>

                {/* Expanded: ledger entries */}
                {isExpanded && (
                  <div className="border-t border-slate-100">

                    {/* Cost Categories with Meter Connection */}
                    {isFeatureEnabled("consumption") && (
                      <CostCategoryMeterSection
                        serviceId={serviceId}
                        buildingId={row.building.id}
                        year={year}
                        lang={lang}
                      />
                    )}

                    {/* Entry table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50/60 border-b border-slate-100">
                            <th className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 text-left">
                              {t("date", lang)}
                            </th>
                            <th className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 text-left">
                              {t("description", lang)}
                            </th>
                            <th className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 text-left hidden lg:table-cell">
                              {t("supplier", lang)}
                            </th>
                            <th className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 text-left hidden md:table-cell">
                              {lang === "nl" ? "Factuur" : "Invoice"}
                            </th>
                            <th className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 text-right">
                              {lang === "nl" ? "Bedrag" : "Amount"}
                            </th>
                            <th className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-2 text-center">
                              {t("status", lang)}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {entries.map((entry) => (
                            <tr
                              key={entry.id}
                              className="hover:bg-slate-50/40 transition-colors"
                              style={
                                entry.status === "flagged"
                                  ? { background: "#FFFBEB40" }
                                  : {}
                              }
                            >
                              <td className="px-4 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                                {fmtDate(entry.date)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs text-slate-700">
                                  {entry.description}
                                </div>
                                {entry.flag && (
                                  <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: brand.red }}>
                                    <AlertTriangle size={14} />
                                    {entry.flag[lang] || entry.flag.en}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                                {entry.supplier || "—"}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-mono text-slate-400 hidden md:table-cell">
                                {entry.invoiceRef}
                              </td>
                              <td className="px-4 py-3 text-right text-xs font-medium tabular-nums" style={{ color: brand.navy }}>
                                {fmtEur2(entry.amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <LedgerStatusBadge status={entry.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-50/60">
                            <td
                              colSpan={4}
                              className="px-4 py-3 text-xs font-semibold text-slate-500"
                            >
                              {lang === "nl" ? "Totaal" : "Total"} ·{" "}
                              <span className="font-normal text-slate-400">
                                {lang === "nl" ? "Budget" : "Budget"}:{" "}
                                {fmtEur(row.budgetForService)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums" style={{ color: brand.navy }}>
                              {fmtEur2(row.total)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* View building detail link */}
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/30">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/${orgId}/buildings/${row.building.id}`);
                        }}
                        className="text-xs font-medium hover:underline transition-colors"
                        style={{ color: brand.blue }}
                      >
                        {lang === "nl"
                          ? `Bekijk ${row.building.complex} →`
                          : `View ${row.building.complex} →`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {buildingRows.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
              {t("noResults", lang)}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
