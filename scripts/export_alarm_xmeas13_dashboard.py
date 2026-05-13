#!/usr/bin/env python3
"""Export alarm xmeas_13 series for the Next.js dashboard (optional).

When parquet cache exists (run the data pipeline / notebook setup first), writes:
  dashboard/public/data/alarm_xmeas13_series.json

Always tries to copy (if present):
  outputs/figures/alarm_xmeas13_deadband.gif -> dashboard/public/alarm_xmeas13_deadband.gif

The dashboard ships a TypeScript demo that mirrors the same formulas; this
script replaces it with real fault-13 testing-run data when data are available.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dashboard" / "public" / "data" / "alarm_xmeas13_series.json"
GIF_SRC = ROOT / "outputs" / "figures" / "alarm_xmeas13_deadband.gif"
GIF_DST = ROOT / "dashboard" / "public" / "alarm_xmeas13_deadband.gif"


def copy_notebook_gif() -> None:
    """If the notebook animation cell wrote the GIF, serve it from Next.js /public."""
    import shutil

    if not GIF_SRC.is_file():
        print("GIF not found (optional):", GIF_SRC)
        return
    GIF_DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(GIF_SRC, GIF_DST)
    print("Copied GIF ->", GIF_DST.resolve())


def main() -> int:
    copy_notebook_gif()
    sys.path.insert(0, str(ROOT))
    try:
        from src import config
        from src.data_loader import ensure_parquet_cache, stream_simulation_run
    except ImportError as e:
        print("Skip export:", e)
        return 0

    SENSOR = "xmeas_13"
    FAULT_MAIN = 13
    SPLIT = "testing"
    INJECT = config.FAULT_INJECTION_SAMPLE[SPLIT]

    def first_simulation_run(fault_id: int) -> int:
        paths = ensure_parquet_cache()
        import numpy as np
        import pandas as pd

        meta = pd.read_parquet(
            paths[f"faulty_{SPLIT}"],
            columns=["faultNumber", "simulationRun"],
        )
        u = meta.loc[meta["faultNumber"] == fault_id, "simulationRun"].unique()
        return int(np.sort(u)[0])

    def ewma(x, alpha: float):
        import numpy as np

        z = np.empty_like(x, dtype=float)
        z[0] = x[0]
        for i in range(1, len(x)):
            z[i] = alpha * x[i] + (1.0 - alpha) * z[i - 1]
        return z

    def deadband_alarm(breach, n_on, n_off, **kw):
        import numpy as np

        n = len(breach)
        out = np.zeros(n, dtype=np.int8)
        on_streak = off_streak = 0
        cur = 0
        lock_rem = 0
        latch_samples = 0
        rearm_lockout = int(kw.get("rearm_lockout", 0))
        max_latch = kw.get("max_latch_samples")
        clear_ok = kw.get("clear_ok")
        for i in range(n):
            b = bool(breach[i])
            if cur == 0:
                if lock_rem > 0:
                    lock_rem -= 1
                    b_eff = False
                else:
                    b_eff = b
                on_streak = on_streak + 1 if b_eff else 0
                if on_streak >= n_on:
                    cur = 1
                    on_streak = 0
                    off_streak = 0
                    latch_samples = 1
            else:
                latch_samples += 1
                if max_latch is not None and latch_samples >= max_latch:
                    cur = 0
                    on_streak = 0
                    off_streak = 0
                    latch_samples = 0
                    lock_rem = rearm_lockout
                else:
                    if clear_ok is not None:
                        good = bool(clear_ok[i])
                    else:
                        good = not b
                    off_streak = off_streak + 1 if good else 0
                    if off_streak >= n_off:
                        cur = 0
                        on_streak = 0
                        off_streak = 0
                        latch_samples = 0
                        lock_rem = rearm_lockout
            out[i] = cur
        return out

    import numpy as np

    rid = first_simulation_run(FAULT_MAIN)
    X, meta = stream_simulation_run(
        FAULT_MAIN, split=SPLIT, simulation_run=rid, random_state=0
    )
    t = meta["sample"].to_numpy()
    y = X[SENSOR].to_numpy(dtype=float)

    ALPHA_EWMA = 0.05
    SIGMA_MULT = 4.5
    BAND_PAD_KPA = 55.0
    DEADBAND_ON = 5
    DEADBAND_OFF = 32
    REARM_LOCKOUT = 90
    MAX_LATCH_SAMPLES = 72
    ROC_MULT = 3.0
    HYST_CLEAR_KPA = 28.0
    TAIL_WIDEN_SIG = 0.35

    z = ewma(y, ALPHA_EWMA)
    pre = t <= INJECT
    mu_z = float(np.mean(z[pre]))
    sig_z = float(np.std(z[pre])) + 1e-12
    inject = int(INJECT)
    span_tail = max(float(t.max() - inject), 1.0)
    ramp = np.clip((t.astype(float) - inject) / span_tail, 0.0, 1.0)
    sig_mult_t = SIGMA_MULT + TAIL_WIDEN_SIG * ramp
    hi_t = mu_z + sig_mult_t * sig_z
    lo_t = mu_z - sig_mult_t * sig_z
    breach_ewma = (z < lo_t - BAND_PAD_KPA) | (z > hi_t + BAND_PAD_KPA)
    lo_pad = lo_t - BAND_PAD_KPA
    hi_pad = hi_t + BAND_PAD_KPA
    lo_inner = lo_pad + HYST_CLEAR_KPA
    hi_inner = hi_pad - HYST_CLEAR_KPA
    in_clear_hyst = (z >= lo_inner) & (z <= hi_inner)
    dz = np.zeros_like(z)
    dz[1:] = z[1:] - z[:-1]
    roc_abs = np.abs(dz)
    roc_mu = float(np.mean(roc_abs[pre]))
    roc_sig = float(np.std(roc_abs[pre])) + 1e-12
    roc_thr = roc_mu + ROC_MULT * roc_sig
    pre_alarm_roc = (roc_abs > roc_thr) & (~breach_ewma)
    alarm_db = deadband_alarm(
        breach_ewma,
        n_on=DEADBAND_ON,
        n_off=DEADBAND_OFF,
        rearm_lockout=REARM_LOCKOUT,
        max_latch_samples=MAX_LATCH_SAMPLES,
        clear_ok=in_clear_hyst,
    )

    points = [
        {
            "sample": int(t[i]),
            "z": float(z[i]),
            "loT": float(lo_t[i]),
            "hiT": float(hi_t[i]),
            "loPad": float(lo_pad[i]),
            "hiPad": float(hi_pad[i]),
            "alarm": int(alarm_db[i]),
            "breach": bool(breach_ewma[i]),
            "rocPre": bool(pre_alarm_roc[i]),
        }
        for i in range(len(t))
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "parquet",
        "fault": FAULT_MAIN,
        "split": SPLIT,
        "simulationRun": rid,
        "inject": inject,
        "tuning": {
            "ALPHA_EWMA": ALPHA_EWMA,
            "SIGMA_MULT": SIGMA_MULT,
            "BAND_PAD_KPA": BAND_PAD_KPA,
            "DEADBAND_ON": DEADBAND_ON,
            "DEADBAND_OFF": DEADBAND_OFF,
            "REARM_LOCKOUT": REARM_LOCKOUT,
            "MAX_LATCH_SAMPLES": MAX_LATCH_SAMPLES,
            "ROC_MULT": ROC_MULT,
            "HYST_CLEAR_KPA": HYST_CLEAR_KPA,
            "TAIL_WIDEN_SIG": TAIL_WIDEN_SIG,
        },
        "points": points,
    }
    OUT.write_text(json.dumps(payload), encoding="utf-8")
    print("Wrote", OUT.resolve(), "samples", len(points))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
