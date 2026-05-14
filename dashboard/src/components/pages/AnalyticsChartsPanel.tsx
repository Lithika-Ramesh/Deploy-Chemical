"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import { plainShapFeatureName } from "@/lib/plainLanguage";
import { usePlantSimulation } from "@/context/PlantSimulationContext";

const axis = { stroke: "#64748b", fontSize: 10, fill: "#94a3b8" };
const grid = { stroke: "#1e293b", strokeOpacity: 0.85 };

export function AnalyticsChartsPanel() {
  const {
    confidenceHistory,
    anomalyHistory,
    shapFeatures,
    faultProbabilities,
  } = usePlantSimulation();

  const trend = useMemo(() => {
    const n = Math.min(
      Math.max(confidenceHistory.length, anomalyHistory.length),
      72,
    );
    if (n === 0) {
      return Array.from({ length: 16 }, (_, i) => ({
        t: i,
        confidence: 92 + Math.sin(i / 3) * 2,
        anomaly: 0.05 + Math.sin(i / 4) * 0.02,
      }));
    }
    const rows = Array.from({ length: n }, (_, i) => ({
      t: i,
      confidence: confidenceHistory[i] ?? confidenceHistory.at(-1) ?? 94,
      anomaly: anomalyHistory[i] ?? anomalyHistory.at(-1) ?? 0.06,
    }));
    if (rows.length < 2) {
      const r = rows[0] ?? { t: 0, confidence: 94, anomaly: 0.06 };
      return [
        { ...r, t: 0 },
        { ...r, t: 1 },
      ];
    }
    return rows;
  }, [confidenceHistory, anomalyHistory]);

  const shapBars = useMemo(
    () =>
      shapFeatures.slice(0, 8).map((s) => ({
        tag: plainShapFeatureName(s.tag),
        shap: Number((s.value * 100).toFixed(1)),
      })),
    [shapFeatures],
  );

  const faultBars = useMemo(
    () => faultProbabilities.slice(0, 7),
    [faultProbabilities],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* <GlassPanel
        title="Model confidence vs. anomaly"
        subtitle="Streaming twin diagnostics (attention-style ranking)"
        accent="blue"
        delay={0}
        className="min-h-[300px]"
      >
        <div className="h-[280px] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} strokeDasharray="3 6" />
              <XAxis dataKey="t" tick={axis} />
              <YAxis yAxisId="l" tick={axis} domain={["auto", "auto"]} width={36} />
              <YAxis
                yAxisId="r"
                orientation="right"
                tick={axis}
                domain={[0, 1]}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(2,6,23,0.94)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Legend />
              <Line
                yAxisId="l"
                type="monotone"
                dataKey="confidence"
                name="Confidence %"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="anomaly"
                name="Anomaly"
                stroke="#fb923c"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      <GlassPanel
        title="Fault class probabilities"
        subtitle="Relative likelihood of each fault family"
        accent="emerald"
        delay={0.05}
        className="min-h-[300px]"
      >
        <div className="h-[280px] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={faultBars}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid {...grid} strokeDasharray="3 6" horizontal={false} />
              <XAxis type="number" tick={axis} domain={[0, 100]} />
              <YAxis
                type="category"
                dataKey="fault"
                width={100}
                tick={{ ...axis, fontSize: 9 }}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(2,6,23,0.94)",
                  border: "1px solid rgba(52,211,153,0.25)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Bar
                dataKey="pct"
                name="%"
                fill="#34d399"
                radius={[0, 6, 6, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel> */}

      <GlassPanel
        title="Feature attention ranking"
        subtitle="Relative contribution to current risk score"
        accent="cyan"
        delay={0.1}
        className="min-h-[300px] lg:col-span-2"
      >
        <div className="h-[280px] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={shapBars}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid {...grid} strokeDasharray="3 6" horizontal={false} />
              <XAxis type="number" tick={axis} />
              <YAxis
                type="category"
                dataKey="tag"
                width={128}
                tick={axis}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(2,6,23,0.94)",
                  border: "1px solid rgba(34,211,238,0.25)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Bar
                dataKey="shap"
                name="Importance ×100"
                fill="#38bdf8"
                radius={[0, 6, 6, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>
    </div>
  );
}
