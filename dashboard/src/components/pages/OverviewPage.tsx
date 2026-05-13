"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { AIMonitoringCenter } from "@/components/dashboard/AIMonitoringCenter";
import { MaintenanceEvents } from "@/components/dashboard/MaintenanceEvents";
import { OverviewStatTiles } from "@/components/dashboard/OverviewStatTiles";
import { ProcessFlowVisual } from "@/components/dashboard/ProcessFlowVisual";

const SensorCharts = dynamic(
  () =>
    import("@/components/dashboard/SensorCharts").then((m) => m.SensorCharts),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xs uppercase tracking-widest text-slate-500">
        Loading telemetry…
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
          Central command view for the Tennessee Eastman surrogate twin — process
          topology, AI inference, and live historian channels.
        </p>
      </div>

      <OverviewStatTiles />

      <div className="grid min-w-0 flex-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4 2xl:col-span-3">
          <ProcessFlowVisual />
        </div>
        <div className="min-w-0 xl:col-span-4 2xl:col-span-4">
          <AIMonitoringCenter />
        </div>
        <div className="min-w-0 xl:col-span-4 2xl:col-span-5">
          <SensorCharts />
        </div>
      </div>

      <div className="mt-4">
        <MaintenanceEvents />
      </div>
    </motion.div>
  );
}
