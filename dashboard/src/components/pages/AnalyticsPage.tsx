"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Activity, Brain, Cpu, Gauge, Timer } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import { usePlantSimulation } from "@/context/PlantSimulationContext";

const AnalyticsChartsPanel = dynamic(
  () =>
    import("./AnalyticsChartsPanel").then((m) => m.AnalyticsChartsPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-slate-500">
        Initializing analytics engine…
      </div>
    ),
  },
);

export function AnalyticsPage() {
  const { snapshot, incidents, simulationConfig } = usePlantSimulation();

  const kpis = useMemo(() => {
    const faultsLogged = incidents.filter(
      (i) => i.severity === "HIGH" || i.severity === "CRITICAL",
    ).length;
    const modelAcc =
      simulationConfig.mode === "fault"
        ? 96.2 + simulationConfig.severity * 0.15
        : 96.8;
    return {
      modelAcc: Math.min(99.5, modelAcc),
      latency: snapshot.predictionLatencyMs,
      sensors: 52,
      faultsLogged,
    };
  }, [incidents, simulationConfig, snapshot.predictionLatencyMs]);

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-6">
        <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
          AI analytics & explainability
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Model health, attribution, and fault-family probabilities for the TEP
          predictive maintenance stack (mocked for UI demonstration).
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Gauge className="h-4 w-4 text-cyan-400" />}
          label="Model accuracy (est.)"
          value={`${kpis.modelAcc.toFixed(1)}%`}
          delay={0}
        />
        <Kpi
          icon={<Timer className="h-4 w-4 text-emerald-400" />}
          label="Prediction latency"
          value={`${kpis.latency} ms`}
          delay={0.04}
        />
        <Kpi
          icon={<Cpu className="h-4 w-4 text-sky-400" />}
          label="Monitored sensors"
          value={`${kpis.sensors}`}
          delay={0.08}
        />
        <Kpi
          icon={<Activity className="h-4 w-4 text-amber-400" />}
          label="High / critical incidents"
          value={`${kpis.faultsLogged}`}
          delay={0.12}
        />
      </div>

      <GlassPanel
        title="AI health"
        subtitle="Drift monitors · ensemble stability · operator trust"
        accent="blue"
        delay={0.06}
        className="mb-6"
      >
        <div className="flex flex-wrap items-center gap-4 p-4">
          <motion.div
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(34,211,238,0)",
                "0 0 28px 2px rgba(34,211,238,0.25)",
                "0 0 0 0 rgba(34,211,238,0)",
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10"
          >
            <Brain className="h-7 w-7 text-cyan-200" />
          </motion.div>
          <div className="min-w-0 flex-1 text-sm text-slate-400">
            <p>
              Ensemble variance within nominal band. SHAP stability index{" "}
              <span className="font-mono text-cyan-200">0.87</span> — suitable
              for operator-facing explanations.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Connect to FastAPI <code className="text-slate-500">/metrics</code>{" "}
              for production manifests.
            </p>
          </div>
        </div>
      </GlassPanel>

      <AnalyticsChartsPanel />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  delay,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 shadow-[0_20px_50px_-40px_rgba(34,211,238,0.35)]"
    >
      <div className="flex items-center gap-2 text-slate-500">{icon}</div>
      <p className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-orbitron)] text-xl font-semibold text-slate-100">
        {value}
      </p>
    </motion.div>
  );
}
