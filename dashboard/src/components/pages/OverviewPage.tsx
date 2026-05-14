"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { AIStatusNarrative } from "@/components/overview/AIStatusNarrative";
import { MaintenanceEvents } from "@/components/dashboard/MaintenanceEvents";
import { OverviewStatTiles } from "@/components/dashboard/OverviewStatTiles";

const LiveSensorCharts = dynamic(
  () =>
    import("@/components/overview/LiveSensorCharts").then(
      (m) => m.LiveSensorCharts,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xs text-slate-500">
        Preparing live charts…
      </div>
    ),
  },
);

export function OverviewPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-3 py-4 sm:px-4 lg:px-6"
    >
      <div className="mb-4">
        <h2 className="font-[family-name:var(--font-orbitron)] text-lg font-semibold uppercase tracking-[0.12em] text-slate-100">
          Operations overview
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          A clear, operator-first view of plant health, AI monitoring, and key
          process traces. Panels load optional metrics from{" "}
          <span className="font-mono text-cyan-200/80">public/data/</span> when
          you publish JSON there; otherwise the UI uses built-in demonstration
          values so the board always looks complete.
        </p>
      </div>

      <OverviewStatTiles />

      <div className="grid min-w-0 flex-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5 2xl:col-span-4">
          <AIStatusNarrative />
        </div>
        <div className="min-w-0 xl:col-span-7 2xl:col-span-8">
          <LiveSensorCharts />
        </div>
      </div>

      <div className="mt-4">
        <MaintenanceEvents />
      </div>
    </motion.div>
  );
}
