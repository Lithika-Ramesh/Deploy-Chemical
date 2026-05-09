"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { FAULT_CATALOG } from "@/lib/faultCatalog";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import type { PlantStatus } from "@/lib/types";
import { GlassPanel } from "./GlassPanel";

function elemStroke(
  status: PlantStatus,
  globalFault: boolean,
  localStress: boolean,
): string {
  if (!globalFault) return "#22d3ee";
  if (localStress) {
    if (status === "CRITICAL") return "#ef4444";
    if (status === "WARNING") return "#fb923c";
    return "#f97316";
  }
  return "#475569";
}

function reactorGlowColor(
  status: PlantStatus,
  globalFault: boolean,
  localStress: boolean,
): string {
  if (!globalFault) return "rgba(34, 211, 238, 0.45)";
  if (localStress) {
    if (status === "CRITICAL") return "rgba(248, 113, 113, 0.75)";
    return "rgba(251, 146, 60, 0.55)";
  }
  return "rgba(34, 211, 238, 0.2)";
}

export function ProcessFlowVisual() {
  const { snapshot, simulationRunning, selectedFaultId, emergencyMode } =
    usePlantSimulation();
  const status = snapshot.insight.plantStatus;
  const faultActive = simulationRunning;

  const h = useMemo(
    () => new Set(FAULT_CATALOG[selectedFaultId].visual),
    [selectedFaultId],
  );

  const stressFeed = faultActive && h.has("feed");
  const stressReactor = faultActive && h.has("reactor");
  const stressSep = faultActive && h.has("separator");
  const stressRecycle =
    faultActive && (h.has("recycle") || h.has("compressor"));

  const sFeed = elemStroke(status, faultActive, stressFeed);
  const sReact = elemStroke(status, faultActive, stressReactor);
  const sSep = elemStroke(status, faultActive, stressSep);
  const sRec = elemStroke(status, faultActive, stressRecycle);
  const glow = reactorGlowColor(status, faultActive, stressReactor);

  const flash = faultActive && (emergencyMode || status === "CRITICAL");

  return (
    <GlassPanel
      title="Process topology"
      subtitle="Live digital twin · Tennessee Eastman surrogate"
      accent={faultActive ? "amber" : "cyan"}
      delay={0.05}
      className="min-h-[320px] lg:min-h-[420px]"
    >
      <div className="relative p-3 sm:p-4">
        {faultActive && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-red-500/5 via-transparent to-transparent"
            animate={{ opacity: flash ? [0.35, 0.7, 0.35] : [0.2, 0.45, 0.2] }}
            transition={{ duration: flash ? 0.9 : 2.2, repeat: Infinity }}
          />
        )}
        <svg
          viewBox="0 0 420 480"
          className="h-full w-full max-h-[440px]"
          role="img"
          aria-label="Chemical process flow diagram"
        >
          <defs>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <Tank
            x={40}
            y={36}
            label="Raw A"
            status={status}
            faultActive={faultActive}
            localStress={stressFeed}
          />
          <Tank
            x={40}
            y={150}
            label="Raw B"
            status={status}
            faultActive={faultActive}
            localStress={stressFeed}
          />

          <AnimatedPipe
            d="M 120 70 C 170 70, 170 120, 220 160"
            stroke={sFeed}
            fast={faultActive && stressFeed}
          />
          <AnimatedPipe
            d="M 120 190 C 175 190, 185 175, 220 200"
            stroke={sFeed}
            fast={faultActive && stressFeed}
          />

          <motion.g
            filter="url(#glow)"
            animate={{
              opacity: faultActive && stressReactor ? [0.9, 1, 0.9] : [0.85, 1, 0.85],
            }}
            transition={{
              duration: faultActive && stressReactor ? 1.2 : 3,
              repeat: Infinity,
            }}
          >
            <ellipse
              cx={268}
              cy={210}
              rx={62}
              ry={78}
              fill="rgba(15,23,42,0.85)"
              stroke={sReact}
              strokeWidth={2.5}
            />
            <ellipse
              cx={268}
              cy={210}
              rx={48}
              ry={60}
              fill={glow}
              opacity={0.35}
            />
            <text
              x={268}
              y={205}
              textAnchor="middle"
              className="fill-slate-100 text-[11px] font-semibold"
              style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
            >
              REACTOR
            </text>
            <text
              x={268}
              y={222}
              textAnchor="middle"
              className="fill-slate-400 text-[8px]"
            >
              R-101 · CSTR
            </text>
          </motion.g>

          <SensorNode
            cx={220}
            cy={160}
            label="TIC"
            warn={faultActive && stressReactor}
          />
          <SensorNode
            cx={310}
            cy={175}
            label="PIC"
            warn={faultActive && (stressReactor || stressSep)}
          />

          <AnimatedPipe
            d="M 330 210 C 360 210, 375 250, 375 300"
            stroke={stressSep || stressReactor ? sSep : sReact}
            fast={faultActive && (stressSep || stressReactor)}
          />

          <path
            d="M 300 300 L 380 320 L 360 400 L 280 385 Z"
            fill="rgba(15,23,42,0.9)"
            stroke={sSep}
            strokeWidth={2}
          />
          <text
            x={330}
            y={350}
            textAnchor="middle"
            className="fill-slate-200 text-[10px] font-semibold"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            SEP
          </text>
          <text
            x={330}
            y={365}
            textAnchor="middle"
            className="fill-slate-500 text-[7px]"
          >
            V-204
          </text>

          <SensorNode
            cx={355}
            cy={335}
            label="ΔP"
            warn={faultActive && stressSep}
          />

          <AnimatedPipe
            d="M 330 400 C 330 430, 250 440, 180 420"
            stroke={sSep}
            fast={faultActive && stressSep}
          />
          <AnimatedPipe
            d="M 380 360 L 400 360 L 400 430 L 200 430"
            stroke={sRec}
            fast={faultActive && stressRecycle}
          />

          <Tank
            x={52}
            y={360}
            label="Product"
            narrow
            status={status}
            faultActive={faultActive}
            localStress={stressSep}
          />
          <motion.rect
            x={300}
            y={438}
            width={72}
            height={28}
            rx={6}
            fill="rgba(15,23,42,0.95)"
            stroke={sRec}
            strokeWidth={1.5}
            animate={
              faultActive && stressRecycle
                ? { stroke: ["#f97316", "#ef4444", "#f97316"] }
                : { stroke: sRec }
            }
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <text
            x={336}
            y={455}
            textAnchor="middle"
            className="fill-slate-400 text-[8px]"
          >
            RECYCLE / K-101
          </text>

          <SensorNode
            cx={180}
            cy={418}
            label="FT"
            warn={faultActive && (stressRecycle || stressFeed)}
          />
        </svg>
      </div>
    </GlassPanel>
  );
}

