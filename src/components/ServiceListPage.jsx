import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Wrench,
  Zap,
  Sparkles,
  HardHat,
  FolderOpen,
  ChevronRight,
  LayoutGrid,
  List,
  ExternalLink,
  Building2,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { getServicesByCategory, getServiceCategories } from "@/lib/mockData";
import { t, useLang } from "@/lib/i18n";
import { useOrg } from "@/lib/OrgContext";
import { StatusBadge } from "./ui/status-badge";

/* ── Category icon + color config ── */
const categoryConfig = {
  energy:        { icon: Zap,        color: "#64748B", bg: "#F8FAFC" },
  installations: { icon: Wrench,     color: "#64748B", bg: "#F8FAFC" },
  cleaning:      { icon: Sparkles,   color: "#64748B", bg: "#F8FAFC" },
  management:    { icon: HardHat,    color: "#64748B", bg: "#F8FAFC" },
  other:         { icon: FolderOpen, color: "#64748B", bg: "#F8FAFC" },
};

function CategoryBadge({ categoryId, lang }) {
  const cfg = categoryConfig[categoryId];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const cat = getServiceCategories().find((c) => c.id === categoryId);
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

/* ── Metered / Variable indicator ── */
function BoolDot({ value }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: value ? brand.blue : brand.muted }}
    />
  );
}

/* ── Kostenverdeler supplier badge ── */
function SupplierChip({ name }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
      {name}
    </span>
  );
}

