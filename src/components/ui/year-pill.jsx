import React from "react";
import { yearColor } from "@/lib/brand";

export const YearPill = ({ year, active, onClick }) => (
  <button onClick={onClick}
    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${active ? "text-white shadow-sm" : "text-slate-500 bg-transparent hover:bg-slate-100"}`}
    style={active ? { background: yearColor[year] } : {}}>
    {year}
  </button>
);
