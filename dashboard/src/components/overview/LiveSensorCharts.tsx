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
import { SENSOR_LOOP_WINDOW } from "@/lib/sensorLoopTypes";

const axis = { stroke: "#475569", fontSize: 10, fill: "#94a3b8" };
const grid = { stroke: "#1e293b", strokeOpacity: 0.9 };

/** Nominal bands from tep_test Fault 5 run 78 (clean hero), with padding */
const SEP = {
  key: "separator_pressure" as const,
  min: 2540,
  max: 2700,
  label: "Separator pressure — XMEAS_13",
  unit: "kPa",
};
const CW_FLOW = {
  key: "condenser_cw_flow" as const,
  min: 12,
  max: 26,
  label: "Condenser CW flow — XMV_11",
  unit: "%",
};
const CW_OUT = {
  key: "comp_cw_outlet_temp" as const,
  min: 75,
  max: 81,
  label: "Separator cooling water outlet temperature — XMEAS_22",
  unit: "°C",
};

type Row = Record<string, number> & { i: number };

function chartRows(
  windowTicks: {
    separator_pressure: number;
    condenser_cw_flow: number;
    comp_cw_outlet_temp: number;
  }[],
): Row[] {
  return windowTicks.map((p, i) => ({
    i,
    [SEP.key]: p.separator_pressure,
    [CW_FLOW.key]: p.condenser_cw_flow,
    [CW_OUT.key]: p.comp_cw_outlet_temp,
  }));
}

function seriesOutOfNormal(
  data: Row[],
  key: "separator_pressure" | "condenser_cw_flow" | "comp_cw_outlet_temp",
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
    sensorLoopScenarioLabel,
    sensorLoopReady,
  } = usePlantSimulation();

  const data = useMemo(() => chartRows(sensorLoopWindow), [sensorLoopWindow]);
  const nowIndex = Math.max(0, data.length - 1);

  const warnBg = sensorLoopAnomaly > 0.3 ? "bg-amber-500/[0.07]" : "";
  const highAlert = sensorLoopAnomaly > 0.6;

  const faultPlain =
    sensorLoopPlainFaultHint?.trim() ||
    "Condenser cooling water inlet temperature step (IDV-5)";

  const sepWarn = data.length
    ? seriesOutOfNormal(data, SEP.key, SEP.min, SEP.max)
    : false;
  const flowWarn = data.length
    ? seriesOutOfNormal(data, CW_FLOW.key, CW_FLOW.min, CW_FLOW.max)
    : false;
  const outWarn = data.length
    ? seriesOutOfNormal(data, CW_OUT.key, CW_OUT.min, CW_OUT.max)
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
            tep_test run 78 · Fault 5 clean hero replay
          </p>
          {sensorLoopScenarioLabel ? (
            <p className="mt-0.5 text-[9px] text-cyan-500/70">{sensorLoopScenarioLabel}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[8px] text-slate-500">
          {!sensorLoopReady ? "Starting…" : "Live · run 78"}
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
          title={SEP.label}
          unit={SEP.unit}
          data={data}
          dataKey={SEP.key}
          yMin={SEP.min}
          yMax={SEP.max}
          decimals={0}
          yAxisWidth={52}
          warn={sepWarn}
          nowIndex={nowIndex}
        />
        <SensorStrip
          title={CW_FLOW.label}
          unit={CW_FLOW.unit}
          data={data}
          dataKey={CW_FLOW.key}
          yMin={CW_FLOW.min}
          yMax={CW_FLOW.max}
          decimals={2}
          yAxisWidth={40}
          warn={flowWarn}
          nowIndex={nowIndex}
        />
        <SensorStrip
          title={CW_OUT.label}
          unit={CW_OUT.unit}
          data={data}
          dataKey={CW_OUT.key}
          yMin={CW_OUT.min}
          yMax={CW_OUT.max}
          decimals={1}
          yAxisWidth={40}
          warn={outWarn}
          nowIndex={nowIndex}
        />
      </div>
    </div>
  );
}

const CHART_HEIGHT = 132;

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
  yAxisWidth = 44,
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
  yAxisWidth?: number;
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
      <div
        className="w-full min-w-0"
        style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}
      >
        {data.length === 0 ? (
          <div
            className="flex items-center justify-center text-[10px] text-slate-600"
            style={{ height: CHART_HEIGHT }}
          >
            Loading trace…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
            <LineChart
              data={data}
              margin={{
                top: 6,
                right: 8,
                left: yAxisWidth + 4,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id={`g-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...grid} strokeDasharray="3 6" />
              <XAxis
                dataKey="i"
                type="number"
                domain={[0, SENSOR_LOOP_WINDOW - 1]}
                allowDataOverflow
                hide
              />
              <YAxis
                type="number"
                domain={[yMin, yMax]}
                tick={axis}
                width={yAxisWidth}
                tickCount={5}
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