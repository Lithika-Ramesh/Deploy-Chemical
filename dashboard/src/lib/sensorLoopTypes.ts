export type SensorLoopScenarioKey = "fault5_run78";

export interface SensorLoopFilePayload {
  scenario: SensorLoopScenarioKey;
  label: string;
  duration_ticks: number;
  /** 0-based tick index where fault is injected (tep_test sample 161) */
  fault_onset_tick?: number;
  sensors: {
    separator_pressure: number[];
    condenser_cw_flow: number[];
    comp_cw_outlet_temp: number[];
  };
  anomaly_score: number[];
  /** Shown when anomaly is high */
  plain_fault_hint?: string | null;
}

export interface SensorLoopTick {
  separator_pressure: number;
  condenser_cw_flow: number;
  comp_cw_outlet_temp: number;
  anomaly_score: number;
}

export const SENSOR_LOOP_TICK_MS = 800;
/** Visible historian points — matches Fault 13 simulation live charts (48-sample window). */
export const SENSOR_LOOP_WINDOW = 48;

export const SCENARIO_PLAYLIST: ReadonlyArray<{
  file: SensorLoopScenarioKey;
  repeats: number;
}> = [{ file: "fault5_run78", repeats: 999 }];
