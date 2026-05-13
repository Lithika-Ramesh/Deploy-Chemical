import type { FaultId } from "./faultCatalog";

export type PlantStatus = "NORMAL" | "WARNING" | "CRITICAL";

export type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MaintenanceRisk = "LOW" | "MODERATE" | "ELEVATED" | "SEVERE";

export interface SensorPoint {
  t: number;
  reactorTemp: number;
  separatorPressure: number;
  flowRate: number;
  vibration: number;
  anomalyScore: number;
}

export interface AIInsight {
  plantStatus: PlantStatus;
  detectedFault: string | null;
  faultId: FaultId | null;
  confidencePct: number;
  severity: Severity;
  maintenanceRisk: MaintenanceRisk;
  riskScore: number; // 0..1
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  failureWindowMinutes: number | null;
  recommendedAction: string;
  actionDetail: string;
  affectedSystems: string[];
}

export interface PlantEvent {
  id: string;
  ts: Date;
  kind: "maintenance" | "ai_alert" | "anomaly" | "recommendation" | "log";
  title: string;
  detail: string;
  severity: Severity;
}

export interface PlantSnapshot {
  insight: AIInsight;
  sensors: SensorPoint;
  systemHealthPct: number;
  aiOnline: boolean;
  anomalyIndex: number;
  predictionLatencyMs: number;
}

export interface IncidentRecord {
  id: string;
  ts: Date;
  severity: Severity;
  subsystem: string;
  title: string;
  diagnosis: string;
  recommendedAction: string;
  faultId: FaultId | null;
  acknowledged: boolean;
}

export interface MaintenanceRecommendation {
  id: string;
  equipment: string;
  issue: string;
  risk: Severity;
  impact: string;
  steps: string[];
  urgency: "P4" | "P3" | "P2" | "P1";
  failureWindowMinutes: number | null;
  progressPct: number;
  faultId: FaultId | null;
}

export interface ShapFeature {
  tag: string;
  value: number;
}

export interface FaultClassProbability {
  fault: string;
  pct: number;
}
