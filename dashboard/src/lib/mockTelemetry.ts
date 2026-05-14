import type { FaultId } from "./faultCatalog";
import { FAULT_CATALOG, FAULT_ORDER } from "./faultCatalog";
import type {
  AIInsight,
  FaultClassProbability,
  PlantEvent,
  PlantSnapshot,
  PlantStatus,
  SensorPoint,
  Severity,
  ShapFeature,
} from "./types";

let tick = 0;

function rnd(seed: number) {
  const x = Math.sin(seed + tick * 0.01) * 10000;
  return x - Math.floor(x);
}

export function resetMockClock() {
  tick = 0;
}

export function getSimulationTick() {
  return tick;
}

export interface SimulationConfig {
  /** Fault scenario is driving the twin */
  mode: "normal" | "fault";
  faultId: FaultId;
  /** 1 = early, 5 = severe */
  severity: number;
  emergency: boolean;
}

const NORMAL_INSIGHT: AIInsight = {
  plantStatus: "NORMAL",
  detectedFault: null,
  faultId: null,
  confidencePct: 94,
  severity: "NONE",
  maintenanceRisk: "LOW",
  riskScore: 0,
  riskLevel: "LOW",
  failureWindowMinutes: null,
  recommendedAction: "Maintain steady-state operation",
  actionDetail:
    "Continue monitoring reactor exotherm and separator delta-P. No model drift detected.",
  affectedSystems: ["Plant-wide"],
};

function clampSeverity(n: number) {
  return Math.min(5, Math.max(1, Math.round(n)));
}

function severityFromLevel(level: number, emergency: boolean): Severity {
  if (emergency) return "CRITICAL";
  if (level >= 5) return "CRITICAL";
  if (level >= 4) return "HIGH";
  if (level >= 3) return "MEDIUM";
  if (level >= 2) return "LOW";
  return "LOW";
}

function plantStatusFrom(
  mode: "normal" | "fault",
  level: number,
  emergency: boolean,
): PlantStatus {
  if (mode === "normal") return "NORMAL";
  if (emergency || level >= 5) return "CRITICAL";
  if (level >= 3) return "WARNING";
  return "WARNING";
}

function maintenanceRiskFrom(sev: Severity): AIInsight["maintenanceRisk"] {
  if (sev === "CRITICAL") return "SEVERE";
  if (sev === "HIGH") return "ELEVATED";
  if (sev === "MEDIUM") return "MODERATE";
  return "LOW";
}

