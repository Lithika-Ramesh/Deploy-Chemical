"use client";

import { motion } from "framer-motion";
import { ArrowRight, Radio } from "lucide-react";
import Link from "next/link";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import { useNotebookDashboard } from "@/context/NotebookDashboardContext";

/** Matches `DashboardBackground` base layer */
const DASH_BG = "none";

export function ArchitecturePage() {
  const { bundle } = useNotebookDashboard();

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-6">
        <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
          Process architecture
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Tennessee Eastman P&amp;ID. The highlighted instrument is separator
          pressure (kPa gauge — same signal as the alarm lab). Click the marker
          to open the notebook-aligned alarm view.
        </p>
      </header>

      <GlassPanel
        title="TEP piping & instrumentation"
        subtitle="Landscape view · diagram fills the panel · alarm highlight"
        accent="cyan"
        delay={0}
      >
        <figure className="relative w-full max-w-full p-0 sm:p-2">
          <div
            className="relative w-full max-w-full overflow-hidden rounded-xl border border-white/[0.06]"
            style={{ backgroundColor: DASH_BG }}
          >
            {/* Tall source rotated −90° → wide on screen; min-height + flex maximize usable area */}
            <div className="flex min-h-[min(68dvh,720px)] w-full max-w-full items-center justify-center p-2 sm:min-h-[min(72dvh,780px)] sm:p-4">
              <div className="relative inline-block max-h-full max-w-full origin-center -rotate-270">
                {/* eslint-disable-next-line @next/next/no-img-element -- static P&ID asset */}
                <img
                  src="/tep_architecture_pid.png"
                  alt="Tennessee Eastman process and instrumentation diagram"
                  className="block h-[min(96vw,92dvh,960px)] w-auto max-h-[92dvh] max-w-[min(96vw,1600px)] object-contain object-center mix-blend-multiply contrast-[1.06] sm:h-[min(94vw,88dvh,920px)]"
                  draggable={false}
                />

                {/* xmeas_13 marker — nudge with left-[px] / top-[px] on this block */}
                <motion.div className="absolute left-[180px] top-[380px] size-12 -translate-x-1/2 -translate-y-1/2">
                  <span className="pointer-events-none absolute inset-2 rounded-full bg-red-500/35 animate-ping" />
                  <motion.span
                    className="pointer-events-none absolute inset-[12%] rounded-full border-2 border-red-400/95 shadow-[0_0_22px_rgba(239,68,68,0.55)]"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <Link
                    href="/alarm-xmeas13"
                    className="absolute inset-0 z-10 rounded-full outline-none ring-offset-2 ring-offset-[#020617] focus-visible:ring-2 focus-visible:ring-red-400"
                    aria-label="Open alarm lab for separator pressure"
                    title="Separator pressure — open alarm lab"
                  >
                    <span className="sr-only">Open alarm lab for separator pressure</span>
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>

          <figcaption className="mt-4 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Radio className="h-3.5 w-3.5 shrink-0 text-red-300/85" />
              <span>
                Live target:{" "}
                <strong className="font-mono text-slate-200">xmeas_13</strong> ·
                vap/liq separator pressure (PI)
              </span>
            </p>
            <Link
              href="/alarm-xmeas13"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-100 transition-colors hover:bg-cyan-500/25 sm:self-auto"
            >
              Alarm lab
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </figcaption>
        </figure>
      </GlassPanel>

      {bundle?.architecture ? (
        <GlassPanel
          title="Classifier context (notebooks)"
          subtitle="Same P&amp;ID view as above — this panel is metadata only"
          accent="emerald"
          delay={0.06}
          className="mt-4"
        >
          <div className="space-y-2 p-4 text-sm text-slate-300">
            <p className="font-[family-name:var(--font-orbitron)] text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
              {bundle.architecture.headline}
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              {bundle.architecture.detail}
            </p>
          </div>
        </GlassPanel>
      ) : null}
    </div>
  );
}
