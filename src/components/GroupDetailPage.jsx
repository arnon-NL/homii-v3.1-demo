import React, { useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Workflow,
  LayoutGrid,
  BookOpen,
  Send,
  Gauge,
  Activity,
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  ExternalLink,
  Filter,
  Search,
  ChevronRight,
  ChevronDown,
  Users,
  Home,
  Lock,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  Sparkles,
  HardHat,
  FileText,
} from "lucide-react";
import {
  getCostFlow,
  getAllAudiences,
  computeTrust,
  summariseLane,
  fmtEur,
  fmtEur2,
  fmtSignedEur,
  anchorStatusBucket,
  setActiveGroup,
} from "@/lib/costFlow";
import { CostFlowView } from "./CostFlowPage";
import { isLaneFrozen, useEditsVersion } from "@/lib/costFlowEdits";
import {
  getTenancyOutcomes,
  getTenantSummary,
} from "@/lib/perTenant";
import TenancyDetailSheet from "./TenancyDetailSheet";

/* ─── Tab definitions ─────────────────────────────────── */
const TABS = [
  { id: "overview",    label: "Overzicht",      icon: LayoutGrid },
  { id: "cost-flow",   label: "Kostenstroom",   icon: Workflow },
  { id: "tenants",     label: "Huurders",       icon: Home },
  { id: "bookkeeping", label: "Boekhouding",    icon: BookOpen },
  { id: "settlements", label: "Afrekeningen",   icon: Send },
  { id: "meters",      label: "Meters",         icon: Gauge },
  { id: "activity",    label: "Activiteit",     icon: Activity },
];

/* Dutch labels for the settlementStatus enum. The data still carries the
 * enum value; the UI maps through this dict. */
const SETTLEMENT_STATUS_LABEL = {
  draft:     "Concept",
  proposed:  "Gereed voor controle",
  finalised: "Gefinaliseerd",
  closed:    "Gesloten",
  blocked:   "Geblokkeerd",
};

/* ─── Shell ────────────────────────────────────────────── */
/* The cost flow is the historical distribution for one specific year.
 * The period is fixed by the data; surfaced as a static badge, not as a
 * selector — picking a different year is a different distribution entirely. */
function ShellHeader({ flow, onBack }) {
  return (
    <div className="border-b border-slate-200 bg-white px-6 pt-3 pb-3">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 mb-2"
      >
        <ArrowLeft size={12} /> Buildings
      </button>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-900">
          {flow.group.name}
        </h1>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-2 h-5 rounded border border-slate-200 bg-slate-50">
          <Calendar size={10} className="text-slate-400" />
          {flow.period} distribution
        </span>
        <span className="text-xs text-slate-400">
          {flow.group.city} · {flow.group.vheCount} VHE · merged from{" "}
          {flow.group.sourceComplexes.map((c) => `cpl ${c}`).join(" + ")}
        </span>
      </div>
    </div>
  );
}

