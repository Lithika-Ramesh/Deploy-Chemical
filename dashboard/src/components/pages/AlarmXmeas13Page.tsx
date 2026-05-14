"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Skull,
  Volume2,
} from "lucide-react";
import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassPanel } from "@/components/dashboard/GlassPanel";
import {
  alarmModelFromSeriesJson,
  buildDemoAlarmXmeas13Model,
  ewmaAnimationYDomain,
  TUNING,
  type AlarmXmeas13Point,
  type AlarmXmeas13SeriesJson,
} from "@/lib/alarmXmeas13Model";

const axis = { stroke: "#475569", fontSize: 10, fill: "#94a3b8" };
const grid = { stroke: "#1e293b", strokeOpacity: 0.85 };

/** Matplotlib defaults used in `alarm_management_xmeas13.ipynb` animation (`ax_a`). */
const NB_SEA_GREEN = "#2e8b57";
const NB_MPL_C0 = "#1f77b4";
const NB_CRIMSON = "#dc143c";

const STEP = 4;
const TICK_MS = 100;

type AlarmChartRow = AlarmXmeas13Point & { bandRange: [number, number] };

function blinkAlpha(frame: number): number {
  return 0.25 + 0.75 * (0.5 + 0.5 * Math.sin((2 * Math.PI * frame) / 3));
}

function useAlarmBeepLoop(
  playing: boolean,
  latched: boolean,
  enabled: boolean,
  audioCtxRef: RefObject<AudioContext | null>,
) {
  useEffect(() => {
    if (!playing || !latched || !enabled) return;

    const playOnce = () => {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "closed") return;
      if (ctx.state === "suspended") {
        void ctx.resume();
        return;
      }

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.value = 0.12;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.09);
    };

    playOnce();
    const id = window.setInterval(playOnce, 420);
    return () => window.clearInterval(id);
  }, [playing, latched, enabled, audioCtxRef]);
}

