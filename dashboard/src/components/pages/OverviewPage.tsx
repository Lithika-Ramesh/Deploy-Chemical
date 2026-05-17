"use client";

import { motion } from "framer-motion";
import { MaintenanceEvents } from "@/components/dashboard/MaintenanceEvents";
import { OverviewStatTiles } from "@/components/dashboard/OverviewStatTiles";
import { Fault5SensorFigures } from "@/components/overview/Fault5SensorFigures";

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
          Fault&nbsp;5 process traces from{" "}
         
        </p>
      </div>

      <OverviewStatTiles />

      <div className="mt-4 min-w-0">
        <Fault5SensorFigures />
      </div>

      <div className="mt-4">
        <MaintenanceEvents />
      </div>
    </motion.div>
  );
}
