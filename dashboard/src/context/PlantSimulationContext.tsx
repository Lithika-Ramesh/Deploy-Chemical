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
import { fetchApiHealth, isApiConfigured } from "@/lib/api";

const HISTORY_CAP = 48;

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
  const [events, setEvents] = useState<PlantEvent[]>(() =>
    seedFaultEvents({
      mode: "normal",
      faultId: "reactor_cooling",
      severity: 1,
      emergency: false,
    }),
  );
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [anomalyHistory, setAnomalyHistory] = useState<number[]>([]);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);

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
    setEvents(seedFaultEvents(normal));
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
    setEvents(seedFaultEvents(simulationConfig));
  }, [simulationConfig]);

  useEffect(() => {
    if (!isApiConfigured()) {
      setApiReachable(null);
      return;
    }
    let cancelled = false;
    fetchApiHealth().then((h) => {
      if (!cancelled) setApiReachable(h?.status === "ok");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const frozen = paused && simulationRunning;
      if (!frozen) {
        advanceMockTick();
      }
      setTick(getSimulationTick());

      const next = buildSnapshot(simulationConfig);
      setSnapshot(next);

      if (!frozen) {
        setHistory((prev) => [...prev, next.sensors].slice(-HISTORY_CAP));
        setConfidenceHistory((prev) =>
          [...prev, next.insight.confidencePct].slice(-72),
        );
        setAnomalyHistory((prev) =>
          [...prev, next.sensors.anomalyScore].slice(-72),
        );
      }
    }, 1000);
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
