"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { GlassPanel } from "@/components/dashboard/GlassPanel";

export type Fault5Figure = {
  src: string;
  title: string;
  subtitle: string;
  alt: string;
  accent: "cyan" | "blue" | "amber" | "emerald" | "red";
  delay?: number;
};

export interface Fault5FigureGridProps {
  sectionTitle: string;
  sectionDescription: ReactNode;
  figures: readonly Fault5Figure[];
  className?: string;
}

export function Fault5FigureGrid({
  sectionTitle,
  sectionDescription,
  figures,
  className = "",
}: Fault5FigureGridProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div className="mb-3">
        <p className="font-[family-name:var(--font-orbitron)] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
          {sectionTitle}
        </p>
        <p className="mt-0.5 max-w-3xl text-[10px] text-slate-500">{sectionDescription}</p>
      </motion.div>
      <motion.div className="grid gap-4 lg:grid-cols-3">
        {figures.map((fig) => (
          <GlassPanel
            key={fig.src}
            title={fig.title}
            subtitle={fig.subtitle}
            accent={fig.accent}
            delay={fig.delay ?? 0}
          >
            <motion.div className="relative aspect-[12/5] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f172a]">
              <Image
                src={fig.src}
                alt={fig.alt}
                fill
                className="object-contain p-1"
                sizes="(max-width: 1024px) 100vw, 33vw"
              />
            </motion.div>
          </GlassPanel>
        ))}
      </motion.div>
    </motion.div>
  );
}
