"use client";

import {
  Fault5FigureGrid,
  type Fault5Figure,
} from "@/components/overview/Fault5FigureGrid";
import { FAULT5_TEP_ONSET_SAMPLE } from "@/lib/fault5MaintenanceCases";

const FIGURES: readonly Fault5Figure[] = [
  {
    src: "/data/fault5/11_xmeas_13_run78_vs_171.png",
    title: "Separator pressure",
    subtitle: "XMEAS_13 · run 78 vs 171",
    alt: "XMEAS_13 rolling mean: Fault 5 run 78 vs run 171",
    accent: "cyan",
    delay: 0,
  },
  {
    src: "/data/fault5/12_xmv_11_run78_vs_171.png",
    title: "Condenser CW flow",
    subtitle: "XMV_11 (PID) · run 78 vs 171",
    alt: "XMV_11 rolling mean: Fault 5 run 78 vs run 171",
    accent: "amber",
    delay: 0.04,
  },
  {
    src: "/data/fault5/13_p_fault_run78_vs_171.png",
    title: "P(fault)",
    subtitle: "Champion binary · run 78 vs 171",
    alt: "P(fault) from champion binary: Fault 5 run 78 vs run 171",
    accent: "red",
    delay: 0.08,
  },
];

export interface Fault5Run78Vs171FiguresProps {
  className?: string;
}

export function Fault5Run78Vs171Figures({ className = "" }: Fault5Run78Vs171FiguresProps) {
  return (
    <Fault5FigureGrid
      className={className}
      sectionTitle="Clean vs nuisance alarms"
      sectionDescription={
        <>
          Run 78 (clean hero) vs run 171 (pre-fault nuisance alarms) · tep_test.csv +
          champion binary · injection at sample{" "}
          <span className="font-mono text-orange-300/90">{FAULT5_TEP_ONSET_SAMPLE}</span>
        </>
      }
      figures={FIGURES}
    />
  );
}
