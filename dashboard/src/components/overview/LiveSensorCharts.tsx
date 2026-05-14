"use client";

import { useId, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePlantSimulation } from "@/context/PlantSimulationContext";

const axis = { stroke: "#475569", fontSize: 10, fill: "#94a3b8" };
const grid = { stroke: "#1e293b", strokeOpacity: 0.9 };

const REACTOR = {
  key: "reactor_temp" as const,
  min: 100,
  max: 165,
  label: "Reactor temperature -Xmeas_9",
  unit: "°C",
};
const SEP = {
  key: "separator_pressure" as const,
  min: 2600,
  max: 2800,
  label: "Separator pressure- Xmeas_13",
  unit: "kPa",
};
const FLOW = {
  key: "recycle_flow" as const,
  min: 0.2,
  max: 0.5,
  label: "Recycle flow rate- Xmeas_17",
  unit: "kscmh",
};

type Row = Record<string, number> & { i: number };

function chartRows(
  windowTicks: {
    reactor_temp: number;
    separator_pressure: number;
    recycle_flow: number;
  }[],
): Row[] {
  return windowTicks.map((p, i) => ({
    i,
    [REACTOR.key]: p.reactor_temp,
    [SEP.key]: p.separator_pressure,
    [FLOW.key]: p.recycle_flow,
  }));
}

function seriesOutOfNormal(
  data: Row[],
  key: "reactor_temp" | "separator_pressure" | "recycle_flow",
  min: number,
  max: number,
): boolean {
  return data.some((d) => {
    const v = d[key];
    return v < min || v > max;
  });
}

export interface LiveSensorChartsProps {
  className?: string;
}

export function LiveSensorCharts({ className = "" }: LiveSensorChartsProps) {
  const {
    sensorLoopWindow,
    sensorLoopAnomaly,
    sensorLoopPlainFaultHint,
    sensorLoopReady,
  } = usePlantSimulation();

  const data = useMemo(() => chartRows(sensorLoopWindow), [sensorLoopWindow]);
  const nowIndex = Math.max(0, data.length - 1);

  const warnBg = sensorLoopAnomaly > 0.3 ? "bg-amber-500/[0.07]" : "";
  const highAlert = sensorLoopAnomaly > 0.6;

  const faultPlain =
    sensorLoopPlainFaultHint?.trim() || "Reactor cooling upset";

  const reactorWarn = data.length
    ? seriesOutOfNormal(data, REACTOR.key, REACTOR.min, REACTOR.max)
    : false;
  const sepWarn = data.length
    ? seriesOutOfNormal(data, SEP.key, SEP.min, SEP.max)
    : false;
  const flowWarn = data.length
    ? seriesOutOfNormal(data, FLOW.key, FLOW.min, FLOW.max)
    : false;

  return (
    <div
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] ${warnBg} ${className}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <div>
          <p className="font-[family-name:var(--font-orbitron)] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
            Live plant sensors
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Recorded sequence · three operator-critical traces
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[8px] text-slate-500">
          {!sensorLoopReady ? "Starting…" : "Replay · demo"}
        </span>
      </div>

      {sensorLoopAnomaly > 0.3 ? (
        <div
          className={`mx-3 mt-2 rounded-lg border px-3 py-2 text-[11px] sm:mx-4 ${
            highAlert
              ? "border-red-500/35 bg-red-500/10 text-red-100/95"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100/90"
          }`}
        >
          {highAlert
            ? `Fault signature developing — ${faultPlain}`
            : "AI detecting early deviation — monitoring closely"}
        </div>
      ) : null}

      <div className="grid flex-1 gap-3 p-3 sm:p-4">
        <SensorStrip
          title={REACTOR.label}
          unit={REACTOR.unit}
          data={data}
          dataKey={REACTOR.key}
          yMin={REACTOR.min}
          yMax={REACTOR.max}
          warn={reactorWarn}
          nowIndex={nowIndex}
        />
        <SensorStrip
          title={SEP.label}
          unit={SEP.unit}
          data={data}
          dataKey={SEP.key}
          yMin={SEP.min}
          yMax={SEP.max}
          warn={sepWarn}
          nowIndex={nowIndex}
        />
        <SensorStrip
          title={FLOW.label}
          unit={FLOW.unit}
          data={data}
          dataKey={FLOW.key}
          yMin={FLOW.min}
          yMax={FLOW.max}
          decimals={3}
          warn={flowWarn}
          nowIndex={nowIndex}
        />
      </div>
    </div>
  );
}

function SensorStrip({
  title,
  unit,
  data,
  dataKey,
  yMin,
  yMax,
  warn,
  nowIndex,
  decimals = 1,
}: {
  title: string;
  unit: string;
  data: Row[];
  dataKey: string;
  yMin: number;
  yMax: number;
  warn: boolean;
  nowIndex: number;
  decimals?: number;
}) {
  const stroke = warn ? "#fbbf24" : "#22d3ee";
  const gradId = useId().replace(/:/g, "");

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-black/30 p-2">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          {title}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500">{unit}</span>
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-emerald-200/90">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live · updating
          </span>
        </div>
      </div>
      <div className="h-[120px] min-h-[120px] w-full min-w-0">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[10px] text-slate-600">
            Loading trace…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={110}>
            <LineChart
              data={data}
              margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`g-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...grid} strokeDasharray="3 6" />
              <XAxis dataKey="i" hide />
              <YAxis
                type="number"
                domain={[yMin, yMax]}
                tick={axis}
                width={36}
                tickFormatter={(v) => v.toFixed(decimals)}
              />
              <ReferenceArea
                y1={yMin}
                y2={yMax}
                strokeOpacity={0}
                fill={`url(#g-${gradId})`}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(2,6,23,0.92)",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(v) => [
                  typeof v === "number" ? v.toFixed(decimals) : "—",
                  title,
                ]}
              />
              <ReferenceLine
                x={nowIndex}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{
                  value: "now",
                  position: "top",
                  fill: "#64748b",
                  fontSize: 9,
                }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={stroke}
                strokeWidth={warn ? 2.2 : 1.8}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
