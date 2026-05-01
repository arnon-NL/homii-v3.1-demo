import React, { useState, useRef, useEffect } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Home,
  Inbox,
  CheckSquare,
  Zap,
  UserPlus,
  Building2,
  DoorOpen,
  Gauge,
  Wrench,
  Search,
  LayoutGrid,
  FileCheck,
  List,
  AlertTriangle,
  Plus,
  ChevronDown,
  Check,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { t, useLang } from "@/lib/i18n";
import { useOrg } from "@/lib/OrgContext";
import { useViews } from "@/lib/ViewsContext";

/* ── Icon lookup for view icons ── */
const viewIconMap = {
  list: List,
  zap: Zap,
  fileCheck: FileCheck,
  alertTriangle: AlertTriangle,
};

/* ── Nav button (main nav + objects) ── */
function NavButton({ item, showCount }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 h-8 px-3 rounded-lg text-sm transition-colors no-underline ${
          isActive
            ? "bg-slate-200/60 text-slate-900 font-medium"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
          <span className="flex-1 text-left">{item.label}</span>
          {showCount && item.count != null && (
            <span className="text-[11px] text-slate-400 tabular-nums">
              {item.count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ── View button (in Views section) ── */
function ViewButton({ view, lang, orgId, onDelete }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const Icon = viewIconMap[view.icon] || List;
  const objectRouteMap = {
    buildings: `/${orgId}/buildings`,
    vhe: `/${orgId}/vhe`,
    services: `/${orgId}/services`,
    suppliers: `/${orgId}/suppliers`,
    meters: `/${orgId}/meters`,
  };
  const basePath = objectRouteMap[view.objectType] || `/${orgId}/buildings`;
  const viewPath = `${basePath}?view=${view.id}`;

  // Check if this view is currently active
  const isActive =
    location.pathname === basePath &&
    searchParams.get("view") === view.id;

  return (
    <div className="group relative">
      <NavLink
        to={viewPath}
        className={`w-full flex items-center gap-3 h-7 pl-4 pr-7 rounded-lg text-xs transition-colors no-underline ${
          isActive
            ? "bg-slate-200/60 text-slate-900 font-medium"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
        <span className="flex-1 text-left truncate">
          {typeof view.name === "object"
            ? view.name[lang] || view.name.en
            : view.name}
        </span>
      </NavLink>
      {/* Delete button — only for user-created views, revealed on hover */}
      {onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(view.id); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
          title={lang === "nl" ? "Weergave verwijderen" : "Delete view"}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

/* ── Org Switcher (Notion-style) ── */
function OrgSwitcher() {
  const { org, organizations } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleOrgSwitch = (newOrgId) => {
    // Extract the sub-path after the current orgId
    const match = location.pathname.match(/^\/[^/]+(\/.*)?$/);
    let subPath = match?.[1] || "/buildings";

    // If on a detail page, navigate to list to avoid stale IDs
    if (subPath.match(/^\/(buildings|services|suppliers|vhe|meters)\/[^/]+/)) {
      subPath = "/buildings";
    }

    navigate(`/${newOrgId}${subPath}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 pt-4 pb-2 hover:bg-slate-100/60 rounded-lg transition-colors"
      >
        {org.logoUrl ? (
          <img
            src={org.logoUrl}
            alt={org.name}
            className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-semibold tracking-wide"
            style={{ background: brand.navy }}
          >
            {org.logoText}
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <span
            className="text-sm font-semibold block truncate"
            style={{ color: brand.navy }}
          >
            {org.name}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            Powered by homii
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-2 right-2 top-[calc(100%+2px)] z-50 bg-white rounded-xl shadow-md border border-slate-200 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            Organizations
          </div>
          {organizations.map((o) => {
            const isActive = o.id === org.id;
            return (
              <button
                key={o.id}
                onClick={() => handleOrgSwitch(o.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isActive
                    ? "bg-slate-50"
                    : "hover:bg-slate-50"
                }`}
              >
                {o.logoUrl ? (
                  <img
                    src={o.logoUrl}
                    alt={o.name}
                    className="w-7 h-7 rounded-md object-contain bg-white border border-slate-200"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-semibold"
                    style={{ background: brand.navy }}
                  >
                    {o.logoText}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800 block truncate">
                    {o.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {o.modules.includes("serviceCharges")
                      ? "Energy + Service Charges"
                      : "Energy Module"}
                  </span>
                </div>
                {isActive && (
                  <Check size={14} className="text-slate-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ lang, setLang }) {
  const { orgId, hasModule } = useOrg();
  const { views, addView, deleteView } = useViews();
  const navigate = useNavigate();

  // Inline view-creation form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createObjectType, setCreateObjectType] = useState("buildings");
  const createInputRef = useRef(null);

  useEffect(() => {
    if (showCreateForm && createInputRef.current) createInputRef.current.focus();
  }, [showCreateForm]);

  function handleCreateView(e) {
    e?.preventDefault();
    if (!createName.trim()) return;
    const newView = addView({
      name: createName.trim(),
      objectType: createObjectType,
      filters: {},
      columns: [],
    });
    setCreateName("");
    setShowCreateForm(false);
    const objectRouteMap = {
      buildings: `/${orgId}/buildings`,
      vhe: `/${orgId}/vhe`,
      services: `/${orgId}/services`,
      suppliers: `/${orgId}/suppliers`,
      meters: `/${orgId}/meters`,
    };
    navigate(`${objectRouteMap[createObjectType] || `/${orgId}/buildings`}?view=${newView.id}`);
  }

  const objectTypeOptions = [
    { value: "buildings", label: lang === "nl" ? "Gebouwen" : "Buildings" },
    { value: "vhe",       label: lang === "nl" ? "Eenheden" : "Units" },
    { value: "services",  label: lang === "nl" ? "Diensten" : "Services" },
    { value: "suppliers", label: lang === "nl" ? "Leveranciers" : "Suppliers" },
    { value: "meters",    label: lang === "nl" ? "Meters" : "Meters" },
  ];

  const navItems = [
    { label: t("home", lang), icon: Home, path: `/${orgId}/home`, end: true },
    { label: t("inbox", lang), icon: Inbox, path: `/${orgId}/inbox` },
    { label: t("tasks", lang), icon: CheckSquare, path: `/${orgId}/tasks` },
    { label: t("automations", lang), icon: Zap, path: `/${orgId}/automations` },
    { label: t("onboarding", lang), icon: UserPlus, path: `/${orgId}/onboarding` },
  ];

  const objectItems = [
    { label: t("buildings", lang), icon: Building2, path: `/${orgId}/buildings` },
    { label: t("vheTitle", lang), icon: DoorOpen, path: `/${orgId}/vhe` },
    { label: t("services", lang), icon: Wrench, path: `/${orgId}/services` },
    { label: t("meters", lang), icon: Gauge, path: `/${orgId}/meters` },
    hasModule("serviceCharges") && { label: lang === "nl" ? "Verdeling" : "Distribution", icon: Send, path: `/${orgId}/distribution` },
  ].filter(Boolean);

  // User-created views (non-system) are deletable
  const isUserView = (view) => !view.isSystem && !view.isDefault;

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col h-full select-none">
      {/* Org switcher header */}
      <OrgSwitcher />

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-200/50 border border-slate-200/80 text-slate-400 cursor-pointer hover:bg-slate-200/80 transition-colors">
          <Search size={14} strokeWidth={2} />
          <span className="text-xs">{t("search", lang)}...</span>
          <span className="ml-auto text-[11px] font-mono text-slate-300 bg-white/60 px-2 py-1 rounded border border-slate-200/80">
            ⌘K
          </span>
        </div>
      </div>

      <div className="h-px bg-slate-200 mx-3" />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {/* Main nav */}
        {navItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}

        <div className="h-px bg-slate-200 my-2 mx-1" />

        {/* Objects section */}
        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          {t("objects", lang)}
        </div>
        {objectItems.map((item) => (
          <NavButton key={item.path} item={item} showCount />
        ))}

        <div className="h-px bg-slate-200 my-2 mx-1" />

        {/* Views section */}
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            {lang === "nl" ? "Weergaven" : "Views"}
          </span>
          <button
            onClick={() => { setShowCreateForm((v) => !v); setCreateName(""); }}
            className="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            title={lang === "nl" ? "Weergave toevoegen" : "Add view"}
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Inline create-view form */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateView}
            className="mx-2 mb-1 p-2 rounded-lg border border-slate-200 bg-white shadow-sm space-y-1.5"
          >
            <input
              ref={createInputRef}
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowCreateForm(false); setCreateName(""); } }}
              placeholder={lang === "nl" ? "Naam weergave..." : "View name..."}
              className="w-full h-7 px-2 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3EB1C8]/30 focus:border-[#3EB1C8]"
            />
            <select
              value={createObjectType}
              onChange={(e) => setCreateObjectType(e.target.value)}
              className="w-full h-7 px-2 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3EB1C8]/30 focus:border-[#3EB1C8]"
            >
              {objectTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                type="submit"
                disabled={!createName.trim()}
                className="flex-1 h-6 rounded text-[11px] font-medium text-white disabled:opacity-40 transition-colors"
                style={{ background: brand.teal }}
              >
                {lang === "nl" ? "Aanmaken" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setCreateName(""); }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={12} />
              </button>
            </div>
          </form>
        )}

        <div className="space-y-0.5">
          {views.map((view) => (
            <ViewButton
              key={view.id}
              view={view}
              lang={lang}
              orgId={orgId}
              onDelete={isUserView(view) ? deleteView : undefined}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-500">
            A
          </div>
          <span className="text-xs text-slate-600 font-medium">Admin</span>
        </div>

        {/* Language toggle */}
        <div className="flex items-center gap-1 bg-slate-200/60 rounded-lg p-0.5">
          {["en", "nl"].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                lang === l
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
