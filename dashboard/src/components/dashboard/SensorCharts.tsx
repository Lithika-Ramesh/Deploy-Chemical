"use client";

import { motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePlantSimulation } from "@/context/PlantSimulationContext";
import { GlassPanel } from "./GlassPanel";
import type { SensorPoint } from "@/lib/types";

const axis = { stroke: "#475569", fontSize: 10, fill: "#94a3b8" };
const grid = { stroke: "#1e293b", strokeOpacity: 0.9 };

function buildChartRows(points: SensorPoint[]) {
  return points.map((p, i) => ({
    i,
    reactorTemp: Number(p.reactorTemp.toFixed(2)),
    separatorPressure: Number(p.separatorPressure.toFixed(0)),
    flowRate: Number(p.flowRate.toFixed(2)),
    vibration: Number(p.vibration.toFixed(3)),
    anomalyScore: Number(p.anomalyScore.toFixed(3)),
  }));
}

export function SensorCharts() {
  const { history, snapshot, simulationRunning } = usePlantSimulation();
  const data = useMemo(() => {
    const pts =
      history.length > 0 ? history : [snapshot.sensors, snapshot.sensors];
    return buildChartRows(pts);
  }, [history, snapshot.sensors]);

  return (
    <GlassPanel
      title="Live sensor analytics"
      subtitle="Simulated historian stream · anomaly-aware overlays"
      accent="emerald"
      delay={0.12}
    >
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Reactor temperature"
          unit="°C"
          fault={simulationRunning}
          delay={0}
        >
          <MiniLine
            data={data}
            dataKey="reactorTemp"
            color="#22d3ee"
            fault={simulationRunning}
          />
        </ChartCard>
        <ChartCard
          title="Separator pressure"
          unit="kPa"
          fault={simulationRunning}
          delay={0.04}
        >
          <MiniLine
            data={data}
            dataKey="separatorPressure"
            color="#38bdf8"
            fault={simulationRunning}
          />
        </ChartCard>
        <ChartCard
          title="Flow rate"
          unit="kg/s"
          fault={simulationRunning}
          delay={0.08}
        >
          <MiniLine
            data={data}
            dataKey="flowRate"
            color="#34d399"
            fault={simulationRunning}
          />
        </ChartCard>
        <ChartCard
          title="Vibration"
          unit="g"
          fault={simulationRunning}
          delay={0.12}
        >
          <MiniLine
            data={data}
            dataKey="vibration"
            color="#a78bfa"
            fault={simulationRunning}
          />
        </ChartCard>
        <ChartCard
          title="Anomaly score"
          unit="σ̂"
          fault={simulationRunning}
          delay={0.16}
          className="sm:col-span-2 xl:col-span-2"
        >
          <AnomalyChart data={data} fault={simulationRunning} />
        </ChartCard>
      </div>
    </GlassPanel>
  );
}

function ChartCard({
  title,
  unit,
  fault,
  delay,
  className = "",
  children,
}: {
  title: string;
  unit: string;
  fault: boolean;
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`rounded-xl border border-white/[0.06] bg-black/30 p-2 shadow-[0_0_40px_-20px_rgba(34,211,238,0.5)] ${className}`}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          {title}
        </p>
        <span className="text-[9px] text-slate-500">{unit}</span>
      </div>
      <div
        className={`h-[132px] w-full rounded-lg ${
          fault ? "ring-1 ring-orange-500/30" : ""
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}

function MiniLine({
  data,
  dataKey,
  color,
  fault,
}: {
  data: ReturnType<typeof buildChartRows>;
  dataKey: string;
  color: string;
  fault: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid {...grid} strokeDasharray="3 6" />
        <XAxis dataKey="i" hide />
        <YAxis tick={axis} width={36} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            background: "rgba(2,6,23,0.92)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 8,
            fontSize: 11,
          }}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={fault ? 2.4 : 1.8}
          dot={false}
          isAnimationActive
          animationDuration={400}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AnomalyChart({
  data,
  fault,
}: {
  data: ReturnType<typeof buildChartRows>;
  fault: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="anomFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...grid} strokeDasharray="3 6" />
        <XAxis dataKey="i" hide />
        <YAxis tick={axis} width={36} domain={[0, "auto"]} />
        <Tooltip
          contentStyle={{
            background: "rgba(2,6,23,0.92)",
            border: "1px solid rgba(251,146,60,0.35)",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
        <ReferenceLine
          y={0.45}
          stroke={fault ? "#fb7185" : "#64748b"}
          strokeDasharray="4 4"
        />
        <Area
          type="monotone"
          dataKey="anomalyScore"
          stroke="#fb923c"
          fill="url(#anomFill)"
          strokeWidth={2}
          isAnimationActive
          animationDuration={400}
        />
        <Line
          type="monotone"
          dataKey="anomalyScore"
          stroke="#fbbf24"
          strokeWidth={1.2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
