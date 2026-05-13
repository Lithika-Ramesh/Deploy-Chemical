/**
 * Optional bridge to the FastAPI service (`api.main`).
 * Set `NEXT_PUBLIC_AIFI_API_URL=http://127.0.0.1:8000` to enable live calls.
 */

const base = process.env.NEXT_PUBLIC_AIFI_API_URL?.replace(/\/$/, "") ?? "";

export function isApiConfigured(): boolean {
  return base.length > 0;
}

export async function fetchApiHealth(): Promise<{ status: string } | null> {
  if (!base) return null;
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchMetrics(): Promise<Record<string, unknown> | null> {
  if (!base) return null;
  try {
    const res = await fetch(`${base}/metrics`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
