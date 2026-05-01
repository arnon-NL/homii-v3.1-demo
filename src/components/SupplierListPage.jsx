import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Truck,
  Zap,
  Wrench,
  Sparkles,
  HardHat,
  Gauge,
  ChevronRight,
  LayoutGrid,
  List,
  Building2,
  Star,
  Calendar,
  Phone,
  Mail,
  ExternalLink,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { getSupplierCategories, getServices } from "@/lib/mockData";
import { useOrg } from "@/lib/OrgContext";
import { t, useLang } from "@/lib/i18n";
import { StatusBadge } from "./ui/status-badge";

/* ── Category icon + color config ── */
const categoryConfig = {
  energy:        { icon: Zap,     color: "#64748B", bg: "#F8FAFC" },
  installations: { icon: Wrench,  color: "#64748B", bg: "#F8FAFC" },
  cleaning:      { icon: Sparkles, color: "#64748B", bg: "#F8FAFC" },
  metering:      { icon: Gauge,   color: "#64748B", bg: "#F8FAFC" },
  management:    { icon: HardHat, color: "#64748B", bg: "#F8FAFC" },
};

function CategoryBadge({ categoryId, lang }) {
  const cfg = categoryConfig[categoryId];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const cat = getSupplierCategories().find((c) => c.id === categoryId);
  return (
    <div
      className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon size={14} />
      {cat?.label[lang] || categoryId}
    </div>
  );
}

/* ── Star rating ── */
function StarRating({ value, max = 5 }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < value ? "#F59E0B" : "none"}
          stroke={i < value ? "#F59E0B" : "#CBD5E1"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

/* ── Service chip list ── */
function ServiceChips({ serviceIds, lang, max = 3 }) {
  const matched = serviceIds
    .map((sid) => getServices().find((s) => s.id === sid))
    .filter(Boolean);
  const shown = matched.slice(0, max);
  const remaining = matched.length - max;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((s) => (
        <span
          key={s.id}
          className="text-[11px] font-medium px-2 py-1 rounded bg-slate-100 text-slate-600 truncate max-w-[140px]"
          title={s.name[lang] || s.name.en}
        >
          {s.code}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-[11px] text-slate-400 font-medium">
          +{remaining}
        </span>
      )}
    </div>
  );
}

/* ── Status mapping ── */
function supplierStatus(s) {
  if (s.status === "expiring") return { status: "warning", label: { en: "Expiring", nl: "Verloopt" } };
  if (s.status === "inactive") return { status: "neutral", label: { en: "Inactive", nl: "Inactief" } };
  return { status: "active", label: { en: "Active", nl: "Actief" } };
}

/* ── Format currency ── */
const fmt = (v) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

