import React from "react";

const variants = {
  active:    { bg: "bg-sky-50",     text: "text-sky-600" },
  success:   { bg: "bg-sky-50",     text: "text-sky-600" },
  good:      { bg: "bg-sky-50",     text: "text-sky-600" },
  onboarded: { bg: "bg-sky-50",     text: "text-sky-600" },
  warning:   { bg: "bg-amber-50",   text: "text-amber-600" },
  offline:   { bg: "bg-amber-50",   text: "text-amber-600" },
  pending:   { bg: "bg-amber-50",   text: "text-amber-600" },
  medium:    { bg: "bg-amber-50",   text: "text-amber-600" },
  error:     { bg: "bg-red-50",     text: "text-red-600" },
  bad:       { bg: "bg-red-50",     text: "text-red-600" },
  low:       { bg: "bg-red-50",     text: "text-red-600" },
  inactive:  { bg: "bg-slate-100",  text: "text-slate-400" },
  vacant:    { bg: "bg-slate-100",  text: "text-slate-400" },
  ended:     { bg: "bg-slate-100",  text: "text-slate-400" },
  neutral:   { bg: "bg-slate-100",  text: "text-slate-500" },
  unknown:   { bg: "bg-slate-100",  text: "text-slate-400" },
};

const statusLabels = {
  active: "Active", success: "Success", good: "Good",
  onboarded: "Onboarded", warning: "Warning", offline: "Offline",
  pending: "Pending", medium: "Medium", error: "Error", bad: "Bad",
  low: "Low", inactive: "Inactive", vacant: "Vacant", ended: "Ended",
  neutral: "Neutral", unknown: "Unknown",
};

export function StatusBadge({ status, label, size = "sm" }) {
  const v = variants[status] || variants.neutral;
  const sizeClass = size === "xs" ? "text-[11px] px-2 py-0" : "text-[11px] px-2 py-1";
  const displayLabel = label || statusLabels[status] || status;
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${v.bg} ${v.text} ${sizeClass}`}>
      {displayLabel}
    </span>
  );
}

export function StatusDot({ status, size = 6 }) {
  const colors = {
    active: "#3EB1C8", success: "#3EB1C8", good: "#3EB1C8", onboarded: "#3EB1C8",
    warning: "#F59E0B", offline: "#F59E0B", pending: "#F59E0B",
    error: "#EF4444", bad: "#EF4444",
    inactive: "#94A3B8", vacant: "#94A3B8", ended: "#94A3B8", neutral: "#94A3B8", unknown: "#94A3B8",
    high: "#94A3B8", medium: "#F59E0B", low: "#EF4444",
  };
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: colors[status] || colors.neutral }} />;
}
