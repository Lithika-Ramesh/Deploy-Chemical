"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import { useIncidentChecklist } from "@/context/IncidentChecklistContext";
import { useNotebookIncidents } from "@/context/NotebookDashboardContext";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { getChecklistForIncident } from "@/lib/incidentChecklist";
import { INCIDENT_SUBSYSTEMS } from "@/lib/incidents";
import { severityBadgeClass } from "@/lib/mockTelemetry";
import type { IncidentRecord, Severity } from "@/lib/types";

const SEVERITY_OPTIONS: (Severity | "ALL")[] = [
  "ALL",
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export function AlertsPage() {
  const { incidents: simIncidents } = usePlantSimulation();
  const nbIncidents = useNotebookIncidents();
  const { remainingSteps } = useIncidentChecklist();
  const incidents = nbIncidents.length > 0 ? nbIncidents : simIncidents;
  const [sev, setSev] = useState<Severity | "ALL">("ALL");
  const [subsystem, setSubsystem] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (sev !== "ALL" && i.severity !== sev) return false;
      if (subsystem !== "ALL" && i.subsystem !== subsystem) return false;
      if (q.trim()) {
        const s = `${i.title} ${i.diagnosis} ${i.recommendedAction}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [incidents, sev, subsystem, q]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => b.ts.getTime() - a.ts.getTime()),
    [filtered],
  );

  const unackedInView = useMemo(
    () => sorted.filter((i) => !i.acknowledged).length,
    [sorted],
  );

  const stepsFleet = useMemo(
    () => remainingSteps(incidents),
    [incidents, remainingSteps],
  );
  const stepsInView = useMemo(
    () => remainingSteps(sorted),
    [sorted, remainingSteps],
  );

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-6">
        <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
          Alerts & incidents
        </h2>
        
      </header>

      <GlassPanel
        title="Incident filters"
        subtitle="Narrow by severity, subsystem, or free-text search"
        accent="blue"
        delay={0}
      >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-1 flex-col gap-1 sm:min-w-[140px]">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
              <Filter className="h-3 w-3" /> Severity
            </span>
            <select
              value={sev}
              onChange={(e) => setSev(e.target.value as Severity | "ALL")}
              className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-100"
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 sm:min-w-[180px]">
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              Subsystem
            </span>
            <select
              value={subsystem}
              onChange={(e) => setSubsystem(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-100"
            >
              <option value="ALL">All subsystems</option>
              {INCIDENT_SUBSYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
              <Search className="h-3 w-3" /> Search
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, diagnosis, action…"
              className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </label>
        </div>
      </GlassPanel>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-slate-500">
          {sorted.length} incident{sorted.length === 1 ? "" : "s"} in this view
          {unackedInView > 0 ? (
            <span className="normal-case text-cyan-200/90">
              {" "}
              · {unackedInView} unacknowledged · {stepsInView} checklist step
              {stepsInView === 1 ? "" : "s"} left here · {stepsFleet} fleet-wide
            </span>
          ) : (
            <span className="normal-case text-slate-600">
              {" "}
              · all acknowledged in this view · {stepsInView} checklist step
              {stepsInView === 1 ? "" : "s"} left in view
            </span>
          )}
        </p>
        {sorted.map((inc, idx) => (
          <IncidentCard
            key={inc.id}
            inc={inc}
            index={idx}
            expanded={expanded === inc.id}
            onToggle={() =>
              setExpanded((e) => (e === inc.id ? null : inc.id))
            }
          />
        ))}
      </div>
    </div>
  );
}

function IncidentCard({
  inc,
  index,
  expanded,
  onToggle,
}: {
  inc: IncidentRecord;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const time = inc.ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent backdrop-blur-xl shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <motion.div
          animate={
            inc.severity === "CRITICAL"
              ? { boxShadow: ["0 0 0 0 transparent", "0 0 24px 2px rgba(248,113,113,0.4)", "0 0 0 0 transparent"] }
              : {}
          }
          transition={{ duration: 2, repeat: Infinity }}
          className={`mt-0.5 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${severityBadgeClass(inc.severity)}`}
        >
          {inc.severity}
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-slate-50">
            {inc.title}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {time} · {inc.subsystem}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {!inc.acknowledged ? (
        <IncidentChecklist inc={inc} />
      ) : (
        <p className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-slate-600">
          Record marked acknowledged — no operator checklist.
        </p>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.06] bg-black/25"
          >
            <div className="space-y-3 p-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  AI diagnosis
                </p>
                <p className="mt-1 text-slate-300">{inc.diagnosis}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-400/90">
                  Recommended action
                </p>
                <p className="mt-1 font-medium text-amber-100/95">
                  {inc.recommendedAction}
                </p>
              </div>
              {inc.faultId && (
                <p className="text-[10px] text-slate-600">
                  Fault class ID: {inc.faultId}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function IncidentChecklist({ inc }: { inc: IncidentRecord }) {
  const { isChecked, toggle } = useIncidentChecklist();
  const items = useMemo(() => getChecklistForIncident(inc), [inc]);
  const done = items.filter((it) => isChecked(inc.id, it.id)).length;

  return (
    <div className="border-t border-white/[0.06] bg-black/20 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Operator checklist{" "}
        <span className="font-mono text-cyan-200/80">
          {done}/{items.length}
        </span>
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((it) => {
          const on = isChecked(inc.id, it.id);
          return (
            <li key={it.id} className="flex items-start gap-2">
              <input
                id={`${inc.id}-${it.id}`}
                type="checkbox"
                checked={on}
                onChange={() => toggle(inc.id, it.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/50 text-cyan-500 focus:ring-cyan-400/50"
              />
              <label
                htmlFor={`${inc.id}-${it.id}`}
                className={`cursor-pointer text-[12px] leading-snug ${
                  on ? "text-slate-500 line-through" : "text-slate-200"
                }`}
              >
                {it.label}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
