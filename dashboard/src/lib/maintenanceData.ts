import { FAULT_CATALOG } from "./faultCatalog";
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
  const staticList: MaintenanceRecommendation[] = [
    {
      id: "m-1",
      equipment: "Stripper reboiler E-204",
      issue: "Fouling index trending high",
      risk: "MEDIUM",
      impact: "~2.1% energy penalty if unaddressed within 72h",
      steps: [
        "Pull last 30d duty vs. UA estimate",
        "Schedule chemical clean window",
        "Verify steam trap farm",
      ],
      urgency: "P3",
      failureWindowMinutes: 4200,
      progressPct: 62,
      faultId: null,
    },
    {
      id: "m-2",
      equipment: "Analyzer AT-17",
      issue: "Validation gap vs. lab",
      risk: "LOW",
      impact: "Optimizer bias risk on light key",
      steps: [
        "Run 3-point calibration",
        "Cross-check GC backflush cycle",
      ],
      urgency: "P4",
      failureWindowMinutes: null,
      progressPct: 28,
      faultId: 13,
    },
    {
      id: "m-3",
      equipment: "Recycle compressor K-101",
      issue: "Seal gas differential soft",
      risk: "HIGH",
      impact: "Trip risk under recycle upset",
      steps: [
        "Inspect seal gas regulator",
        "Verify balance line purge",
      ],
      urgency: "P2",
      failureWindowMinutes: 180,
      progressPct: 44,
      faultId: 7,
    },
  ];

  if (config.mode !== "fault") return staticList;

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

  return [dynamic, ...staticList];
}
