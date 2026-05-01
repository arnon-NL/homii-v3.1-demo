import * as React from "react";
import { cn } from "@/lib/utils";

const SelectContext = React.createContext({ value: "", onValueChange: () => {}, open: false, setOpen: () => {} });

function Select({ value, onValueChange, children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ className, children }) {
  const ctx = React.useContext(SelectContext);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ctx.open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target)) ctx.setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctx.open]);
  return (
    <button ref={ref} type="button" onClick={() => ctx.setOpen(!ctx.open)}
      className={cn("flex h-10 items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}>
      {children}
      <svg className="ml-2 h-4 w-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function SelectValue() {
  const ctx = React.useContext(SelectContext);
  return <span className="truncate">{ctx._labelMap?.[ctx.value] || ctx.value}</span>;
}

function SelectContent({ className, children }) {
  const ctx = React.useContext(SelectContext);
  if (!ctx.open) return null;
  return (
    <div className={cn("absolute z-50 mt-1 min-w-[8rem] w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95", className)}>
      <div className="p-1 max-h-60 overflow-auto">{children}</div>
    </div>
  );
}

function SelectItem({ value, className, children }) {
  const ctx = React.useContext(SelectContext);
  const isSelected = ctx.value === value;
  React.useEffect(() => {
    if (!ctx._labelMap) ctx._labelMap = {};
    ctx._labelMap[value] = children;
  }, [children, value]);
  return (
    <div onClick={() => { ctx.onValueChange(value); ctx.setOpen(false); }}
      className={cn("relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground", isSelected && "bg-accent text-accent-foreground", className)}>
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
      {children}
    </div>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
