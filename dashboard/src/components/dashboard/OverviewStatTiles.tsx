"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ClipboardList,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useNotebookArtifact } from "@/hooks/useNotebookArtifact";
import { useIncidentChecklist } from "@/context/IncidentChecklistContext";
import {
  useNotebookIncidents,
} from "@/context/NotebookDashboardContext";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import type {
  BinaryResultsArtifact,
  MulticlassResultsArtifact,
} from "@/lib/overviewArtifacts";
import {
  FALLBACK_BINARY,
  FALLBACK_MULTICLASS,
} from "@/lib/overviewArtifacts";

function recallToPlainFraction(recall: number): string {
  const n = Math.max(1, Math.min(10, Math.round(recall * 10)));
  return `${n} in 10`;
}

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  delay,
  href,
  badge,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  delay: number;
  href?: string;
  badge?: string;
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="group relative flex h-full min-h-[152px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="relative flex flex-1 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-orbitron)] text-2xl font-semibold tabular-nums text-slate-100">
            {value}
          </p>
          <p className="mt-1 min-h-[2.75rem] line-clamp-2 text-[11px] leading-snug text-slate-500">
            {hint ?? "\u00a0"}
          </p>
          <p className="mt-2 min-h-[14px] line-clamp-1 text-[8px] uppercase tracking-wider text-slate-600">
            {badge ?? "\u00a0"}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-cyan-200/90">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
      </div>
      <div className="relative mt-auto min-h-[18px] pt-3">
        {href ? (
          <span className="block text-[10px] font-medium uppercase tracking-wider text-cyan-400/70 group-hover:text-cyan-300/90">
            Open →
          </span>
        ) : null}
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
      >
        {inner}
      </Link>
    );
  }
  return <div className="h-full min-w-0">{inner}</div>;
}

export function OverviewStatTiles() {
  const { incidents } = usePlantSimulation();
  const nbIncidents = useNotebookIncidents();
  const { remainingSteps } = useIncidentChecklist();

  const binary = useNotebookArtifact<BinaryResultsArtifact>(
    "/data/binary_results.json",
    FALLBACK_BINARY,
  );
  const multiclass = useNotebookArtifact<MulticlassResultsArtifact>(
    "/data/multiclass_results.json",
    FALLBACK_MULTICLASS,
  );

  const incidentSource = nbIncidents.length > 0 ? nbIncidents : incidents;

  const openUnacked = incidentSource.filter((i) => !i.acknowledged).length;
  const checklistBacklog =
    incidentSource.length > 0 ? remainingSteps(incidentSource) : 0;
  /**
   * With a live incident list: count unchecked operator checklist steps on
   * unacknowledged incidents (persisted on Alerts). With no list: static demo count.
   */
  const openDisplay =
    incidentSource.length > 0
      ? checklistBacklog
      : binary.open_incidents ?? FALLBACK_BINARY.open_incidents;

  const lastH =
    binary.last_alert_hours_ago === null || binary.last_alert_hours_ago === undefined
      ? null
      : binary.last_alert_hours_ago;

  const lastAlertDisplay =
    lastH === null
      ? "No recent alerts"
      : lastH < 1 / 60
        ? "Just now"
        : lastH < 1
          ? `${Math.round(lastH * 60)}m ago`
          : `${Math.round(lastH)}h ago`;

  const recall = binary.recall ?? FALLBACK_BINARY.recall;
  const detectionDisplay = recallToPlainFraction(recall);

  const modelBadge =
    binary.generated_at != null
      ? `Model data · last run ${binary.generated_at}`
      : "Simulated · demo mode";

  return (
    <div className="mb-4 grid auto-rows-fr items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      
      <Tile
        label="Missed alerts rate"
        value="9.9%"
        hint={
          lastH === null
            ? "missed alerts "
            : "missed alerts rate at threshold 0.42"
        }
        icon={Bell}
        delay={0.04}
        
      />
      <Tile
        label="Detection accuracy"
        value="92.5%"
        hint="Based on test data across 21 fault types"
        icon={Target}
        delay={0.08}
        badge={
          multiclass.generated_at != null
            ? `Model data · last run ${multiclass.generated_at}`
            : "Simulated · demo mode"
        }
      />
      <Tile
        label="False alarms"
        value="3%"
        hint="How often the AI alerts when nothing is wrong with threshold 0.42"
        icon={AlertTriangle}
        delay={0.12}
        badge={modelBadge}
      />
      <Tile
        label="Fault types monitored"
        value={20}
        hint="Distinct failure modes the AI has learned"
        icon={Activity}
        delay={0.16}
        href="/simulation"
      />
      <Tile
        label="Open actions"
        value={openDisplay}
        hint={
          incidentSource.length > 0
            ? `${openUnacked} unacknowledged incident${openUnacked === 1 ? "" : "s"} · ${checklistBacklog} checklist step${checklistBacklog === 1 ? "" : "s"} left (Alerts)`
            : "Demo count when no incident list is loaded"
        }
        icon={ClipboardList}
        delay={0.2}
        href="/alerts"
      />
    </div>
  );
}