/* ── Service row (shared between external & internal grouped views) ── */
function ServiceRow({ s, lang, orgId, navigate, fmt, showSuppliers }) {
  return (
    <button
      key={s.id}
      onClick={() => navigate(`/${orgId}/services/${s.id}`)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 shrink-0">
            {s.code}
          </span>
          <span
            className="text-sm font-medium truncate"
            style={{ color: brand.navy }}
          >
            {s.name[lang] || s.name.en}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-slate-400 truncate hidden sm:block">
            {s.description[lang] || s.description.en}
          </p>
          {showSuppliers && s._kostenverdelers?.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              {s._kostenverdelers.map((kv) => (
                <SupplierChip key={kv.id} name={kv.shortName || kv.name} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Meta chips */}
      <div className="hidden md:flex items-center gap-3 shrink-0">
        {s.metered && (
          <span className="text-[11px] font-medium px-2 py-1 rounded bg-blue-50 text-blue-600">
            {t("metered", lang)}
          </span>
        )}
        <span className="text-xs tabular-nums text-slate-500">
          {s.buildingCount} {lang === "nl" ? "geb." : "bldg."}
        </span>
        <span className="text-xs tabular-nums text-slate-600 font-medium w-[72px] text-right">
          {s.avgCostPerVhe != null ? `${fmt(s.avgCostPerVhe)}/VHE` : "—"}
        </span>
      </div>

      <ChevronRight
        size={14}
        className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"
      />
    </button>
  );
}

/* ── Main component ── */
export default function ServiceListPage() {
  const lang = useLang();
  const navigate = useNavigate();
  const { data, orgId } = useOrg();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" or "flat"

  const categoryFilters = useMemo(() => [
    { value: "all", label: { en: "All", nl: "Alle" } },
    ...data.serviceCategories.map((c) => ({ value: c.id, label: c.label })),
  ], [data.serviceCategories]);

  // Build kostenverdeler map: serviceId → array of kostenverdeler suppliers
  // Only suppliers explicitly flagged as kostenverdeler (e.g. Techem, ista, WMS Brunata, ASG)
  // — not all metering companies do cost distribution
  const kostenverdelerMap = useMemo(() => {
    const map = new Map();
    const kvSuppliers = data.suppliers.filter((s) => s.kostenverdeler === true);
    for (const sup of kvSuppliers) {
      // Create a short display name (strip BV/B.V. etc for badge)
      const shortName = sup.name
        .replace(/\s+(BV|B\.V\.|NV|N\.V\.)$/i, "")
        .replace(/\s+Energy Services$/i, "");
      for (const svcId of sup.serviceIds || []) {
        if (!map.has(svcId)) map.set(svcId, []);
        map.get(svcId).push({ id: sup.id, name: sup.name, shortName });
      }
    }
    return map;
  }, [data.suppliers]);

  // Enrich services with _kostenverdelers and _isExternal
  const enrichedServices = useMemo(() => {
    return data.services.map((s) => ({
      ...s,
      _kostenverdelers: kostenverdelerMap.get(s.id) || [],
      _isExternal: kostenverdelerMap.has(s.id),
    }));
  }, [data.services, kostenverdelerMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enrichedServices.filter((s) => {
      const matchSearch =
        !q ||
        s.code.toLowerCase().includes(q) ||
        (s.name[lang] || s.name.en).toLowerCase().includes(q) ||
        (s.description[lang] || s.description.en).toLowerCase().includes(q);
      const matchCategory =
        categoryFilter === "all" || s.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [search, categoryFilter, lang, enrichedServices]);

  // Split filtered services into external (kostenverdeler) and internal
  const { externalServices, internalGrouped } = useMemo(() => {
    const external = filtered.filter((s) => s._isExternal);
    const internal = filtered.filter((s) => !s._isExternal);

    const internalGrouped = data.serviceCategories
      .map((cat) => ({
        ...cat,
        services: internal.filter((s) => s.category === cat.id),
      }))
      .filter((g) => g.services.length > 0);

    return { externalServices: external, internalGrouped };
  }, [filtered, data.serviceCategories]);

  // Collect unique kostenverdeler names for the external group header
  const kostenverdelerNames = useMemo(() => {
    const names = new Set();
    for (const s of externalServices) {
      for (const kv of s._kostenverdelers) {
        names.add(kv.shortName);
      }
    }
    return [...names];
  }, [externalServices]);

  const fmt = (v) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Title + count + view toggle */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold" style={{ color: brand.navy }}>
              {t("servicesTitle", lang)}
            </h1>
            <span className="text-sm text-slate-400">{filtered.length}</span>
          </div>

          {/* View mode toggle */}
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
              title={lang === "nl" ? "Lijst" : "List"}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Search & filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search input */}
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

          {/* Category filter — scrollable on mobile */}
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
            {/* ── External: Kostenverdeler group (comes first) ── */}
            {externalServices.length > 0 && (
              <div>
                {/* Kostenverdeler group header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "#FEF3C7", color: "#D97706" }}
                  >
                    <ExternalLink size={14} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-sm font-semibold"
                      style={{ color: brand.navy }}
                    >
                      {t("distributedBy", lang)}{" "}
                      <span className="text-amber-600">
                        {kostenverdelerNames.join(" / ")}
                      </span>
                    </h2>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {externalServices.length}
                    </span>
                  </div>
                </div>

                {/* Subtle info line */}
                <div className="flex items-center gap-2 mb-2 ml-10">
                  <span className="text-[11px] text-amber-600/70">
                    {lang === "nl"
                      ? "Wijzigingen verlopen via de kostenverdeler"
                      : "Changes are managed by the cost distributor"}
                  </span>
                </div>

                {/* External service rows */}
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/30 divide-y divide-amber-100/60">
                  {externalServices.map((s) => (
                    <ServiceRow
                      key={s.id}
                      s={s}
                      lang={lang}
                      orgId={orgId}
                      navigate={navigate}
                      fmt={fmt}
                      showSuppliers={kostenverdelerNames.length > 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Internal: Grouped by category (as before) ── */}
            {internalGrouped.length > 0 && externalServices.length > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "#F0FDF4", color: "#16A34A" }}
                >
                  <Building2 size={14} />
                </div>
                <h2
                  className="text-sm font-semibold"
                  style={{ color: brand.navy }}
                >
                  {t("internalDistribution", lang)}
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">
                  {filtered.length - externalServices.length}
                </span>
              </div>
            )}

            {internalGrouped.map((group) => {
              const cfg = categoryConfig[group.id];
              const GroupIcon = cfg?.icon || Wrench;
              return (
                <div key={group.id}>
                  {/* Category header */}
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
                      {group.services.length}
                    </span>
                  </div>

                  {/* Service rows */}
                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {group.services.map((s) => (
                      <ServiceRow
                        key={s.id}
                        s={s}
                        lang={lang}
                        orgId={orgId}
                        navigate={navigate}
                        fmt={fmt}
                        showSuppliers={false}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {externalServices.length === 0 && internalGrouped.length === 0 && (
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
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/${orgId}/services/${s.id}`)}
                  className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-[#3EB1C8] hover:shadow-md transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: s._isExternal
                            ? "#FEF3C7"
                            : categoryConfig[s.category]?.bg || "#F1F5F9",
                        }}
                      >
                        {s._isExternal ? (
                          <ExternalLink size={14} style={{ color: "#D97706" }} />
                        ) : (
                          (() => {
                            const Icon = categoryConfig[s.category]?.icon || Wrench;
                            return (
                              <Icon
                                size={14}
                                style={{ color: categoryConfig[s.category]?.color || brand.muted }}
                              />
                            );
                          })()
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: brand.navy }}>
                          {s.name[lang] || s.name.en}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.code}</div>
                      </div>
                    </div>
                    <StatusBadge status={s.status} size="xs" />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                    {s.description[lang] || s.description.en}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {s._isExternal ? (
                      <>
                        {s._kostenverdelers.map((kv) => (
                          <SupplierChip key={kv.id} name={kv.shortName} />
                        ))}
                      </>
                    ) : (
                      <CategoryBadge categoryId={s.category} lang={lang} />
                    )}
                    <span className="text-[11px] text-slate-400">
                      {s.buildingCount} {t("buildings", lang).toLowerCase()}
                    </span>
                    <span className="w-px h-3 bg-slate-200" />
                    <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                      {fmt(s.avgCostPerVhe)} / VHE
                    </span>
                  </div>
                </button>
              ))}
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
                      { key: "code", align: "left" },
                      { key: "service", align: "left" },
                      { key: "category", align: "left" },
                      { key: "kostenverdeler", align: "left" },
                      { key: "metered", align: "center" },
                      { key: "buildingCount", align: "right" },
                      { key: "avgCostVhe", align: "right" },
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
                  {filtered.map((s) => {
                    const cfg = categoryConfig[s.category];
                    const Icon = cfg?.icon || Wrench;
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          s._isExternal ? "bg-amber-50/20" : ""
                        }`}
                        onClick={() => navigate(`/${orgId}/services/${s.id}`)}
                      >
                        <td className="px-3 sm:px-4 py-3">
                          <span className="text-xs font-mono font-semibold text-slate-600">
                            {s.code}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 max-w-[320px]">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{
                                background: s._isExternal ? "#FEF3C7" : cfg?.bg || "#F1F5F9",
                              }}
                            >
                              {s._isExternal ? (
                                <ExternalLink size={14} style={{ color: "#D97706" }} />
                              ) : (
                                <Icon size={14} style={{ color: cfg?.color || brand.muted }} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate" style={{ color: brand.navy }}>
                                {s.name[lang] || s.name.en}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate leading-relaxed">
                                {s.description[lang] || s.description.en}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <CategoryBadge categoryId={s.category} lang={lang} />
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          {s._isExternal ? (
                            <div className="flex flex-wrap gap-1">
                              {s._kostenverdelers.map((kv) => (
                                <SupplierChip key={kv.id} name={kv.shortName} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <BoolDot value={s.metered} />
                            <span className="text-[11px] text-slate-500">
                              {s.metered ? t("yes", lang) : t("no", lang)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <span className="text-sm font-semibold tabular-nums text-slate-700">
                            {s.buildingCount}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <span className="text-sm tabular-nums text-slate-600">
                            {s.avgCostPerVhe != null ? fmt(s.avgCostPerVhe) : "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <StatusBadge status={s.status} size="xs" />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 sm:px-4 py-8 text-center text-sm text-slate-400">
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
