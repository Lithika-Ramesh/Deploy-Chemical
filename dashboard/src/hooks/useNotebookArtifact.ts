"use client";

import { useEffect, useState } from "react";

/**
 * Loads static JSON from `public/`. On failure or missing file, keeps `fallback`
 * so panels stay usable with no visible error state.
 */
export function useNotebookArtifact<T>(path: string, fallback: T): T {
  const [data, setData] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;
    fetch(path)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        if (!cancelled && d != null) setData(d as T);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);

  return data;
}