function TabBar({ tabs, activeId, onChange }) {
  return (
    <div className="border-b border-slate-200 bg-white px-6 -mt-px">
      <nav className="flex items-center gap-1" role="tablist">
        {tabs.map((t) => {
          const isActive = activeId === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={`relative inline-flex items-center gap-1.5 px-3 h-9 text-[12px] transition-colors ${
                isActive
                  ? "text-slate-900 font-medium"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
              {t.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-slate-900" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ─── Overview tab ─────────────────────────────────────── */
function KpiCard({ label, value, sub, accent }) {
  const accentClass = {
    amber:   "text-amber-800",
    emerald: "text-emerald-800",
    red:     "text-red-700",
    slate:   "text-slate-800",
  }[accent || "slate"];
  const borderClass = {
    amber:   "border-amber-200 bg-amber-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    red:     "border-red-200 bg-red-50/40",
    slate:   "border-slate-200 bg-white",
  }[accent || "slate"];
  return (
    <div className={`rounded-lg border p-3 ${borderClass}`}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums leading-tight mt-1 ${accentClass}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

const AUDIENCE_KIND_LABELS = {
  complex:    "Complex",
  block:      "Block",
  commercial: "BOG",
  subgroup:   "Subgroup",
  external:   "External",
};
const AUDIENCE_KIND_STRIPES = {
  complex:    "bg-slate-700",
  block:      "bg-slate-500",
  commercial: "bg-amber-500",
  subgroup:   "bg-slate-400",
  external:   "bg-slate-300",
};

function AudienceRow({ audience, onOpenInCostFlow }) {
  const stripeColor = AUDIENCE_KIND_STRIPES[audience.kind] || "bg-slate-300";
  const kindLabel = AUDIENCE_KIND_LABELS[audience.kind] || "Subgroup";
  return (
    <div className="flex items-stretch rounded-lg border border-slate-200 bg-white">
      <span className={`w-1 rounded-l-lg ${stripeColor}`} aria-hidden />
      <div className="flex-1 px-3 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              {kindLabel}
            </span>
            <span className="text-sm font-medium text-slate-800">{audience.name}</span>
            <span className="text-[11px] text-slate-400">· {audience.vheCount} VHE</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {audience.settlementCount} {audience.settlementCount === 1 ? "service" : "services"}
            {audience.flagCount > 0 && (
              <span className="ml-2 text-amber-700">· {audience.flagCount} flag{audience.flagCount === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-800 tabular-nums shrink-0">
          {fmtEur(audience.settled)}
        </div>
        <button
          onClick={() => onOpenInCostFlow?.(audience.id)}
          className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 shrink-0"
          title="Filter Cost Flow to this audience"
        >
          Open <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

function IssueRow({ icon: Icon, severity, title, detail, action, onClick }) {
  const colorClass =
    severity === "error"
      ? "text-red-700 border-red-200 bg-red-50/40 hover:bg-red-50"
      : "text-amber-800 border-amber-200 bg-amber-50/40 hover:bg-amber-50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left rounded-lg border p-3 flex items-start gap-2.5 transition-colors ${colorClass} ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold leading-tight">{title}</div>
        <div className="text-[11px] text-slate-700 mt-0.5">{detail}</div>
      </div>
      {action && (
        <span className="shrink-0 text-[11px] text-slate-700 underline">
          {action}
        </span>
      )}
    </button>
  );
}

function OverviewTab({ flow, onJumpToCostFlow }) {
  // Subscribe to edits — re-render when components are frozen/unfrozen so
  // the settle-progress bar stays accurate.
  useEditsVersion();

  const trust = computeTrust();
  const audiences = useMemo(() => getAllAudiences(), []);

  const groupId = flow.group?.id;
  const settleProgress = useMemo(() => {
    const total = flow.lanes.length;
    if (!groupId) return { frozen: 0, total };
    let frozen = 0;
    for (const lane of flow.lanes) {
      if (isLaneFrozen(groupId, lane.id)) frozen++;
    }
    return { frozen, total };
  }, [flow.lanes, groupId]);

  // Topline figures (matches the rail topline)
  const totals = useMemo(() => {
    let totalExpected = 0;
    let collectTotal = 0;
    let refundTotal = 0;
    for (const lane of flow.lanes) {
      const s = summariseLane(lane.id);
      totalExpected += s.expected;
      if (s.netDelta != null) {
        // delta = advance − actual: positive → refund, negative → collect.
        if (s.netDelta > 0) refundTotal += s.netDelta;
        else if (s.netDelta < 0) collectTotal += Math.abs(s.netDelta);
      }
    }
    return { totalExpected, collectTotal, refundTotal };
  }, [flow.lanes]);

  // Curated issue list — auto-built from real flags
  const issues = useMemo(() => {
    const out = [];
    for (const node of flow.nodes) {
      for (const f of (node.flags || [])) {
        out.push({ severity: f.kind, node, note: f.note, laneId: node.laneId });
      }
    }
    // Rank by severity, then by amount
    const rank = { error: 0, warning: 1 };
    out.sort((a, b) => {
      const r = rank[a.severity] - rank[b.severity];
      if (r !== 0) return r;
      return Math.abs(b.node.amount || 0) - Math.abs(a.node.amount || 0);
    });
    return out.slice(0, 6);
  }, [flow.nodes]);

  // Mock recente activiteit
  const activity = [
    { when: "2 dagen geleden",  who: "M. de Vries", what: 'Verdeling Stadsverwarming aangepast'                        },
    { when: "5 dagen geleden",  who: "M. de Vries", what: 'Voorschot Tuinonderhoud bijgesteld voor 2025'              },
    { when: "1 week geleden",   who: "L. Bakker",   what: 'Galerij-deelnemers audience opnieuw vastgesteld (32 woningen)' },
    { when: "2 weken geleden",  who: "M. de Vries", what: 'Stadsverwarming SV001 goedgekeurd & vergrendeld'           },
  ];

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-6 max-w-[1400px] space-y-6">
        {/* KPI grid */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Totaal kosten"
            value={fmtEur(totals.totalExpected)}
            sub={`Verdeeld over ${flow.lanes.length} kostencomponent${flow.lanes.length === 1 ? "" : "en"}`}
          />
          <KpiCard
            label="Aansluitend"
            value={trust.formattedPct + "%"}
            sub={`${trust.issuesCount} ${trust.issuesCount === 1 ? "aandachtspunt" : "aandachtspunten"} · ${fmtEur(trust.wrongAccountAmount)} verkeerd geboekt`}
            accent={trust.formattedPct >= 95 ? "slate" : trust.formattedPct >= 80 ? "amber" : "red"}
          />
          <KpiCard
            label="Te innen"
            value={fmtEur(totals.collectTotal)}
            sub="Voorschot lager dan kosten"
            accent="amber"
          />
          <KpiCard
            label="Te restitueren"
            value={fmtEur(totals.refundTotal)}
            sub="Voorschot hoger dan kosten"
            accent="emerald"
          />
        </div>

        {/* Settle progress — how many cost components have been approved
         * & locked for the current period. */}
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Voortgang afrekening
            </div>
            <div className="text-[12px] text-slate-700 mt-0.5">
              <span className="font-semibold tabular-nums">
                {settleProgress.frozen}
              </span>{" "}
              van{" "}
              <span className="tabular-nums">{settleProgress.total}</span>{" "}
              kostencomponenten vergrendeld voor {flow.period}
            </div>
          </div>
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${settleProgress.total === 0 ? 0 : (settleProgress.frozen / settleProgress.total) * 100}%`,
              }}
            />
          </div>
          <div className="text-[11px] tabular-nums text-slate-500 shrink-0">
            {settleProgress.total === 0
              ? "—"
              : `${Math.round((settleProgress.frozen / settleProgress.total) * 100)}%`}
          </div>
        </div>

        {/* Audiences */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900">Doelgroepen</h2>
            <span className="text-[11px] text-slate-500">
              wie betaalt welk deel van de kosten
            </span>
          </div>
          <div className="space-y-2">
            {audiences.map((a) => (
              <AudienceRow
                key={a.id}
                audience={a}
                onOpenInCostFlow={(id) => {
                  // Find the lane this audience receives the most money from
                  // (by abs settlement amount). Sending both laneId and
                  // groupId to jumpToCostFlow opens the L3 sheet directly on
                  // that lane while keeping the audience scope active — so
                  // the user lands on the audience's primary settlement
                  // workflow instead of just a re-filtered Sankey.
                  const tally = {};
                  for (const n of flow.nodes) {
                    if (
                      n.type === "settlement" &&
                      !n.outOfScope &&
                      n.groupId === id
                    ) {
                      tally[n.laneId] =
                        (tally[n.laneId] || 0) + Math.abs(n.amount || 0);
                    }
                  }
                  const dominantLaneId = Object.entries(tally).sort(
                    (x, y) => y[1] - x[1]
                  )[0]?.[0];
                  onJumpToCostFlow?.({
                    groupId: id,
                    laneId: dominantLaneId || undefined,
                  });
                }}
              />
            ))}
          </div>
        </section>

        {/* Things to look at */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900">Aandachtspunten</h2>
            <span className="text-[11px] text-slate-500">
              automatisch gegenereerd · hoogste impact eerst
            </span>
          </div>
          <div className="space-y-2">
            {issues.length === 0 && (
              <div className="rounded-lg border border-slate-200 p-3 text-[11px] text-slate-500">
                Geen aandachtspunten — alle kostenposten zijn aansluitend.
              </div>
            )}
            {issues.map((i, idx) => (
              <IssueRow
                key={idx}
                icon={i.severity === "error" ? AlertCircle : AlertTriangle}
                severity={i.severity}
                title={i.node.label}
                detail={i.note}
                action="Open in kostenstroom"
                onClick={() => onJumpToCostFlow?.(i.laneId)}
              />
            ))}
          </div>
        </section>

        {/* Recente activiteit */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900">Recente activiteit</h2>
            <span className="text-[11px] text-slate-500">laatste 30 dagen</span>
          </div>
          <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {activity.map((a, idx) => (
              <li key={idx} className="px-3 py-2 flex items-start gap-3 text-[11px]">
                <span className="text-slate-400 w-20 shrink-0">{a.when}</span>
                <span className="text-slate-700 font-medium w-28 shrink-0 truncate">{a.who}</span>
                <span className="text-slate-600 flex-1 min-w-0">{a.what}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ─── Bookkeeping tab ──────────────────────────────────── */
function StatusPill({ status }) {
  const map = {
    matched:         { color: "text-slate-700",  bg: "bg-slate-100", label: "Matched" },
    matched_partial: { color: "text-amber-700",  bg: "bg-amber-50",  label: "Partial" },
    wrong_account:   { color: "text-red-700",    bg: "bg-red-50",    label: "Wrong account" },
    duplicate:       { color: "text-amber-700",  bg: "bg-amber-50",  label: "Duplicate" },
    missing:         { color: "text-red-700",    bg: "bg-red-50",    label: "Missing" },
  };
  const cfg = map[status] || { color: "text-slate-500", bg: "bg-slate-50", label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

/* Generate plausible invoice rows for one source — used for the prototype's
 * Bookkeeping tab so each ledger posting has visible substantiation. The
 * count comes from the source's evidenceCount; cadence shapes the date
 * spread; amounts are even slices of the source total. Real product would
 * pull these from the ERP. */
function generateInvoices(source, period) {
  const n = Math.max(1, source.evidenceCount || 1);
  const total = source.amount || 0;
  const cadence = source.cadence || "monthly";
  const supplierKey = (source.supplier || "INV").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const yyyy = period || 2024;
  const out = [];
  for (let i = 0; i < n; i++) {
    let m;
    if (cadence === "monthly") m = i + 1;
    else if (cadence === "quarterly") m = i * 3 + 2;
    else if (cadence === "annual") m = 6;
    else m = Math.min(12, Math.floor(((i + 0.5) / n) * 12) + 1);
    const date = `${yyyy}-${String(Math.min(m, 12)).padStart(2, "0")}-${String(15).padStart(2, "0")}`;
    const sliceTotal = Math.round((total / n) * 100) / 100;
    const btw = Math.round(((sliceTotal / 1.21) * 0.21) * 100) / 100;
    const net = Math.round((sliceTotal - btw) * 100) / 100;
    out.push({
      id: `${source.id}-inv-${i + 1}`,
      date,
      ref: `${supplierKey}-${yyyy}${String(i + 1).padStart(3, "0")}`,
      supplier: source.supplier || "—",
      net,
      btw,
      total: sliceTotal,
    });
  }
  return out;
}

function BookkeepingTab({ flow }) {
  /* Group everything by service cost component (= lane). Each component
   * gathers its source nodes (one per supplier), its ledger account, and
   * its service code. */
  const components = useMemo(() => {
    return flow.lanes
      .map((lane) => {
        const sources = flow.nodes.filter(
          (n) => n.type === "source" && n.laneId === lane.id
        );
        const settlements = flow.nodes.filter(
          (n) => n.type === "settlement" && n.laneId === lane.id
        );
        const ledgerAccounts = [
          ...new Set(
            sources
              .flatMap((s) => s.anchors || [])
              .map((a) => a.ledgerAccount)
              .filter(Boolean)
          ),
        ];
        const serviceCode = settlements[0]?.serviceCode || null;
        const totalActual = sources.reduce(
          (s, n) => s + (n.amount || 0),
          0
        );
        const totalInvoices = sources.reduce(
          (s, n) => s + (n.evidenceCount || 0),
          0
        );
        return {
          id: lane.id,
          lane,
          sources,
          ledgerAccounts,
          serviceCode,
          totalActual,
          totalInvoices,
        };
      })
      .filter((c) => c.sources.length > 0);
  }, [flow]);

  const [expandedComps, setExpandedComps] = useState(() => new Set());
  const [expandedSources, setExpandedSources] = useState(() => new Set());

  function toggleComp(id) {
    setExpandedComps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSource(id) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedComps(new Set(components.map((c) => c.id)));
  }
  function collapseAll() {
    setExpandedComps(new Set());
    setExpandedSources(new Set());
  }
  const allOpen = components.every((c) => expandedComps.has(c.id));

  return (
    <div className="overflow-y-auto h-full bg-slate-50/30">
      <div className="px-6 py-5 max-w-[1100px] mx-auto space-y-4">
        {/* Hero */}
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Bookkeeping</h1>
            <p className="text-[12px] text-slate-500 mt-0.5 max-w-2xl">
              Ledger entries for{" "}
              <span className="font-medium text-slate-700">
                {flow.group?.name}
              </span>
              , organized by service cost component the way the ERP does.
              Each component groups its supplier postings; click a posting to
              see the invoices that compose it.
            </p>
          </div>
          <button
            onClick={allOpen ? collapseAll : expandAll}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 shrink-0"
          >
            <ChevronDown
              size={12}
              className={`text-slate-500 transition-transform ${allOpen ? "" : "-rotate-90"}`}
            />
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>

        {/* Components list */}
        <div className="space-y-2">
          {components.map((comp) => {
            const expanded = expandedComps.has(comp.id);
            return (
              <div
                key={comp.id}
                className="rounded-lg border border-slate-200 bg-white overflow-hidden"
              >
                {/* Component header */}
                <button
                  onClick={() => toggleComp(comp.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                >
                  <ChevronDown
                    size={13}
                    className={`text-slate-400 shrink-0 transition-transform ${
                      expanded ? "" : "-rotate-90"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-slate-900">
                      {comp.lane.title}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                      {comp.serviceCode && (
                        <code className="font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                          {comp.serviceCode}
                        </code>
                      )}
                      {comp.ledgerAccounts.map((acc) => (
                        <code
                          key={acc}
                          className="font-mono text-[10px] text-slate-500"
                        >
                          {acc}
                        </code>
                      ))}
                      <span className="text-slate-300">·</span>
                      <span>
                        {comp.sources.length} supplier
                        {comp.sources.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>
                        {comp.totalInvoices} invoice
                        {comp.totalInvoices === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="text-[13px] tabular-nums font-semibold text-slate-900 shrink-0">
                    {fmtEur(comp.totalActual)}
                  </div>
                </button>

                {/* Sources (suppliers) within component */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/30">
                    {comp.sources.map((source) => {
                      const isOpen = expandedSources.has(source.id);
                      const invoices = generateInvoices(source, flow.period);
                      return (
                        <div
                          key={source.id}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <button
                            onClick={() => toggleSource(source.id)}
                            className="w-full flex items-center gap-3 pl-10 pr-4 py-2 hover:bg-white text-left"
                          >
                            <ChevronDown
                              size={11}
                              className={`text-slate-400 shrink-0 transition-transform ${
                                isOpen ? "" : "-rotate-90"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] text-slate-800 font-medium">
                                {source.supplier || "Unknown supplier"}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {source.subLabel || source.identifier || source.label} ·{" "}
                                {invoices.length} invoice
                                {invoices.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            <div className="text-[11px] tabular-nums text-slate-700 shrink-0 font-medium">
                              {fmtEur(source.amount || 0)}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="bg-white border-t border-slate-100">
                              <table className="w-full text-[11px]">
                                <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-50/60">
                                  <tr>
                                    <th className="text-left pl-14 pr-3 py-1.5 font-semibold">
                                      Date
                                    </th>
                                    <th className="text-left px-3 py-1.5 font-semibold">
                                      Reference
                                    </th>
                                    <th className="text-right px-3 py-1.5 font-semibold">
                                      Net
                                    </th>
                                    <th className="text-right px-3 py-1.5 font-semibold">
                                      BTW
                                    </th>
                                    <th className="text-right pr-4 px-3 py-1.5 font-semibold">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {invoices.map((inv) => (
                                    <tr
                                      key={inv.id}
                                      className="hover:bg-slate-50/40"
                                    >
                                      <td className="pl-14 pr-3 py-1.5 text-slate-700 font-mono text-[10px] tabular-nums">
                                        {inv.date}
                                      </td>
                                      <td className="px-3 py-1.5 text-slate-700 font-mono text-[10px]">
                                        {inv.ref}
                                      </td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                                        {fmtEur2(inv.net)}
                                      </td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                                        {fmtEur2(inv.btw)}
                                      </td>
                                      <td className="pr-4 px-3 py-1.5 text-right tabular-nums text-slate-900 font-medium">
                                        {fmtEur2(inv.total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-50/40 text-[10px]">
                                    <td className="pl-14 pr-3 py-1.5 text-slate-500 font-medium" colSpan={4}>
                                      {invoices.length} invoice{invoices.length === 1 ? "" : "s"} total
                                    </td>
                                    <td className="pr-4 px-3 py-1.5 text-right tabular-nums text-slate-900 font-semibold">
                                      {fmtEur2(invoices.reduce((s, i) => s + i.total, 0))}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Settlements tab ──────────────────────────────────── */
function SettlementsTab({ flow }) {
  const settlements = useMemo(
    () => flow.nodes.filter((n) => n.type === "settlement" && !n.outOfScope),
    [flow.nodes]
  );

  function dirOf(d) {
    // delta = advance − actual: positive → refund, negative → collect.
    if (d == null) return null;
    if (d > 1) return "refund";
    if (d < -1) return "collect";
    return "balanced";
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-6 max-w-[1400px] space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-[12px] text-slate-700">
          <div className="font-medium mb-0.5">Settlements on this Complex</div>
          <div className="text-[11px] text-slate-600">
            One row per (Service × Audience × Period). Deep-link into the
            existing settlement workflow to walk the validation → comparison →
            control → publish steps.
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Service</th>
                <th className="text-left font-semibold px-3 py-2">Audience</th>
                <th className="text-right font-semibold px-3 py-2">VHE</th>
                <th className="text-right font-semibold px-3 py-2">Actual</th>
                <th className="text-right font-semibold px-3 py-2">Advance</th>
                <th className="text-right font-semibold px-3 py-2">Delta</th>
                <th className="text-left font-semibold px-3 py-2">Direction</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map((s) => {
                const dir = dirOf(s.delta);
                const dirColor =
                  dir === "collect" ? "text-amber-700" : dir === "refund" ? "text-emerald-700" : "text-slate-400";
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1.5 font-mono text-[10px] text-slate-700">{s.serviceCode}</td>
                    <td className="px-3 py-1.5 text-slate-700">{s.subLabel}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{s.vheCount}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{fmtEur(s.amount)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{s.advance != null ? fmtEur(s.advance) : "—"}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${dirColor}`}>
                      {s.delta != null ? fmtSignedEur(s.delta) : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {dir === "collect" ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-[10px]"><TrendingUp size={11} /> Collect</span>
                      ) : dir === "refund" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[10px]"><TrendingDown size={11} /> Refund</span>
                      ) : dir === "balanced" ? (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-[10px]"><Minus size={11} /> Balanced</span>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">via Ista</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                          s.settlementStatus === "blocked" ? "bg-amber-500" :
                          s.settlementStatus === "finalised" ? "bg-slate-700" :
                          s.settlementStatus === "closed" ? "bg-slate-900" :
                          "bg-slate-400"
                        }`} />
                        {(SETTLEMENT_STATUS_LABEL[s.settlementStatus] || s.settlementStatus || "Draft")}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <button className="text-[10px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
                        Open <ExternalLink size={10} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Meters tab (placeholder list) ──────────────────────
 *
 * Restricted to actually-metered cost sources — i.e. things that are read
 * off a physical meter (EAN, kWh, m³, GJ). Cleaning, management,
 * maintenance contracts and the like don't belong in this tab even though
 * their nodes are typed as "source" too. We accept a node if either:
 *   • its sourceKind is "metered" (the explicit signal), or
 *   • it carries an EAN identifier or a metered utility label (legacy
 *     records that pre-date the sourceKind taxonomy).
 */
function MetersTab({ flow }) {
  const meters = useMemo(() => {
    const meteredUtilities = new Set([
      "elektra",
      "gas",
      "warmte",
      "warmwater",
      "koudwater",
      "water",
      "stadsverwarming",
    ]);
    const out = [];
    for (const n of flow.nodes) {
      if (n.type !== "source") continue;
      const eanMatch = n.subLabel?.match(/EAN\s+(\d+)/);
      const ean = eanMatch ? eanMatch[1] : null;

      const isMetered =
        n.sourceKind === "metered" ||
        !!ean ||
        (n.utility && meteredUtilities.has(String(n.utility).toLowerCase()));
      if (!isMetered) continue;

      out.push({
        id: n.id,
        name: n.label,
        ean,
        utility: n.utility || "—",
        supplier: n.supplier === "multi" ? "Multiple" : (n.supplier || "—"),
        consumption: n.expectedConsumption,
        unit: n.consumptionUnit,
        amount: n.amount,
      });
    }
    return out;
  }, [flow.nodes]);

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-6 max-w-[1400px] space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-[12px] text-slate-700">
          <div className="font-medium mb-0.5">Physical assets feeding cost sources</div>
          <div className="text-[11px] text-slate-600">
            Mostly the energy team's tab — meter readings, calibration, EAN
            registry. Most users never need to come here once the Cost Flow's
            sources are mature.
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Source</th>
                <th className="text-left font-semibold px-3 py-2">EAN / identifier</th>
                <th className="text-left font-semibold px-3 py-2">Utility</th>
                <th className="text-left font-semibold px-3 py-2">Supplier</th>
                <th className="text-right font-semibold px-3 py-2">Consumption</th>
                <th className="text-right font-semibold px-3 py-2">Annual cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meters.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-slate-700">{m.name}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-600">{m.ean || "—"}</td>
                  <td className="px-3 py-1.5 capitalize text-slate-600">{m.utility}</td>
                  <td className="px-3 py-1.5 text-slate-600">{m.supplier}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                    {m.consumption != null ? `${m.consumption.toLocaleString("nl-NL")} ${m.unit || ""}` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{fmtEur(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Tenants tab — the master per-tenancy outcome grid ──
 *
 * Where the workflow lands. One row per tenancy (VHE × tenant × period),
 * one column per service component (lane), each cell shows €calc, €advance
 * and the per-component delta. The sticky right-most column is the per-
 * tenant Net Δ — the headline number that ultimately appears on the
 * tenant's Subtotaal row in the source Excel.
 *
 * Live: every cell reads through getCostFlow() → active(), so editing in
 * the workflow ripples into the grid via useEditsVersion(). Locked
 * components render with an emerald border on the column header so users
 * can read at a glance which numbers are committed and which are draft.
 */

const CATEGORY_ICON = {
  energy:     Zap,
  cleaning:   Sparkles,
  management: HardHat,
  other:      FileText,
};

function TenantHeaderKpi({ icon: Icon, label, value, sub, accent }) {
  const accentClass =
    accent === "amber"   ? "text-amber-700 bg-amber-50/70 border-amber-200"
    : accent === "emerald" ? "text-emerald-700 bg-emerald-50/70 border-emerald-200"
    : "text-slate-700 bg-white border-slate-200";
  return (
    <div className={`rounded-lg border ${accentClass} px-3 py-2.5 flex items-start gap-2.5`}>
      {Icon && (
        <span className="w-7 h-7 rounded-md border border-current/20 bg-white/60 flex items-center justify-center shrink-0">
          <Icon size={13} strokeWidth={1.6} />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-semibold opacity-80">
          {label}
        </div>
        <div className="text-[16px] font-semibold tabular-nums leading-tight mt-0.5">
          {value}
        </div>
        {sub && (
          <div className="text-[11px] opacity-75 mt-0.5">{sub}</div>
        )}
      </div>
    </div>
  );
}

function TenantsTab({ flow, onJumpToCostFlow }) {
  // Subscribe so the grid updates when the user edits a cost source,
  // changes a distribution method, or freezes a component.
  useEditsVersion();

  const groupId = flow.group?.id;
  const period = flow.period;

  // Selected tenancy → opens the detail sheet (same component used by
  // the slim Step-5 preview inside the Settle workflow, so click-row
  // behaviour is identical no matter where the user came in from).
  const [selectedTenancyId, setSelectedTenancyId] = useState(null);

  const outcomes = useMemo(
    () => (groupId ? getTenancyOutcomes(groupId) : []),
    [groupId]
  );
  const summary = useMemo(
    () => (groupId ? getTenantSummary(groupId) : null),
    [groupId]
  );

  // Filter UI state — kept in component-local state. Defaults match what a
  // controller would land on first ("show me the trouble cases").
  const [direction, setDirection] = useState("all"); // all | collect | refund | balanced
  const [audienceFilter, setAudienceFilter] = useState("all"); // audience id or "all"
  const [coverageFilter, setCoverageFilter] = useState("all"); // all | full | partial
  const [search, setSearch] = useState("");

  // Pagination — 605 rows × 14 columns is fine but we cap the visible
  // window to keep the DOM light. The user can scroll the table; the
  // counter at the top tells them what's truncated.
  const PAGE_SIZE = 80;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const audiences = flow.siblingGroups || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return outcomes.filter((o) => {
      if (direction === "collect" && !(o.netDelta < -1)) return false;
      if (direction === "refund" && !(o.netDelta > 1)) return false;
      if (direction === "balanced" && Math.abs(o.netDelta) > 1) return false;
      if (audienceFilter !== "all" && !o.vhe.audienceIds.includes(audienceFilter)) return false;
      if (coverageFilter === "full" && o.tenancy.coverage !== "full") return false;
      if (coverageFilter === "partial" && o.tenancy.coverage === "full") return false;
      if (q) {
        const hay =
          (o.vhe.address || "").toLowerCase() +
          " " +
          (o.tenancy.tenantName || "").toLowerCase() +
          " " +
          (o.tenancy.contractCode || "").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [outcomes, direction, audienceFilter, coverageFilter, search]);

  // Reset visible window whenever the filter changes — otherwise the user
  // may scroll past the new shorter list.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [direction, audienceFilter, coverageFilter, search]);

  const visible = filtered.slice(0, visibleCount);
  const truncated = filtered.length > visibleCount;

  // Lanes used as the column set. Sorted to match the Sankey: by category
  // then alphabetical, so the user reads the same column order they saw
  // upstream in Cost flow.
  const lanes = useMemo(() => [...flow.lanes].sort((a, b) => {
    if ((a.category || "") !== (b.category || "")) {
      return (a.category || "").localeCompare(b.category || "");
    }
    return (a.title || "").localeCompare(b.title || "");
  }), [flow.lanes]);

  if (!groupId) {
    return (
      <div className="px-6 py-8 text-[12px] text-slate-500">
        No group selected.
      </div>
    );
  }

  if (outcomes.length === 0) {
    return (
      <div className="px-6 py-8 text-[12px] text-slate-500 italic">
        No tenancies for this group.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="px-6 pt-6 pb-3 max-w-[1600px]">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <TenantHeaderKpi
            icon={Home}
            label="Huurperiodes"
            value={summary.tenancyCount.toLocaleString("nl-NL")}
            sub={`${period} · over ${audiences.length} doelgroep${audiences.length === 1 ? "" : "en"}`}
          />
          <TenantHeaderKpi
            icon={ArrowDownToLine}
            label="Te innen"
            value={fmtEur(summary.collect)}
            sub={`${summary.collectCount} huurder${summary.collectCount === 1 ? "" : "s"} te weinig betaald`}
            accent="amber"
          />
          <TenantHeaderKpi
            icon={ArrowUpFromLine}
            label="Te restitueren"
            value={fmtEur(summary.refund)}
            sub={`${summary.refundCount} huurder${summary.refundCount === 1 ? "" : "s"} te veel betaald`}
            accent="emerald"
          />
          <TenantHeaderKpi
            icon={CheckCircle2}
            label="Sluitend"
            value={summary.balancedCount.toLocaleString("nl-NL")}
            sub="Geen afrekening nodig"
          />
        </div>

        {/* Filter strip */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Zoek op adres, huurder of contract…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 pr-2 w-72 text-[12px] rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-400"
            />
          </div>

          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="h-8 px-2 text-[12px] rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">Alle richtingen</option>
            <option value="collect">Te innen (te weinig betaald)</option>
            <option value="refund">Te restitueren (te veel betaald)</option>
            <option value="balanced">Sluitend</option>
          </select>

          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="h-8 px-2 text-[12px] rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">Alle doelgroepen</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            value={coverageFilter}
            onChange={(e) => setCoverageFilter(e.target.value)}
            className="h-8 px-2 text-[12px] rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">Heel + gedeeltelijk jaar</option>
            <option value="full">Alleen heel jaar</option>
            <option value="partial">Gedeeltelijk jaar (mutaties)</option>
          </select>

          <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
            {visible.length.toLocaleString("nl-NL")} van {filtered.length.toLocaleString("nl-NL")} zichtbaar
            {filtered.length !== outcomes.length && (
              <span className="text-slate-400">
                {" "}({outcomes.length.toLocaleString("nl-NL")} totaal)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Grid — the bulk of the page. We use overflow-x-auto so the
       * component-column band can scroll horizontally on narrow viewports
       * while the tenancy column and Net Δ column stay sticky on each
       * side. */}
      <div className="px-6 pb-6 max-w-[1600px]">
        <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-20">
              <tr>
                <th className="text-left font-semibold uppercase tracking-widest text-[10px] text-slate-500 px-3 py-2 border-b border-slate-200 sticky left-0 bg-slate-50 z-10 min-w-[280px]">
                  Huurperiode
                </th>
                {lanes.map((lane) => {
                  const Icon = CATEGORY_ICON[lane.category] || FileText;
                  const locked = isLaneFrozen(groupId, lane.id);
                  // Detect external distributor (Ista et al.) on this lane —
                  // gives the column a sky tint so users see at a glance
                  // which columns aren't computed by us.
                  const externalSettlement = flow.nodes.find(
                    (n) =>
                      n.type === "settlement" &&
                      n.laneId === lane.id &&
                      !n.outOfScope &&
                      (n.externalDistributor ||
                        n.distribution?.method === "metered_ista")
                  );
                  const externalDistributor = externalSettlement
                    ? externalSettlement.externalDistributor || "Ista"
                    : null;
                  // Stack tints: locked > external > default. Only one
                  // visual treatment "wins" so the header stays readable.
                  const headerClass = locked
                    ? "border-emerald-200 bg-emerald-50/40 text-emerald-700"
                    : externalDistributor
                    ? "border-sky-200 bg-sky-50/40 text-sky-700"
                    : "border-slate-200 text-slate-500";
                  return (
                    <th
                      key={lane.id}
                      className={`text-right font-semibold uppercase tracking-widest text-[10px] px-3 py-2 border-b min-w-[110px] cursor-pointer hover:bg-slate-100 transition-colors ${headerClass}`}
                      onClick={() => onJumpToCostFlow?.(lane.id)}
                      title={
                        externalDistributor
                          ? `${lane.title} · verdeling via ${externalDistributor}${locked ? " · vergrendeld" : ""} — klik om te openen in Kostenstroom`
                          : `${lane.title}${locked ? " · vergrendeld" : ""} — klik om te openen in Kostenstroom`
                      }
                    >
                      <div className="flex items-center justify-end gap-1">
                        {locked && <Lock size={9} className="opacity-80" />}
                        {externalDistributor && !locked && (
                          <Gauge size={9} className="opacity-80" />
                        )}
                        <Icon size={10} className="opacity-70 shrink-0" />
                        <span className="truncate">{lane.title}</span>
                      </div>
                      {externalDistributor && (
                        <div className="text-[8px] font-normal normal-case tracking-normal opacity-75 mt-0.5">
                          via {externalDistributor}
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="text-right font-semibold uppercase tracking-widest text-[10px] text-slate-500 px-3 py-2 border-b border-slate-200 sticky right-0 bg-slate-50 z-10 min-w-[130px]">
                  Net Δ
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const dirClass =
                  o.netDelta < -1 ? "text-amber-700"
                : o.netDelta > 1  ? "text-emerald-700"
                :                   "text-slate-400";
                const dirLabel =
                  o.netDelta < -1 ? "te innen"
                : o.netDelta > 1  ? "te restitueren"
                :                   "sluitend";
                return (
                  <tr
                    key={o.tenancy.id}
                    className="hover:bg-slate-50/60 cursor-pointer group"
                    onClick={() => setSelectedTenancyId(o.tenancy.id)}
                    title="Klik voor volledig overzicht per woning"
                  >
                    {/* Tenancy column — sticky left */}
                    <td className="px-3 py-1.5 border-b border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50/60 z-10">
                      <div className="text-[12px] text-slate-900 font-medium leading-tight truncate">
                        {o.vhe.address}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">
                        {o.tenancy.tenantName}
                        <span className="text-slate-300"> · </span>
                        <span className="font-mono">{o.tenancy.contractCode}</span>
                        {o.tenancy.coverage !== "full" && (
                          <span className="text-amber-700 ml-1.5">
                            · {new Date(o.tenancy.start).toLocaleDateString("nl-NL", {month:"short", day:"numeric"})}–{new Date(o.tenancy.end).toLocaleDateString("nl-NL", {month:"short", day:"numeric"})}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Component cells */}
                    {lanes.map((lane) => {
                      const cell = o.byLane[lane.id];
                      if (!cell || !cell.applicable) {
                        return (
                          <td
                            key={lane.id}
                            className="px-3 py-1.5 text-right text-slate-300 border-b border-slate-100 tabular-nums"
                            title="Niet van toepassing op deze huurder"
                          >
                            —
                          </td>
                        );
                      }
                      const c = cell.calcCost;
                      const a = cell.advance;
                      const d = cell.delta;
                      const cellTone =
                        Math.abs(d) <= 1 ? ""
                      : d < 0            ? "bg-amber-50/40"
                      :                    "bg-emerald-50/40";
                      return (
                        <td
                          key={lane.id}
                          className={`px-3 py-1.5 text-right border-b border-slate-100 tabular-nums ${cellTone} ${cell.locked ? "border-l-2 border-l-emerald-200" : ""}`}
                          title={`${lane.title}\nKosten: ${fmtEur2(c)}\nVoorschot: ${fmtEur2(a)}\nΔ: ${fmtSignedEur(d)}`}
                        >
                          <div className="text-[11px] text-slate-900 font-medium leading-tight">
                            {fmtEur(c)}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight">
                            vsch {fmtEur(a)}
                          </div>
                        </td>
                      );
                    })}

                    {/* Net Δ — sticky right */}
                    <td className="px-3 py-1.5 text-right border-b border-slate-100 sticky right-0 bg-white group-hover:bg-slate-50/60 z-10">
                      <div className={`text-[12px] font-semibold tabular-nums leading-tight ${dirClass}`}>
                        {fmtSignedEur(o.netDelta)}
                      </div>
                      <div className="text-[10px] text-slate-400 tabular-nums leading-tight">
                        {dirLabel}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {truncated && (
            <div className="px-3 py-3 border-t border-slate-200 bg-slate-50/40 flex items-center justify-center">
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              >
                <ChevronDown size={12} />
                {Math.min(PAGE_SIZE, filtered.length - visibleCount)} meer laden
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedTenancyId && (
        <TenancyDetailSheet
          groupId={groupId}
          tenancyId={selectedTenancyId}
          onClose={() => setSelectedTenancyId(null)}
          onJumpToCostFlow={(laneId) => {
            // Closing the sheet first keeps focus stable, then jump.
            setSelectedTenancyId(null);
            onJumpToCostFlow?.(laneId);
          }}
        />
      )}
    </div>
  );
}

/* ─── Activity tab (mock log) ──────────────────────────── */
function ActivityTab() {
  const events = [
    { when: "2026-04-21 14:32", who: "M. de Vries", what: "Updated 80/20 split rule", target: 'Electricity meter Blok 2' },
    { when: "2026-04-19 10:11", who: "M. de Vries", what: "Flagged Engie gas booking", target: 'Wrong-account: cpl 2397 instead of 2379 (€92,203)' },
    { when: "2026-04-15 16:08", who: "L. Bakker",   what: "Created ad-hoc audience", target: 'Riolering audience (117 VHE)' },
    { when: "2026-04-12 09:45", who: "M. de Vries", what: "Confirmed advance recommendation", target: 'SV1313G — Huismeester (lower €4.50→€4 mid-year)' },
    { when: "2026-04-08 13:20", who: "L. Bakker",   what: "Linked invoices", target: 'Maro 4-line LED armature → SV1372G Common Blok 1' },
    { when: "2026-04-02 11:55", who: "M. de Vries", what: "Edited deduction", target: 'Privégebruik gem. elektra Blok 2 (-€456.24)' },
    { when: "2026-03-28 17:02", who: "system",      what: "Imported invoices",  target: 'Engie Q1 2024 (12 invoices)' },
    { when: "2026-03-22 08:15", who: "system",      what: "Merged complexes",   target: 'cpl 2379 + cpl 2380 → Zeverijnstraat 30-484' },
  ];
  return (
    <div className="overflow-y-auto h-full">
      <div className="p-6 max-w-[1000px] space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-[12px] text-slate-700">
          <div className="font-medium mb-0.5">Audit log</div>
          <div className="text-[11px] text-slate-600">
            Every change to splits, audiences, advances, manual adjustments,
            invoice links, and structural moves (merges, recodes) shows up
            here, attributed and timestamped.
          </div>
        </div>
        <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {events.map((e, idx) => (
            <li key={idx} className="px-3 py-2 grid grid-cols-[140px_140px_1fr_2fr] gap-3 text-[11px] items-start">
              <span className="text-slate-400 tabular-nums">{e.when}</span>
              <span className="text-slate-700 font-medium truncate">{e.who}</span>
              <span className="text-slate-700">{e.what}</span>
              <span className="text-slate-500 truncate">{e.target}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────── */
export default function GroupDetailPage() {
  const { groupId } = useParams();
  // Set the active flow synchronously BEFORE children read getCostFlow().
  // Idempotent — safe to call on every render.
  setActiveGroup(groupId);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const flow = getCostFlow();
  // Pending focus the Overview clicked into; threaded into CostFlowView
  const [pendingFocus, setPendingFocus] = useState(null);

  const activeTab =
    TABS.find((t) => t.id === searchParams.get("tab"))?.id || "overview";

  function setTab(id) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  }

  function jumpToCostFlow(target) {
    // target can be a string (laneId, legacy) or { laneId, groupId }
    const focus =
      typeof target === "string"
        ? { laneId: target }
        : target || {};
    if (focus.laneId || focus.groupId) {
      setPendingFocus({ ...focus, key: Date.now() });
    }
    setTab("cost-flow");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <ShellHeader flow={flow} onBack={() => navigate(-1)} />
      <TabBar tabs={TABS} activeId={activeTab} onChange={setTab} />

      <div className="flex-1 min-h-0 overflow-hidden bg-slate-50/30">
        {activeTab === "overview"    && <OverviewTab flow={flow} onJumpToCostFlow={jumpToCostFlow} />}
        {activeTab === "cost-flow"   && (
          <CostFlowView
            compact={true}
            initialLaneId={pendingFocus?.laneId}
            initialGroupId={pendingFocus?.groupId}
            onJumpToMeters={() => setTab("meters")}
            onJumpToBookkeeping={() => setTab("bookkeeping")}
            onJumpToTenants={() => setTab("tenants")}
            // remount when key changes so the focus + scroll fire reliably
            key={pendingFocus?.key || "default"}
          />
        )}
        {activeTab === "tenants"     && (
          <TenantsTab flow={flow} onJumpToCostFlow={jumpToCostFlow} />
        )}
        {activeTab === "bookkeeping" && <BookkeepingTab flow={flow} />}
        {activeTab === "settlements" && <SettlementsTab flow={flow} />}
        {activeTab === "meters"      && <MetersTab flow={flow} />}
        {activeTab === "activity"    && <ActivityTab />}
      </div>
    </div>
  );
}