export function AlarmXmeas13Page() {
  const [model, setModel] = useState(() => buildDemoAlarmXmeas13Model());
  const [seriesSource, setSeriesSource] = useState<"demo" | "parquet">("demo");
  const { points, inject, alarm } = model;
  const maxI = points.length - 1;

  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [frame, setFrame] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [gifOk, setGifOk] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartBox, setChartBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    fetch("/data/alarm_xmeas13_series.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((raw: unknown) => {
        if (cancelled || raw == null || typeof raw !== "object") return;
        const next = alarmModelFromSeriesJson(raw as AlarmXmeas13SeriesJson);
        if (!next) return;
        setModel(next);
        setSeriesSource("parquet");
        setPlaying(false);
        setCursor(0);
        setFrame(0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(0, Math.floor(r.width));
      const h = Math.max(0, Math.floor(r.height));
      setChartBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const unlockAudio = useCallback(async () => {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    let ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AC();
      audioCtxRef.current = ctx;
    }
    await ctx.resume();
  }, []);

  const latched = alarm[cursor] === 1;
  const p = points[cursor]!;
  const rocOnly = p.rocPre && !latched;

  useAlarmBeepLoop(playing, latched, soundOn, audioCtxRef);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrame((f) => f + 1);
      setCursor((c) => {
        if (c >= maxI) {
          setPlaying(false);
          return maxI;
        }
        return Math.min(c + STEP, maxI);
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, maxI]);

  const chartYDomain = useMemo(() => ewmaAnimationYDomain(points), [points]);

  const xAxisTicks = useMemo(() => {
    if (maxI <= 0) return [0];
    const segments = 5;
    return Array.from({ length: segments + 1 }, (_, i) =>
      Math.round((maxI * i) / segments),
    );
  }, [maxI]);

  const chartRows = useMemo((): AlarmChartRow[] => {
    const cap = Math.min(cursor + 1, points.length);
    return points.slice(0, cap).map((row) => ({
      ...row,
      bandRange: [row.loPad, row.hiPad],
    }));
  }, [points, cursor]);

  const marker = useMemo(() => {
    const a = blinkAlpha(frame);
    if (latched) {
      return { sample: p.sample, z: p.z, fill: "#ef4444", a };
    }
    if (rocOnly) {
      return { sample: p.sample, z: p.z, fill: "#ea580c", a: a * 0.9 };
    }
    return null;
  }, [frame, latched, rocOnly, p.sample, p.z]);

  const reset = useCallback(() => {
    setPlaying(false);
    setCursor(0);
    setFrame(0);
  }, []);

  const pct = maxI > 0 ? Math.round((cursor / maxI) * 100) : 0;

  const chartSubtitle =
    seriesSource === "parquet"
      ? `Notebook parquet series · Fault 13 · injection sample ${inject} · α=${TUNING.ALPHA_EWMA} · σ×${TUNING.SIGMA_MULT} + tail ramp`
      : `Demo synthesis · Fault 13 · injection sample ${inject} · α=${TUNING.ALPHA_EWMA} · σ×${TUNING.SIGMA_MULT} + tail ramp`;

  return (
    <div className="px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold uppercase tracking-[0.14em] text-slate-100">
            xmeas_13 alarm lab
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Deadband-latched alarm with tail-widened σ band, rate-of-change
            pre-alarm, and
            optional browser beep while latched — same logic as{" "}
            <span className="font-mono text-slate-400">
              alarm_management_xmeas13.ipynb
            </span>
            . The main dashboard still uses its own mock twin; notebook edits do
            not sync automatically.             Run{" "}
            <span className="font-mono text-cyan-200/80">
              python scripts/export_alarm_xmeas13_dashboard.py
            </span>{" "}
            after the notebook cache exists to drop matching series JSON under{" "}
            <span className="font-mono text-cyan-200/80">dashboard/public/data/</span> and copy the GIF from{" "}
            <span className="font-mono text-cyan-200/80">outputs/figures/</span> into{" "}
            <span className="font-mono text-cyan-200/80">dashboard/public/</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              await unlockAudio();
              setPlaying((v) => !v);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-100"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </motion.button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-300"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={async () => {
              await unlockAudio();
              setSoundOn((s) => !s);
            }}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
              soundOn
                ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                : "border-white/10 bg-white/[0.05] text-slate-400"
            }`}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            Beep {soundOn ? "on" : "off"}
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AnimatePresence mode="wait">
          {latched && playing && (
            <motion.div
              key="latched"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-500/45 bg-red-500/15 px-3 py-2 text-red-100 shadow-[0_0_28px_-6px_rgba(239,68,68,0.75)]"
            >
              <Skull className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Latched alarm
              </span>
              <Bell className="h-4 w-4 animate-pulse text-red-200" />
            </motion.div>
          )}
        </AnimatePresence>
        {rocOnly && !latched && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/35 bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-200">
            <Radio className="h-3.5 w-3.5" />
            Rate-of-change pre-alarm (in-band)
          </span>
        )}
        <span className="font-mono text-[11px] text-slate-500">
          sample {cursor} / {maxI} · {pct}%
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={maxI}
        value={cursor}
        onChange={(e) => {
          setCursor(Number(e.target.value));
          setFrame((f) => f + 1);
        }}
        className="mb-6 h-2 w-full max-w-3xl cursor-pointer accent-cyan-400"
      />

      <GlassPanel
        title="EWMA + deadband animation"
        subtitle={chartSubtitle}
        accent="cyan"
        delay={0}
      >
        <div
          ref={chartWrapRef}
          className="h-[380px] w-full min-h-[280px] min-w-0 shrink-0 p-2 sm:p-3"
        >
          {chartBox.w >= 80 && chartBox.h >= 120 ? (
            <ComposedChart
              width={chartBox.w}
              height={chartBox.h}
              data={chartRows}
              margin={{ top: 10, right: 14, left: 4, bottom: 26 }}
            >
              <CartesianGrid strokeDasharray="3 6" {...grid} />
              <XAxis
                dataKey="sample"
                type="number"
                domain={[0, maxI]}
                ticks={xAxisTicks}
                tick={axis}
                tickLine={false}
                label={{
                  value: "Sample",
                  ...axis,
                  position: "insideBottom",
                  offset: -4,
                }}
              />
              <YAxis
                domain={chartYDomain}
                tickFormatter={(v) =>
                  typeof v === "number" && Number.isFinite(v)
                    ? v.toLocaleString("en-US", { maximumFractionDigits: 0 })
                    : ""
                }
                tick={axis}
                tickLine={false}
                width={52}
                label={{
                  value: "EWMA",
                  angle: -90,
                  position: "insideLeft",
                  ...axis,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 10,
                  fontSize: 11,
                }}
                formatter={(value, name) => {
                  if (Array.isArray(value)) {
                    return [`${Number(value[0]).toFixed(1)} … ${Number(value[1]).toFixed(1)}`, String(name)];
                  }
                  return [
                    typeof value === "number" ? value.toFixed(2) : String(value ?? ""),
                    String(name),
                  ];
                }}
              />
              <Area
                type="monotone"
                dataKey="bandRange"
                stroke="none"
                fill={NB_SEA_GREEN}
                fillOpacity={0.12}
                isAnimationActive={false}
                name="Padded σ band"
              />
              <Line
                type="monotone"
                dataKey="loT"
                stroke={NB_SEA_GREEN}
                strokeDasharray="2 3"
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
                name="lo σ"
              />
              <Line
                type="monotone"
                dataKey="hiT"
                stroke={NB_SEA_GREEN}
                strokeDasharray="2 3"
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
                name="hi σ"
              />
              <ReferenceLine
                x={inject}
                stroke={NB_CRIMSON}
                strokeDasharray="5 4"
                strokeWidth={1.2}
                label={{ value: "Inject", fill: "#fb7185", fontSize: 10 }}
              />
              <ReferenceLine
                x={cursor}
                stroke="rgba(115,115,115,0.55)"
                strokeWidth={0.9}
              />
              <Line
                type="monotone"
                dataKey="z"
                stroke={NB_MPL_C0}
                dot={false}
                strokeWidth={1.3}
                isAnimationActive={false}
                name="EWMA (animated)"
              />
              {marker && (
                <ReferenceDot
                  x={marker.sample}
                  y={marker.z}
                  r={11}
                  fill={marker.fill}
                  fillOpacity={marker.a}
                  stroke="#f8fafc"
                  strokeWidth={1}
                />
              )}
            </ComposedChart>
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-white/[0.06] bg-black/30 text-xs text-slate-500">
              Loading chart…
            </div>
          )}
        </div>
      </GlassPanel>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GlassPanel title="Notebook GIF (optional)" subtitle="Place alarm_xmeas13_deadband.gif in /public" accent="blue" delay={0.06}>
          <div className="relative flex min-h-[200px] items-center justify-center rounded-xl border border-white/[0.06] bg-black/40 p-3">
            {gifOk ? (
              // eslint-disable-next-line @next/next/no-img-element -- local GIF from notebook export
              <img
                src="/alarm_xmeas13_deadband.gif"
                alt="Deadband alarm animation from notebook"
                className="max-h-[280px] w-auto rounded-lg opacity-95"
                onError={() => setGifOk(false)}
              />
            ) : (
              <p className="max-w-sm text-center text-xs text-slate-500">
                No GIF found. Run the animation cell in{" "}
                <span className="font-mono text-slate-400">notebooks/alarm_management_xmeas13.ipynb</span>{" "}
                and copy{" "}
                <span className="font-mono text-slate-400">outputs/figures/alarm_xmeas13_deadband.gif</span>{" "}
                to <span className="font-mono text-slate-400">dashboard/public/</span>.
              </p>
            )}
          </div>
        </GlassPanel>
        <GlassPanel title="Tuning snapshot" subtitle="Matches notebook data cell" accent="emerald" delay={0.1}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 font-mono text-[11px] text-slate-400">
            {Object.entries(TUNING).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-white/[0.04] py-1">
                <dt>{k}</dt>
                <dd className="text-cyan-200/90">{String(v)}</dd>
              </div>
            ))}
            <div className="col-span-2 mt-1 text-slate-500">
              Injection sample (loaded model) = {inject}
            </div>
          </dl>
        </GlassPanel>
      </div>
    </div>
  );
}

