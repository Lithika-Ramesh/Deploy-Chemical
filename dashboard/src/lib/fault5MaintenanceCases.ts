import { FAULT_CATALOG } from "./faultCatalog";
import type { MaintenanceRecommendation } from "./types";

/** Metrics from `outputs/figures/fault5/curated_run_metrics.csv` (tep_test.csv + champion models). */
export const FAULT5_TEP_ONSET_SAMPLE = 161;

export type Fault5CaseMetrics = {
  simulationRun: number;
  preFalseAlarms: number;
  firstAlertSample: number | null;
  detectionDelaySamples: number | null;
  maxPFault: number;
  multiclassIdv5Pct: number;
  xmeas13Delta: number;
  caseTag: string;
};

const F5 = FAULT_CATALOG[5];

function workOrder(
  id: string,
  run: number,
  caseTag: string,
  issue: string,
  impact: string,
  risk: MaintenanceRecommendation["risk"],
  urgency: MaintenanceRecommendation["urgency"],
  progressPct: number,
  metrics: Omit<Fault5CaseMetrics, "caseTag"> & { caseTag: string },
  extraSteps: string[] = [],
): MaintenanceRecommendation {
  return {
    id,
    equipment: `${F5.affectedSystems.join(" · ")} · tep_test run ${run}`,
    issue,
    risk,
    impact,
    steps: [
      F5.recommendedAction,
      ...F5.actionDetail.split(" · "),
      ...extraSteps,
    ],
    urgency,
    failureWindowMinutes:
      metrics.detectionDelaySamples != null && metrics.detectionDelaySamples >= 0
        ? Math.max(3, 11 + metrics.detectionDelaySamples * 3)
        : 45,
    progressPct,
    faultId: 5,
    tepCase: metrics,
  };
}

/** Curated Fault 5 maintenance / case-study work orders (real test-set runs). */
export const FAULT5_MAINTENANCE_CASES: MaintenanceRecommendation[] = [
  workOrder(
    "f5-pm-78",
    78,
    "Clean hero",
    "IDV(5) condenser CW inlet T step — instant alert at injection with zero pre-fault alarms",
    "tep_test run 78: pre-FA 0 · 1st alert sample 161 · delay 0 · max P(fault) 99.996% · IDV(5) label 98% · ΔXMEAS_13 +2.74",
    "LOW",
    "P4",
    0,
    {
      simulationRun: 78,
      preFalseAlarms: 0,
      firstAlertSample: 161,
      detectionDelaySamples: 0,
      maxPFault: 0.999964,
      multiclassIdv5Pct: 98.375,
      xmeas13Delta: 2.743625,
      caseTag: "Clean hero",
    },
    [
      "Use as default simulation replay when demoing Fault 5",
      "Compare XMEAS_13 and XMV_11 traces to operator DCS historian",
    ],
  ),
  workOrder(
    "f5-pm-148",
    148,
    "Strong separator step (−)",
    "Large negative separator pressure step after condenser CW upset — high visual signature",
    "tep_test run 148: pre-FA 0 · alert sample 162 (1-sample delay) · ΔXMEAS_13 −7.83 · IDV(5) 98%",
    "HIGH",
    "P2",
    0,
    {
      simulationRun: 148,
      preFalseAlarms: 0,
      firstAlertSample: 162,
      detectionDelaySamples: 1,
      maxPFault: 0.999933,
      multiclassIdv5Pct: 98.123,
      xmeas13Delta: -7.83125,
      caseTag: "Strong step (−)",
    },
    [
      "Prioritize separator PIT calibration and condenser duty check",
      "Use for chart-heavy dashboard demos (clear post-161 transient)",
    ],
  ),
];
