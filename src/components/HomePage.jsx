import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  DoorOpen,
  Gauge,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { useLang } from "@/lib/i18n";
import { useOrg } from "@/lib/OrgContext";
import {
  getBuildings,
  getServices,
  getVhes,
  getMeters,
  getSuppliers,
  getAllBuildingServices,
} from "@/lib/data";
import rawTasks from "../data/tasks.json";

/* ── Formatting ── */
const fmtEur = (v) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

const fmtNum = (v) => new Intl.NumberFormat("nl-NL").format(v);

/* ═══════════════════════════════════════════════════════════
   Section 1 — Company Metrics (compact strip)
   ═══════════════════════════════════════════════════════════ */
function MetricCard({ value, label, subs, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 text-left hover:shadow-sm hover:border-slate-300 transition-all group flex-1 min-w-0"
    >
      <div className="flex items-baseline gap-2">
        <span
          className="text-[22px] font-bold tabular-nums leading-none"
          style={{ color: brand.navy }}
        >
          {value}
        </span>
        <span className="text-[12px] text-slate-500 font-medium">{label}</span>
      </div>
      {subs && subs.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          {subs.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="text-slate-300 text-[10px]">·</span>
              )}
              <span className="text-[11px] text-slate-400">
                <span
                  className="tabular-nums font-medium"
                  style={{ color: s.color || brand.subtle }}
                >
                  {s.value}
                </span>{" "}
                {s.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Section 2 — Smart Insights (grouped panels)
   ═══════════════════════════════════════════════════════════ */
function InsightRow({ icon: Icon, count, label, color, onClick }) {
  const isZero = count === 0;
  return (
    <button
      onClick={onClick}
      disabled={isZero}
      className={`flex items-center gap-3 py-2 px-1 rounded-lg w-full text-left transition-colors ${
        isZero
          ? "opacity-50 cursor-default"
          : "hover:bg-slate-50 cursor-pointer"
      }`}
    >
      <div
        className="w-5 h-5 rounded flex items-center justify-center shrink-0"
        style={{ background: isZero ? "#F1F5F9" : (color || brand.amber) + "14" }}
      >
        <Icon
          size={12}
          style={{ color: isZero ? "#CBD5E1" : color || brand.amber }}
        />
      </div>
      <span
        className="text-[14px] font-semibold tabular-nums min-w-[28px]"
        style={{ color: isZero ? "#CBD5E1" : brand.navy }}
      >
        {fmtNum(count)}
      </span>
      <span
        className="text-[12px] flex-1"
        style={{ color: isZero ? "#CBD5E1" : "#64748B" }}
      >
        {label}
      </span>
      {!isZero && (
        <ArrowUpRight size={12} className="text-slate-300 shrink-0" />
      )}
    </button>
  );
}

function InsightGroup({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3
        className="text-[11px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: brand.muted }}
      >
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Section 3 — Stuff to do (task list)
   ═══════════════════════════════════════════════════════════ */
function TaskRow({ task, building, lang, onClick }) {
  const title =
    typeof task.title === "object"
      ? task.title[lang] || task.title.en
      : task.title;

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  const dueLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString(
        lang === "nl" ? "nl-NL" : "en-US",
        { month: "short", day: "numeric" }
      )
    : "";

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg w-full text-left hover:bg-slate-50 transition-colors group"
    >
      {/* Priority dot */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background:
            task.priority === "high"
              ? brand.red
              : task.priority === "medium"
              ? brand.amber
              : "#CBD5E1",
        }}
      />
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: brand.navy }}
          >
            {title}
          </span>
          {task.blocking && (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-500 shrink-0">
              {lang === "nl" ? "blokkerend" : "blocking"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400 truncate">
            {building?.complex || task.buildingId}
          </span>
          {task.assignee && (
            <>
              <span className="text-slate-300 text-[10px]">·</span>
              <span className="text-[11px] text-slate-400">
                {task.assigneeInitials || task.assignee}
              </span>
            </>
          )}
        </div>
      </div>
      {/* Due date */}
      <span
        className="text-[11px] tabular-nums shrink-0"
        style={{ color: isOverdue ? brand.red : "#94A3B8" }}
      >
        {dueLabel}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   HomePage
   ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const lang = useLang();
  const navigate = useNavigate();
  const { orgId, org } = useOrg();

  /* ── Compute all metrics ── */
  const data = useMemo(() => {
    const buildings = getBuildings();
    const vhes = getVhes();
    const meters = getMeters();
    const services = getServices();
    const suppliers = getSuppliers();
    const buildingServices = getAllBuildingServices();

    // --- Section 1: Company Metrics ---
    const buildingsByOnboarding = {
      live: buildings.filter((b) => b.onboardingStatus === "live").length,
      onboarded: buildings.filter((b) => b.onboardingStatus === "onboarded").length,
      pipeline: buildings.filter((b) => b.onboardingStatus === "pipeline").length,
    };

    const mainMeters = meters.filter((m) => m.type === "main").length;
    const subMeters = meters.filter((m) => m.type === "sub").length;

    let totalCosts = 0;
    for (const b of buildings) {
      totalCosts += b.budgetSpent || 0;
    }

    // --- Section 2: Smart Insights ---

    // Tenants above/below budget
    // Use costAttribution: compare endTotalCost vs totalAdvance
    let tenantsAboveBudget = 0;
    let tenantsBelowBudget = 0;
    let departedNegative = 0;

    // Create a set of VHE IDs with ended contracts
    const departedVheIds = new Set();
    for (const v of vhes) {
      if (v.contract && v.contract.endDate) {
        departedVheIds.add(v.id);
      }
    }

    // Use buildingServices for budget comparison at building level
    // For tenant-level: we compute from VHE voorschot vs suggested
    for (const v of vhes) {
      if (v.suggestedTotal != null && v.voorschot != null) {
        const diff = v.voorschot - v.suggestedTotal;
        if (diff < -10) {
          // Paying less than suggested = above actual cost
          tenantsAboveBudget++;
        } else if (diff > 10) {
          tenantsBelowBudget++;
        }
        // Departed with negative balance
        if (departedVheIds.has(v.id) && diff < -10) {
          departedNegative++;
        }
      }
    }

    // Buildings blocked (status "inactive" or data quality "error" + flagged settlements)
    const buildingsBlocked = buildings.filter(
      (b) => b.status === "inactive"
    ).length;

    // Buildings requiring client control (data quality "warning" or "error")
    // In practice: buildings with flagged settlement checks
    // We approximate with data quality as proxy
    const buildingsNeedControl = buildings.filter(
      (b) => b.dataQuality === "warning"
    ).length;

    const buildingsRedDQ = buildings.filter(
      (b) => b.dataQuality === "error"
    ).length;

    // Meters
    const metersRedDQ = meters.filter((m) => m.status === "error").length;
    const metersDismounted = meters.filter(
      (m) => m.status === "dismounted" || m.dismounted
    ).length;

    // --- Section 3: Tasks ---
    const openTasks = rawTasks
      .filter((t) => t.status === "open")
      .sort((a, b) => {
        // Blocking first, then by priority, then by due date
        if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
        const priOrder = { high: 0, medium: 1, low: 2 };
        if (priOrder[a.priority] !== priOrder[b.priority])
          return priOrder[a.priority] - priOrder[b.priority];
        return (a.dueDate || "").localeCompare(b.dueDate || "");
      });

    // Building lookup for tasks
    const buildingMap = new Map(buildings.map((b) => [String(b.id), b]));

    return {
      buildings,
      vhes,
      meters,
      services,
      buildingsByOnboarding,
      mainMeters,
      subMeters,
      totalCosts,
      tenantsAboveBudget,
      tenantsBelowBudget,
      departedNegative,
      buildingsBlocked,
      buildingsNeedControl,
      buildingsRedDQ,
      metersRedDQ,
      metersDismounted,
      openTasks,
      buildingMap,
    };
  }, [orgId]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* ── Greeting ── */}
        <div className="mb-5">
          <h1 className="text-lg font-semibold" style={{ color: brand.navy }}>
            {org.name}
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {lang === "nl"
              ? "Overzicht van uw vastgoedportfolio"
              : "Overview of your property portfolio"}
          </p>
        </div>

        {/* ═══ Section 1: Company Metrics ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
          <MetricCard
            value={fmtNum(data.buildings.length)}
            label={lang === "nl" ? "Gebouwen" : "Buildings"}
            subs={[
              {
                value: data.buildingsByOnboarding.live,
                label: lang === "nl" ? "live" : "live",
                color: "#10B981",
              },
              {
                value: data.buildingsByOnboarding.onboarded,
                label: lang === "nl" ? "ingericht" : "onboarded",
                color: brand.blue,
              },
              {
                value: data.buildingsByOnboarding.pipeline,
                label: lang === "nl" ? "pipeline" : "pipeline",
                color: brand.muted,
              },
            ]}
            onClick={() => navigate(`/${orgId}/buildings`)}
          />
          <MetricCard
            value={fmtNum(data.vhes.length)}
            label={lang === "nl" ? "Eenheden" : "Units"}
            subs={[]}
            onClick={() => navigate(`/${orgId}/vhe`)}
          />
          <MetricCard
            value={fmtNum(data.meters.length)}
            label={lang === "nl" ? "Meters" : "Meters"}
            subs={[
              {
                value: fmtNum(data.mainMeters),
                label: lang === "nl" ? "hoofd" : "main",
              },
              {
                value: fmtNum(data.subMeters),
                label: "sub",
              },
            ]}
            onClick={() => navigate(`/${orgId}/meters`)}
          />
          <MetricCard
            value={fmtEur(data.totalCosts)}
            label={lang === "nl" ? "Totale kosten" : "Total costs"}
            subs={[
              {
                value: "YTD 2025",
                label: "",
                color: brand.muted,
              },
            ]}
            onClick={() => navigate(`/${orgId}/buildings`)}
          />
        </div>

        {/* ═══ Section 2: Smart Insights ═══ */}
        <div className="mb-6">
          <h2
            className="text-[13px] font-semibold mb-3"
            style={{ color: brand.navy }}
          >
            {lang === "nl" ? "Aandachtspunten" : "Smart insights"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Tenants */}
            <InsightGroup
              title={lang === "nl" ? "Huurders" : "Tenants"}
            >
              <InsightRow
                icon={TrendingUp}
                count={data.tenantsAboveBudget}
                label={
                  lang === "nl" ? "boven budget" : "above budget"
                }
                color={brand.amber}
                onClick={() => navigate(`/${orgId}/vhe`)}
              />
              <InsightRow
                icon={TrendingDown}
                count={data.tenantsBelowBudget}
                label={
                  lang === "nl" ? "onder budget" : "below budget"
                }
                color={brand.blue}
                onClick={() => navigate(`/${orgId}/vhe`)}
              />
              <InsightRow
                icon={AlertTriangle}
                count={data.departedNegative}
                label={
                  lang === "nl"
                    ? "vertrokken met tekort"
                    : "departed with deficit"
                }
                color={brand.red}
                onClick={() => navigate(`/${orgId}/vhe`)}
              />
            </InsightGroup>

            {/* Buildings */}
            <InsightGroup
              title={lang === "nl" ? "Gebouwen" : "Buildings"}
            >
              <InsightRow
                icon={AlertTriangle}
                count={data.buildingsBlocked}
                label={
                  lang === "nl" ? "geblokkeerd" : "blocked"
                }
                color={brand.red}
                onClick={() => navigate(`/${orgId}/buildings`)}
              />
              <InsightRow
                icon={AlertTriangle}
                count={data.buildingsNeedControl}
                label={
                  lang === "nl"
                    ? "opdrachtgeverscontrole"
                    : "client control needed"
                }
                color={brand.amber}
                onClick={() => navigate(`/${orgId}/buildings`)}
              />
              <InsightRow
                icon={AlertTriangle}
                count={data.buildingsRedDQ}
                label={
                  lang === "nl"
                    ? "rode datakwaliteit"
                    : "red data quality"
                }
                color={brand.red}
                onClick={() => navigate(`/${orgId}/buildings`)}
              />
            </InsightGroup>

            {/* Meters */}
            <InsightGroup
              title={lang === "nl" ? "Meters" : "Meters"}
            >
              <InsightRow
                icon={AlertTriangle}
                count={data.metersRedDQ}
                label={
                  lang === "nl"
                    ? "rode datakwaliteit"
                    : "red data quality"
                }
                color={brand.red}
                onClick={() => navigate(`/${orgId}/meters`)}
              />
              <InsightRow
                icon={Activity}
                count={data.metersDismounted}
                label={
                  lang === "nl"
                    ? "gedemonteerd dit jaar"
                    : "dismounted this year"
                }
                color={brand.amber}
                onClick={() => navigate(`/${orgId}/meters`)}
              />
            </InsightGroup>
          </div>
        </div>

        {/* ═══ Section 3: Stuff to do ═══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-[13px] font-semibold"
              style={{ color: brand.navy }}
            >
              {lang === "nl" ? "Te doen" : "Stuff to do"}
            </h2>
            <button
              onClick={() => navigate(`/${orgId}/tasks`)}
              className="text-[11px] font-medium hover:underline"
              style={{ color: brand.blue }}
            >
              {lang === "nl" ? "Alle taken" : "All tasks"} →
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            {data.openTasks.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.openTasks.slice(0, 7).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    building={data.buildingMap.get(String(task.buildingId))}
                    lang={lang}
                    onClick={() =>
                      navigate(
                        `/${orgId}/buildings/${task.buildingId}`
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <CheckCircle2
                  size={20}
                  className="text-emerald-400 mx-auto mb-2"
                />
                <p className="text-[13px] text-slate-400">
                  {lang === "nl"
                    ? "Niets blokkerend — je ligt op schema"
                    : "Nothing blocking — you're on track"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
