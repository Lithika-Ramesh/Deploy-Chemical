"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  Cpu,
  Factory,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { statusColorClass } from "@/lib/mockTelemetry";

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Clock only updates after mount so SSR HTML matches the client (avoids hydration mismatch). */
function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function TopNav() {
  const {
    snapshot,
    notificationCount,
    simulationRunning,
    headerPlantStatusLabel,
  } = usePlantSimulation();
  const { insight, systemHealthPct, aiOnline } = snapshot;
  const now = useClock();

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-20 flex flex-col gap-3 border-b border-white/[0.07] bg-[#030712]/80 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_24px_-4px_rgba(34,211,238,0.65)]">
          <Factory className="h-5 w-5 text-cyan-300" strokeWidth={1.5} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold uppercase tracking-[0.18em] text-slate-100 sm:text-base">
              Eastman TEP Digital Twin
            </h1>
            <span className="hidden rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-slate-400 sm:inline">
              Smart chemical plant
            </span>
            {simulationRunning && (
              <span className="rounded border border-orange-500/35 bg-orange-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-orange-200">
                Sim active
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Predictive fault intelligence
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <StatusChip
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Plant"
          value={headerPlantStatusLabel}
          valueClass={statusColorClass(snapshot.insight.plantStatus)}
          pulse={snapshot.insight.plantStatus !== "NORMAL"}
        />
        <StatusChip
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="AI status"
          value={aiOnline ? "ONLINE" : "STANDBY"}
          valueClass={aiOnline ? "text-emerald-300" : "text-slate-500"}
          pulse={aiOnline}
        />
        <StatusChip
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="System health"
          value={`${systemHealthPct.toFixed(0)}%`}
          valueClass={
            systemHealthPct < 55
              ? "text-red-400"
              : systemHealthPct < 80
                ? "text-amber-300"
                : "text-cyan-200"
          }
        />

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <span className="hidden min-w-[9ch] tabular-nums font-mono text-[11px] text-cyan-200/80 sm:inline-block">
            {now ? formatTime(now) : "\u00a0"}
          </span>
          <Link
            href="/simulation"
            className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:border-cyan-400/35 hover:text-cyan-100 lg:inline"
          >
            Control room
          </Link>
          <motion.span whileHover={{ scale: 1.05 }} className="relative inline-flex">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300"
            >
              <Bell className="h-4 w-4" />
            </button>
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-[0_0_12px_2px_rgba(239,68,68,0.85)]">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </motion.span>
        </div>
      </div>
    </motion.header>
  );
}

function StatusChip({
  icon,
  label,
  value,
  valueClass,
  pulse,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5">
      <span className="text-cyan-500/80">{icon}</span>
      <div className="leading-tight">
        <p className="text-[9px] uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <motion.p
          animate={pulse ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
          transition={
            pulse
              ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
          className={`text-[11px] font-semibold ${valueClass}`}
        >
          {value}
        </motion.p>
      </div>
    </div>
  );
}
