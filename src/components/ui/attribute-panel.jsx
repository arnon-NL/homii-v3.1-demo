import React from "react";
import { ChevronRight } from "lucide-react";
import { brand } from "@/lib/brand";

/* ═══════════════════════════════════════════════════════════════
   Attribute Panel — right sidebar for detail pages
   Design: clean left-border accent, strict 4px grid, minimal palette
   ═══════════════════════════════════════════════════════════════ */

export function AttributePanel({ children }) {
  return (
    <div className="w-full xl:w-[280px] shrink-0 overflow-y-auto">
      <div className="xl:border-l border-slate-200 space-y-0 py-2">
        {children}
      </div>
    </div>
  );
}

export function AttrSection({ title, children, first }) {
  return (
    <div className={first ? "" : "border-t border-slate-100"}>
      <div className={`px-5 ${first ? "pt-2" : "pt-5"} pb-4`}>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-0.5 h-3 rounded-full"
            style={{ background: brand.blue }}
          />
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            {title}
          </h3>
        </div>
        <div className="space-y-2 pl-3">{children}</div>
      </div>
    </div>
  );
}

export function AttrRow({ label, value, onClick, mono, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-slate-400 shrink-0">{label}</span>
      {onClick ? (
        <button
          onClick={onClick}
          className="group flex items-center gap-1 text-xs font-medium transition-colors text-right truncate max-w-[160px]"
          style={{ color: brand.blue }}
          title={typeof value === "string" ? value : undefined}
        >
          <span className="truncate">{value}</span>
          <ChevronRight
            size={12}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          />
        </button>
      ) : (
        <span
          className={`text-xs font-medium text-right truncate max-w-[160px] ${
            mono ? "font-mono text-[11px]" : ""
          } ${muted ? "text-slate-400" : ""}`}
          style={muted ? undefined : { color: brand.navy }}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export function AttrBadge({ label, active, text }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-slate-400 shrink-0">{label}</span>
      <span
        className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${
          active
            ? "bg-[#3EB1C8]/10 text-[#3EB1C8]"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
