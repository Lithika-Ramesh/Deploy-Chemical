"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertOctagon,
  Layers,
  Radio,
  Shield,
  Siren,
} from "lucide-react";
import Link from "next/link";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { FAULT_ORDER } from "@/lib/faultCatalog";

const HISTORY_CAP = 48;

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  delay,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  delay: number;
  href?: string;
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-orbitron)] text-2xl font-semibold tabular-nums text-slate-100">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-cyan-200/90">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
      </div>
      {href ? (
        <span className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-cyan-400/70 group-hover:text-cyan-300/90">
          Open →
        </span>
      ) : null}
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]">
        {inner}
      </Link>
    );
  }
  return <div className="min-w-0">{inner}</div>;
}

export function OverviewStatTiles() {
  const {
    incidents,
    history,
    plantStatus,
    simulationRunning,
    paused,
    snapshot,
    apiReachable,
    pipelineManifest,
    tick,
  } = usePlantSimulation();

  const openPriorityIncidents = incidents.filter(
    (i) =>
      !i.acknowledged &&
      (i.severity === "HIGH" || i.severity === "CRITICAL"),
  ).length;

  const simLabel = !simulationRunning
    ? "Idle"
    : paused
      ? "Paused"
      : "Live";

  const apiLabel =
    apiReachable === null ? "Mock only" : apiReachable ? "Backend OK" : "Offline";

  const dataPlaneHint =
    apiReachable === null
      ? "Set NEXT_PUBLIC_AIFI_API_URL for /health + /metrics"
      : !apiReachable
        ? "API unreachable — check Uvicorn"
        : pipelineManifest?.bestModel
          ? `Manifest: ${pipelineManifest.bestModel}${
              pipelineManifest.bestF1Macro != null
                ? ` · F1macro ${pipelineManifest.bestF1Macro.toFixed(3)}`
                : ""
            }`
          : "Linked — no manifest (run src.pipeline for /metrics)";

  const bufferPct =
    HISTORY_CAP > 0 ? Math.round((history.length / HISTORY_CAP) * 100) : 0;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Tile
        label="Fault scenarios"
        value={FAULT_ORDER.length}
        hint="TEP surrogate fault library"
        icon={Siren}
        delay={0}
        href="/simulation"
      />
      <Tile
        label="XMEAS channels"
        value={41}
        hint="Tennessee Eastman benchmark"
        icon={Layers}
        delay={0.04}
      />
      <Tile
        label="Open incidents"
        value={openPriorityIncidents}
        hint="HIGH / CRITICAL · unacked"
        icon={AlertOctagon}
        delay={0.08}
        href="/alerts"
      />
      <Tile
        label="Plant status"
        value={plantStatus}
        hint={snapshot.insight.detectedFault ?? "No active fault signature"}
        icon={Shield}
        delay={0.12}
      />
      <Tile
        label="Twin stream"
        value={simLabel}
        hint={`Tick ${tick} · buffer ${bufferPct}%`}
        icon={Radio}
        delay={0.16}
        href="/simulation"
      />
      <Tile
        label="Data plane"
        value={apiLabel}
        hint={dataPlaneHint}
        icon={Activity}
        delay={0.2}
      />
    </div>
  );
}
