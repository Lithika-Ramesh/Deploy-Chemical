"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { useMemo } from "react";
import { useNotebookArtifact } from "@/hooks/useNotebookArtifact";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import type { ChampionProbabilitiesArtifact } from "@/lib/overviewArtifacts";
import {
  plainFaultDescription,
  plainShapFeatureName,
  plantStatusHeadline,
  plantStatusTone,
} from "@/lib/plainLanguage";
import type { FaultClassProbability } from "@/lib/types";

const EMPTY_PROBS: ChampionProbabilitiesArtifact = {};

function topDevelopingFaults(
  champion: ChampionProbabilitiesArtifact,
  mock: FaultClassProbability[],
): { label: string; pct: number }[] {
  if (Array.isArray(champion.classes) && champion.classes.length > 0) {
    const rows = champion.classes
      .filter((c) => c.id !== 0 && c.pct > 3)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 2)
      .map((c) => ({
        label: plainFaultDescription(c.id),
        pct: Math.round(c.pct * 10) / 10,
      }));
    return rows;
  }
  return mock
    .filter((m) => m.fault !== "Normal" && m.pct > 3)
    .slice(0, 2)
    .map((m) => ({ label: m.fault, pct: m.pct }));
}

export interface AIStatusNarrativeProps {
  className?: string;
}

export function AIStatusNarrative({ className = "" }: AIStatusNarrativeProps) {
  const { snapshot, shapFeatures, faultProbabilities } = usePlantSimulation();
  const champion = useNotebookArtifact<ChampionProbabilitiesArtifact>(
    "/data/multiclass_champion_probabilities.json",
    EMPTY_PROBS,
  );

  const insight = snapshot.insight;
  const hasDetectedFault = Boolean(insight.detectedFault);
  const tone = plantStatusTone(insight.plantStatus, hasDetectedFault);
  const headline = plantStatusHeadline(tone, insight.detectedFault);

  const developing = useMemo(
    () => topDevelopingFaults(champion, faultProbabilities),
    [champion, faultProbabilities],
  );
  const showDeveloping = developing.length > 0;

  const watching = useMemo(() => {
    const sorted = [...shapFeatures].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 3);
    const labels = ["highest attention", "elevated", "normal"] as const;
    return top.map((s, i) => ({
      name: plainShapFeatureName(s.tag),
      band: labels[Math.min(i, 2)]!,
    }));
  }, [shapFeatures]);

  const dataBadge =
    champion.generated_at != null
      ? `Model data · last run ${champion.generated_at}`
      : "Simulated · demo mode";

  const StatusIcon =
    tone === "normal"
      ? CheckCircle2
      : tone === "fault"
        ? ShieldAlert
        : AlertTriangle;

  const iconClass =
    tone === "normal"
      ? "text-emerald-300"
      : tone === "fault"
        ? "text-red-300"
        : "text-amber-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm sm:p-5 ${className}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[9px] font-medium uppercase tracking-widest text-slate-500">
            AI watch summary
          </p>
          <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[8px] text-slate-500">
            {dataBadge}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/35 ${iconClass}`}
          >
            <StatusIcon className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-orbitron)] text-xs font-semibold uppercase tracking-[0.14em] text-slate-100">
              {headline}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              The AI is {insight.confidencePct}% confident no fault is active.
            </p>
          </div>
        </div>

        {showDeveloping ? (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              If a fault were developing, it would most likely look like:
            </p>
            <ul className="mt-3 space-y-3">
              {developing.map((row) => (
                <li key={row.label} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200">{row.label}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-cyan-400/40"
                        style={{ width: `${Math.min(100, row.pct)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums text-[11px] text-cyan-200/90">
                    {row.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            What the AI is watching right now:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {watching.map((w) => (
              <li key={w.name} className="flex items-baseline gap-2">
                <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400/80" />
                <span>
                  <span className="font-medium text-slate-100">{w.name}</span>
                  <span className="text-slate-500"> — {w.band}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
