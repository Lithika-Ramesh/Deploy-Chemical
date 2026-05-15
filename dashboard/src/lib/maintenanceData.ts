import { FAULT_CATALOG } from "./faultCatalog";
import { FAULT5_MAINTENANCE_CASES } from "./fault5MaintenanceCases";
import type { SimulationConfig } from "./mockTelemetry";
import type { MaintenanceRecommendation, Severity } from "./types";

function urgencyFrom(sev: Severity): MaintenanceRecommendation["urgency"] {
  if (sev === "CRITICAL") return "P1";
  if (sev === "HIGH") return "P2";
  if (sev === "MEDIUM") return "P3";
  return "P4";
}

export function buildMaintenanceRecommendations(
  config: SimulationConfig,
  tick: number,
): MaintenanceRecommendation[] {
  if (config.mode !== "fault") return FAULT5_MAINTENANCE_CASES;

  const def = FAULT_CATALOG[config.faultId];
  const sev: Severity =
    config.emergency || config.severity >= 5
      ? "CRITICAL"
      : config.severity >= 3
        ? "HIGH"
        : "MEDIUM";

  const dynamic: MaintenanceRecommendation = {
    id: `m-live-${config.faultId}`,
    equipment: def.affectedSystems[0] ?? "Critical asset",
    issue: `${def.label} — model-driven finding`,
    risk: sev,
    impact:
      sev === "CRITICAL"
        ? "Immediate production / safety exposure"
        : "Elevated downtime probability within predicted window",
    steps: [
      def.recommendedAction,
      ...def.actionDetail.split(" · "),
      `Digital twin tick ${tick}: confirm field readings`,
    ],
    urgency: urgencyFrom(sev),
    failureWindowMinutes: Math.max(3, def.baseFailureMinutes - Math.floor(tick / 8)),
    progressPct: Math.min(95, 22 + config.severity * 12),
    faultId: config.faultId,
  };

  const fault5Match = FAULT5_MAINTENANCE_CASES.find(
    (c) => c.faultId === config.faultId,
  );
  if (fault5Match) {
    return [dynamic, fault5Match, ...FAULT5_MAINTENANCE_CASES.filter((c) => c.id !== fault5Match.id)];
  }

  return [dynamic, ...FAULT5_MAINTENANCE_CASES];
}
