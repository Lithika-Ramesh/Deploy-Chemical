"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FaultId } from "@/lib/faultCatalog";
import { buildIncidentLibrary } from "@/lib/incidents";
import { buildMaintenanceRecommendations } from "@/lib/maintenanceData";
import {
  advanceMockTick,
  buildFaultProbabilities,
  buildShapImportance,
  buildSnapshot,
  getSimulationTick,
  resetMockClock,
  seedFaultEvents,
  type SimulationConfig,
} from "@/lib/mockTelemetry";
import {
  SCENARIO_PLAYLIST,
  SENSOR_LOOP_TICK_MS,
  SENSOR_LOOP_WINDOW,
  type SensorLoopFilePayload,
  type SensorLoopScenarioKey,
  type SensorLoopTick,
} from "@/lib/sensorLoopTypes";
import type {
  FaultClassProbability,
  IncidentRecord,
  MaintenanceRecommendation,
  PlantEvent,
  PlantStatus,
  SensorPoint,
  ShapFeature,
} from "@/lib/types";

const HISTORY_CAP = 48;
/** Mock telemetry refresh when no fault sim is running (lighter laptops). */
const IDLE_TICK_MS = 4000;
const ACTIVE_TICK_MS = 1000;

type LoopEngine = {
  pIdx: number;
  roundsLeft: number;
  tIdx: number;
  window: SensorLoopTick[];
};

function freshLoopEngine(): LoopEngine {
  return {
    pIdx: 0,
    roundsLeft: SCENARIO_PLAYLIST[0]?.repeats ?? 1,
    tIdx: 0,
    window: [],
  };
}

type PlantSimulationContextValue = {
  simulationConfig: SimulationConfig;
  selectedFaultId: FaultId;
  setSelectedFaultId: (id: FaultId) => void;
  simulationRunning: boolean;
  paused: boolean;
  severity: number;
  emergencyMode: boolean;
  tick: number;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  resetSimulation: () => void;
  increaseSeverity: () => void;
  setSeverity: (n: number) => void;
  toggleEmergency: () => void;
  plantStatus: PlantStatus;
  snapshot: ReturnType<typeof buildSnapshot>;
  history: SensorPoint[];
  events: PlantEvent[];
  incidents: IncidentRecord[];
  maintenanceItems: MaintenanceRecommendation[];
  shapFeatures: ShapFeature[];
  faultProbabilities: FaultClassProbability[];
  confidenceHistory: number[];
  anomalyHistory: number[];
  notificationCount: number;
  sensorLoopWindow: SensorLoopTick[];
  sensorLoopAnomaly: number;
  sensorLoopScenarioLabel: string;
  sensorLoopPlainFaultHint: string | null;
  sensorLoopReady: boolean;
};

const PlantSimulationContext =
  createContext<PlantSimulationContextValue | null>(null);

