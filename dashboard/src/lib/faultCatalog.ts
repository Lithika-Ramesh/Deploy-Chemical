/**
 * Tennessee Eastman Process (TEP) benchmark fault IDs 0–20.
 * @see Lyman & Georgakis; Downs & Vogel fault definitions.
 */

export type FaultType =
  | "None"
  | "Step"
  | "Random Variation"
  | "Slow Drift"
  | "Sticking"
  | "Unknown";

export type VisualSubsystem =
  | "reactor"
  | "feed"
  | "separator"
  | "compressor"
  | "recycle";

export const FAULT_ORDER = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const;

export type FaultId = (typeof FAULT_ORDER)[number];

export interface FaultDefinition {
  id: FaultId;
  /** Short label for compact UI */
  label: string;
  /** Full benchmark description */
  description: string;
  faultType: FaultType;
  affectedSystems: string[];
  recommendedAction: string;
  actionDetail: string;
  baseFailureMinutes: number;
  /** PFD regions to stress in `ProcessFlowVisual` */
  visual: VisualSubsystem[];
}

export const FAULT_CATALOG: Record<FaultId, FaultDefinition> = {
  0: {
    id: 0,
    label: "Normal behavior",
    description: "Normal behavior",
    faultType: "None",
    affectedSystems: ["Plant-wide"],
    recommendedAction: "Maintain steady-state operation",
    actionDetail:
      "Continue monitoring key loops and historian QA. No injected benchmark fault.",
    baseFailureMinutes: 120,
    visual: [],
  },
  1: {
    id: 1,
    label: "Fault 1 — A/C feed ratio",
    description: "A/C feed ratio, B composition constant",
    faultType: "Step",
    affectedSystems: ["Feed header", "A/C blending", "FIC loops"],
    recommendedAction: "Verify feed ratio cascade",
    actionDetail:
      "Check A and C flow controllers against lab B analysis · confirm ratio SP integrity.",
    baseFailureMinutes: 14,
    visual: ["feed"],
  },
  2: {
    id: 2,
    label: "Fault 2 — B composition",
    description: "B composition, A/C ratio constant",
    faultType: "Step",
    affectedSystems: ["B stream", "Composition analyzer"],
    recommendedAction: "Confirm B quality",
    actionDetail:
      "Grab sample on B · verify analyzer calibration · review stripper side reactions.",
    baseFailureMinutes: 16,
    visual: ["feed", "separator"],
  },
  3: {
    id: 3,
    label: "Fault 3 — D feed temperature",
    description: "D feed temperature",
    faultType: "Step",
    affectedSystems: ["D feed", "Pre-heat exchanger"],
    recommendedAction: "Stabilize D feed enthalpy",
    actionDetail:
      "Inspect D feed preheat · verify steam trap on trim heater · watch reactor inlet T.",
    baseFailureMinutes: 12,
    visual: ["feed", "reactor"],
  },
  4: {
    id: 4,
    label: "Fault 4 — Reactor CW inlet T",
    description: "Reactor cooling water inlet temperature",
    faultType: "Step",
    affectedSystems: ["R-101 jacket", "CW supply", "TIC-101"],
    recommendedAction: "Restore reactor cooling margin",
    actionDetail:
      "Verify CW header temperature · inspect isolation valves · stage mechanical on jacket circuit.",
    baseFailureMinutes: 10,
    visual: ["reactor"],
  },
  5: {
    id: 5,
    label: "Fault 5 — Condenser CW inlet T",
    description: "Condenser cooling water inlet temperature",
    faultType: "Step",
    affectedSystems: ["Overhead condenser", "CW return"],
    recommendedAction: "Recover condensing duty",
    actionDetail:
      "Check CW flow to condenser · confirm ΔT across bundle · review tower pressure.",
    baseFailureMinutes: 11,
    visual: ["separator"],
  },
  6: {
    id: 6,
    label: "Fault 6 — A feed loss",
    description: "A feed loss",
    faultType: "Step",
    affectedSystems: ["A feed pump", "FIC-204", "Inventory"],
    recommendedAction: "Stabilize A inventory",
    actionDetail:
      "Confirm pump run status · check block valves · balance feeds to maintain mass balance.",
    baseFailureMinutes: 18,
    visual: ["feed"],
  },
  7: {
    id: 7,
    label: "Fault 7 — C header pressure loss",
    description: "C header pressure loss",
    faultType: "Step",
    affectedSystems: ["C header", "PIC", "Compressor suction"],
    recommendedAction: "Investigate pressure loss",
    actionDetail:
      "Walk down C header for leaks/restrictions · verify compressor inlet pressure control.",
    baseFailureMinutes: 9,
    visual: ["feed", "compressor", "recycle"],
  },
  8: {
    id: 8,
    label: "Fault 8 — A,B,C composition",
    description: "A, B, C feed composition",
    faultType: "Random Variation",
    affectedSystems: ["Feed analyzers", "Blending"],
    recommendedAction: "Tighten analyzer QA",
    actionDetail:
      "Compare redundant analyzers · increase lab frequency · alert planning to quality risk.",
    baseFailureMinutes: 40,
    visual: ["feed", "reactor"],
  },
  9: {
    id: 9,
    label: "Fault 9 — D feed temperature",
    description: "D feed temperature",
    faultType: "Random Variation",
    affectedSystems: ["D feed", "Trim heat"],
    recommendedAction: "Dampen D feed thermal noise",
    actionDetail:
      "Review TC tuning on D preheat · check steam supply swings · consider feed-forward bias.",
    baseFailureMinutes: 22,
    visual: ["feed", "reactor"],
  },
  10: {
    id: 10,
    label: "Fault 10 — C feed temperature",
    description: "C feed temperature",
    faultType: "Random Variation",
    affectedSystems: ["C feed", "Heat integration"],
    recommendedAction: "Stabilize C feed thermal profile",
    actionDetail:
      "Inspect C feed exchanger pass · verify control valve travel · monitor reactor delta-T.",
    baseFailureMinutes: 22,
    visual: ["feed", "reactor"],
  },
  11: {
    id: 11,
    label: "Fault 11 — Reactor CW inlet T",
    description: "Reactor cooling water inlet temperature",
    faultType: "Random Variation",
    affectedSystems: ["CW header", "R-101 jacket"],
    recommendedAction: "Track CW variability",
    actionDetail:
      "Correlate CW upset with ambient/utility swings · prep reactor MV limits if needed.",
    baseFailureMinutes: 25,
    visual: ["reactor"],
  },
  12: {
    id: 12,
    label: "Fault 12 — Condenser CW inlet T",
    description: "Condenser cooling water inlet temperature",
    faultType: "Random Variation",
    affectedSystems: ["Condenser CW", "Tower pressure"],
    recommendedAction: "Mitigate CW noise to tower",
    actionDetail:
      "Review condenser CW valve tuning · watch tower pressure CV · coordinate with utilities.",
    baseFailureMinutes: 24,
    visual: ["separator"],
  },
  13: {
    id: 13,
    label: "Fault 13 — Reaction kinetics",
    description: "Reaction kinetics",
    faultType: "Slow Drift",
    affectedSystems: ["R-101", "Catalyst system"],
    recommendedAction: "Monitor conversion drift",
    actionDetail:
      "Track heat generation vs. feed · schedule catalyst assessment · compare model residuals.",
    baseFailureMinutes: 55,
    visual: ["reactor", "separator"],
  },
  14: {
    id: 14,
    label: "Fault 14 — Reactor CW valve",
    description: "Reactor cooling water valve",
    faultType: "Sticking",
    affectedSystems: ["Reactor CW valve", "TIC cascade"],
    recommendedAction: "Address valve stiction",
    actionDetail:
      "Bump-test CW valve · check I/P · plan isolation for bench test or trim replacement.",
    baseFailureMinutes: 15,
    visual: ["reactor", "recycle"],
  },
  15: {
    id: 15,
    label: "Fault 15 — Condenser CW valve",
    description: "Condenser cooling water valve",
    faultType: "Sticking",
    affectedSystems: ["Condenser CW valve", "Tower pressure"],
    recommendedAction: "Service condenser CW valve",
    actionDetail:
      "Hand-jog valve if safe · verify position feedback · prepare maintenance window.",
    baseFailureMinutes: 15,
    visual: ["separator", "recycle"],
  },
  16: {
    id: 16,
    label: "Fault 16 — Unknown",
    description: "Unknown",
    faultType: "Unknown",
    affectedSystems: ["Plant-wide"],
    recommendedAction: "Broaden diagnostics",
    actionDetail:
      "Run multivariate fingerprinting · escalate to engineering · hold major setpoint moves.",
    baseFailureMinutes: 30,
    visual: ["reactor", "feed"],
  },
  17: {
    id: 17,
    label: "Fault 17 — Unknown",
    description: "Unknown",
    faultType: "Unknown",
    affectedSystems: ["Plant-wide"],
    recommendedAction: "Broaden diagnostics",
    actionDetail:
      "Cross-check historian vs. lab · review recent maintenance · widen AI monitoring bands.",
    baseFailureMinutes: 30,
    visual: ["separator", "compressor"],
  },
  18: {
    id: 18,
    label: "Fault 18 — Unknown",
    description: "Unknown",
    faultType: "Unknown",
    affectedSystems: ["Plant-wide"],
    recommendedAction: "Broaden diagnostics",
    actionDetail:
      "Correlate auxiliary utilities · verify field bus health · preserve event log chain.",
    baseFailureMinutes: 30,
    visual: ["feed", "recycle"],
  },
  19: {
    id: 19,
    label: "Fault 19 — Unknown",
    description: "Unknown",
    faultType: "Unknown",
    affectedSystems: ["Plant-wide"],
    recommendedAction: "Broaden diagnostics",
    actionDetail:
      "Engage shift supervisor · prep safe parking procedure if uncertainty persists.",
    baseFailureMinutes: 30,
    visual: ["reactor", "compressor"],
  },
  20: {
    id: 20,
    label: "Fault 20 — Unknown",
    description: "Unknown",
    faultType: "Unknown",
    affectedSystems: ["Plant-wide"],
    recommendedAction: "Broaden diagnostics",
    actionDetail:
      "Treat as reserved benchmark class · follow site abnormal event protocol.",
    baseFailureMinutes: 30,
    visual: ["reactor", "separator", "feed"],
  },
};

export function faultLabel(id: FaultId): string {
  return FAULT_CATALOG[id].label;
}

export function faultDropdownLabel(id: FaultId): string {
  const d = FAULT_CATALOG[id];
  if (id === 0) return `${id}: ${d.description} (${d.faultType})`;
  return `${id}: ${d.description} · ${d.faultType}`;
}

export function parseFaultId(raw: string): FaultId {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0 && n <= 20) return n as FaultId;
  return 1;
}
