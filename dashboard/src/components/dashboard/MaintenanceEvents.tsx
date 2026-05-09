"use client";

import { motion } from "framer-motion";
import {
  AlertOctagon,
  Bot,
  ClipboardList,
  RadioTower,
  ScrollText,
  Wrench,
} from "lucide-react";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import type { PlantEvent, Severity } from "@/lib/types";
import { GlassPanel } from "./GlassPanel";

const kindIcon = {
  maintenance: Wrench,
  ai_alert: Bot,
  anomaly: AlertOctagon,
  recommendation: RadioTower,
  log: ScrollText,
} as const;

function severityStyles(s: Severity): string {
  if (s === "CRITICAL") {
    return "border-red-500/45 bg-red-500/10 shadow-[0_0_32px_-8px_rgba(248,113,113,0.75)]";
  }
  if (s === "HIGH") {
    return "border-orange-400/40 bg-orange-500/10 shadow-[0_0_28px_-10px_rgba(251,146,60,0.55)]";
  }
  if (s === "MEDIUM" || s === "LOW") {
    return "border-amber-400/25 bg-amber-500/5";
  }
  return "border-white/10 bg-white/[0.03]";
}

export function MaintenanceEvents() {
  const { events, simulationRunning } = usePlantSimulation();

  return (
    <GlassPanel
      title="Maintenance & AI events"
      subtitle="Tickets · alerts · operator guidance · system logs"
      accent={simulationRunning ? "red" : "cyan"}
      delay={0.18}
    >
      <div className="max-h-[280px] space-y-2 overflow-y-auto p-3 sm:p-4">
        {events.map((ev, idx) => (
          <EventCard key={ev.id} event={ev} index={idx} />
        ))}
      </div>
    </GlassPanel>
  );
}

function EventCard({ event, index }: { event: PlantEvent; index: number }) {
  const Icon = kindIcon[event.kind];
  const time = event.ts.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <motion.article
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className={`flex gap-3 rounded-xl border p-3 ${severityStyles(event.severity)}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40">
        <Icon className="h-4 w-4 text-cyan-300" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-mono text-slate-500">{time}</span>
          <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-slate-400">
            {event.kind.replace("_", " ")}
          </span>
          {event.severity !== "NONE" && (
            <span className="text-[8px] font-semibold uppercase tracking-wider text-amber-200/90">
              {event.severity}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-100">{event.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
          {event.detail}
        </p>
      </div>
      <ClipboardList className="mt-1 hidden h-4 w-4 shrink-0 text-slate-600 sm:block" />
    </motion.article>
  );
}