export function PlantSimulationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedFaultId, setSelectedFaultId] =
    useState<FaultId>("reactor_cooling");
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [severity, setSeverity] = useState(2);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [tick, setTick] = useState(0);

  const [snapshot, setSnapshot] = useState(() =>
    buildSnapshot({
      mode: "normal",
      faultId: selectedFaultId,
      severity: 1,
      emergency: false,
    }),
  );
  const [history, setHistory] = useState<SensorPoint[]>([]);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [anomalyHistory, setAnomalyHistory] = useState<number[]>([]);

  const [sensorLoopWindow, setSensorLoopWindow] = useState<SensorLoopTick[]>(
    [],
  );
  const [sensorLoopAnomaly, setSensorLoopAnomaly] = useState(0);
  const [sensorLoopScenarioLabel, setSensorLoopScenarioLabel] = useState("");
  const [sensorLoopPlainFaultHint, setSensorLoopPlainFaultHint] = useState<
    string | null
  >(null);
  const [sensorLoopReady, setSensorLoopReady] = useState(false);

  const loopEngine = useRef<LoopEngine>(freshLoopEngine());
  const loopPrimed = useRef(false);
  const scenarioCacheRef = useRef<
    Partial<Record<SensorLoopScenarioKey, SensorLoopFilePayload>>
  >({});

  const simulationConfig: SimulationConfig = useMemo(
    () => ({
      mode: simulationRunning ? "fault" : "normal",
      faultId: selectedFaultId,
      severity,
      emergency: emergencyMode,
    }),
    [simulationRunning, selectedFaultId, severity, emergencyMode],
  );

  const incidents = useMemo(
    () => buildIncidentLibrary(simulationConfig),
    [simulationConfig],
  );

  const maintenanceItems = useMemo(
    () => buildMaintenanceRecommendations(simulationConfig, tick),
    [simulationConfig, tick],
  );

  const shapFeatures = useMemo(
    () => buildShapImportance(simulationConfig),
    [simulationConfig],
  );

  const faultProbabilities = useMemo(
    () => buildFaultProbabilities(simulationConfig),
    [simulationConfig],
  );

  const events = useMemo(
    () => seedFaultEvents(simulationConfig),
    [simulationConfig],
  );

  const notificationCount = useMemo(() => {
    const open = incidents.filter(
      (i) =>
        !i.acknowledged &&
        (i.severity === "HIGH" || i.severity === "CRITICAL"),
    ).length;
    return Math.min(99, open + (simulationRunning ? 1 : 0));
  }, [incidents, simulationRunning]);

  useEffect(() => {
    let cancelled = false;
    const keys = [...new Set(SCENARIO_PLAYLIST.map((e) => e.file))];
    void Promise.all(
      keys.map((k) =>
        fetch(`/data/sensor_loops/${k}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (j && typeof j === "object")
              scenarioCacheRef.current[k] = j as SensorLoopFilePayload;
          })
          .catch(() => {}),
      ),
    ).then(() => {
      if (!cancelled) setSensorLoopReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sensorLoopReady) return;

    const advanceOne = () => {
      const entry = SCENARIO_PLAYLIST[loopEngine.current.pIdx];
      if (!entry) return;
      const sc = scenarioCacheRef.current[entry.file];
      if (!sc?.sensors) return;

      const i = loopEngine.current.tIdx;
      const row: SensorLoopTick = {
        reactor_temp: sc.sensors.reactor_temp[i] ?? sc.sensors.reactor_temp[0]!,
        separator_pressure:
          sc.sensors.separator_pressure[i] ?? sc.sensors.separator_pressure[0]!,
        recycle_flow: sc.sensors.recycle_flow[i] ?? sc.sensors.recycle_flow[0]!,
        anomaly_score: sc.anomaly_score[i] ?? sc.anomaly_score[0] ?? 0,
      };

      const nextWindow = [...loopEngine.current.window, row].slice(
        -SENSOR_LOOP_WINDOW,
      );
      loopEngine.current.window = nextWindow;

      if (loopEngine.current.tIdx + 1 >= sc.duration_ticks) {
        loopEngine.current.tIdx = 0;
        loopEngine.current.roundsLeft -= 1;
        if (loopEngine.current.roundsLeft <= 0) {
          loopEngine.current.pIdx =
            (loopEngine.current.pIdx + 1) % SCENARIO_PLAYLIST.length;
          loopEngine.current.roundsLeft =
            SCENARIO_PLAYLIST[loopEngine.current.pIdx]!.repeats;
        }
      } else {
        loopEngine.current.tIdx += 1;
      }

      setSensorLoopWindow([...nextWindow]);
      setSensorLoopAnomaly(row.anomaly_score);
      setSensorLoopScenarioLabel(sc.label);
      setSensorLoopPlainFaultHint(sc.plain_fault_hint ?? null);
    };

    if (!loopPrimed.current) {
      loopPrimed.current = true;
      const firstKey = SCENARIO_PLAYLIST[0]?.file;
      const first = firstKey ? scenarioCacheRef.current[firstKey] : undefined;
      if (first?.sensors) {
        const n = Math.min(SENSOR_LOOP_WINDOW, first.duration_ticks);
        const w: SensorLoopTick[] = [];
        for (let j = 0; j < n; j++) {
          w.push({
            reactor_temp: first.sensors.reactor_temp[j]!,
            separator_pressure: first.sensors.separator_pressure[j]!,
            recycle_flow: first.sensors.recycle_flow[j]!,
            anomaly_score: first.anomaly_score[j]!,
          });
        }
        loopEngine.current.window = w;
        loopEngine.current.tIdx = n % first.duration_ticks;
        setSensorLoopWindow(w);
        if (w.length) {
          const last = w[w.length - 1]!;
          setSensorLoopAnomaly(last.anomaly_score);
          setSensorLoopScenarioLabel(first.label);
          setSensorLoopPlainFaultHint(first.plain_fault_hint ?? null);
        }
      }
    }

    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      advanceOne();
    }, SENSOR_LOOP_TICK_MS);

    return () => window.clearInterval(id);
  }, [sensorLoopReady]);

  const startSimulation = useCallback(() => {
    resetMockClock();
    setTick(0);
    setHistory([]);
    setConfidenceHistory([]);
    setAnomalyHistory([]);
    setSimulationRunning(true);
    setPaused(false);
    setEmergencyMode(false);
    setSeverity(2);
  }, []);

  const pauseSimulation = useCallback(() => {
    setPaused(true);
  }, []);

  const resumeSimulation = useCallback(() => {
    setPaused(false);
  }, []);

  const resetSimulation = useCallback(() => {
    resetMockClock();
    setTick(0);
    setSimulationRunning(false);
    setPaused(false);
    setEmergencyMode(false);
    setSeverity(2);
    setHistory([]);
    const normal: SimulationConfig = {
      mode: "normal",
      faultId: selectedFaultId,
      severity: 1,
      emergency: false,
    };
    setSnapshot(buildSnapshot(normal));
    setConfidenceHistory([]);
    setAnomalyHistory([]);
  }, [selectedFaultId]);

  const increaseSeverity = useCallback(() => {
    setSeverity((s) => Math.min(5, s + 1));
  }, []);

  const toggleEmergency = useCallback(() => {
    setEmergencyMode((e) => !e);
  }, []);

  useEffect(() => {
    const intervalMs = simulationRunning ? ACTIVE_TICK_MS : IDLE_TICK_MS;

    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;

      const frozen = paused && simulationRunning;
      if (frozen) return;

      advanceMockTick();
      setTick(getSimulationTick());

      const next = buildSnapshot(simulationConfig);
      setSnapshot(next);

      setHistory((prev) => [...prev, next.sensors].slice(-HISTORY_CAP));
      setConfidenceHistory((prev) =>
        [...prev, next.insight.confidencePct].slice(-72),
      );
      setAnomalyHistory((prev) =>
        [...prev, next.sensors.anomalyScore].slice(-72),
      );
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [paused, simulationRunning, simulationConfig]);

  const value = useMemo(
    () => ({
      simulationConfig,
      selectedFaultId,
      setSelectedFaultId,
      simulationRunning,
      paused,
      severity,
      emergencyMode,
      tick,
      startSimulation,
      pauseSimulation,
      resumeSimulation,
      resetSimulation,
      increaseSeverity,
      setSeverity,
      toggleEmergency,
      plantStatus: snapshot.insight.plantStatus,
      snapshot,
      history,
      events,
      incidents,
      maintenanceItems,
      shapFeatures,
      faultProbabilities,
      confidenceHistory,
      anomalyHistory,
      notificationCount,
      sensorLoopWindow,
      sensorLoopAnomaly,
      sensorLoopScenarioLabel,
      sensorLoopPlainFaultHint,
      sensorLoopReady,
    }),
    [
      simulationConfig,
      selectedFaultId,
      simulationRunning,
      paused,
      severity,
      emergencyMode,
      tick,
      startSimulation,
      pauseSimulation,
      resumeSimulation,
      resetSimulation,
      increaseSeverity,
      toggleEmergency,
      snapshot,
      history,
      events,
      incidents,
      maintenanceItems,
      shapFeatures,
      faultProbabilities,
      confidenceHistory,
      anomalyHistory,
      notificationCount,
      sensorLoopWindow,
      sensorLoopAnomaly,
      sensorLoopScenarioLabel,
      sensorLoopPlainFaultHint,
      sensorLoopReady,
    ],
  );

  return (
    <PlantSimulationContext.Provider value={value}>
      {children}
    </PlantSimulationContext.Provider>
  );
}

export function usePlantSimulation() {
  const ctx = useContext(PlantSimulationContext);
  if (!ctx) {
    throw new Error("usePlantSimulation must be used within provider");
  }
  return ctx;
}
