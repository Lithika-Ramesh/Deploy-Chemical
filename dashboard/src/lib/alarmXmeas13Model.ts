/**
 * Alarm stack for xmeas_13 (separator pressure) — mirrors the notebook
 * `notebooks/alarm_management_xmeas13.ipynb` setup cell (fault 13, testing split).
 * When no parquet cache exists, `buildDemoAlarmXmeas13Model()` synthesizes a
 * fault-13-like drift so the dashboard still runs.
 */

export const INJECT_SAMPLE_TESTING = 160;

export const TUNING = {
  ALPHA_EWMA: 0.05,
  SIGMA_MULT: 4.5,
  BAND_PAD_KPA: 55,
  DEADBAND_ON: 5,
  DEADBAND_OFF: 32,
  REARM_LOCKOUT: 90,
  MAX_LATCH_SAMPLES: 72,
  ROC_MULT: 3.0,
  HYST_CLEAR_KPA: 28.0,
  TAIL_WIDEN_SIG: 0.35,
} as const;

function ewma(x: Float64Array, alpha: number): Float64Array {
  const z = new Float64Array(x.length);
  z[0] = x[0];
  for (let i = 1; i < x.length; i++) {
    z[i] = alpha * x[i] + (1 - alpha) * z[i - 1];
  }
  return z;
}

/** Deterministic [0,1) hash for cheap pseudo-noise */
function hash01(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Synthesized raw xmeas_13 (kPa) — shape tuned so deadband + ROC fire post-inject */
function synthXmeas13(n: number, inject: number): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v =
      2750 +
      8 * Math.sin(i / 17) +
      4 * Math.cos(i / 31) +
      (hash01(i, 1) - 0.5) * 12;
    if (i >= inject) {
      const k = i - inject;
      v +=
        0.38 * k +
        0.00018 * k * k +
        14 * Math.sin(k / 9) +
        7 * Math.cos(k / 21);
    }
    y[i] = v;
  }
  return y;
}

export function deadbandAlarm(
  breach: boolean[],
  nOn: number,
  nOff: number,
  opts: {
    rearmLockout: number;
    maxLatchSamples: number | null;
    clearOk: boolean[] | null;
  },
): Int8Array {
  const n = breach.length;
  const out = new Int8Array(n);
  let onStreak = 0;
  let offStreak = 0;
  let cur = 0;
  let lockRem = 0;
  let latchSamples = 0;

  for (let i = 0; i < n; i++) {
    const b = breach[i];
    if (cur === 0) {
      const bEff = lockRem > 0 ? false : b;
      if (lockRem > 0) lockRem -= 1;
      onStreak = bEff ? onStreak + 1 : 0;
      if (onStreak >= nOn) {
        cur = 1;
        onStreak = 0;
        offStreak = 0;
        latchSamples = 1;
      }
    } else {
      latchSamples += 1;
      if (opts.maxLatchSamples != null && latchSamples >= opts.maxLatchSamples) {
        cur = 0;
        onStreak = 0;
        offStreak = 0;
        latchSamples = 0;
        lockRem = opts.rearmLockout;
      } else {
        const good =
          opts.clearOk != null ? opts.clearOk[i] : !b;
        offStreak = good ? offStreak + 1 : 0;
        if (offStreak >= nOff) {
          cur = 0;
          onStreak = 0;
          offStreak = 0;
          latchSamples = 0;
          lockRem = opts.rearmLockout;
        }
      }
    }
    out[i] = cur as unknown as number;
  }
  return out;
}

export type AlarmXmeas13Point = {
  sample: number;
  z: number;
  loT: number;
  hiT: number;
  loPad: number;
  hiPad: number;
  alarm: number;
  breach: boolean;
  rocPre: boolean;
};

/** Notebook animation cell: `_ymin, _ymax = nanmin(z)-_zpad, nanmax(z)+_zpad` with `_zpad = 0.04*span`. */
export function ewmaAnimationYDomain(
  pts: readonly Pick<AlarmXmeas13Point, "z">[],
): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of pts) {
    lo = Math.min(lo, row.z);
    hi = Math.max(hi, row.z);
  }
  const span = Math.max(hi - lo, 1e-9);
  const pad = 0.04 * span;
  const ymin = lo - pad;
  const ymax = hi + pad;
  if (!Number.isFinite(ymin) || !Number.isFinite(ymax) || ymin >= ymax) {
    return [2700, 2900];
  }
  return [ymin, ymax];
}

export type AlarmXmeas13Model = {
  inject: number;
  points: AlarmXmeas13Point[];
  /** Full EWMA z (same length as points) */
  z: Float64Array;
  alarm: Int8Array;
};

