import { FAULT_CATALOG, FAULT_ORDER, type FaultId } from "./faultCatalog";
import type {
  AIInsight,
  FaultClassProbability,
  PlantSnapshot,
  PlantStatus,
  SensorPoint,
  Severity,
} from "./types";

/** Matches export script / notebook operational threshold */
export const BINARY_FAULT_THRESHOLD = 0.35;

export type Fault13ReplayPayload = {
  samples: number[];
  p_fault: number[];
  health_score: number[];
  is_fault: number[];
  fault_type: number[];
  xmeas_9: number[];
  xmv_10: number[];
  xmeas_22: number[];
  xmv_11: number[];
};

export function isFault13ReplayPayload(x: unknown): x is Fault13ReplayPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.samples) &&
    Array.isArray(o.p_fault) &&
    Array.isArray(o.health_score) &&
    Array.isArray(o.is_fault) &&
    Array.isArray(o.fault_type) &&
    Array.isArray(o.xmeas_9) &&
    Array.isArray(o.xmv_10)
  );
}

/** Recommended action strings from dashboard brief (IDV 1–15). */
export const RECOMMENDED_ACTIONS: Record<number, string> = {
  1: "Check A/C feed ratio — verify stream 4 composition analysis",
  2: "Check B composition in stream 4 — request lab sample",
  3: "Monitor D feed temperature — check stream 2 heat exchanger",
  4: "CHECK REACTOR COOLING WATER — inspect CW inlet temperature and flow",
  5: "Check condenser cooling water — inspect CV-31 valve position",
  6: "EMERGENCY: A feed loss detected — check stream 1 valve and upstream supply",
  7: "Check C header pressure — inspect stream 4 supply pressure",
  8: "Monitor feed composition — request stream 4 analysis",
  9: "Monitor D feed temperature — within normal variation",
  10: "Monitor C feed temperature — within normal variation",
  11: "Check reactor cooling water temperature — inspect CW system",
  12: "Monitor condenser cooling water temperature",
  13: "Monitor reaction kinetics — check catalyst activity. Schedule inspection.",
  14: "INSPECT REACTOR CW VALVE — stiction detected. Manual check required.",
  15: "INSPECT CONDENSER CW VALVE — stiction detected. Manual check required.",
};

export function recommendedActionForFault(faultId: number): string {
  if (faultId >= 16 && faultId <= 20) {
    return "Review process data and contact process engineer for unclassified signature.";
  }
  return (
    RECOMMENDED_ACTIONS[faultId] ??
    "Review process data and contact process engineer."
  );
}

/** Risk lookup from brief; IDV(13) escalates to HIGH when confidence > 80%. */
export function operationalRiskLevel(
  faultId: number,
  pFault: number,
): "LOW" | "MEDIUM" | "HIGH" {
  if (faultId === 13) {
    return pFault > 0.8 ? "HIGH" : "MEDIUM";
  }
  const table: Record<number, "LOW" | "MEDIUM" | "HIGH"> = {
    1: "MEDIUM",
    2: "MEDIUM",
    3: "LOW",
    4: "HIGH",
    5: "HIGH",
    6: "HIGH",
    7: "HIGH",
    8: "MEDIUM",
    9: "LOW",
    10: "LOW",
    11: "HIGH",
    12: "MEDIUM",
    14: "HIGH",
    15: "HIGH",
  };
  if (faultId >= 16 && faultId <= 20) return "LOW";
  return table[faultId] ?? "LOW";
}

