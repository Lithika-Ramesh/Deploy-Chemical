export type SensorLoopScenarioKey =
  | "normal_ops"
  | "fault_developing"
  | "fault_active";

export interface SensorLoopFilePayload {
  scenario: SensorLoopScenarioKey;
  label: string;
  duration_ticks: number;
  sensors: {
    reactor_temp: number[];
    separator_pressure: number[];
    recycle_flow: number[];
  };
  anomaly_score: number[];
  /** Shown when anomaly is high (fault_active scenario) */
  plain_fault_hint?: string | null;
}

export interface SensorLoopTick {
  reactor_temp: number;
  separator_pressure: number;
  recycle_flow: number;
  anomaly_score: number;
}

export const SENSOR_LOOP_TICK_MS = 800;
export const SENSOR_LOOP_WINDOW = 60;

export const SCENARIO_PLAYLIST: ReadonlyArray<{
  file: SensorLoopScenarioKey;
  repeats: number;
}> = [
  { file: "normal_ops", repeats: 3 },
  { file: "fault_developing", repeats: 1 },
  { file: "fault_active", repeats: 1 },
];
