"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useNotebookArtifact } from "@/hooks/useNotebookArtifact";
import {
  DEFAULT_HARDEST_FAULT_TEXT,
  buildEventLog,
  type EventLogEntry,
} from "@/lib/eventLog";
import type { MulticlassResultsArtifact } from "@/lib/overviewArtifacts";
import { FALLBACK_MULTICLASS } from "@/lib/overviewArtifacts";
import { GlassPanel } from "./GlassPanel";

function hardestFaultSentence(data: MulticlassResultsArtifact): string {
  const rows = data.per_class;
  if (!rows?.length) return DEFAULT_HARDEST_FAULT_TEXT;
  let worst = rows[0]!;
  for (const r of rows) {
    if (r.recall < worst.recall) worst = r;
  }
  const name =
    worst.name ??
    (typeof worst.label === "number"
      ? `Fault type ${worst.label}`
      : String(worst.label));
  const caught = Math.max(1, Math.min(10, Math.round(worst.recall * 10)));
  return `Hardest fault to detect: ${name} — caught in ${caught} of 10 cases. Operators should monitor feed sensors manually.`;
}

function entryStyles(e: EventLogEntry): string {
  if (e.type === "warning") {
    return "border-amber-400/35 bg-amber-500/10";
  }
  if (e.type === "resolved") {
    return "border-emerald-500/25 bg-emerald-500/5";
  }
  return "border-white/10 bg-white/[0.03]";
}

export function MaintenanceEvents() {
  const multiclass = useNotebookArtifact<MulticlassResultsArtifact>(
    "/data/multiclass_results.json",
    FALLBACK_MULTICLASS,
  );

  const entries = useMemo(() => {
    const sentence = hardestFaultSentence(multiclass);
    return buildEventLog(sentence);
  }, [multiclass]);

  return (
    <GlassPanel
    >
      <div className="max-h-[280px] space-y-2 overflow-y-auto p-3 sm:p-4">
        <p className="text-xs text-slate-500">A prototype of the maintenance events dashboard</p>
        {/* {entries.map((ev, idx) => (
          <LogRow key={ev.time + ev.text} entry={ev} index={idx} />
        ))} */}
      </div>
    </GlassPanel>
  );
}

function LogRow({ entry, index }: { entry: EventLogEntry; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`flex gap-3 rounded-xl border p-3 ${entryStyles(entry)}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-base">
        {entry.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {entry.time}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-200">{entry.text}</p>
      </div>
    </motion.article>
  );
}
