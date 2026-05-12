"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Clock3,
  Gauge,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { GlassPanel } from "./GlassPanel";

export function AIMonitoringCenter() {
  const { snapshot, simulationRunning } = usePlantSimulation();
  const { insight } = snapshot;

  const expanded = simulationRunning || insight.plantStatus !== "NORMAL";

  return (
    <GlassPanel
      title="AI monitoring core"
      subtitle="Real-time inference · TEP fault classifier"
      accent={
        insight.plantStatus === "CRITICAL"
          ? "red"
          : insight.plantStatus === "WARNING"
            ? "amber"
            : "blue"
      }
      delay={0.1}
      className={expanded ? "ring-1 ring-amber-400/25" : ""}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <motion.div
              animate={
                simulationRunning
                  ? {
                      boxShadow: [
                        "0 0 0 0 rgba(248,113,113,0)",
                        "0 0 28px 4px rgba(248,113,113,0.45)",
                        "0 0 0 0 rgba(248,113,113,0)",
                      ],
                    }
                  : {
                      boxShadow: [
                        "0 0 0 0 rgba(34,211,238,0)",
                        "0 0 22px 2px rgba(34,211,238,0.35)",
                        "0 0 0 0 rgba(34,211,238,0)",
                      ],
                    }
              }
              transition={{ duration: 2.2, repeat: Infinity }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/10"
            >
              <BrainCircuit className="h-5 w-5 text-cyan-200" />
            </motion.div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Inference stream
              </p>
              <p className="font-[family-name:var(--font-orbitron)] text-xs font-semibold text-slate-100">
                AIFI · predictive maintenance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-medium text-cyan-100/90">
              {insight.confidencePct}% conf.
            </span>
          </div>
        </div>

        {insight.affectedSystems?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {insight.affectedSystems.map((s) => (
              <span
                key={s}
                className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-cyan-200/90"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <motion.div
          layout
          className="grid gap-3 rounded-xl border border-white/[0.06] bg-black/35 p-3 sm:grid-cols-2"
        >
          <Metric
            icon={<Gauge className="h-4 w-4 text-cyan-400" />}
            label="Plant status"
            value={insight.plantStatus}
            highlight={
              insight.plantStatus === "CRITICAL"
                ? "text-red-400"
                : insight.plantStatus === "WARNING"
                  ? "text-amber-300"
                  : "text-emerald-300"
            }
          />
          <Metric
            icon={<ShieldAlert className="h-4 w-4 text-sky-400" />}
            label="Severity"
            value={insight.severity}
            highlight={
              insight.severity === "CRITICAL" || insight.severity === "HIGH"
                ? "text-red-300"
                : "text-slate-200"
            }
          />
          <Metric
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            label="Maint. risk"
            value={insight.maintenanceRisk}
            highlight="text-amber-200"
          />
          <Metric
            icon={<AlertTriangle className="h-4 w-4 text-orange-400" />}
            label="Risk score"
            value={`${(insight.riskScore * 100).toFixed(1)}% · ${insight.riskLevel}`}
            highlight="text-orange-200"
          />
          <Metric
            icon={<Clock3 className="h-4 w-4 text-emerald-400" />}
            label="Failure window"
            value={
              insight.failureWindowMinutes != null
                ? `${insight.failureWindowMinutes} min`
                : "—"
            }
            highlight="text-emerald-200"
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={insight.detectedFault ?? "clear"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className={`rounded-xl border p-4 ${
              simulationRunning
                ? "border-red-500/40 bg-gradient-to-br from-red-500/15 to-transparent"
                : "border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent"
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Detected fault
            </p>
            <p className="mt-1 font-[family-name:var(--font-orbitron)] text-sm font-semibold text-slate-50">
              {insight.detectedFault ?? "No active fault signature"}
            </p>
          </motion.div>
        </AnimatePresence>

        <motion.div
          layout
          animate={
            expanded
              ? { scale: [1, 1.01, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 2.8, repeat: expanded ? Infinity : 0 }}
          className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Recommended action
          </p>
          <p className="mt-2 text-sm font-semibold text-cyan-100">
            {insight.recommendedAction}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {insight.actionDetail}
          </p>
        </motion.div>
      </div>
    </GlassPanel>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  highlight: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-black/25 p-2.5">
      <div className="mt-0.5 opacity-90">{icon}</div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className={`text-[13px] font-semibold ${highlight}`}>{value}</p>
      </div>
    </div>
  );
}