function riskLevelFromScore(score: number): AIInsight["riskLevel"] {
  if (score >= 0.75) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

function faultSpike(config: SimulationConfig): number {
  const base = (tick % 200) / 80;
  const sev = clampSeverity(config.severity);
  const ramp = 1 + Math.min(1, base) * (0.35 + sev * 0.18);
  return config.emergency ? Math.max(ramp, 1.85) : ramp;
}

function generateSensorRow(config: SimulationConfig, t: number): SensorPoint {
  const baseTemp = 118 + Math.sin(t / 8) * 1.2 + (rnd(1) - 0.5) * 0.4;
  const basePress = 2750 + Math.cos(t / 11) * 35 + (rnd(2) - 0.5) * 12;
  const baseFlow = 52 + Math.sin(t / 6) * 0.8 + (rnd(3) - 0.5) * 0.15;
  const baseVib = 0.42 + Math.abs(Math.sin(t / 14)) * 0.06 + (rnd(4) - 0.5) * 0.02;
  const sp = config.mode === "fault" ? faultSpike(config) : 0;

  if (config.mode === "normal") {
    return {
      t,
      reactorTemp: baseTemp,
      separatorPressure: basePress,
      flowRate: baseFlow,
      vibration: baseVib,
      anomalyScore: Math.max(0, 0.04 + (rnd(8) - 0.5) * 0.03),
    };
  }

  const id = config.faultId;
  let temp = baseTemp;
  let press = basePress;
  let flow = baseFlow;
  let vib = baseVib;
  let anom = 0.12 + 0.55 * sp + (rnd(7) - 0.5) * 0.06;

  switch (id) {
    case 0:
      break;
    case 4:
    case 11:
      temp += 6 * sp + (rnd(5) - 0.5) * 1.1;
      press += 120 * sp;
      flow = Math.max(38, flow - 2.5 * sp);
      vib += 0.12 * sp;
      break;
    case 1:
    case 2:
    case 6:
    case 8:
      flow = Math.max(32, flow - 9 * sp);
      press -= 55 * sp;
      temp -= 1.2 * sp;
      anom += 0.08 * sp;
      break;
    case 7:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
      press += (180 * sp + Math.sin(tick / 3) * 40 * sp) * 0.6;
      flow += Math.sin(tick / 2.5) * 1.2 * sp;
      vib += 0.08 * sp;
      break;
    case 13:
      temp += (tick * 0.02 * sp) % 4;
      press += (tick * 0.15 * sp) % 25;
      anom += 0.05 * sp;
      break;
    case 14:
    case 15:
      flow += Math.sin(tick / 1.8) * 4 * sp;
      press += 90 * sp * Math.abs(Math.sin(tick / 4));
      vib += 0.2 * sp;
      break;
    case 5:
    case 12:
      press += 200 * sp;
      vib += 0.22 * sp;
      flow -= 2 * sp;
      temp += 1.5 * sp;
      break;
    case 3:
    case 9:
    case 10:
      vib += 0.45 * sp;
      press -= 40 * sp;
      flow -= 3 * sp;
      temp += 2 * sp;
      break;
    default:
      break;
  }

  return {
    t,
    reactorTemp: temp,
    separatorPressure: press,
    flowRate: flow,
    vibration: vib,
    anomalyScore: Math.min(0.99, Math.max(0, anom)),
  };
}

function buildFaultInsight(config: SimulationConfig): AIInsight {
  if (config.faultId === 0) {
    return {
      ...NORMAL_INSIGHT,
      faultId: 0,
      detectedFault: null,
      affectedSystems: FAULT_CATALOG[0].affectedSystems,
      recommendedAction: FAULT_CATALOG[0].recommendedAction,
      actionDetail: FAULT_CATALOG[0].actionDetail,
    };
  }

  const def = FAULT_CATALOG[config.faultId];
  const level = clampSeverity(config.severity);
  const sev = severityFromLevel(level, config.emergency);
  const plant = plantStatusFrom(config.mode, level, config.emergency);
  const progress = Math.min(1, tick / 160);
  const window = Math.max(
    2,
    Math.round(def.baseFailureMinutes * (1 - progress * 0.35) - tick / 50),
  );
  const conf = Math.min(
    99,
    86 + level * 2 + (config.emergency ? 6 : 0) + Math.floor(progress * 4),
  );
  const severityWeight: Record<Severity, number> = {
    NONE: 0,
    LOW: 0.35,
    MEDIUM: 0.6,
    HIGH: 0.85,
    CRITICAL: 1,
  };
  const riskScore = Math.min(1, (conf / 100) * severityWeight[sev]);

  return {
    plantStatus: plant,
    detectedFault: def.label,
    faultId: config.faultId,
    confidencePct: conf,
    severity: sev,
    maintenanceRisk: maintenanceRiskFrom(sev),
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    failureWindowMinutes: window,
    recommendedAction: def.recommendedAction,
    actionDetail: def.actionDetail,
    affectedSystems: def.affectedSystems,
  };
}

export function buildSnapshot(config: SimulationConfig): PlantSnapshot {
  const insight: AIInsight =
    config.mode === "normal" ? NORMAL_INSIGHT : buildFaultInsight(config);

  const sensors = generateSensorRow(config, tick);
  const systemHealthPct =
    config.mode === "normal"
      ? 96 + (rnd(9) - 0.5) * 1.5
      : Math.max(
          28,
          94 -
            tick * (0.06 + config.severity * 0.02) -
            (config.emergency ? 18 : 0),
        );

  const anomalyIndex =
    config.mode === "normal"
      ? 0.08 + (rnd(10) - 0.5) * 0.02
      : 0.35 + faultSpike(config) * 0.22;

  const predictionLatencyMs =
    28 + Math.floor(rnd(11) * 40) + (config.mode === "fault" ? 15 : 0);

  return {
    insight,
    sensors,
    systemHealthPct: Math.min(100, Math.max(0, systemHealthPct)),
    aiOnline: true,
    anomalyIndex: Math.min(1, Math.max(0, anomalyIndex)),
    predictionLatencyMs,
  };
}

export function advanceMockTick() {
  tick += 1;
}

export function seedFaultEvents(config: SimulationConfig): PlantEvent[] {
  const now = new Date();
  const base: PlantEvent[] = [
    {
      id: "e1",
      ts: new Date(now.getTime() - 1000 * 60 * 12),
      kind: "log",
      title: "Digital twin sync",
      detail: "TEP surrogate model aligned with historian batch 07-A.",
      severity: "LOW",
    },
    {
      id: "e2",
      ts: new Date(now.getTime() - 1000 * 60 * 6),
      kind: "maintenance",
      title: "PM-2041 · Separator inspection",
      detail: "Window scheduled 02:00–04:00 · Parts staged at Bay C.",
      severity: "LOW",
    },
    {
      id: "e3",
      ts: new Date(now.getTime() - 1000 * 60 * 2),
      kind: "recommendation",
      title: "Optimizer hint",
      detail: "Feed split bias +0.6% toward stripper under current pricing.",
      severity: "NONE",
    },
  ];

  if (config.mode === "normal") return base;

  const def = FAULT_CATALOG[config.faultId];
  return [
    {
      id: "f1",
      ts: new Date(now.getTime() - 1000 * 45),
      kind: "ai_alert",
      title: `Model confidence · ${def.label}`,
      detail: `Signature diverging on ${def.affectedSystems[0]}.`,
      severity: "HIGH",
    },
    {
      id: "f2",
      ts: new Date(now.getTime() - 1000 * 20),
      kind: "anomaly",
      title: "Multivariate anomaly",
      detail: "Mahalanobis distance exceeded 3σ for sustained window.",
      severity: "HIGH",
    },
    {
      id: "f3",
      ts: new Date(now.getTime() - 1000 * 8),
      kind: "maintenance",
      title: "Auto-ticket generated",
      detail: `${def.recommendedAction} — crew notified.`,
      severity: "CRITICAL",
    },
    ...base,
  ];
}

export function statusColorClass(status: PlantStatus): string {
  if (status === "CRITICAL") return "text-red-400";
  if (status === "WARNING") return "text-amber-400";
  return "text-emerald-400";
}

export function buildShapImportance(
  config: SimulationConfig,
): ShapFeature[] {
  const base: ShapFeature[] = [
    { tag: "xmeas_9", value: 0.08 },
    { tag: "xmeas_21", value: 0.07 },
    { tag: "xmeas_7", value: 0.06 },
    { tag: "xmeas_12", value: 0.055 },
    { tag: "xmeas_17", value: 0.05 },
    { tag: "xmeas_3", value: 0.045 },
    { tag: "xmeas_31", value: 0.04 },
    { tag: "xmeas_41", value: 0.035 },
  ];
  if (config.mode === "normal") return base;

  const bump = (tag: string, v: number) =>
    base.map((b) => (b.tag === tag ? { ...b, value: b.value + v } : b));

  switch (config.faultId) {
    case 0:
      return base;
    case 4:
    case 11:
      return bump("xmeas_9", 0.12).sort((a, b) => b.value - a.value);
    case 1:
    case 2:
    case 6:
    case 8:
      return bump("xmeas_21", 0.11).sort((a, b) => b.value - a.value);
    case 7:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
      return bump("xmeas_12", 0.1).sort((a, b) => b.value - a.value);
    case 13:
      return bump("xmeas_17", 0.09).sort((a, b) => b.value - a.value);
    case 14:
    case 15:
      return bump("xmeas_3", 0.1).sort((a, b) => b.value - a.value);
    case 5:
    case 12:
      return bump("xmeas_31", 0.11).sort((a, b) => b.value - a.value);
    case 3:
    case 9:
    case 10:
      return bump("xmeas_41", 0.12).sort((a, b) => b.value - a.value);
    default:
      return base;
  }
}

export function buildFaultProbabilities(
  config: SimulationConfig,
): FaultClassProbability[] {
  const labels = FAULT_ORDER.map((id) =>
    id === 0 ? "Normal" : FAULT_CATALOG[id].description,
  );
  const weights = FAULT_ORDER.map((id) =>
    id === 0 ? 0.35 : rnd(id + 3) * 0.06,
  );
  if (config.mode === "fault" && config.faultId !== 0) {
    const j = config.faultId;
    weights[j] += 0.45 + config.severity * 0.04 + (config.emergency ? 0.12 : 0);
    weights[0] *= 0.35;
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  return labels
    .map((fault, i) => ({
      fault,
      pct: Math.round((weights[i]! / sum) * 1000) / 10,
    }))
    .sort((a, b) => b.pct - a.pct);
}

export function severityBadgeClass(s: Severity): string {
  if (s === "CRITICAL") return "bg-red-500/20 text-red-200 border-red-500/40";
  if (s === "HIGH") return "bg-orange-500/15 text-orange-200 border-orange-400/35";
  if (s === "MEDIUM") return "bg-amber-500/12 text-amber-100 border-amber-400/30";
  if (s === "LOW") return "bg-cyan-500/10 text-cyan-100 border-cyan-400/25";
  return "bg-slate-500/10 text-slate-300 border-slate-500/20";
}
