"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import type {
  FaultClassProbability,
  IncidentRecord,
  MaintenanceRecommendation,
  PlantEvent,
  PlantStatus,
  SensorPoint,
  ShapFeature,
} from "@/lib/types";
import type { ParsedPipelineSummary } from "@/lib/pipelineManifest";
import { parsePipelineManifest } from "@/lib/pipelineManifest";
import { fetchApiHealth, fetchMetrics, isApiConfigured } from "@/lib/api";

const HISTORY_CAP = 48;
/** Mock telemetry refresh when no fault sim is running (lighter laptops). */
const IDLE_TICK_MS = 4000;
const ACTIVE_TICK_MS = 1000;

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
  apiReachable: boolean | null;
  /** Parsed `GET /metrics` manifest when `NEXT_PUBLIC_AIFI_API_URL` is set and the API returns pipeline JSON. */
  pipelineManifest: ParsedPipelineSummary | null;
  notificationCount: number;
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
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [pipelineManifestRaw, setPipelineManifestRaw] = useState<
    Record<string, unknown> | null
  >(null);

  const simulationConfig: SimulationConfig = useMemo(
    () => ({
      mode: simulationRunning ? "fault" : "normal",
      faultId: selectedFaultId,
      severity,
      emergency: emergencyMode,
    }),
    [simulationRunning, selectedFaultId, severity, emergencyMode],
  );

  const pipelineManifest = useMemo(
    () => parsePipelineManifest(pipelineManifestRaw),
    [pipelineManifestRaw],
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
    if (!isApiConfigured()) return;
    let cancelled = false;
    void (async () => {
      const [h, metrics] = await Promise.all([
        fetchApiHealth(),
        fetchMetrics(),
      ]);
      if (cancelled) return;
      setApiReachable(h?.status === "ok");
      setPipelineManifestRaw(metrics);
    })();
    return () => {
      cancelled = true;
    };
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
      apiReachable,
      pipelineManifest,
      notificationCount,
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
      apiReachable,
      pipelineManifest,
      notificationCount,
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
