// ═══════════════════════════════════════════════════════════════
// src/lib/ViewsContext.jsx — Unified views context
//
// Combines system views (from savedViews.json via OrgContext) with
// user-created views (persisted per-org in localStorage). Exposes
// a single `useViews()` hook consumed by Sidebar and list pages.
// ═══════════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect } from "react";
import { useOrg } from "./OrgContext";

const ViewsCtx = createContext(null);

const USER_VIEWS_KEY = "homii-views";

function loadUserViews(orgId) {
  try {
    const raw = localStorage.getItem(`${USER_VIEWS_KEY}-${orgId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistUserViews(orgId, views) {
  localStorage.setItem(`${USER_VIEWS_KEY}-${orgId}`, JSON.stringify(views));
}

export function ViewsProvider({ children }) {
  const { data, orgId } = useOrg();
  const systemViews = data.savedViews || [];
  const [userViews, setUserViews] = useState(() => loadUserViews(orgId));

  // Sync when org switches
  useEffect(() => {
    setUserViews(loadUserViews(orgId));
  }, [orgId]);

  // Sidebar-visible views: non-default system views + all user-created views
  const views = [
    ...systemViews.filter((v) => !v.isDefault),
    ...userViews,
  ];

  function getView(id) {
    return (
      systemViews.find((v) => v.id === id) ||
      userViews.find((v) => v.id === id) ||
      null
    );
  }

  function getViewsForObject(objectType) {
    return views.filter((v) => v.objectType === objectType);
  }

  function addView(view) {
    const newView = {
      id: `user-view-${Date.now()}`,
      isSystem: false,
      isDefault: false,
      icon: "list",
      ...view,
    };
    const updated = [...userViews, newView];
    setUserViews(updated);
    persistUserViews(orgId, updated);
    return newView;
  }

  function deleteView(id) {
    const updated = userViews.filter((v) => v.id !== id);
    setUserViews(updated);
    persistUserViews(orgId, updated);
  }

  function updateView(id, changes) {
    const updated = userViews.map((v) => (v.id === id ? { ...v, ...changes } : v));
    setUserViews(updated);
    persistUserViews(orgId, updated);
  }

  return (
    <ViewsCtx.Provider
      value={{ views, getView, getViewsForObject, addView, deleteView, updateView }}
    >
      {children}
    </ViewsCtx.Provider>
  );
}

export function useViews() {
  const ctx = useContext(ViewsCtx);
  if (!ctx) throw new Error("useViews must be used within a ViewsProvider");
  return ctx;
}
