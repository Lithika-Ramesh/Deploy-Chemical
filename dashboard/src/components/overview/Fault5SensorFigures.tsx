"use client";

import {
  Fault5FigureGrid,
  type Fault5Figure,
} from "@/components/overview/Fault5FigureGrid";
import { FAULT5_TEP_ONSET_SAMPLE } from "@/lib/fault5MaintenanceCases";

const FIGURES: readonly Fault5Figure[] = [
  {
    src: "/data/fault5/08_xmeas_22_run78_vs_normal.png",
    title: "Separator cooling water outlet temperature",
    subtitle: "XMEAS_22 · tep_test run 78 vs normal run 1",
    alt: "XMEAS_22 separator cooling water outlet temperature: Fault 5 run 78 vs normal run 1",
    accent: "cyan",
    delay: 0,
    priority: true,
  },
  {
    src: "/data/fault5/09_xmeas_11_run78_vs_normal.png",
    title: "Product separator temperature",
    subtitle: "XMEAS_11 · tep_test run 78 vs normal run 1",
    alt: "XMEAS_11 product separator temperature: Fault 5 run 78 vs normal run 1",
    accent: "blue",
    delay: 0.04,
  },
  {
    src: "/data/fault5/10_xmv_11_run78_vs_normal.png",
    title: "Condenser CW flow",
    subtitle: "XMV_11 (PID) · tep_test run 78 vs normal run 1",
    alt: "XMV_11 rolling mean: Fault 5 run 78 vs normal run 1",
    accent: "amber",
    delay: 0.08,
  },
];

export interface Fault5SensorFiguresProps {
  className?: string;
}

export function Fault5SensorFigures({ className = "" }: Fault5SensorFiguresProps) {
  return (
    <Fault5FigureGrid
      className={className}
      sectionTitle="Fault 5 sensor traces"
      sectionDescription={
        <>
          Condenser CW inlet temperature step (IDV-5) · clean hero run 78 vs nominal run 1 ·
          10-sample rolling mean · injection at sample{" "}
          <span className="font-mono text-orange-300/90">{FAULT5_TEP_ONSET_SAMPLE}</span>
        </>
      }
      figures={FIGURES}
    />
  );
}
