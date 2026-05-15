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
    95,
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
    "f5-pm-171",
    171,
    "Pre-fault nuisance alarms",
    "Binary gate fires 90 times before sample 161 — alarm-trust / false-alarm review required",
    "tep_test run 171: pre-FA 90 · 1st alert sample 21 (140 samples early) · post-onset P(fault) still ~99.996% · IDV(5) 88%",
    "HIGH",
    "P1",
    35,
    {
      simulationRun: 171,
      preFalseAlarms: 90,
      firstAlertSample: 21,
      detectionDelaySamples: -140,
      maxPFault: 0.999958,
      multiclassIdv5Pct: 88.427,
      xmeas13Delta: -0.916,
      caseTag: "Nuisance alarms",
    },
    [
      "Review alarm rationalization and deadband on binary score (threshold 0.35)",
      "Pair with clean run 78 in maintenance briefing — same fault, different alarm burden",
      "Inspect condenser CW flow (XMV_11) vs separator pressure (XMEAS_13) before blaming instrumentation",
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
    55,
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
  workOrder(
    "f5-pm-429",
    429,
    "Strong separator step (+)",
    "Mirror case: large positive XMEAS_13 step — same fault class, opposite pressure direction",
    "tep_test run 429: pre-FA 0 · alert sample 161 · ΔXMEAS_13 +7.39 · IDV(5) 98%",
    "HIGH",
    "P2",
    58,
    {
      simulationRun: 429,
      preFalseAlarms: 0,
      firstAlertSample: 161,
      detectionDelaySamples: 0,
      maxPFault: 0.999938,
      multiclassIdv5Pct: 97.75,
      xmeas13Delta: 7.387125,
      caseTag: "Strong step (+)",
    },
    [
      "Compare with run 148 — discuss run-to-run variability on holdout test set",
    ],
  ),
  workOrder(
    "f5-pm-377",
    377,
    "Subtle step, strong AI",
    "Minimal XMEAS_13 shift (+0.12) but model still crosses threshold at onset — AI-led finding",
    "tep_test run 377: pre-FA 0 · alert sample 161 · ΔXMEAS_13 +0.12 · max P(fault) 99.996%",
    "MEDIUM",
    "P3",
    70,
    {
      simulationRun: 377,
      preFalseAlarms: 0,
      firstAlertSample: 161,
      detectionDelaySamples: 0,
      maxPFault: 0.999956,
      multiclassIdv5Pct: 98.375,
      xmeas13Delta: 0.121125,
      caseTag: "Subtle physics",
    },
    [
      "Contrast with Fault 13 slow drift — step fault can be subtle in one tag yet obvious to rolling-feature model",
    ],
  ),
];
