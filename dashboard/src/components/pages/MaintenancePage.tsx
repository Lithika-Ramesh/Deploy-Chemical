"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock3,
  Cog,
  ListChecks,
  Shield,
} from "lucide-react";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import {
  useNotebookDashboard,
  useNotebookMaintenance,
} from "@/context/NotebookDashboardContext";
import { severityBadgeClass } from "@/lib/mockTelemetry";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import type { MaintenanceRecommendation } from "@/lib/types";

export function MaintenancePage() {
  const { maintenanceItems, snapshot } = usePlantSimulation();
  const nbMaint = useNotebookMaintenance();
  const { bundle } = useNotebookDashboard();
  const items = nbMaint.length > 0 ? nbMaint : maintenanceItems;

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-6">
        <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
          Predictive maintenance
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          AI-ranked work orders, equipment risk, and downtime prevention
          estimates synchronized with the live twin (health{" "}
          <span className="font-mono text-cyan-300">
            {snapshot.systemHealthPct.toFixed(0)}%
          </span>
          ).
          {nbMaint.length > 0 && bundle ? (
            <span className="mt-1 block text-emerald-200/85">
              Work orders below are driven by{" "}
              <span className="font-mono text-emerald-100/90">tep_notebook_dashboard.json</span>{" "}
              (generated {new Date(bundle.generatedAt).toLocaleDateString()}).
            </span>
          ) : null}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((m, idx) => (
          <MaintenanceCard key={m.id} item={m} index={idx} />
        ))}
      </div>
    </div>
  );
}

function MaintenanceCard({
  item,
  index,
}: {
  item: MaintenanceRecommendation;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <GlassPanel
        title={item.equipment}
        subtitle={`Urgency ${item.urgency} · ${item.risk} risk`}
        accent={
          item.risk === "CRITICAL"
            ? "red"
            : item.risk === "HIGH"
              ? "amber"
              : "emerald"
        }
        delay={0}
        className="h-full"
      >
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${severityBadgeClass(item.risk)}`}
            >
              {item.risk}
            </span>
            <span className="flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-cyan-200">
              <Shield className="h-3 w-3" />
              {item.urgency}
            </span>
            {item.failureWindowMinutes != null && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock3 className="h-3 w-3" />
                Est. window {item.failureWindowMinutes} min
              </span>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Detected issue
            </p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {item.issue}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Estimated impact
            </p>
            <p className="mt-1 text-xs text-slate-400">{item.impact}</p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-1">
                <Cog className="h-3 w-3" /> Work order progress
              </span>
              <span className="font-mono text-cyan-300">{item.progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${item.progressPct}%` }}
                transition={{ duration: 0.8, delay: 0.15 }}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
              <ListChecks className="h-3 w-3" /> Inspection steps
            </p>
            <ul className="space-y-2">
              {item.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-xs text-slate-400"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/70" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GlassPanel>
    </motion.article>
  );
}
