import type { FaultId } from "./faultCatalog";
import type {
  IncidentRecord,
  MaintenanceRecommendation,
  SensorPoint,
} from "./types";

export type NotebookMaintenancePayload = MaintenanceRecommendation;

/** Static export consumed by the dashboard (from notebooks 04a / 04b + export script). */
export interface NotebookBinaryModelMetrics {
  auc?: number;
  threshold?: number;
  accuracy?: number;
  macroF1?: number;
  macroRecall?: number;
  configLabel?: string;
}

export interface NotebookMulticlassComparisonRow {
  model: string;
  split: string;
  train_time_s?: number | null;
  accuracy: number;
  macro_recall: number;
  macro_f1: number;
  weighted_f1: number;
}

/** Optional extra columns from merged TEP test rows (export script). */
export interface NotebookTelemetryPoint extends SensorPoint {
  sample?: number;
  trueFaultLabel?: number;
  predFault?: number;
  maxProb?: number;
}

export interface NotebookIncidentPayload {
  id: string;
  ts: string;
  severity: IncidentRecord["severity"];
  subsystem: string;
  title: string;
  diagnosis: string;
  recommendedAction: string;
  faultId: FaultId | null;
  acknowledged: boolean;
  checklist?: IncidentRecord["checklist"];
}

export interface NotebookDashboardBundle {
  version: 1;
  generatedAt: string;
  sourceNote: string;
  binary: {
    defaultModelKey: string;
    models: Record<string, NotebookBinaryModelMetrics>;
  };
  multiclass: {
    champion: string;
    comparison: NotebookMulticlassComparisonRow[];
    featureCount: number;
    xmeasCount: number;
  };
  incidents: NotebookIncidentPayload[];
  maintenance: NotebookMaintenancePayload[];
  telemetry: NotebookTelemetryPoint[];
  /** Index into `telemetry` where fault-period begins (optional, for chart markers). */
  faultOnsetIndex?: number | null;
  architecture?: {
    headline: string;
    detail: string;
  };
}

export function isNotebookDashboardBundle(x: unknown): x is NotebookDashboardBundle {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const mc = o.multiclass as Record<string, unknown> | undefined;
  return (
    o.version === 1 &&
    typeof o.generatedAt === "string" &&
    o.binary != null &&
    typeof o.binary === "object" &&
    mc != null &&
    typeof mc === "object" &&
    Array.isArray(mc.comparison) &&
    Array.isArray(o.incidents) &&
    Array.isArray(o.maintenance) &&
    Array.isArray(o.telemetry)
  );
}
