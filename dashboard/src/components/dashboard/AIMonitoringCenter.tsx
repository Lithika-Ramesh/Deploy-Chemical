"use client";

import { motion } from "framer-motion";
import { BrainCircuit } from "lucide-react";
import { useNotebookDashboard } from "@/context/NotebookDashboardContext";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { AIStatusNarrative } from "@/components/overview/AIStatusNarrative";
import { GlassPanel } from "./GlassPanel";

export function AIMonitoringCenter() {
  const { snapshot, simulationRunning } = usePlantSimulation();
  const { bundle } = useNotebookDashboard();
  const { insight } = snapshot;

  const expanded = simulationRunning || insight.plantStatus !== "NORMAL";

  const champTest = bundle?.multiclass.comparison.find(
    (r) => r.split === "test" && r.model === bundle.multiclass.champion,
  );

  return (
    <GlassPanel
      title="AI monitoring core"
      subtitle="Narrative view · champion probabilities from multiclass_champion_probabilities.csv"
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
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center gap-2 px-1">
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/10"
          >
            <BrainCircuit className="h-4 w-4 text-cyan-200" />
          </motion.div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Operator narrative (replaces raw metric tiles)
          </p>
        </div>

        <AIStatusNarrative className="border border-white/[0.06] bg-black/20 shadow-none" />

        {bundle && champTest && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5 text-[11px] leading-snug text-slate-300">
            <span className="font-semibold uppercase tracking-wider text-emerald-200/95">
              Notebook evaluation
            </span>
            <span className="mx-1.5 text-slate-600">·</span>
            Champion{" "}
            <span className="font-mono text-cyan-200/90">{bundle.multiclass.champion}</span> on
            holdout fault-period rows — accuracy{" "}
            <span className="font-mono text-slate-100">
              {(champTest.accuracy * 100).toFixed(2)}%
            </span>
            , macro-F1{" "}
            <span className="font-mono text-slate-100">
              {(champTest.macro_f1 * 100).toFixed(2)}%
            </span>
            .
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
