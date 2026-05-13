import { FAULT_CATALOG, type FaultId } from "./faultCatalog";
import type { SimulationConfig } from "./mockTelemetry";
import type { IncidentRecord, Severity } from "./types";

const SUBSYSTEMS = [
  "Reactor train",
  "Separator V-204",
  "Feed header",
  "Compressor K-101",
  "Utilities / CW",
  "DCS / Analytics",
] as const;

export function buildIncidentLibrary(
  config: SimulationConfig,
): IncidentRecord[] {
  const now = Date.now();
  const base: IncidentRecord[] = [
    {
      id: "arch-01",
      ts: new Date(now - 1000 * 60 * 60 * 26),
      severity: "LOW",
      subsystem: "DCS / Analytics",
      title: "Historian burst lag",
      diagnosis: "PI interface node buffer > 8s for batch 06",
      recommendedAction: "Restart IF-02 · verify scan class",
      faultId: null,
      acknowledged: true,
    },
    {
      id: "arch-02",
      ts: new Date(now - 1000 * 60 * 60 * 9),
      severity: "MEDIUM",
      subsystem: "Separator V-204",
      title: "Level oscillation advisory",
      diagnosis: "LC-204 MV hunting near setpoint under feed swing",
      recommendedAction: "Detune cascade · check boot purge",
      faultId: "separator_fault",
      acknowledged: true,
    },
    {
      id: "arch-03",
      ts: new Date(now - 1000 * 60 * 60 * 3),
      severity: "HIGH",
      subsystem: "Reactor train",
      title: "Exotherm rate anomaly",
      diagnosis: "Model residual on jacket ΔT vs. power draw",
      recommendedAction: "Reduce catalyst feed · inspect CW valve",
      faultId: "reactor_cooling",
      acknowledged: false,
    },
    {
      id: "arch-04",
      ts: new Date(now - 1000 * 60 * 45),
      severity: "LOW",
      subsystem: "Feed header",
      title: "Mass balance drift",
      diagnosis: "FIC-204 vs. tank strapping mismatch 1.8%",
      recommendedAction: "Verify flow element · lab grab sample",
      faultId: "feed_loss",
      acknowledged: true,
    },
    {
      id: "arch-05",
      ts: new Date(now - 1000 * 60 * 20),
      severity: "CRITICAL",
      subsystem: "Compressor K-101",
      title: "Surge margin erosion",
      diagnosis: "Recycle valve fast swings · vibration RMS rising",
      recommendedAction: "Unload compressor · check anti-surge line",
      faultId: "compressor_failure",
      acknowledged: false,
    },
  ];

  if (config.mode !== "fault") return base;

  const def = FAULT_CATALOG[config.faultId];
  const liveSeverity: Severity = config.emergency
    ? "CRITICAL"
    : config.severity >= 4
      ? "HIGH"
      : "MEDIUM";

  const live: IncidentRecord = {
    id: "live-scenario",
    ts: new Date(),
    severity: liveSeverity,
    subsystem: def.affectedSystems[0] ?? SUBSYSTEMS[0],
    title: `${def.label} — simulation active`,
    diagnosis: `AI twin: elevated residual on ${def.affectedSystems.join(", ")} · severity stage ${config.severity}`,
    recommendedAction: def.recommendedAction,
    faultId: config.faultId,
    acknowledged: false,
  };

  return [live, ...base];
}

export const INCIDENT_SUBSYSTEMS = [...SUBSYSTEMS];