/* ── Main component ── */
export default function SupplierListPage() {
  const lang = useLang();
  const navigate = useNavigate();
  const { data, orgId } = useOrg();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grouped");

  // Guard: if no suppliers data, show empty state
  if (!data.suppliers || data.suppliers.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <h1 className="text-xl font-semibold mb-6" style={{ color: brand.navy }}>
            {t("suppliersTitle", lang)}
          </h1>
          <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
            <Truck size={32} className="mb-3 text-slate-300" />
            <p className="text-sm">
              {lang === "nl" ? "Geen leveranciers beschikbaar voor deze organisatie" : "No suppliers available for this organization"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const categoryFilters = useMemo(() => [
    { value: "all", label: { en: "All", nl: "Alle" } },
    ...data.supplierCategories.map((c) => ({ value: c.id, label: c.label })),
  ], [data.supplierCategories]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.suppliers.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.kvk.includes(q) ||
        s.serviceIds.some((sid) => {
          const svc = getServices().find((sv) => sv.id === sid);
          return svc && ((svc.name[lang] || svc.name.en).toLowerCase().includes(q) || svc.code.toLowerCase().includes(q));
        });
      const matchCategory =
        categoryFilter === "all" || s.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [search, categoryFilter, lang, data.suppliers]);

  const grouped = useMemo(() => {
    return data.supplierCategories
      .map((cat) => ({
        ...cat,
        suppliers: filtered.filter((s) => s.category === cat.id),
      }))
      .filter((g) => g.suppliers.length > 0);
  }, [filtered, data.supplierCategories]);

  const totalAnnualSpend = useMemo(
    () => filtered.reduce((sum, s) => sum + s.annualSpend, 0),
    [filtered]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Title + count + view toggle */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold" style={{ color: brand.navy }}>
              {t("suppliersTitle", lang)}
            </h1>
            <span className="text-sm text-slate-400">{filtered.length}</span>
          </div>
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode("grouped")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grouped"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title={lang === "nl" ? "Gegroepeerd" : "Grouped"}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "flat"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title={lang === "nl" ? "Tabel" : "Table"}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-slate-400" />
            <span className="font-medium" style={{ color: brand.navy }}>
              {filtered.length}
            </span>
            {lang === "nl" ? "leveranciers" : "suppliers"}
          </div>
          <span className="w-px h-3.5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-slate-400" />
            <span className="font-medium" style={{ color: brand.navy }}>
              {fmt(totalAnnualSpend)}
            </span>
            {lang === "nl" ? "jaaromzet" : "annual spend"}
          </div>
        </div>

        {/* Search & filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t("search", lang)}...`}
              className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3EB1C8]/30 focus:border-[#3EB1C8] transition-colors"
            />
          </div>
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 overflow-x-auto max-w-full">
            {categoryFilters.map((f) => {
              const cfg = categoryConfig[f.value];
              const Icon = cfg?.icon;
              return (
                <button
                  key={f.value}
                  onClick={() => setCategoryFilter(f.value)}
                  className={`flex items-center gap-2 px-3 h-7 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    categoryFilter === f.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {Icon && <Icon size={14} />}
                  <span className="hidden sm:inline">
                    {f.label[lang] || f.label.en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ GROUPED VIEW ═══ */}
        {viewMode === "grouped" && (
          <div className="space-y-6">
            {grouped.map((group) => {
              const cfg = categoryConfig[group.id];
              const GroupIcon = cfg?.icon || Truck;
              return (
                <div key={group.id}>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: cfg?.bg, color: cfg?.color }}
                    >
                      <GroupIcon size={14} />
                    </div>
                    <h2
                      className="text-sm font-semibold"
                      style={{ color: brand.navy }}
                    >
                      {group.label[lang] || group.label.en}
                    </h2>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {group.suppliers.length}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {group.suppliers.map((sup) => {
                      const st = supplierStatus(sup);
                      return (
                        <button
                          key={sup.id}
                          onClick={() => navigate(`/${orgId}/suppliers/${sup.id}`)}
                          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm font-medium truncate"
                                style={{ color: brand.navy }}
                              >
                                {sup.name}
                              </span>
                              <StatusBadge
                                status={st.status}
                                label={st.label[lang]}
                                size="xs"
                              />
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[11px] text-slate-400">
                                {sup.city}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                KVK {sup.kvk}
                              </span>
                            </div>
                          </div>

                          <div className="hidden md:flex items-center gap-4 shrink-0">
                            <ServiceChips serviceIds={sup.serviceIds} lang={lang} max={2} />
                            <span className="text-xs tabular-nums text-slate-500">
                              {sup.buildingCount} {lang === "nl" ? "geb." : "bldg."}
                            </span>
                            <span className="text-xs tabular-nums text-slate-600 font-medium w-[80px] text-right">
                              {fmt(sup.annualSpend)}
                            </span>
                            <StarRating value={sup.rating} />
                          </div>

                          <ChevronRight
                            size={14}
                            className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {grouped.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                {t("noResults", lang)}
              </div>
            )}
          </div>
        )}

        {/* ═══ FLAT TABLE VIEW ═══ */}
        {viewMode === "flat" && (
          <>
            {/* Mobile card view */}
            <div className="block md:hidden space-y-3">
              {filtered.map((sup) => {
                const st = supplierStatus(sup);
                return (
                  <button
                    key={sup.id}
                    onClick={() => navigate(`/${orgId}/suppliers/${sup.id}`)}
                    className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-[#3EB1C8] hover:shadow-md transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: brand.navy }}>
                          {sup.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{sup.city} · KVK {sup.kvk}</div>
                      </div>
                      <StatusBadge status={st.status} label={st.label[lang]} size="xs" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <CategoryBadge categoryId={sup.category} lang={lang} />
                      <StarRating value={sup.rating} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[11px] text-slate-400">
                        {sup.buildingCount} {t("buildings", lang).toLowerCase()}
                      </span>
                      <span className="w-px h-3 bg-slate-200" />
                      <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                        {fmt(sup.annualSpend)} / {lang === "nl" ? "jaar" : "yr"}
                      </span>
                      <span className="w-px h-3 bg-slate-200" />
                      <span className="text-[11px] text-slate-400">
                        {sup.serviceIds.length} {t("services", lang).toLowerCase()}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  {t("noResults", lang)}
                </div>
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    {[
                      { key: "supplier", align: "left" },
                      { key: "category", align: "left" },
                      { key: "city", align: "left" },
                      { key: "supplierServices", align: "left" },
                      { key: "buildingCount", align: "right" },
                      { key: "annualSpend", align: "right" },
                      { key: "rating", align: "center" },
                      { key: "contractEnd", align: "center" },
                      { key: "status", align: "center" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 sm:px-4 py-3 text-${col.align} whitespace-nowrap`}
                      >
                        {t(col.key, lang)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((sup) => {
                    const cfg = categoryConfig[sup.category];
                    const Icon = cfg?.icon || Truck;
                    const st = supplierStatus(sup);
                    return (
                      <tr
                        key={sup.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => navigate(`/${orgId}/suppliers/${sup.id}`)}
                      >
                        <td className="px-3 sm:px-4 py-3 max-w-[260px]">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: cfg?.bg || "#F1F5F9" }}
                            >
                              <Icon size={14} style={{ color: cfg?.color || brand.muted }} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate" style={{ color: brand.navy }}>
                                {sup.name}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                KVK {sup.kvk}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <CategoryBadge categoryId={sup.category} lang={lang} />
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <span className="text-xs text-slate-600">{sup.city}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <ServiceChips serviceIds={sup.serviceIds} lang={lang} max={3} />
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <span className="text-sm font-semibold tabular-nums text-slate-700">
                            {sup.buildingCount}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <span className="text-sm tabular-nums text-slate-600">
                            {fmt(sup.annualSpend)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <StarRating value={sup.rating} />
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <span className={`text-[11px] tabular-nums ${
                            sup.contractEnd
                              ? new Date(sup.contractEnd) < new Date("2025-06-01")
                                ? "text-amber-600 font-medium"
                                : "text-slate-500"
                              : "text-slate-400 italic"
                          }`}>
                            {sup.contractEnd
                              ? new Date(sup.contractEnd).toLocaleDateString("nl-NL", { month: "short", year: "numeric" })
                              : lang === "nl" ? "doorlopend" : "ongoing"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <StatusBadge status={st.status} label={st.label[lang]} size="xs" />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 sm:px-4 py-8 text-center text-sm text-slate-400">
                        {t("noResults", lang)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
