"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { countRemainingChecklistSteps } from "@/lib/incidentChecklist";
import type { IncidentRecord } from "@/lib/types";

const STORAGE_KEY = "tep-dashboard-incident-checklist-v1";

type CheckedMap = Record<string, string[]>;

type IncidentChecklistContextValue = {
  /** True after attempting to read localStorage (client). */
  ready: boolean;
  isChecked: (incidentId: string, itemId: string) => boolean;
  toggle: (incidentId: string, itemId: string) => void;
  remainingSteps: (incidents: IncidentRecord[]) => number;
};

const IncidentChecklistContext =
  createContext<IncidentChecklistContextValue | null>(null);

export function IncidentChecklistProvider({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState<CheckedMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          startTransition(() => {
            setChecked(parsed as CheckedMap);
          });
        }
      }
    } catch {
      /* ignore */
    }
    startTransition(() => {
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, ready]);

  const isChecked = useCallback(
    (incidentId: string, itemId: string) =>
      (checked[incidentId] ?? []).includes(itemId),
    [checked],
  );

  const toggle = useCallback((incidentId: string, itemId: string) => {
    setChecked((prev) => {
      const cur = new Set(prev[incidentId] ?? []);
      if (cur.has(itemId)) cur.delete(itemId);
      else cur.add(itemId);
      return { ...prev, [incidentId]: [...cur] };
    });
  }, []);

  const remainingSteps = useCallback(
    (incidents: IncidentRecord[]) =>
      countRemainingChecklistSteps(incidents, checked),
    [checked],
  );

  const value = useMemo(
    () => ({
      ready,
      isChecked,
      toggle,
      remainingSteps,
    }),
    [ready, isChecked, toggle, remainingSteps],
  );

  return (
    <IncidentChecklistContext.Provider value={value}>
      {children}
    </IncidentChecklistContext.Provider>
  );
}

export function useIncidentChecklist() {
  const ctx = useContext(IncidentChecklistContext);
  if (!ctx) {
    throw new Error(
      "useIncidentChecklist must be used within IncidentChecklistProvider",
    );
  }
  return ctx;
}
