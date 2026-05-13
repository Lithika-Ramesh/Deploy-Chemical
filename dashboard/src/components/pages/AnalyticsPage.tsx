"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Activity, Brain, Cpu, Gauge, Timer } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { isApiConfigured } from "@/lib/api";

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
  const { snapshot, incidents, simulationConfig, pipelineManifest, apiReachable } =
    usePlantSimulation();

  const kpis = useMemo(() => {
    const faultsLogged = incidents.filter(
      (i) => i.severity === "HIGH" || i.severity === "CRITICAL",
    ).length;

    const hasHeldOut =
      pipelineManifest?.bestTestAccuracy != null &&
      Number.isFinite(pipelineManifest.bestTestAccuracy);

    const modelAcc = hasHeldOut
      ? Math.min(99.9, pipelineManifest.bestTestAccuracy! * 100)
      : simulationConfig.mode === "fault"
        ? 96.2 + simulationConfig.severity * 0.15
        : 96.8;

    const modelLabel = hasHeldOut
      ? "Test accuracy (held-out)"
      : "Model accuracy (est.)";

    const sensors =
      pipelineManifest?.featureCount != null && pipelineManifest.featureCount > 0
        ? pipelineManifest.featureCount
        : 52;

    return {
      modelAcc: Math.min(99.5, modelAcc),
      modelLabel,
      latency: snapshot.predictionLatencyMs,
      sensors,
      faultsLogged,
      usesPipeline: Boolean(hasHeldOut),
    };
  }, [
    incidents,
    simulationConfig,
    snapshot.predictionLatencyMs,
    pipelineManifest,
  ]);

  const pipelineHealthCopy = useMemo(() => {
    if (!pipelineManifest) {
      return {
        lead: (
          <>
            Ensemble variance within nominal band. SHAP stability index{" "}
            <span className="font-mono text-cyan-200">0.87</span> — placeholder
            until a pipeline manifest is available.
          </>
        ),
        trail: isApiConfigured()
          ? "With the API linked, run `python -m src.pipeline` (or the notebook) so `GET /metrics` returns `manifest.json`."
          : "Set `NEXT_PUBLIC_AIFI_API_URL` and run the Python pipeline so `GET /metrics` can populate real held-out scores.",
      };
    }

    const { bestModel, bestF1Macro, nClasses, datasetRows, results } =
      pipelineManifest;
    const rows = datasetRows;
    const rowBits = [
      rows?.train != null ? `${rows.train.toLocaleString()} train` : null,
      rows?.val != null ? `${rows.val.toLocaleString()} val` : null,
      rows?.test != null ? `${rows.test.toLocaleString()} test` : null,
    ].filter(Boolean);

    return {
      lead: (
        <>
          Pipeline manifest from <span className="font-mono text-cyan-200/90">GET /metrics</span>
          {bestModel ? (
            <>
              : best model{" "}
              <span className="font-mono text-cyan-200">{bestModel}</span>
              {bestF1Macro != null ? (
                <>
                  {" "}
                  · macro F1{" "}
                  <span className="font-mono text-cyan-200">
                    {bestF1Macro.toFixed(4)}
                  </span>
                </>
              ) : null}
              {nClasses != null ? (
                <>
                  {" "}
                  · <span className="font-mono text-slate-300">{nClasses}</span>{" "}
                  fault classes (TEP)
                </>
              ) : null}
            </>
          ) : null}
          {rowBits.length > 0 ? (
            <>
              {" "}
              · {rowBits.join(" · ")} rows
            </>
          ) : null}
          {results.length > 1 ? (
            <> · see table below for all trained estimators.</>
          ) : null}
        </>
      ),
      trail:
        apiReachable === false
          ? "API was unreachable when the dashboard loaded — refresh after starting Uvicorn."
          : "Charts below still use the mock twin stream unless you wire them to `/demo` or `/simulate`.",
    };
  }, [pipelineManifest, apiReachable]);

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-6">
        <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
          AI analytics & explainability
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          {kpis.usesPipeline
            ? "Held-out test metrics and feature counts come from the FastAPI /metrics manifest (same JSON as outputs/reports/manifest.json from the TEP pipeline notebook)."
            : "Model health, attribution, and fault-family probabilities: twin stream is still mocked; connect the API and run the pipeline to light up real multiclass metrics."}
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Gauge className="h-4 w-4 text-cyan-400" />}
          label={kpis.modelLabel}
          value={`${kpis.modelAcc.toFixed(1)}%`}
          delay={0}
        />
        <Kpi
          icon={<Timer className="h-4 w-4 text-emerald-400" />}
          label="Prediction latency"
          value={`${kpis.latency} ms`}
          hint="Twin estimate (not API RTT)"
          delay={0.04}
        />
        <Kpi
          icon={<Cpu className="h-4 w-4 text-sky-400" />}
          label="Monitored features"
          value={`${kpis.sensors}`}
          hint={
            pipelineManifest?.featureCount != null
              ? "From manifest feature_columns"
              : "Default 52 (41 XMEAS + 11 XMV)"
          }
          delay={0.08}
        />
        <Kpi
          icon={<Activity className="h-4 w-4 text-amber-400" />}
          label="High / critical incidents"
          value={`${kpis.faultsLogged}`}
          hint="Mock incident library in UI"
          delay={0.12}
        />
      </div>

      {pipelineManifest && pipelineManifest.results.length > 0 ? (
        <GlassPanel
          title="Multiclass evaluation (pipeline)"
          subtitle="Same rows as outputs/reports/manifest.json · served via GET /metrics"
          accent="emerald"
          delay={0.04}
          className="mb-6"
        >
          <div className="overflow-x-auto p-3 sm:p-4">
            <table className="w-full min-w-[480px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">Test acc.</th>
                  <th className="py-2 pr-3 font-medium">F1 macro</th>
                  <th className="py-2 pr-3 font-medium">Precision macro</th>
                  <th className="py-2 font-medium">Recall macro</th>
                </tr>
              </thead>
              <tbody>
                {pipelineManifest.results.map((r) => (
                  <tr
                    key={r.model}
                    className={`border-b border-white/[0.06] ${
                      r.model === pipelineManifest.bestModel
                        ? "bg-cyan-500/10 text-cyan-50"
                        : "text-slate-300"
                    }`}
                  >
                    <td className="py-2 pr-3 font-mono">{r.model}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {(r.accuracy * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{r.f1_macro.toFixed(4)}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.precision_macro.toFixed(4)}
                    </td>
                    <td className="py-2 tabular-nums">{r.recall_macro.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      ) : null}

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
            <p>{pipelineHealthCopy.lead}</p>
            <p className="mt-2 text-xs text-slate-600">{pipelineHealthCopy.trail}</p>
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
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delay: number;
  hint?: string;
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
      {hint ? (
        <p className="mt-1 text-[10px] leading-snug text-slate-600">{hint}</p>
      ) : null}
    </motion.div>
  );
}
