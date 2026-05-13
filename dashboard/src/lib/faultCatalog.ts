export type FaultId =
  | "reactor_cooling"
  | "feed_loss"
  | "pressure_instability"
  | "sensor_drift"
  | "valve_failure"
  | "separator_fault"
  | "compressor_failure";

export type VisualSubsystem =
  | "reactor"
  | "feed"
  | "separator"
  | "compressor"
  | "recycle";

export interface FaultDefinition {
  id: FaultId;
  label: string;
  affectedSystems: string[];
  recommendedAction: string;
  actionDetail: string;
  baseFailureMinutes: number;
  /** Which parts of the PFD to stress visually */
  visual: VisualSubsystem[];
}

export const FAULT_ORDER: FaultId[] = [
  "reactor_cooling",
  "feed_loss",
  "pressure_instability",
  "sensor_drift",
  "valve_failure",
  "separator_fault",
  "compressor_failure",
];

export const FAULT_CATALOG: Record<FaultId, FaultDefinition> = {
  reactor_cooling: {
    id: "reactor_cooling",
    label: "Reactor Cooling Failure",
    affectedSystems: ["R-101 CSTR", "CW loop", "TIC-101"],
    recommendedAction: "Reduce feed rate",
    actionDetail:
      "Inspect cooling valve · Verify CW header ΔT · Stage mechanical on R-101 jacket.",
    baseFailureMinutes: 12,
    visual: ["reactor", "feed"],
  },
  feed_loss: {
    id: "feed_loss",
    label: "Feed Loss",
    affectedSystems: ["Feed header", "FIC-204", "Stripper feed"],
    recommendedAction: "Stabilize feed inventory",
    actionDetail:
      "Check pump NPSH · Confirm tank levels · Cross-check flow vs. setpoint.",
    baseFailureMinutes: 18,
    visual: ["feed"],
  },
  pressure_instability: {
    id: "pressure_instability",
    label: "Pressure Instability",
    affectedSystems: ["Separator V-204", "PIC-310", "Overhead line"],
    recommendedAction: "Tune pressure cascade",
    actionDetail:
      "Reduce aggressive MV moves · Inspect PCV trim · Review anti-surge margins.",
    baseFailureMinutes: 9,
    visual: ["separator", "recycle"],
  },
  sensor_drift: {
    id: "sensor_drift",
    label: "Sensor Drift",
    affectedSystems: ["Field analytics", "AT-1..52", "Historian QA"],
    recommendedAction: "Calibrate suspect loops",
    actionDetail:
      "Run redundant voting · Compare lab vs. inline · Schedule instrument PM.",
    baseFailureMinutes: 45,
    visual: ["reactor", "separator"],
  },
  valve_failure: {
    id: "valve_failure",
    label: "Valve Failure",
    affectedSystems: ["FCV-118", "Recycle split", "Hydraulics"],
    recommendedAction: "Bypass or hand-jog valve",
    actionDetail:
      "Confirm stem travel · Check I/P · Prepare isolation for maintenance.",
    baseFailureMinutes: 15,
    visual: ["recycle", "feed"],
  },
  separator_fault: {
    id: "separator_fault",
    label: "Separator Fault",
    affectedSystems: ["V-204", "Level LC", "Boot drain"],
    recommendedAction: "Balance level & heat",
    actionDetail:
      "Inspect level taps · Verify boot purge · Watch interface density.",
    baseFailureMinutes: 14,
    visual: ["separator"],
  },
  compressor_failure: {
    id: "compressor_failure",
    label: "Compressor Failure",
    affectedSystems: ["Recycle compressor", "Vibration XV", "Seal gas"],
    recommendedAction: "Unload & assess surge",
    actionDetail:
      "Reduce recycle demand · Monitor bearing temps · Prepare safe shutdown.",
    baseFailureMinutes: 7,
    visual: ["compressor", "recycle"],
  },
};

export function faultLabel(id: FaultId): string {
  return FAULT_CATALOG[id].label;
}
