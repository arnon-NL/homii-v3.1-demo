import { cn } from "@/lib/utils";

const VARIANTS = {
  real: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "DB",
  },
  mock: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Mock",
  },
  derived: {
    dot: "bg-indigo-400",
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    label: "Calc",
  },
};

/**
 * Tiny pill showing whether a value is real (DB), mock, or derived (Calc).
 *
 * @param {"real"|"mock"|"derived"} source
 * @param {string} [className]
 */
export function DataSourceTag({ source, className }) {
  const v = VARIANTS[source];
  if (!v) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none",
        v.bg,
        v.text,
        className,
      )}
      title={
        source === "real"
          ? "From production database"
          : source === "mock"
            ? "Generated mock data"
            : "Derived / calculated"
      }
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
      {v.label}
    </span>
  );
}