function Tank({
  x,
  y,
  label,
  narrow,
  status,
  faultActive,
  localStress,
}: {
  x: number;
  y: number;
  label: string;
  narrow?: boolean;
  status: PlantStatus;
  faultActive: boolean;
  localStress: boolean;
}) {
  const w = narrow ? 64 : 72;
  const h = narrow ? 70 : 78;
  const stroke = elemStroke(status, faultActive, localStress);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill="rgba(15,23,42,0.92)"
        stroke={stroke}
        strokeWidth={1.8}
      />
      <ellipse
        cx={x + w / 2}
        cy={y + 12}
        rx={w / 2 - 4}
        ry={10}
        fill="rgba(34,211,238,0.12)"
        stroke={stroke}
        strokeWidth={1}
      />
      <text
        x={x + w / 2}
        y={y + 44}
        textAnchor="middle"
        className="fill-slate-200 text-[9px] font-medium"
      >
        {label}
      </text>
      <SensorNode
        cx={x + w - 8}
        cy={y + 28}
        label="L"
        small
        warn={faultActive && localStress}
      />
    </g>
  );
}

function SensorNode({
  cx,
  cy,
  label,
  small,
  warn,
}: {
  cx: number;
  cy: number;
  label: string;
  small?: boolean;
  warn: boolean;
}) {
  const r = small ? 7 : 9;
  return (
    <motion.g
      animate={warn ? { scale: [1, 1.12, 1] } : { scale: [1, 1.04, 1] }}
      transition={{ duration: warn ? 0.9 : 2.2, repeat: Infinity }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r + 4}
        fill={warn ? "rgba(248,113,113,0.25)" : "rgba(34,211,238,0.2)"}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#020617"
        stroke={warn ? "#fb7185" : "#22d3ee"}
        strokeWidth={1.6}
        filter="url(#glow)"
      />
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        className="fill-slate-200"
        style={{ fontSize: small ? 6 : 7 }}
      >
        {label}
      </text>
    </motion.g>
  );
}

function AnimatedPipe({
  d,
  stroke,
  fast,
}: {
  d: string;
  stroke: string;
  fast: boolean;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      strokeWidth={5}
      strokeLinecap="round"
      stroke={stroke}
      opacity={0.5}
      strokeDasharray="14 22"
      initial={{ strokeDashoffset: 0 }}
      animate={{ strokeDashoffset: [0, -144] }}
      transition={{
        duration: fast ? 0.75 : 2.5,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}
