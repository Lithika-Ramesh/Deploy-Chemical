"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock3,
  Cog,
  ExternalLink,
  ListChecks,
  Shield,
} from "lucide-react";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import {
  FAULT5_TEP_ONSET_SAMPLE,
  FAULT5_MAINTENANCE_CASES,
} from "@/lib/fault5MaintenanceCases";
import {
  useNotebookDashboard,
  useNotebookMaintenance,
} from "@/context/NotebookDashboardContext";
import { severityBadgeClass } from "@/lib/mockTelemetry";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import type {
  MaintenanceRecommendation,
  MaintenanceTepCaseMetrics,
} from "@/lib/types";

export function MaintenancePage() {
  const { maintenanceItems, snapshot } = usePlantSimulation();
  const nbMaint = useNotebookMaintenance();
  const { bundle } = useNotebookDashboard();

  const items =
    nbMaint.length > 0 ? nbMaint : FAULT5_MAINTENANCE_CASES.length > 0
      ? FAULT5_MAINTENANCE_CASES
      : maintenanceItems;

  const isFault5Tep = items.some((m) => m.faultId === 5 && m.tepCase);

  return (
    <motion.div
      className="px-3 py-4 sm:px-4 lg:px-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <header className="mb-6">
        <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
          AI predictive maintenance
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          {isFault5Tep ? (
            <>
              Work orders below are grounded in{" "}
              <span className="font-mono text-cyan-300/90">tep_test.csv</span>{" "}
              Fault&nbsp;5 (condenser CW inlet temperature step) curated runs —
              same metrics as{" "}
              <span className="font-mono text-slate-400">
                outputs/figures/fault5
              </span>
              . Injection at sample{" "}
              <span className="font-mono text-orange-300/90">
                {FAULT5_TEP_ONSET_SAMPLE}
              </span>
              .
            </>
          ) : (
            <>
              AI-ranked work orders synchronized with the live twin (health{" "}
              <span className="font-mono text-cyan-300">
                {snapshot.systemHealthPct.toFixed(0)}%
              </span>
              ).
            </>
          )}
          {bundle ? (
            <span className="mt-1 block text-emerald-200/85">
              Data from{" "}
              <span className="font-mono text-emerald-100/90">
                tep_notebook_dashboard.json
              </span>{" "}
              (generated {new Date(bundle.generatedAt).toLocaleDateString()}).
            </span>
          ) : null}
        </p>
        {isFault5Tep ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Replay a run on{" "}
            <Link
              href="/simulation"
              className="inline-flex items-center gap-1 text-cyan-300/90 underline-offset-2 hover:underline"
            >
              Fault simulation
              <ExternalLink className="h-3 w-3" />
            </Link>{" "}
            (select Fault 5 when replay JSON is available).
          </p>
        ) : null}
      </header>

      {isFault5Tep ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <GlassPanel
            title="Clean vs nuisance alarms"
            subtitle="Run 78 vs 171 · real tep_test.csv + champion binary"
            accent="amber"
            delay={0}
          >
            <motion.div
              className="relative aspect-[12/7] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
            >
              <Image
                src="/data/fault5/03_clean_vs_run171.png"
                alt="P(fault) and XMEAS_13 comparison for tep_test Fault 5 runs 78 and 171"
                fill
                className="object-contain p-2"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </motion.div>
          </GlassPanel>
          {/* <GlassPanel
            title="Run comparison"
            subtitle="Pre-fault false alarms · detection delay · XMEAS_13 step"
            accent="cyan"
            delay={0.04}
          >
            <motion.div
              className="relative aspect-[3/1] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.08 }}
            >
              <Image
                src="/data/fault5/04_metrics_bars.png"
                alt="Bar chart comparing Fault 5 curated tep_test runs"
                fill
                className="object-contain p-2"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </motion.div>
          </GlassPanel> */}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((m, idx) => (
          <MaintenanceCard key={m.id} item={m} index={idx} />
        ))}
      </div>
    </motion.div>
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
        subtitle={
          item.tepCase
            ? `${item.tepCase.caseTag} · urgency ${item.urgency} · ${item.risk} risk`
            : `Urgency ${item.urgency} · ${item.risk} risk`
        }
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
        <motion.div
          className="space-y-4 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.04 + index * 0.03 }}
        >
          <motion.div
            className="flex flex-wrap items-center gap-2"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 + index * 0.03 }}
          >
            <span
              className={`rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${severityBadgeClass(item.risk)}`}
            >
              {item.risk}
            </span>
            <span className="flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-cyan-200">
              <Shield className="h-3 w-3" />
              {item.urgency}
            </span>
            {item.tepCase ? (
              <span className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 font-mono text-[9px] text-orange-200/90">
                tep_test run {item.tepCase.simulationRun}
              </span>
            ) : null}
            {item.failureWindowMinutes != null && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock3 className="h-3 w-3" />
                Est. window {item.failureWindowMinutes} min
              </span>
            )}
          </motion.div>

          {item.tepCase ? (
            <TepCaseMetricsGrid metrics={item.tepCase} />
          ) : null}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Detected issue
            </p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {item.issue}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 + index * 0.03 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Estimated impact (holdout test metrics)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {item.impact}
            </p>
          </motion.div>

          <div>
            <motion.div
              className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="flex items-center gap-1">
                <Cog className="h-3 w-3" /> Work order progress
              </span>
              <span className="font-mono text-cyan-300">{item.progressPct}%</span>
            </motion.div>
            <motion.div
              className="h-2 overflow-hidden rounded-full bg-white/[0.06]"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${item.progressPct}%` }}
                transition={{ duration: 0.8, delay: 0.12 + index * 0.04 }}
              />
            </motion.div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
              <ListChecks className="h-3 w-3" /> Inspection steps
            </p>
            <ul className="space-y-2">
              {item.steps.map((step, i) => (
                <motion.li
                  key={i}
                  className="flex gap-2 text-xs text-slate-400"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 + index * 0.03 + i * 0.02 }}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/70" />
                  {step}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </GlassPanel>
    </motion.article>
  );
}

function TepCaseMetricsGrid({ metrics }: { metrics: MaintenanceTepCaseMetrics }) {
  const cells = [
    { label: "Pre-fault FA", value: String(metrics.preFalseAlarms) },
    {
      label: "1st alert",
      value:
        metrics.firstAlertSample != null
          ? String(metrics.firstAlertSample)
          : "—",
    },
    {
      label: "Delay vs 161",
      value:
        metrics.detectionDelaySamples != null
          ? String(metrics.detectionDelaySamples)
          : "—",
    },
    {
      label: "Max P(fault)",
      value: `${(metrics.maxPFault * 100).toFixed(2)}%`,
    },
    {
      label: "IDV(5) ID",
      value: `${metrics.multiclassIdv5Pct.toFixed(1)}%`,
    },
    {
      label: "Δ XMEAS_13",
      value: metrics.xmeas13Delta.toFixed(2),
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 gap-2 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] p-2 sm:grid-cols-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {cells.map((c) => (
        <motion.div
          key={c.label}
          className="rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
        >
          <p className="text-[8px] uppercase tracking-wider text-slate-500">
            {c.label}
          </p>
          <p className="font-mono text-[11px] text-cyan-100/95">{c.value}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
