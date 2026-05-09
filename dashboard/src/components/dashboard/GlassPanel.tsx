"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type GlassPanelProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  accent?: "cyan" | "blue" | "emerald" | "amber" | "red";
  delay?: number;
};

const accentRing: Record<NonNullable<GlassPanelProps["accent"]>, string> = {
  cyan: "from-cyan-400/40 via-cyan-500/10 to-transparent",
  blue: "from-blue-400/35 via-blue-500/10 to-transparent",
  emerald: "from-emerald-400/35 via-emerald-500/10 to-transparent",
  amber: "from-amber-400/40 via-amber-500/10 to-transparent",
  red: "from-red-500/45 via-red-600/15 to-transparent",
};

export function GlassPanel({
  title,
  subtitle,
  children,
  className = "",
  accent = "cyan",
  delay = 0,
}: GlassPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_24px_80px_-32px_rgba(0,240,255,0.25)] backdrop-blur-xl ${className}`}
    >
      <div
        className={`pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-gradient-to-br ${accentRing[accent]} blur-2xl`}
      />
      {(title || subtitle) && (
        <header className="relative z-10 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          {title && (
            <h2 className="font-[family-name:var(--font-orbitron)] text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/90">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
          )}
        </header>
      )}
      <div className="relative z-10">{children}</div>
    </motion.section>
  );
}
