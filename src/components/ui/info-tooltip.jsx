import React, { useState } from "react";
import { Info } from "lucide-react";

export function InfoTooltip({ text, size = 13 }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-slate-300 hover:text-slate-500 transition-colors cursor-help">
        <Info size={size} />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg border border-slate-200 bg-white px-3 py-3 text-[11px] text-slate-500 leading-relaxed shadow-md pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-white border-b border-r border-slate-200" />
        </div>
      )}
    </span>
  );
}

export function TimePeriodLabel({ text, period, className = "" }) {
  return (
    <span className={`text-[11px] font-medium text-slate-400 bg-slate-100 rounded px-2 py-1 ${className}`}>
      {text || period}
    </span>
  );
}
