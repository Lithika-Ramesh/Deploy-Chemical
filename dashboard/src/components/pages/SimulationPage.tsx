"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Siren,
  Skull,
  TrendingUp,
  Zap,
} from "lucide-react";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import { ProcessFlowVisual } from "@/components/dashboard/ProcessFlowVisual";
import { FAULT_CATALOG, FAULT_ORDER, type FaultId } from "@/lib/faultCatalog";
import { statusColorClass } from "@/lib/mockTelemetry";
import { usePlantSimulation } from "@/context/PlantSimulationContext";

const SensorCharts = dynamic(
  () =>
    import("@/components/dashboard/SensorCharts").then((m) => m.SensorCharts),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xs text-slate-500">
        Loading charts…
      </div>
    ),
  },
);

export function SimulationPage() {
  const {
    selectedFaultId,
    setSelectedFaultId,
    simulationRunning,
    paused,
    severity,
    setSeverity,
    emergencyMode,
    toggleEmergency,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    increaseSeverity,
    snapshot,
    tick,
    pipelineManifest,
    apiReachable,
  } = usePlantSimulation();

  const { insight, anomalyIndex, predictionLatencyMs } = snapshot;
  const def = FAULT_CATALOG[selectedFaultId];

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
            Fault simulation control
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Inject Tennessee Eastman fault signatures, stage severity, and
            observe AI residuals in real time. Digital twin tick:{" "}
            <span className="font-mono text-cyan-300/90">{tick}s</span>
          </p>
        </div>
        <AnimatePresence mode="wait">
          {emergencyMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-2 text-red-200 shadow-[0_0_32px_-6px_rgba(239,68,68,0.7)]"
            >
              <Skull className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Emergency mode
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {pipelineManifest?.bestModel && apiReachable ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[11px] text-emerald-100/95">
          <span className="font-semibold uppercase tracking-wider text-emerald-200/90">
            Pipeline model
          </span>
          <span className="ml-2 font-mono text-emerald-50">
            {pipelineManifest.bestModel}
          </span>
          {pipelineManifest.bestF1Macro != null ? (
            <span className="ml-2 text-emerald-200/90">
              test F1 macro {pipelineManifest.bestF1Macro.toFixed(4)}
            </span>
          ) : null}
          <span className="mt-1 block text-[10px] text-emerald-200/70">
            Loaded from FastAPI <code className="text-emerald-100/80">GET /metrics</code> — use{" "}
            <code className="text-emerald-100/80">/simulate</code> or{" "}
            <code className="text-emerald-100/80">/demo</code> to drive scoring from this artifact.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <GlassPanel
            title="Scenario builder"
            subtitle="Select fault class · stage severity · run twin"
            accent="cyan"
            delay={0}
          >
            <div className="space-y-4 p-4">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  Fault type
                </span>
                <select
                  value={selectedFaultId}
                  onChange={(e) =>
                    setSelectedFaultId(e.target.value as FaultId)
                  }
                  disabled={simulationRunning && !paused}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/40 disabled:opacity-50"
                >
                  {FAULT_ORDER.map((id) => (
                    <option key={id} value={id}>
                      {FAULT_CATALOG[id].label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-500">
                  <span>Severity stage</span>
                  <span className="font-mono text-cyan-300">{severity} / 5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  className="mt-2 w-full accent-cyan-400"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={startSimulation}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200"
                >
                  <Play className="h-4 w-4" />
                  Start
                </motion.button>
                {paused ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={resumeSimulation}
                    className="flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-100"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={pauseSimulation}
                    disabled={!simulationRunning}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-200 disabled:opacity-40"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </motion.button>
                )}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={resetSimulation}
                  className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={increaseSeverity}
                  disabled={severity >= 5}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-amber-100 disabled:opacity-40"
                >
                  <TrendingUp className="h-4 w-4" />
                  +Severity
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleEmergency}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider ${
                    emergencyMode
                      ? "border-red-500/60 bg-red-500/20 text-red-100"
                      : "border-red-500/25 bg-red-500/5 text-red-200/90"
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  Emergency
                </motion.button>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-black/35 p-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300">Affected systems</p>
                <p className="mt-1">{def.affectedSystems.join(" · ")}</p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel
            title="AI prediction stream"
            subtitle="Classifier output · anomaly index · latency"
            accent={
              insight.plantStatus === "CRITICAL"
                ? "red"
                : simulationRunning
                  ? "amber"
                  : "blue"
            }
            delay={0.06}
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Stat
                icon={<Gauge className="h-4 w-4 text-cyan-400" />}
                label="Confidence"
                value={`${insight.confidencePct}%`}
              />
              <Stat
                icon={<Siren className="h-4 w-4 text-orange-400" />}
                label="Anomaly index"
                value={anomalyIndex.toFixed(2)}
              />
              <Stat
                icon={<ShieldAlert className="h-4 w-4 text-amber-400" />}
                label="Risk / severity"
                value={`${(insight.riskScore * 100).toFixed(1)}% ${insight.riskLevel} · ${insight.severity}`}
              />
              <Stat
                icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                label="Latency"
                value={`${predictionLatencyMs} ms`}
              />
            </div>
            <div className="border-t border-white/[0.06] px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Plant status
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${statusColorClass(insight.plantStatus)}`}
              >
                {insight.plantStatus}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {insight.detectedFault ?? "Nominal — no injected scenario"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                TTF estimate:{" "}
                {insight.failureWindowMinutes != null
                  ? `${insight.failureWindowMinutes} min`
                  : "—"}
              </p>
            </div>
          </GlassPanel>
        </div>

        <div className="space-y-4 xl:col-span-7">
          <ProcessFlowVisual />
          <SensorCharts />
        </div>
      </div>

      <motion.div
        className="pointer-events-none fixed bottom-6 right-6 z-30 hidden lg:block"
        animate={
          simulationRunning && !paused
            ? { opacity: [0.4, 1, 0.4], scale: [1, 1.05, 1] }
            : { opacity: 0.3 }
        }
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <div className="rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-orange-200 shadow-[0_0_40px_-8px_rgba(251,146,60,0.8)]">
          Live simulation
        </div>
      </motion.div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/30 p-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="text-sm font-semibold text-slate-100">{value}</p>
      </div>
    </div>
  );
}
