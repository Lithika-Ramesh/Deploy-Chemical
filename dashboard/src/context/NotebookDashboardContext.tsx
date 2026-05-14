"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isNotebookDashboardBundle,
  type NotebookDashboardBundle,
} from "@/lib/notebookDashboardTypes";
import type { IncidentRecord, MaintenanceRecommendation } from "@/lib/types";

type NotebookDashboardContextValue = {
  bundle: NotebookDashboardBundle | null;
  loading: boolean;
  error: string | null;
};

const NotebookDashboardContext =
  createContext<NotebookDashboardContextValue | null>(null);

function parseIncidents(raw: NotebookDashboardBundle["incidents"]): IncidentRecord[] {
  return raw.map((r) => ({
    ...r,
    ts: new Date(r.ts),
  }));
}

export function NotebookDashboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bundle, setBundle] = useState<NotebookDashboardBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/tep_notebook_dashboard.json", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: unknown = await res.json();
        if (!isNotebookDashboardBundle(data)) {
          throw new Error("Invalid tep_notebook_dashboard.json shape");
        }
        if (!cancelled) {
          setBundle(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setBundle(null);
          setError(e instanceof Error ? e.message : "Failed to load notebook data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      bundle,
      loading,
      error,
    }),
    [bundle, loading, error],
  );

  return (
    <NotebookDashboardContext.Provider value={value}>
      {children}
    </NotebookDashboardContext.Provider>
  );
}

export function useNotebookDashboard() {
  const ctx = useContext(NotebookDashboardContext);
  if (!ctx) {
    throw new Error("useNotebookDashboard must be used within NotebookDashboardProvider");
  }
  return ctx;
}

/** Incidents derived from the notebook export (empty if bundle missing). */
export function useNotebookIncidents(): IncidentRecord[] {
  const { bundle } = useNotebookDashboard();
  return useMemo(
    () => (bundle ? parseIncidents(bundle.incidents) : []),
    [bundle],
  );
}

export function useNotebookMaintenance(): MaintenanceRecommendation[] {
  const { bundle } = useNotebookDashboard();
  return useMemo(
    () => (bundle?.maintenance as MaintenanceRecommendation[]) ?? [],
    [bundle],
  );
}
