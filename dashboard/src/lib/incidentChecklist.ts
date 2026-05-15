import type { IncidentRecord } from "./types";

export type IncidentChecklistItem = {
  id: string;
  label: string;
};

/** Default operator steps when an incident has no embedded checklist. */
export const DEFAULT_INCIDENT_CHECKLIST: IncidentChecklistItem[] = [
  { id: "review", label: "check CW inlet temperature" },
  { id: "notes", label: "inspect CWS supply line" },
  { id: "dcs", label: "monitor separtor pressure" },
  { id: "dcs", label: "schedule inspection within 24h" },
];

export function getChecklistForIncident(inc: IncidentRecord): IncidentChecklistItem[] {
  if (inc.checklist && inc.checklist.length > 0) return inc.checklist;
  return DEFAULT_INCIDENT_CHECKLIST;
}

/** Sum of unchecked checklist items for incidents that are still unacknowledged in source data. */
export function countRemainingChecklistSteps(
  incidents: IncidentRecord[],
  checkedByIncidentId: Record<string, string[]>,
): number {
  let sum = 0;
  for (const inc of incidents) {
    if (inc.acknowledged) continue;
    const items = getChecklistForIncident(inc);
    const done = new Set(checkedByIncidentId[inc.id] ?? []);
    sum += items.filter((it) => !done.has(it.id)).length;
  }
  return sum;
}
