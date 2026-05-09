"use client";

import type { ReactNode } from "react";
import { DashboardBackground } from "./DashboardBackground";
import { MobileNav, SideNav } from "./SideNav";
import { TopNav } from "@/components/dashboard/TopNav";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { motion } from "framer-motion";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { simulationRunning, snapshot } = usePlantSimulation();
  const critical = snapshot.insight.plantStatus === "CRITICAL";

  return (
    <div className="relative min-h-screen text-slate-100">
      <DashboardBackground />
      {simulationRunning && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent md:left-56"
          animate={{ opacity: critical ? [0.5, 1, 0.5] : [0.25, 0.8, 0.25] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div className="relative z-10 flex min-h-screen">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          <TopNav />
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