function severityForPlant(
  plant: PlantStatus,
  fault: boolean,
  risk: "LOW" | "MEDIUM" | "HIGH",
): Severity {
  if (!fault) return "NONE";
  if (plant === "CRITICAL") return "CRITICAL";
  if (risk === "HIGH") return "HIGH";
  if (risk === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function maintenanceRiskFrom(
  risk: "LOW" | "MEDIUM" | "HIGH",
): AIInsight["maintenanceRisk"] {
  if (risk === "HIGH") return "SEVERE";
  if (risk === "MEDIUM") return "MODERATE";
  return "LOW";
}

export function faultDescriptionLine(faultId: number): string {
  if (faultId === 13) return "Reaction Kinetics Slow Drift";
  return FAULT_CATALOG[faultId as FaultId]?.description ?? "Unknown fault";
}

export function buildFault13FaultProbabilities(
  payload: Fault13ReplayPayload,
  index: number,
): FaultClassProbability[] {
  const i = clampIndex(payload, index);
  const activeId = Math.min(20, Math.max(1, Math.round(payload.fault_type[i] ?? 13)));
  const rows = FAULT_ORDER.filter((id) => id > 0).map((id) => ({
    fault: FAULT_CATALOG[id].description,
    pct: id === activeId ? 88 : Math.round((4 + (id % 7)) * 10) / 10,
  }));
  return rows.sort((a, b) => b.pct - a.pct);
}

function clampIndex(payload: Fault13ReplayPayload, index: number): number {
  const n = payload.samples.length;
  if (n === 0) return 0;
  return Math.min(Math.max(0, index), n - 1);
}

export function buildFault13Snapshot(
  payload: Fault13ReplayPayload,
  index: number,
): PlantSnapshot {
  const i = clampIndex(payload, index);
  const p = Number(payload.p_fault[i] ?? 0);
  const health = Number(payload.health_score[i] ?? (1 - p) * 100);
  const fault = Number(payload.is_fault[i] ?? 0) === 1;
  const classId = Math.min(20, Math.max(1, Math.round(Number(payload.fault_type[i] ?? 13))));
  const x9 = Number(payload.xmeas_9[i] ?? 120);
  const x10 = Number(payload.xmv_10[i] ?? 41);
  const x22 = Number(payload.xmeas_22[i] ?? 77);
  const x11 = Number(payload.xmv_11[i] ?? 18);

  const risk = operationalRiskLevel(classId, p);
  const plant: PlantStatus = !fault
    ? "NORMAL"
    : risk === "HIGH" || p >= 0.92
      ? "CRITICAL"
      : "WARNING";

  const severity = severityForPlant(plant, fault, risk);
  const detectedFault = fault
    ? `⚠ Fault IDV(${classId}) detected — ${faultDescriptionLine(classId)}`
    : "Plant running normally";

  const insight: AIInsight = {
    plantStatus: plant,
    detectedFault,
    faultId: fault ? (classId as FaultId) : null,
    confidencePct: Math.min(100, Math.max(0, Math.round(p * 100))),
    severity,
    maintenanceRisk: fault ? maintenanceRiskFrom(risk) : "LOW",
    riskScore: Math.min(1, Math.max(0, p)),
    riskLevel: fault ? risk : "LOW",
    failureWindowMinutes: fault ? Math.max(5, 480 - Math.round(payload.samples[i] ?? 0)) : null,
    recommendedAction: fault
      ? recommendedActionForFault(classId)
      : "Maintain steady-state operation",
    actionDetail: fault
      ? `${recommendedActionForFault(classId)} Contact process engineer if deviation persists.`
      : "Continue monitoring reactor exotherm and separator delta-P. No model alarm on this timestep.",
    affectedSystems: fault
      ? FAULT_CATALOG[classId as FaultId]?.affectedSystems ?? ["R-101", "Catalyst system"]
      : ["Plant-wide"],
  };

  const sensors: SensorPoint = {
    t: Number(payload.samples[i] ?? i),
    reactorTemp: x9,
    separatorPressure: x22,
    flowRate: x10,
    vibration: Math.min(0.99, 0.35 + x11 / 200),
    anomalyScore: Math.min(0.99, Math.max(0, p)),
  };

  return {
    insight,
    sensors,
    systemHealthPct: Math.min(100, Math.max(0, health)),
    aiOnline: true,
    anomalyIndex: Math.min(1, Math.max(0, p)),
    predictionLatencyMs: 32 + Math.round((payload.samples[i] ?? 0) % 40),
  };
}
