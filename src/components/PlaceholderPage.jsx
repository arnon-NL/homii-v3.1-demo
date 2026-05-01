import React from "react";
import { brand } from "@/lib/brand";

export default function PlaceholderPage({ title, subtitle }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: brand.navy }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center py-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50">
          <div className="text-center">
            <p className="text-sm text-slate-400">
              This page is under construction
            </p>
            <p className="text-xs text-slate-300 mt-1">
              Content will be added here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