/** Matches `numpy.std(..., ddof=0)` used in `alarm_management_xmeas13.ipynb`. */
function meanStd(a: Float64Array, mask: boolean[]): { mu: number; sig: number } {
  let s = 0;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    if (mask[i]) {
      s += a[i];
      c++;
    }
  }
  const mu = c ? s / c : 0;
  let v = 0;
  for (let i = 0; i < a.length; i++) {
    if (mask[i]) {
      const d = a[i] - mu;
      v += d * d;
    }
  }
  const sig = c > 0 ? Math.sqrt(v / c) : 0;
  return { mu, sig: sig + 1e-12 };
}

export type AlarmXmeas13SeriesJson = {
  inject: number;
  points: AlarmXmeas13Point[];
};

export function alarmModelFromSeriesJson(
  payload: AlarmXmeas13SeriesJson,
): AlarmXmeas13Model | null {
  if (
    typeof payload.inject !== "number" ||
    !Number.isFinite(payload.inject) ||
    !Array.isArray(payload.points) ||
    payload.points.length === 0
  ) {
    return null;
  }
  const points = payload.points;
  const z = Float64Array.from(points.map((p) => p.z));
  const alarm = Int8Array.from(points.map((p) => p.alarm));
  return { inject: payload.inject, points, z, alarm };
}

export function buildDemoAlarmXmeas13Model(
  n = 960,
  inject = INJECT_SAMPLE_TESTING,
): AlarmXmeas13Model {
  const t = Float64Array.from({ length: n }, (_, i) => i);
  const y = synthXmeas13(n, inject);
  const alpha = TUNING.ALPHA_EWMA;
  const z = ewma(y, alpha);

  const preMask = Array(n).fill(false) as boolean[];
  for (let i = 0; i < n; i++) preMask[i] = t[i] <= inject;

  const { mu: muZ, sig: sigZ } = meanStd(z, preMask);

  const spanTail = Math.max(t[n - 1]! - inject, 1);
  const loT = new Float64Array(n);
  const hiT = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ramp = Math.min(Math.max((t[i]! - inject) / spanTail, 0), 1);
    const sigMultT = TUNING.SIGMA_MULT + TUNING.TAIL_WIDEN_SIG * ramp;
    loT[i] = muZ - sigMultT * sigZ;
    hiT[i] = muZ + sigMultT * sigZ;
  }

  const breach: boolean[] = Array(n);
  const loPad = new Float64Array(n);
  const hiPad = new Float64Array(n);
  const loInner = new Float64Array(n);
  const hiInner = new Float64Array(n);
  const inClearHyst: boolean[] = Array(n);

  const pad = TUNING.BAND_PAD_KPA;
  const hyst = TUNING.HYST_CLEAR_KPA;

  for (let i = 0; i < n; i++) {
    const lo = loT[i]!;
    const hi = hiT[i]!;
    const zv = z[i]!;
    loPad[i] = lo - pad;
    hiPad[i] = hi + pad;
    loInner[i] = loPad[i] + hyst;
    hiInner[i] = hiPad[i] - hyst;
    breach[i] = zv < loPad[i] || zv > hiPad[i];
    inClearHyst[i] = zv >= loInner[i] && zv <= hiInner[i];
  }

  const dz = new Float64Array(n);
  for (let i = 1; i < n; i++) dz[i] = z[i]! - z[i - 1]!;
  const rocAbs = new Float64Array(n);
  for (let i = 0; i < n; i++) rocAbs[i] = Math.abs(dz[i]!);

  const { mu: rocMu, sig: rocSig } = meanStd(rocAbs, preMask);
  const rocThr = rocMu + TUNING.ROC_MULT * rocSig;

  const rocPre: boolean[] = Array(n);
  for (let i = 0; i < n; i++) {
    rocPre[i] = rocAbs[i]! > rocThr && !breach[i];
  }

  const alarm = deadbandAlarm(breach, TUNING.DEADBAND_ON, TUNING.DEADBAND_OFF, {
    rearmLockout: TUNING.REARM_LOCKOUT,
    maxLatchSamples: TUNING.MAX_LATCH_SAMPLES,
    clearOk: inClearHyst,
  });

  const points: AlarmXmeas13Point[] = [];
  for (let i = 0; i < n; i++) {
    const lop = loPad[i]!;
    const hip = hiPad[i]!;
    points.push({
      sample: i,
      z: z[i]!,
      loT: loT[i]!,
      hiT: hiT[i]!,
      loPad: lop,
      hiPad: hip,
      alarm: alarm[i]!,
      breach: breach[i]!,
      rocPre: rocPre[i]!,
    });
  }

  return { inject, points, z, alarm };
}
